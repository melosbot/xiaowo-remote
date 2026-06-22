#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$SCRIPT_DIR/data"
PID_FILE="$DATA_DIR/server.pid"
LOG_FILE="$DATA_DIR/server.log"

export DATA_DIR="$DATA_DIR"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8787}"
BASE_URL="http://localhost:${PORT}"

# ---- helpers ----

banner() {
  echo ""
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║       小沃远控 Demo                   ║"
  echo "  ╠══════════════════════════════════════╣"
  echo "  ║  内置账号: 13800000000 / demo          ║"
  echo "  ║  服务地址: $BASE_URL"
  echo "  ║  数据目录: $DATA_DIR"
  echo "  ║  TG 推送: ${TG_BOT_TOKEN:-(未配置)}"
  echo "  ╚══════════════════════════════════════╝"
  echo ""
}

log() { echo "[demo] $(date '+%H:%M:%S') $*"; }

running_pid() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
  fi
  return 1
}

health_check() {
  curl -sf "$BASE_URL/api/health" >/dev/null 2>&1
}

# ---- actions ----

cmd_install() {
  if [ ! -d "$PROJECT_DIR/server/node_modules" ]; then
    log "installing server dependencies..."
    (cd "$PROJECT_DIR/server" && npm ci)
  fi
  if [ ! -d "$PROJECT_DIR/web/node_modules" ]; then
    log "installing web dependencies..."
    (cd "$PROJECT_DIR/web" && npm ci)
  fi
}

cmd_rebuild() {
  log "clean reinstalling server..."
  rm -rf "$PROJECT_DIR/server/node_modules"
  (cd "$PROJECT_DIR/server" && npm ci)
  log "clean reinstalling web..."
  rm -rf "$PROJECT_DIR/web/node_modules"
  (cd "$PROJECT_DIR/web" && npm ci)
  log "rebuilding frontend..."
  (cd "$PROJECT_DIR/web" && npm run build)
  log "rebuild done"
}

cmd_build() {
  if [ ! -d "$PROJECT_DIR/web/dist" ]; then
    log "building web frontend..."
    (cd "$PROJECT_DIR/web" && npm run build)
  fi
}

cmd_stop() {
  local pid
  if pid="$(running_pid)"; then
    log "stopping server (pid=$pid)..."
    kill "$pid"
    # 等它退出
    for i in $(seq 1 10); do
      if ! kill -0 "$pid" 2>/dev/null; then break; fi
      sleep 0.5
    done
    # 还不死就强杀
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
    log "server stopped"
  else
    log "no running server"
  fi
}

cmd_start() {
  cmd_install
  cmd_build
  cmd_stop  # 先停旧的

  mkdir -p "$DATA_DIR"

  log "starting server..."
  cd "$PROJECT_DIR/server"
  npx tsx src/index.ts >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"
  log "server started (pid=$pid)"

  # 等它就绪
  log "waiting for health check..."
  for i in $(seq 1 30); do
    if health_check; then
      log "server ready ✓"
      return 0
    fi
    sleep 1
  done
  log "server may still be starting, check $LOG_FILE"
}

cmd_status() {
  local pid
  if pid="$(running_pid)"; then
    echo "Server:  RUNNING (pid=$pid)"
    if health_check; then
      echo "Health:  OK        $BASE_URL/api/health"
    else
      echo "Health:  NOT READY (still starting?)"
    fi
  else
    echo "Server:  STOPPED"
  fi
  echo "Log:     $LOG_FILE (tail -f to follow)"
  echo "Data:    $DATA_DIR"
}

cmd_logs() {
  if [ -f "$LOG_FILE" ]; then
    tail -n "${1:-40}" "$LOG_FILE"
  else
    echo "(no log yet)"
  fi
}

cmd_restart() {
  cmd_stop
  cmd_start
  cmd_status
}

# ---- signal handling ----

cleanup() {
  log "received signal, shutting down..."
  cmd_stop
  exit 0
}
trap cleanup SIGINT SIGTERM

# ---- main ----

case "${1:-start}" in
  start)
    cmd_start
    banner
    log "press Ctrl+C to stop"
    # 前台阻塞，等 server 进程退出
    wait "$(running_pid)"
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_restart
    ;;
  rebuild)
    cmd_rebuild
    cmd_start
    banner
    log "press Ctrl+C to stop"
    wait "$(running_pid)"
    ;;
  status)
    cmd_status
    ;;
  logs)
    cmd_logs "${2:-}"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|rebuild|status|logs}"
    exit 1
    ;;
esac
