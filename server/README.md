# Poker Club — Minimal Server (Starter)

This is a **demo** server to get the Android client running end‑to‑end. It supports:
- Demo login (`demo` / `password`)
- Create table, join by invite token, buy‑in
- Start NLHE hand with **blind levels** and **UTG / UTG_DOUBLE straddles** (simplified)
- WebSocket snapshots

## Run locally
```bash
cd server
npm install
npm start
```
Healthcheck: `http://localhost:8080/health`

### Example flow
1) Login and get `user.id`
2) `POST /tables` with `{ ownerId, name, straddleMode: "UTG" | "UTG_DOUBLE" | "NONE", blindLevels: [{sb,bb,durationSec}] }`
3) Join with invite token, buy in
4) Connect WS: `ws://localhost:8080/ws?tableId=<ID>&userId=<UID>`
5) Send `{ "type":"ACTION","action":"START_HAND" }`

---

## One‑click deploy (Render)

1. Push this repo to your GitHub account.
2. In Render, choose **New +** → **Blueprint** and point it at this repo. It uses `render.yaml` to configure the web service.
3. After deploy, open the service URL and hit `/health` to verify.


### Pot-Limit validation
This server enforces **POT LIMIT** sizing when you create a table with `variant: "PLO"` or `variant: "PLO8"`.
- When no bet is outstanding (**BET**), max = current **pot size**.
- When facing a bet (**RAISE**), max additional over your call = **pot after calling** (`potSize + need`).

Create a PLO/PLO8 table:
```bash
curl -X POST http://localhost:8080/tables \
 -H 'content-type: application/json' \
 -d '{ "ownerId":"<USER_ID>", "name":"PLO Test", "variant":"PLO", "straddleMode":"UTG", "blindLevels":[{"sb":1,"bb":2,"durationSec":1800}] }'
```


## Persistence
- Postgres schema in `server/db/schema.sql`
- Configure `DATABASE_URL` (defaults to `postgres://postgres:postgres@localhost:5432/pokerclub`)
- Start DB locally: `docker compose up -d db`, then the server auto-initializes schema on boot.
- The server persists: users (chips), tables (metadata), players (seats, stacks), and full table state (JSON).
- On restart, tables are **restored**, including in-progress hands (board/pots/deck/toAct).
