---
name: Gap to ticket
description: MANDATORY workflow for this repo. Use at the START of every task — before editing any file, before proposing a fix, and whenever the user says "revisá", "arreglá", "hay un bug", "compará con la spec", "no anda", or asks for a review. Enforces the order: read the challenge spec → audit the repo → open one GitHub issue per gap → only then write code, test-first. Also use it mid-task when a new finding appears, and before claiming something is fixed without an issue number. For pushing, opening or merging PRs, load `stacked-prs` after this one.
---

# Gap → ticket → code

**Hard rule: no code until every gap has an issue.** This is not bureaucracy. An
agent has no memory between sessions; the user should not have to carry the list
of known gaps in their head. If a gap is not a ticket, it will be lost.

This rule exists because it was violated: an audit produced a backlog, and
implementation started in parallel anyway. The backlog then became stale within
minutes. Do not repeat it.

## Hard rules

1. **No code without a ticket.** If a finding appears mid-task, stop and create
   the issue before touching the code. If the task is already a ticket, work on
   that issue.
2. **No fix without a failing test.** Reproduce first, then implement. A test
   that does not fail before the fix is not a regression test.
3. **Tokens are per-command.** Never `export GH_TOKEN` globally, never write a
   token to a file, and never embed one in a git remote.
   - Repo operations: `GH_PERSONAL_TOKEN`.
   - Project operations: `GH_PERSONAL_TOKEN_CLASSIC` (the only token with the
     `project` scope).
   - Never use the classic token for repo operations. If a token appears in
     chat, tell the user to revoke it.
4. **Merging needs explicit approval.** The ticket is permission to implement,
   not to merge. Load `stacked-prs` and wait for the user's go-ahead.
5. **No invented numbers.** Read paths degrade explicitly: `null` plus a flag,
   excluded from aggregates. Write paths fail fast: 4xx before the INSERT, never
   a 500 from a constraint. If a metric cannot be computed, return `null`; never
   pretend it is `0`.

## 0. Read the board first

Before anything else, load the current state. It is cheaper than rediscovering it.

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh issue list -R brianfiszman/cocos-challenge --state open --limit 200 \
    --json number,title,milestone,labels \
    --jq ".[] | \"#\(.number) [\(.milestone.title)] [\(.labels | map(.name) | join(\", \"))] \(.title)\""'
```

- If the task is already an issue, work on that issue. Do not create a duplicate.
- If the task contradicts an open issue, update the issue instead of opening a new one.

## 1. Read the spec

Source of truth: **https://github.com/cocoscap/cocos-challenge/blob/main/backend-challenge.md**

Read the whole thing. The relevant sections are "Resumen", "Consideraciones
funcionales" and "Consideraciones técnicas". Treat explicit lines as
requirements even when they look like an aside (e.g. `previousClose` for the
daily return).

## 2. Audit the repo against it

For every requirement, record: met / partially met / not met / ambiguous. Pull
evidence, not impressions: `file:line`, the SQL that runs, the response shape.
`grep` is your friend; open the file and read the surrounding code.

## 3. What counts as a gap

Open a ticket for each of these, and only these:

- **spec-gap** — an explicit requirement that is not met, or an ambiguity that
  needs a documented decision.
- **bug** — behavior that is incorrect even if the spec is silent (races,
  silent fallbacks, 500s that should be 4xx, soft-delete leaks).
- **test** — a required behavior with no test that actually executes it.
- **chore** — migrations, seeds, CI, tooling, data consistency.
- **docs** — a decision that exists only in someone's head.
- **feat** — capabilities the project explicitly wants (see the outbox
  milestone), not speculative nice-to-haves.

Not a gap: style preferences with no behavioral consequence, and anything you
cannot point at with a `file:line`.

## 4. Deduplicate before creating

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  gh issue list -R brianfiszman/cocos-challenge --state all --limit 300 --json number,title'
```

Search by keyword, not by exact title. A closed issue may already cover it; in
that case reopen or reference it instead of duplicating.

## 5. Create the ticket

Conventions:

- **Labels**: `type: bug | spec-gap | test | feat | chore | docs` and
  `prio: high | medium | low`.
- **Milestones**: use the phase, not the label:

  | Milestone | Use for |
  |---|---|
  | `M0 — Test infrastructure` | harness, CI, docs about testing |
  | `M1 — Spec compliance` | explicit spec requirements/ambiguities: `previousClose`, `returnPct`, asset search, cash-transfer fields |
  | `M2 — Correctness` | races, error semantics, soft deletes, migration/seed integrity, API consistency, perf |
  | `M3 — Outbox + Kafka` | outbox, relay, consumer, broker, ADRs |

- **Title**: conventional-commit style, e.g. `fix(orders): make cancelOrder atomic`.

Body template:

```markdown
**Context**
What is wrong, in two or three sentences. Why it matters.

**Evidence**
- `path/to/file.ts:42`

**Reproduction** (bugs only)
- Command and observed `expected` / `received`.

**Acceptance criteria**
- [ ] Verifiable statement, not an intention.
- [ ] Test that proves it (if applicable).
```

Create with the repo-scoped token:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN";
  printf "%s" "$BODY" | gh issue create -R brianfiszman/cocos-challenge \
    --title "..." --body-file - --label "type: bug" --label "prio: high" \
    --milestone "M2 — Correctness"'
```

Add it to the board (project **5**, owner `brianfiszman`) with the classic token:

```sh
zsh -c 'source ~/.zshrc >/dev/null 2>&1; export GH_TOKEN="$GH_PERSONAL_TOKEN_CLASSIC";
  gh project item-add 5 --owner brianfiszman --url <issue-url>;
  gh project item-edit 5 --owner brianfiszman --url <issue-url> \
    --field "Status" --value "In Progress"'
```

## 6. Implement test-first

1. **Branch**: `type/N-slug`, e.g. `fix/9-cancel-order-atomic`.
2. **Write the test** that proves the gap, at the lowest layer that can see it
   (see §8).
3. **Run it alone** and capture the failure (`expected` vs `received`). If it
   passes, stop: the diagnosis is wrong or the test is not exercising the path.
   Update the issue. If an HTTP test returns 400, check the DTO bounds first: an
   out-of-range id never reaches the service and hides the real failure (see
   `functional-testing`).
4. **Implement the smallest fix** that makes it pass.
5. **Flip any `it.failing`** in the same commit that fixes the bug.
6. **Run the gates**: `npx tsc --noEmit`, `yarn lint`, `yarn test`,
   `yarn test:e2e`, and `yarn test:functional` when SQL or DB behavior changed.
   `yarn check:full` runs all of them in one shot, including the functional
   suite (it starts and stops Postgres as needed).
7. **Commit**: `type(scope): summary`; the body explains the failure and the fix
   and ends with `Closes #N`.

### Decision tickets

When the acceptance criterion is "decide and document" (unit of a metric,
behavior for an edge case, an explicit degradation), the decision lives in
three places:

1. the README or the decision log, as the contract;
2. an issue comment explaining the alternative that was rejected and why;
3. a test that fixes the chosen convention, so a later change fails loudly.

A decision that exists only in the issue comment is not implemented.

## 7. Definition of Done

- [ ] Every acceptance criterion is checked in the issue body.
- [ ] Evidence comment with before/after, exact commands and results.
- [ ] All gates above pass.
- [ ] Commit ends with `Closes #N`; `it.failing` flipped if applicable.
- [ ] PR opened following `stacked-prs`.
- [ ] The issue closes when the change lands on `main` (GitHub closes it through
      `Closes #N` for a PR merged into the default branch). If the PR was merged
      into a stacked base, close it manually after the stack lands on `main`.
      If you close it by hand, do it only after the merge.
- [ ] Board: `In Progress` while working, `Done` when closed. Verify, do not assume.

## 8. Testing layers

| Layer | Path | Command | Uses |
|---|---|---|---|
| Unit | `tests/unit/*.spec.ts` | `yarn test` | mocks, no database |
| E2E | `tests/integration/*.e2e-spec.ts` | `yarn test:e2e` | real controllers, pipes, filters and interceptors; mocked services; no database |
| Functional | `tests/functional/*.functional-spec.ts` | `yarn test:functional` | real `AppModule` + Postgres (`database_test`) |

- DB-backed behavior belongs in **functional**, never in e2e: `test:e2e` (and
  `scripts/check.sh`) must stay database-free.
- Reproduce before fixing. A test that does not fail before the fix is not a
  regression test.
- Harness setup, fixtures, concurrency recipes, the DTO-bounds trap and the PR
  checklist live in the `functional-testing` skill. Load it before writing a
  DB-backed test.

## 9. Keep this skill current

When the process changes — new milestone, new label, a convention that stops
working — edit this file in the same PR that changes the process. The skill is
part of the codebase, not a note.

## Changelog

- 2026-11-12 — created after the backlog/implementation race. Defines the
  mandatory order and the issue conventions.
- 2026-11-12 — added the hard token rule, the test-first loop, Definition of
  Done, board lifecycle, testing layers and the explicit milestone map. PR
  workflow moved to `stacked-prs`.
- 2026-11-13 — added the no-invented-numbers principle, the DTO-bounds trap in
  the test-first loop and the decision-ticket protocol. Harness detail moved to
  `functional-testing`.
- 2026-11-13 — gates can run in one shot with `yarn check:full` (#28).
