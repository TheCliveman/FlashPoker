# Poker Club — Production Ship Kit

## One-command server deploy (TLS, DB, Redis)
1. Point a DNS record (A/AAAA) to your VM/IP: `DOMAIN=your.domain.com`
2. On the VM:
   ```bash
   git clone <your-fork> && cd poker-club-starter
   export DOMAIN=your.domain.com
   export EMAIL=you@example.com
   export POSTGRES_USER=postgres
   export POSTGRES_PASSWORD=postgres
   export POSTGRES_DB=pokerclub
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   Caddy will fetch certificates automatically. Your API & WebSocket live at:
   - `https://$DOMAIN` (WS path: `/ws`, upgrade to **wss://**).

## Android APK (signed)
### Create a keystore (one-time)
```bash
keytool -genkey -v -keystore android/app/release.keystore -alias pokerclub   -keyalg RSA -keysize 2048 -validity 36500
```
Fill passwords and organization prompts.

### Configure signing
- Copy `android/keystore.properties.example` to `android/keystore.properties` and fill your values.
- Or set secrets in GitHub Actions:
  - `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

### Build locally
```bash
cd android
./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

### Build via GitHub Actions
- Push a tag like `v1.0.0` → workflow builds and uploads the **signed APK** as an artifact.

## App configuration
- In the Android app, set the WebSocket URL to your domain: `wss://$DOMAIN/ws`
- Deep links and invite tokens already work. Invite example:
  - `pokerclub://join?token=...&server=wss://$DOMAIN/ws`

## Backups
- Postgres volume `dbdata` holds all persistent data (users, tables, hands, actions, invites).
- Use `pg_dump` on a schedule, or snapshot the volume.

## Scale out
- Run multiple server containers behind the same Caddy. Redis pub/sub syncs table messages across instances.
- Consider DB connection pool tuning and Postgres hosting (managed service) for heavy traffic.
