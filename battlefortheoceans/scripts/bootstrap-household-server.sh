#!/usr/bin/env bash
# Run on Spinney while logged in (GUI session), from ~/BattleForTheOceans after deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
PORT=3002
LABEL="com.household.battlefortheoceans"
LOG_NAME="battlefortheoceans"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 22+ (e.g. brew install node) and run again." >&2
  exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing $ROOT/.env — deploy from your MacBook first (npm run deploy:household)." >&2
  exit 1
fi

# npm install (not ci): MacBook is arm64, Spinney is x86_64; ci fails on
# optional @rollup/* platform packages pinned for the wrong arch in the lockfile.
npm install
npm run build

LOG_DIR="$HOME/Library/Logs/$LOG_NAME"
mkdir -p "$LOG_DIR"
PLIST_SRC="$ROOT/deploy/launchd/${LABEL}.plist"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
sed "s|HOME_PLACEHOLDER|$HOME|g" "$PLIST_SRC" > "$PLIST"

UID_NUM="$(id -u)"
DOMAIN="gui/$UID_NUM"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$OLD_PIDS" ]]; then
    echo "Stopping existing listener(s) on :$PORT: $OLD_PIDS"
    kill $OLD_PIDS 2>/dev/null || true
    sleep 2
  fi
fi
sleep 1
if ! launchctl bootstrap "$DOMAIN" "$PLIST" 2>/dev/null; then
  echo "launchctl bootstrap returned an error (often harmless I/O error 5); continuing with kickstart..."
fi
launchctl enable "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl kickstart -k "$DOMAIN/$LABEL"
sleep 2

if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:${PORT}/"; then
  echo "Battle for the Oceans is listening on http://$(hostname -s).local:${PORT}/"
else
  echo "Not responding on :${PORT} yet. Check $LOG_DIR/stderr.log" >&2
  exit 1
fi
