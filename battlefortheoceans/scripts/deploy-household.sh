#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/deploy/household.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/deploy/household.env"
fi

: "${HOUSEHOLD_SSH:?Set HOUSEHOLD_SSH (e.g. clintoconnor@spinney.local) in deploy/household.env or the environment}"

REMOTE_DIR="${HOUSEHOLD_REMOTE_DIR:-BattleForTheOceans}"
PORT=3002
LABEL="com.household.battlefortheoceans"
LOG_NAME="battlefortheoceans"

for arg in "$@"; do
  case "$arg" in
    -h | --help)
      echo "Usage: $0"
      echo "  HOUSEHOLD_SSH          SSH target (required), e.g. clintoconnor@spinney.local"
      echo "  HOUSEHOLD_REMOTE_DIR   Remote install dir under \$HOME (default: BattleForTheOceans)"
      echo "  HOUSEHOLD_URL_HOST     Hostname for health check (default: spinney.local)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -o IdentitiesOnly=yes -o AddressFamily=inet)
if [[ -n "${HOUSEHOLD_SSH_IDENTITY:-}" ]]; then
  SSH_OPTS+=(-o "IdentityFile=${HOUSEHOLD_SSH_IDENTITY}")
elif [[ -f "$HOME/.ssh/id_ed25519" ]]; then
  SSH_OPTS+=(-o "IdentityFile=$HOME/.ssh/id_ed25519")
fi

RSYNC_SSH="ssh"
for opt in "${SSH_OPTS[@]}"; do
  RSYNC_SSH+=" $(printf '%q' "$opt")"
done

echo "Checking SSH to ${HOUSEHOLD_SSH}..."
ssh "${SSH_OPTS[@]}" "${HOUSEHOLD_SSH}" 'echo "Connected as $(whoami) on $(hostname -s)"'

RSYNC_EXCLUDES=(
  --exclude build
  --exclude node_modules
  --exclude .git
  --exclude .env
  --exclude deploy/household.env
  --exclude docs
  --exclude netlify
  --exclude .cursor
)

echo "Syncing app to ${HOUSEHOLD_SSH}:~/${REMOTE_DIR}/ ..."
rsync -az --delete -e "$RSYNC_SSH" "${RSYNC_EXCLUDES[@]}" "$ROOT/" "${HOUSEHOLD_SSH}:~/${REMOTE_DIR}/"

if [[ -f "$ROOT/.env" ]]; then
  echo "Syncing .env (required for REACT_APP_* at build time)..."
  rsync -az -e "$RSYNC_SSH" "$ROOT/.env" "${HOUSEHOLD_SSH}:~/${REMOTE_DIR}/.env"
else
  echo "Warning: no local .env — remote build may fail or lack Supabase keys." >&2
fi

echo "Installing dependencies and building on server..."
ssh "${SSH_OPTS[@]}" "${HOUSEHOLD_SSH}" bash -s <<EOF
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:\$PATH"
cd "\$HOME/${REMOTE_DIR}"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed on the server. Install Node 22+ (e.g. brew install node) and re-run deploy." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Missing .env on server. Copy from MacBook and re-run deploy." >&2
  exit 1
fi
# npm install (not ci): MacBook is arm64, Spinney is x86_64; ci fails on
# optional @rollup/* platform packages pinned for the wrong arch in the lockfile.
npm install
npm run build
EOF

echo "Installing LaunchAgent..."
ssh "${SSH_OPTS[@]}" "${HOUSEHOLD_SSH}" bash -s <<EOF
set -euo pipefail
REMOTE="\$HOME/${REMOTE_DIR}"
LOG_DIR="\$HOME/Library/Logs/${LOG_NAME}"
mkdir -p "\$LOG_DIR"
UID_NUM="\$(id -u)"
DOMAIN="gui/\$UID_NUM"
PLIST="\$HOME/Library/LaunchAgents/${LABEL}.plist"
sed "s|HOME_PLACEHOLDER|\$HOME|g" "\$REMOTE/deploy/launchd/${LABEL}.plist" > "\$PLIST"
launchctl bootout "\$DOMAIN/${LABEL}" 2>/dev/null || true
# Stop stray listeners so the new build is not mixed with an old server.
if command -v lsof >/dev/null 2>&1; then
  OLD_PIDS="\$(lsof -ti tcp:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "\$OLD_PIDS" ]]; then
    echo "Stopping existing listener(s) on :${PORT}: \$OLD_PIDS"
    kill \$OLD_PIDS 2>/dev/null || true
    sleep 2
  fi
fi
sleep 1
if ! launchctl bootstrap "\$DOMAIN" "\$PLIST" 2>/dev/null; then
  echo "launchctl bootstrap returned an error (often harmless I/O error 5); continuing with kickstart..."
fi
launchctl enable "\$DOMAIN/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "\$DOMAIN/${LABEL}"
sleep 2
if curl -sf -o /dev/null --max-time 5 "http://127.0.0.1:${PORT}/"; then
  echo "Battle for the Oceans is listening on :${PORT}"
else
  echo "Warning: :${PORT} not responding yet. Check ~/Library/Logs/${LOG_NAME}/stderr.log" >&2
fi
EOF

echo "Waiting for server..."
sleep 2
HOST="${HOUSEHOLD_URL_HOST:-${HOUSEHOLD_SSH#*@}}"
if curl -sf --max-time 15 "http://${HOST}:${PORT}/" >/dev/null; then
  echo "Battle for the Oceans is up at http://${HOST}:${PORT}/"
else
  echo "Deploy finished; could not reach the server from this Mac."
  echo "Check logs on Spinney: ~/Library/Logs/${LOG_NAME}/stderr.log"
fi
