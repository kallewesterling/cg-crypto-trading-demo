#!/usr/bin/env bash
# Isolated TradeSim instances for verification. Never touches port 3000 or prisma/dev.db.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
STATE_DIR="${TRADESIM_VERIFY_STATE_DIR:-/tmp/tradesim-verify}"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"

usage() {
  cat <<'EOF'
Usage: tradesim-verify.sh <command> [options]

  launch [--port PORT]   Start a disposable Next.js instance and print its URL.
  doctor [--port PORT]   Read-only health check for one instance.
  wallet EMAIL [--port PORT]
                          Print the user and wallet row for EMAIL.
  fault fail|live [--port PORT]
                          Pause or restore the CoinGecko quote for this instance.
                          The server reads the flag on the next request.
  quote [clear] [--port PORT]
                          Print the cached BTC quote JSON, or delete it with clear.
  cleanup [--port PORT | --all]
                          Stop instances this script started and delete their data dirs.
                          Leaves .cursor/skills/verify-tradesim/artifacts in place.

State files live in /tmp/tradesim-verify. Proof artifacts are never deleted.
EOF
}

refuse_shared_port() {
  if [[ "${1:-}" == "3000" ]]; then
    echo "Refusing port 3000. That listener is the shared dev server, not a verification instance." >&2
    exit 1
  fi
}

state_file_for_port() {
  echo "$STATE_DIR/$1.env"
}

latest_file() {
  echo "$STATE_DIR/latest"
}

refresh_latest_pointer() {
  local latest port
  latest="$(latest_file)"
  if [[ -f "$latest" ]]; then
    port="$(awk -F= '/^PORT=/{print $2; exit}' "$latest")"
    if [[ -n "${port:-}" && -f "$(state_file_for_port "$port")" ]]; then
      return
    fi
  fi
  shopt -s nullglob
  local remaining=("$STATE_DIR"/[0-9]*.env)
  shopt -u nullglob
  if [[ ${#remaining[@]} -gt 0 ]]; then
    cp "${remaining[0]}" "$latest"
  else
    rm -f "$latest"
  fi
}

load_state() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "No verification state at $file. Run launch first." >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$file"
}

resolve_port() {
  local requested="${1:-}"
  if [[ -n "$requested" ]]; then
    refuse_shared_port "$requested"
    echo "$requested"
    return
  fi
  local latest
  latest="$(latest_file)"
  if [[ -f "$latest" ]]; then
    load_state "$latest"
    echo "$PORT"
    return
  fi
  echo "No active verification instance. Pass --port or run launch." >&2
  exit 1
}

port_listener_pid() {
  local port="$1"
  local pid inode hex fd
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -n "$pid" ]]; then
    echo "$pid"
    return
  fi
  # lsof is installed in some sandboxes but cannot see sockets. /proc still can.
  hex="$(printf '%04X' "$port")"
  inode="$(awk -v suffix=":$hex" 'NR > 1 && $4 == "0A" && substr($2, length($2) - length(suffix) + 1) == suffix { print $10; exit }' /proc/net/tcp /proc/net/tcp6 2>/dev/null || true)"
  if [[ -z "${inode:-}" || "$inode" == "0" ]]; then
    return
  fi
  for fd in /proc/[0-9]*/fd/*; do
    if [[ "$(readlink "$fd" 2>/dev/null || true)" == "socket:[$inode]" ]]; then
      pid="${fd#/proc/}"
      echo "${pid%%/*}"
      return
    fi
  done
}

cmd_launch() {
  local port="4173"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        port="$2"
        shift 2
        ;;
      *)
        echo "Unknown launch option: $1" >&2
        exit 1
        ;;
    esac
  done
  refuse_shared_port "$port"

  local listener
  listener="$(port_listener_pid "$port")"
  if [[ -n "$listener" ]]; then
    echo "Port $port is already in use by pid $listener. Pick another port." >&2
    exit 1
  fi

  mkdir -p "$STATE_DIR" "$ARTIFACTS_DIR"
  local run_id root secret state
  run_id="$(date +%Y%m%d%H%M%S)-$$"
  root="$STATE_DIR/run-$run_id"
  mkdir -p "$root"
  secret="$(openssl rand -hex 32)"
  state="$(state_file_for_port "$port")"
  printf 'live\n' >"$root/fault"

  cat >"$root/env" <<EOF
DATABASE_URL=file:$root/dev.db
AUTH_SECRET=$secret
AUTH_TRUST_HOST=true
NEXTAUTH_URL=http://127.0.0.1:$port
AUTH_URL=http://127.0.0.1:$port
NEXT_PUBLIC_APP_URL=http://127.0.0.1:$port
DEV_LOGIN=true
BTC_PRICE_CACHE_FILE=$root/btc-price.json
BTC_CHART_CACHE_FILE=$root/btc-chart.json
BTC_PRICE_FAULT_FILE=$root/fault
EOF

  # shellcheck disable=SC1090
  set -a
  source "$root/env"
  set +a

  (
    cd "$REPO_ROOT"
    npx prisma db push --skip-generate --accept-data-loss
  ) >"$root/prisma.log" 2>&1

  # Double-fork into a new session so the dev server outlives this command.
  local launch_pid
  launch_pid="$(
    python3 - "$REPO_ROOT" "$root/env" "$port" "$root/server.log" <<'PY'
import os
import sys

repo, env_file, port, log_path = sys.argv[1:5]
env = os.environ.copy()
with open(env_file, encoding="utf-8") as handle:
    for line in handle:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key] = value

read_fd, write_fd = os.pipe()
if os.fork() > 0:
    os.close(write_fd)
    grandchild = os.read(read_fd, 64).decode()
    os.write(1, grandchild.encode())
    os._exit(0)

os.close(read_fd)
os.setsid()
grandchild = os.fork()
if grandchild > 0:
    os.write(write_fd, str(grandchild).encode())
    os._exit(0)

os.close(write_fd)
os.chdir(repo)
log = open(log_path, "a", encoding="utf-8")
os.dup2(log.fileno(), 1)
os.dup2(log.fileno(), 2)
devnull = open(os.devnull, "r", encoding="utf-8")
os.dup2(devnull.fileno(), 0)
os.execvpe("npx", ["npx", "next", "dev", "-p", port, "-H", "127.0.0.1"], env)
PY
  )"
  echo "$launch_pid" >"$root/server.pid"

  local pid="$launch_pid"
  cat >"$state" <<EOF
RUN_ID=$run_id
PORT=$port
PID=$pid
LAUNCH_PID=$launch_pid
ROOT=$root
URL=http://127.0.0.1:$port
DATABASE=$root/dev.db
LOG=$root/server.log
EOF
  cp "$state" "$(latest_file)"

  local ready=0
  for _ in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:$port" | grep -q "Welcome to TradeSim"; then
      local listener pgid
      listener="$(port_listener_pid "$port")"
      pgid="$(ps -o pgid= -p "$listener" 2>/dev/null | tr -d ' ' || true)"
      if [[ -n "$listener" && -n "$pgid" ]]; then
        pid="$listener"
        echo "$pid" >"$root/server.pid"
        cat >"$state" <<EOF
RUN_ID=$run_id
PORT=$port
PID=$pid
PGID=$pgid
LAUNCH_PID=$launch_pid
ROOT=$root
URL=http://127.0.0.1:$port
DATABASE=$root/dev.db
LOG=$root/server.log
EOF
        cp "$state" "$(latest_file)"
        ready=1
        break
      fi
    fi
    sleep 1
  done
  if [[ "$ready" != "1" ]]; then
    echo "Timed out waiting for Welcome to TradeSim on port $port. Log: $root/server.log" >&2
    exit 1
  fi

  echo "URL=http://127.0.0.1:$port"
  echo "PORT=$port"
  echo "PID=$pid"
  echo "DATABASE=$root/dev.db"
  echo "LOG=$root/server.log"
}

cmd_doctor() {
  local port=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        port="$2"
        shift 2
        ;;
      *)
        echo "Unknown doctor option: $1" >&2
        exit 1
        ;;
    esac
  done
  port="$(resolve_port "$port")"
  refuse_shared_port "$port"
  load_state "$(state_file_for_port "$port")"

  local ok=1
  if [[ ! -f "$DATABASE" ]]; then
    echo "FAIL database missing: $DATABASE"
    ok=0
  else
    echo "OK database $DATABASE"
  fi

  if ! kill -0 "$PID" 2>/dev/null; then
    echo "FAIL pid $PID is not running"
    ok=0
  else
    echo "OK pid $PID"
  fi

  local listener
  listener="$(port_listener_pid "$PORT")"
  if [[ "$listener" != "$PID" ]]; then
    echo "FAIL port $PORT listener is '${listener:-none}', expected $PID"
    ok=0
  else
    echo "OK port $PORT owned by $PID"
  fi

  local body
  body="$(curl -sf "http://127.0.0.1:$PORT" || true)"
  if [[ "$body" != *"Welcome to TradeSim"* ]]; then
    echo "FAIL $URL did not return the TradeSim landing page"
    ok=0
  else
    echo "OK $URL serves Welcome to TradeSim"
  fi

  if [[ "$ok" != "1" ]]; then
    exit 1
  fi
  echo "READY $URL"
}

cmd_wallet() {
  local email="" port=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        port="$2"
        shift 2
        ;;
      *)
        if [[ -z "$email" ]]; then
          email="$1"
          shift
        else
          echo "Unexpected argument: $1" >&2
          exit 1
        fi
        ;;
    esac
  done
  if [[ -z "$email" ]]; then
    echo "wallet requires an email address" >&2
    exit 1
  fi
  port="$(resolve_port "$port")"
  load_state "$(state_file_for_port "$port")"
  local email_sql="${email//\'/\'\'}"
  sqlite3 "$DATABASE" <<SQL
.headers on
.mode column
SELECT u.email, u.name, w.usdtBalance, w.btcBalance
FROM User u
JOIN Wallet w ON w.userId = u.id
WHERE u.email = '$email_sql';
SELECT COUNT(*) AS trades
FROM Trade t
JOIN User u ON u.id = t.userId
WHERE u.email = '$email_sql';
SQL
}

cmd_fault() {
  local mode="" port=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        port="$2"
        shift 2
        ;;
      *)
        if [[ -z "$mode" ]]; then
          mode="$1"
          shift
        else
          echo "Unexpected argument: $1" >&2
          exit 1
        fi
        ;;
    esac
  done
  if [[ "$mode" != "fail" && "$mode" != "live" ]]; then
    echo "fault mode must be fail or live" >&2
    exit 1
  fi
  port="$(resolve_port "$port")"
  load_state "$(state_file_for_port "$port")"
  if [[ -z "${ROOT:-}" || "$ROOT" != "$STATE_DIR"/run-* ]]; then
    echo "Refusing to write a fault file outside a verification run." >&2
    exit 1
  fi
  printf '%s\n' "$mode" >"$ROOT/fault"
  echo "FAULT=$mode"
}

cmd_quote() {
  local port="" action="show"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        port="$2"
        shift 2
        ;;
      clear)
        action="clear"
        shift
        ;;
      *)
        echo "Unknown quote option: $1" >&2
        exit 1
        ;;
    esac
  done
  port="$(resolve_port "$port")"
  load_state "$(state_file_for_port "$port")"
  if [[ -z "${ROOT:-}" || "$ROOT" != "$STATE_DIR"/run-* ]]; then
    echo "Refusing to touch a quote cache outside a verification run." >&2
    exit 1
  fi
  if [[ "$action" == "clear" ]]; then
    rm -f "$ROOT/btc-price.json"
    echo "CLEARED $ROOT/btc-price.json"
    return
  fi
  if [[ -f "$ROOT/btc-price.json" ]]; then
    cat "$ROOT/btc-price.json"
    echo
  else
    echo "NO_CACHE"
  fi
  if [[ -f "$ROOT/fault" ]]; then
    echo "FAULT=$(tr -d '\n' <"$ROOT/fault")"
  fi
}

cmd_cleanup() {
  local port="" all=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)
        port="$2"
        shift 2
        ;;
      --all)
        all=1
        shift
        ;;
      *)
        echo "Unknown cleanup option: $1" >&2
        exit 1
        ;;
    esac
  done

  local files=()
  if [[ "$all" == "1" ]]; then
    shopt -s nullglob
    files=("$STATE_DIR"/[0-9]*.env)
    shopt -u nullglob
  else
    port="$(resolve_port "$port")"
    files=("$(state_file_for_port "$port")")
  fi

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No verification instances to clean up."
    return
  fi

  local file
  for file in "${files[@]}"; do
    [[ -f "$file" ]] || continue
    # shellcheck disable=SC1090
    source "$file"
    refuse_shared_port "$PORT"
    local listener
    listener="$(port_listener_pid "$PORT")"
    if [[ -n "$listener" && -n "${PID:-}" && "$listener" != "$PID" ]]; then
      echo "Refusing to kill because port $PORT is owned by $listener, not pid $PID." >&2
      exit 1
    fi
    local group_cmd=""
    if [[ -n "${PGID:-}" ]]; then
      group_cmd="$(ps -o command= -g "$PGID" 2>/dev/null || true)"
      if [[ -n "$group_cmd" && "$group_cmd" != *"-p $PORT"* ]]; then
        echo "Refusing to kill process group $PGID; it is not the verification server on port $PORT." >&2
        exit 1
      fi
    fi
    local stopped=0
    if [[ -n "${PGID:-}" && -n "$group_cmd" ]]; then
      kill -- "-$PGID" 2>/dev/null || true
      stopped=1
    elif [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      stopped=1
    fi
    if [[ "$stopped" == "1" ]]; then
      for _ in $(seq 1 20); do
        if [[ -z "$(port_listener_pid "$PORT")" ]]; then
          break
        fi
        sleep 0.25
      done
      if [[ -n "$(port_listener_pid "$PORT")" && -n "${PGID:-}" ]]; then
        kill -9 -- "-$PGID" 2>/dev/null || true
      fi
      echo "Stopped verification server on port $PORT"
    else
      echo "Verification server on port $PORT was already stopped"
    fi
    if [[ -n "${ROOT:-}" && "$ROOT" == "$STATE_DIR"/run-* ]]; then
      rm -rf "$ROOT"
      echo "Removed $ROOT"
    fi
    rm -f "$file"
  done
  refresh_latest_pointer
  echo "Artifacts kept at $ARTIFACTS_DIR"
}

main() {
  local cmd="${1:-}"
  if [[ -z "$cmd" ]]; then
    usage
    exit 1
  fi
  shift
  case "$cmd" in
    launch) cmd_launch "$@" ;;
    doctor) cmd_doctor "$@" ;;
    wallet) cmd_wallet "$@" ;;
    fault) cmd_fault "$@" ;;
    quote) cmd_quote "$@" ;;
    cleanup) cmd_cleanup "$@" ;;
    -h|--help|help) usage ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
