---
name: Functional testing
description: Use whenever writing, running, extending or debugging tests in this repo — especially DB-backed functional tests. Covers the three test layers, the Postgres/`database_test` setup, `tests/support` (app bootstrap, schema reset, truncation, fixtures), when to add a fixture that writes directly, the DTO-bounds reproduction trap, concurrency tests synchronized on real locks, and the checklist before opening a test PR. Trigger on "agregá un test", "el functional falla", "test flaky", "concurrencia", "fixture", "database_test", "reset", or any bug that needs a regression test.
---

# Functional testing

**Hard rules**

1. DB-backed behavior belongs in **functional**, never in unit or e2e.
2. Reproduce before fixing. A regression test must fail before the fix and pass
   after it. If it passes before, the diagnosis is wrong.
3. Assert the **database state**, not only the HTTP response. The API can lie.
4. Concurrency tests synchronize on real database locks, never on `sleep`.
5. `yarn test` and `yarn test:e2e` stay database-free.

## 1. Layers

| Layer | Path | Command | Uses |
|---|---|---|---|
| Unit | `tests/unit/*.spec.ts` | `yarn test` | mocks, no database |
| E2E | `tests/integration/*.e2e-spec.ts` | `yarn test:e2e` | real controllers, pipes, filters and interceptors; mocked services; no database |
| Functional | `tests/functional/*.functional-spec.ts` | `yarn test:functional` | real `AppModule` + Postgres (`database_test`) |

`scripts/check.sh` is the DB-free gate (typecheck, lint, build, unit, e2e).
`yarn check:full` runs it plus the functional suite: it starts Postgres if
needed, ensures `database_test`, and stops the container only if it started it.
Run `check:full` before opening a PR.

If a test can prove the bug without a database, put it in unit or e2e. Use
functional only when the behavior depends on SQL, transactions, locks,
constraints or Sequelize scopes.

## 2. Prerequisites

- Postgres reachable at `localhost:5432`, user/password `postgres`, with a
  `database_test` database. The local container is `postgres_db`.
- `tests/setup-functional.ts` forces `DB_NAME=database_test` so a `.env` file
  cannot point the suite at the development database.
- The functional config uses `maxWorkers: 1`. Do not parallelize: every spec
  truncates the same tables.
- `resetSchema` builds tables with `sequelize.sync({ force: true })`, not with
  the migrations. This keeps the harness independent of migration state;
  migrations are exercised separately by the docker entrypoint.

## 3. Harness

| File | Responsibility |
|---|---|
| `tests/support/test-app.ts` | Boots the real `AppModule` with the same `ValidationPipe`, `HttpExceptionFilter` and `TransformInterceptor` as `main.ts`. Returns `{ app, sequelize }`. Logging is disabled. |
| `tests/support/test-database.ts` | `resetSchema(sequelize)` drops and recreates `public`; `truncateAll(sequelize)` truncates the four tables and restarts identities. |
| `tests/support/fixtures.ts` | Builders for users, cash, instruments, market data and orders. |
| `tests/jest-functional.json` | Test regex, ts-jest transform, `maxWorkers: 1`. |
| `tests/setup-functional.ts` | Forces the `database_test` connection env vars. |

## 4. Spec skeleton

```ts
describe('Feature (functional, real database)', () => {
  let app: INestApplication;
  let sequelize: Sequelize;
  let baseline: Baseline;

  beforeAll(async () => {
    ({ app, sequelize } = await createTestApp());
    await resetSchema(sequelize);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(sequelize);
    baseline = await seedBaseline(app);
  });
});
```

- Drive HTTP through `request(app.getHttpServer())`.
- Assert status, the public envelope and the row in the database.
- The public error body is always
  `{ statusCode, data: "The request could not be completed.", timestamp }`.
  Exception messages are logged, not returned; do not assert on them.
- To create a state the API cannot produce (for example a FILLED BUY on an
  instrument without market data), use a fixture that writes through the model.
  Do not reach for raw SQL in the spec.

## 5. Fixtures

| Helper | What it creates |
|---|---|
| `seedBaseline(app, options?)` | ARS instrument, AAPL with one `marketdata` row, Alice with `cash`, Bob idle. Options: `cash`, `price`, `previousClose`. |
| `createUser(app, email)` | A user with no orders. |
| `createUserWithCash(app, email, cash, arsInstrumentId)` | A user plus a FILLED `CASH_IN`. |
| `createInstrumentWithoutMarketData(app, ticker?)` | A stock with no `marketdata` rows. |
| `createFilledOrder(app, params)` | A FILLED BUY/SELL written directly, bypassing the market-data checks and the funds check. |

Add a fixture when a test needs a state that the public API rejects or cannot
express. Keep the fixture explicit and typed; extend `BaselineOptions` instead
of re-seeding with raw SQL.

## 6. Regression recipe and traps

1. Write the test at the lowest layer that can see the bug.
2. Run it alone and capture `expected` vs `received`.
3. Fix the code.
4. Re-run the test, then the full suite.

Traps that have already cost time:

- **DTO bounds hide the service.** A test using `userId: 999999999` returned
  400 from `@Max(999999)` and never reached the 500 caused by the foreign key
  (#12). If an HTTP test returns 400, check the DTO first and use an in-range
  but non-existent id such as `999999`.
- **Response-only assertions miss writes.** A rejected order still inserts a
  row; assert `orders.status`, not just the JSON.
- **Paranoid models.** `destroy()` sets `deletedAt`; `findByPk` and the raw SQL
  aggregates exclude those rows. Cover the soft-deleted case explicitly when
  the behavior involves deletion.
- **Lint and typed bodies.** Cast `response.body` to a local interface instead
  of `expect.any(...)` inside `toEqual`; `no-unsafe-assignment` fails otherwise.

## 7. Concurrency

- Open real overlapping transactions and synchronize on a database lock.
  Patterns already in the repo:
  - poll `pg_stat_activity` until the competing transaction is waiting
    (`orders-cancel-race.functional-spec.ts`);
  - `FOR UPDATE` / advisory locks (`orders-concurrency.functional-spec.ts`).
- Never use a bare `sleep` to "make the race happen".
- Assert the final database state and the invariant (for example, exactly one
  of cancel/fill wins), not only the two HTTP responses.
- If a concurrency test is flaky, fix the synchronization, do not add retries.

## 8. Checklist before opening a test PR

- [ ] The test failed before the fix and passes after it.
- [ ] It asserts database state where the behavior writes.
- [ ] Fixtures are reused or extended; no ad-hoc SQL in the spec.
- [ ] No dependency on another test: `truncateAll` runs in `beforeEach`.
- [ ] `yarn test:functional` passes together with `tsc`, `lint`, `yarn test`
      and `yarn test:e2e`.
- [ ] The issue and PR mention the before/after failure and the exact commands.

## 9. Keep this skill current

When the harness changes — new fixture, new config, a trap that costs time —
update this file in the same PR that changes the harness.

## Changelog

- 2026-11-13 — created after #12 (DTO-bound trap), #13/#14/#15 (decision
  tests), and the concurrency suite. Extracted the functional detail out of
  `gap-to-ticket`.
- 2026-11-13 — `yarn check:full` runs the DB-free gate plus the functional
  suite and manages the Postgres container (#28).
