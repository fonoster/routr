#!/usr/bin/env bash
# Replays the known-good corpus (etc/corpus), then every partner manifest
# (interop/*/manifest.yaml), through the chain built from this checkout:
# data -> location -> connect -> dispatcher, no EdgePort, no Docker. Fails when any
# recorded message is answered differently today (drift) or on a spec violation a
# file's manifest does not declare (an error-level finding). Every manifest runs; the
# exit status is the first non-zero one. config/compat/connect.yaml sets nonceMaxAge: 0,
# since the recordings answer the challenges issued when they were made.
#
# Usage: npm run compat [-- --sip-connect]
# Needs: go, and npm run build (rctl runs the replay).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MANIFEST="${MANIFEST:-etc/corpus/manifest.yaml}"
BIN="$(mktemp -d)"
export COMPAT_RESOURCES="$ROOT/$(dirname "$MANIFEST")/$(sed -n 's/^resources: *//p' "$MANIFEST" | head -1)"

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
  echo "starting $name"
  go build -o "$BIN/$name" "./cmd/$name"
  CONFIG_PATH="$ROOT/$config" "$BIN/$name" > "/tmp/routr-compat-$name.log" 2>&1 &
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

start data config/compat/data.yaml
start location config/compat/location.yaml
start connect config/compat/connect.yaml
start dispatcher config/compat/dispatcher.yaml

wait_port 51907 data
wait_port 51902 location
wait_port 51904 connect
wait_port 51901 dispatcher

shopt -s nullglob
manifests=("$MANIFEST" interop/*/manifest.yaml)
status=0
for m in "${manifests[@]}"; do
  echo "== $m"
  node mods/ctl/bin/run trace compat "$m" --against localhost:51901 --insecure --fail-on error "$@" \
    || { rc=$?; [ "$status" -eq 0 ] && status=$rc; }
done
exit "$status"
