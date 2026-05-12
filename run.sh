#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3344}"
HOST="${HOST:-0.0.0.0}"
LOG_DIR=".paperclip"
LOG_FILE="${LOG_DIR}/run.log"
PID_FILE="${LOG_DIR}/run.pid"

port_pids() {
  lsof -ti tcp:"${PORT}" 2>/dev/null || true
}

stop() {
  if [[ -f "${PID_FILE}" ]]; then
    local root_pid
    root_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
    if [[ -n "${root_pid}" ]] && ps -p "${root_pid}" >/dev/null 2>&1; then
      echo "Stopping Paperclip process group ${root_pid}"
      kill -"${root_pid}" 2>/dev/null || kill "${root_pid}" 2>/dev/null || true
      sleep 1
      if ps -p "${root_pid}" >/dev/null 2>&1; then
        kill -9 -"${root_pid}" 2>/dev/null || kill -9 "${root_pid}" 2>/dev/null || true
      fi
    fi
  fi
  ps -axo pid=,command= \
    | grep -F "$(pwd)" \
    | grep -E 'dev-runner|dev-watch|tsx watch|src/index\.ts' \
    | awk '{print $1}' \
    | xargs -r kill 2>/dev/null || true
  local pids
  pids="$(port_pids)"
  if [[ -n "${pids}" ]]; then
    echo "Stopping processes on port ${PORT}: ${pids}"
    kill ${pids} 2>/dev/null || true
    sleep 1
    pids="$(port_pids)"
    if [[ -n "${pids}" ]]; then
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
  rm -f "${PID_FILE}"
}

start() {
  stop
  mkdir -p "${LOG_DIR}"
  echo "Starting Paperclip on ${HOST}:${PORT}"
  HOST="${HOST}" PORT="${PORT}" LOG_FILE="${LOG_FILE}" PID_FILE="${PID_FILE}" node <<'NODE'
const fs = require("node:fs");
const { spawn } = require("node:child_process");

const out = fs.openSync(process.env.LOG_FILE, "a");
const child = spawn("pnpm", ["dev", "--", "--bind", "custom", "--bind-host", process.env.HOST], {
  cwd: process.cwd(),
  detached: true,
  env: process.env,
  stdio: ["ignore", out, out],
});
child.unref();
fs.writeFileSync(process.env.PID_FILE, `${child.pid}\n`);
NODE
  echo "Local URL: http://localhost:${PORT}"
  if command -v tailscale >/dev/null 2>&1; then
    local ts_ip
    ts_ip="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
    if [[ -n "${ts_ip}" ]]; then
      echo "Tailscale URL: http://${ts_ip}:${PORT}"
    fi
  fi
  echo "Log: ${LOG_FILE}"
}

case "${1:-start}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    start
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}" >&2
    exit 1
    ;;
esac
