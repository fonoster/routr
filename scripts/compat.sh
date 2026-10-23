#!/usr/bin/env bash
# Replays the known-good corpus (etc/corpus) through the Node chain started from
# this checkout: simpledata -> location -> connect -> dispatcher, no EdgePort, no
# Docker. Fails when any recorded message is answered differently today (drift)
# or when a corpus file no longer passes its rule profiles.
#
# Usage: npm run compat [-- --sip-connect]
# Needs: npm run build (the services run from dist/).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MANIFEST="${MANIFEST:-etc/corpus/manifest.yaml}"
RESOURCES="$ROOT/etc/corpus/$(sed -n 's/^resources: *//p' "$MANIFEST" | head -1)"
export NODE_ENV=dev
export LOGS_LEVEL="${LOGS_LEVEL:-info}"

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

start() {
  local name=$1; shift
  echo "starting $name"
  "$@" > "/tmp/routr-compat-$name.log" 2>&1 &
  pids+=($!)
}

wait_port() {
  local port=$1 name=$2 i
  for i in $(seq 1 60); do
    if (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null; then return 0; fi
    sleep 0.5
  done
  echo "$name did not open port $port; log follows" >&2
  cat "/tmp/routr-compat-$name.log" >&2
  return 1
}

PATH_TO_RESOURCES="$RESOURCES" BIND_ADDR=0.0.0.0:51907 \
  start simpledata node mods/simpledata/dist/runner.js
CONFIG_PATH="$ROOT/config/location.yaml" \
  start location node mods/location/dist/runner.js
API_ADDR=localhost:51907 LOCATION_ADDR=localhost:51902 BIND_ADDR=0.0.0.0:51904 \
  start connect node mods/connect/dist/runner.js
CONFIG_PATH="$ROOT/config/compat/dispatcher.yaml" \
  start dispatcher node mods/dispatcher/dist/runner.js

wait_port 51907 simpledata
wait_port 51902 location
wait_port 51904 connect
wait_port 51901 dispatcher

node mods/ctl/bin/run trace compat "$MANIFEST" --against localhost:51901 --fail-on drift "$@"
