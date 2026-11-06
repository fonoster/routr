#!/usr/bin/env bash
# Replays etc/corpus/manifest.go-m1.yaml through the Go chain built from this checkout:
# data -> location -> connect -> dispatcher, no EdgePort, no Docker. Same check as
# scripts/compat.sh, which replays the whole corpus on the Node chain.
#
# Usage: ./scripts/compat-go.sh [--sip-connect]
# Needs: npm run build (rctl runs the replay).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BIN="$(mktemp -d)"
export COMPAT_RESOURCES="$ROOT/etc/corpus/resources"

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  rm -r "$BIN"
}
trap cleanup EXIT

start() {
  local name=$1 config=$2
  go build -o "$BIN/$name" "./cmd/$name"
  CONFIG_PATH="$ROOT/$config" "$BIN/$name" > "/tmp/routr-compat-go-$name.log" 2>&1 &
  pids+=($!)
}

wait_port() {
  local port=$1 name=$2 i
  for i in $(seq 1 60); do
    if (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null; then return 0; fi
    sleep 0.5
  done
  echo "$name did not open port $port; log follows" >&2
  cat "/tmp/routr-compat-go-$name.log" >&2
  return 1
}

start data config/compat/data.go.yaml
start location config/compat/location.go.yaml
start connect config/compat/connect.go.yaml
start dispatcher config/compat/dispatcher.yaml

wait_port 51907 data
wait_port 51902 location
wait_port 51904 connect
wait_port 51901 dispatcher

node mods/ctl/bin/run trace compat etc/corpus/manifest.go-m1.yaml --against localhost:51901 --fail-on error "$@"
