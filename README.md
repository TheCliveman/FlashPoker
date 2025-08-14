# Poker Club Starter (Android + Node server)

- **Server**: Node + Express + ws, now with **blind levels** and **UTG/UTG_DOUBLE straddles (simplified)**.
- **Android**: Compose app to connect and test.

## Local dev
See `server/README.md` for API flow, then run the Android app from `/android` (use WS `ws://10.0.2.2:8080/ws`).

## One‑click deploy (Render)
Push this repository to GitHub, then in Render choose **New + → Blueprint**, select your repo (uses `server/render.yaml`). After it builds, your service URL will respond on `/health`.