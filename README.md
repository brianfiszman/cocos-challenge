# Cocos Challenge - Trading API

A NestJS + PostgreSQL + Sequelize backend for a simple trading system. Users can manage a cash balance, search financial instruments, place stock orders (BUY/SELL), and view their portfolio.

## Quick Start

```bash
docker compose up -d --build
```

That is. The entrypoint (`scripts/entrypoint.sh`) inside the container handles everything automatically:

1. Waits for PostgreSQL to be healthy
2. Applies migrations (`npx sequelize-cli db:migrate`) — idempotent, skips already-applied migrations
3. Runs all seeders (`npx sequelize-cli db:seed:all`) — idempotent; each seeder checks if data already exists and skips if so
4. Starts the app in watch mode (`yarn start:dev`)

API: `http://localhost:3000`

## API Overview

All responses are wrapped in a standardized envelope by `TransformInterceptor`:

```json
{
  "statusCode": 200,
  "data": { /* response payload */ },
  "timestamp": "2026-09-17T20:30:00.000Z"
}
```

Validation errors and exceptions return a generic message (full details stay in server logs):

```json
{
  "statusCode": 400,
  "data": "The request could not be completed.",
  "timestamp": "2026-09-17T20:30:00.000Z"
}
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/portfolio/:userId` | Get user's portfolio: total value, available cash, and positions |
| `GET` | `/assets?q=<query>` | Search instruments by ticker or name |
| `POST` | `/orders` | Place an order (BUY, SELL, CASH_IN, CASH_OUT) |
| `PATCH` | `/orders/:id/cancel` | Cancel a NEW order |

### Order Placement (`POST /orders`)

Request body (`CreateOrderDto`):

```json
{
  "userId": 1,
  "side": "BUY",
  "instrumentId": 1,
  "size": 5,
  "price": 190,
  "type": "MARKET"
}
```

- `side`: `BUY`, `SELL`, `CASH_IN`, or `CASH_OUT`
- `type`: `MARKET` (default) or `LIMIT`
- `size`: exact number of shares (positive integer for BUY/SELL, decimal for CASH_IN/CASH_OUT)
- `amount`: alternative to `size` for BUY/SELL - converts to whole shares via `floor(amount / executionPrice)`
- `price`: required for LIMIT orders

**Order flow:**
- `MARKET` BUY fills immediately at the latest close price; rejected if insufficient cash.
- `MARKET` SELL fills immediately if the user has sufficient position; rejected otherwise.
- `LIMIT` orders are created as `NEW` after validating cash (BUY) or position (SELL). Pending LIMIT orders do not reserve funds or positions — validation happens at placement time only.
- `CASH_IN` adds funds (modeled with an ARS instrument, ticker `ARS`, type `MONEDA`); `CASH_OUT` deducts funds (rejected if insufficient balance).
- Exactly one of `size` or `amount` is required for BUY/SELL orders (not both).
- `size` must be a positive integer for BUY/SELL orders.
- Infrastructure errors (DB failures, etc.) return HTTP 500, not `REJECTED`.

Response (201):

```json
{
  "statusCode": 201,
  "data": { "id": 6, "status": "FILLED", "datetime": "2026-09-17T20:30:00.000Z" },
  "timestamp": "2026-09-17T20:30:00.000Z"
}
```

`status` is one of: `NEW`, `FILLED`, `REJECTED`, `CANCELLED`.

### Cancel Order (`PATCH /orders/:id/cancel`)

Only orders with status `NEW` can be cancelled.

```json
{
  "statusCode": 200,
  "data": { "cancelled": true },
  "timestamp": "2026-09-17T20:30:00.000Z"
}
```

### Portfolio (`GET /portfolio/:userId`)

```json
{
  "statusCode": 200,
  "data": {
    "totalValue": -31.4,
    "availableCash": -1852,
    "positions": [
      {
        "instrumentId": 1,
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "size": 10,
        "value": 1820.6,
        "returnPct": -0.017
      }
    ]
  },
  "timestamp": "2026-09-17T20:30:00.000Z"
}
```

Cash reflects all FILLED orders: `CASH_IN - CASH_OUT - BUY cost + SELL proceeds`. `returnPct` is based on cost basis: the average buy price (`avgCost = totalBuyCost / totalBuySize`) vs current market value (`returnPct = (value - avgCost) / avgCost`).

### Asset Search (`GET /assets?q=<query>`)

Returns up to 50 instruments matching the query in `ticker` or `name` (case-insensitive).

```json
{
  "statusCode": 200,
  "data": [
    { "id": "1", "ticker": "AAPL", "name": "Apple Inc.", "type": "stock" }
  ],
  "timestamp": "2026-09-17T20:30:00.000Z"
}
```

`id` is returned as a string due to Sequelize `BIGINT` handling.

## Testing

```bash
# Unit tests (mocked services)
yarn test

# E2E tests (mocked services, tests controllers/interceptors/filters)
yarn test:e2e

# Full verification suite (typecheck + lint + build + unit + e2e)
./scripts/check.sh
```

## Docker

The Docker setup uses a bind-mount approach for fast development:

- **`postgres_db`**: PostgreSQL 16; `init.sh` creates databases on first start.
- **`app`**: NestJS in watch mode (`yarn start:dev`); source is mounted read-only so edits hot-reload instantly.
   - **`scripts/entrypoint.sh`**: Waits for DB, runs migrations (idempotent), runs seeders (each checks if data exists and skips), then starts the app.
- **`scripts/db-check.js`**: Healthcheck / migration-guard helper.

**Manual migrations & seeders** (e.g., after adding new migration files):

```bash
docker exec nest_app npx sequelize-cli db:migrate
docker exec nest_app npx sequelize-cli db:seed:all
```

To reset the database volume (useful if migrations and data are out of sync):

```bash
docker compose down -v
docker compose up -d --build
```

## Project Structure

```
src/
  app.module.ts        # Root module
  main.ts              # Bootstrap (pipes, filters, interceptors)
  models/              # Sequelize models (User, Instrument, Order, MarketData)
  database/            # Sequelize config + module
  common/
    dto/response.dto.ts         # Envelope ResponseDto
    exceptions/http-exception.filter.ts
    interceptors/               # TransformInterceptor, LoggingInterceptor
  modules/
    orders/        # Order placement + cancellation
    users/         # Portfolio & user model
    market-data/   # Instrument search
migrations/        # Sequelize migrations (JS)
seeders/           # Seed data (JS)
scripts/           # check.sh, entrypoint.sh, db-check.js
tests/             # Unit + integration tests (Jest)
postman/           # Postman collection with request/response examples
```

## API Examples

A pre-configured Postman collection with example requests and responses is available at [`postman/cocos-challenge.postman_collection.json`](postman/cocos-challenge.postman_collection.json). Import it into Postman or use the built-in `{{baseUrl}}` variable (`http://localhost:3000`).

### Seed Data

On first start, the following data is seeded:

- **Users**: alice (user 1), bob (user 2), carol (user 3), dave (user 4), erin (user 5)
- **Instruments**: AAPL (stock), MSFT (stock), GOOGL (stock), BTCUSD (crypto), ETHUSD (crypto), ARS (MONEDA)
- **Orders** (6 seed orders):
  - User 1: CASH_IN 10000 ARS (FILLED), BUY 10 AAPL @ 185.2 (FILLED)
  - User 2: SELL 5 MSFT @ 410.75 (FILLED)
  - User 3: BUY 2 GOOGL @ 175.5 (NEW)
  - User 4: BUY 0.5 BTCUSD @ 63500 (FILLED)
  - User 5: SELL 1.5 ETHUSD @ 3450 (CANCELLED)

User 1 starts with 10,000 ARS cash and 10 AAPL shares for easy testing.