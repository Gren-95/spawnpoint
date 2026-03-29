# Spawnpoint — Project Instructions

## After completing any change

Always rebuild and restart the Docker container so changes are live:

```bash
docker compose up -d --build
```

## Common Commands

```bash
docker compose up -d --build   # Rebuild and restart
docker compose down            # Stop
```

## Dev (without Docker)

```bash
node scripts/dev.mjs           # Start backend + frontend concurrently
```

## Helper Scripts

All scripts run from the repo root with `node scripts/<name>.mjs`.

```bash
# Development
node scripts/dev.mjs                      # Start backend (bun) + frontend (vite) together
node scripts/health.mjs                   # Check if Spawnpoint is up, show version + servers
node scripts/logs.mjs                     # Tail Docker logs (all)
node scripts/logs.mjs error               # Tail Docker logs filtered by keyword

# Database
node scripts/db-backup.mjs                # Copy mc.db to data/db-backups/ with timestamp
node scripts/reset-db.mjs                 # Wipe database (backs up first, prompts to confirm)

# Release
node scripts/release.mjs 1.2.3           # Tag vX.Y.Z, push branch + tag → triggers Docker Hub build
node scripts/build-watch.mjs             # Watch latest GitHub Actions release run
node scripts/build-watch.mjs --list      # List recent release runs without watching

# Screenshots
node scripts/screenshot.mjs              # Capture UI screenshots to screenshots/
# Prerequisites (one-time): cd scripts && npm install && npx playwright install chromium
```
