#!/usr/bin/env sh
#
# Starts or stops the services Routr depends on (Postgres, Redis, RTPEngine), defined in
# .devcontainer/compose.yaml. Works from inside the dev container and from the host.
#
#   ./.scripts/deps.sh up [service...]    defaults to postgres and redis
#   ./.scripts/deps.sh down [service...]  defaults to all of them
#
set -e

cd "$(dirname "$0")/.."

action=${1:-up}
[ $# -gt 0 ] && shift

if [ -n "$ROUTR_DEVCONTAINER" ]; then
  # Join the dev container's own Compose project, so the services share its network
  project=$(docker inspect "$(hostname)" \
    --format '{{ index .Config.Labels "com.docker.compose.project" }}')
  flags="-p $project -f .devcontainer/compose.yaml"
else
  # On the host, publish the ports so the services answer on localhost
  flags="-p routr-deps -f .devcontainer/compose.yaml -f .devcontainer/compose.host.yaml"
fi

case "$action" in
  up)
    # shellcheck disable=SC2086
    docker compose $flags up -d --wait --no-deps ${*:-postgres redis}
    ;;
  down)
    # shellcheck disable=SC2086
    docker compose $flags stop ${*:-postgres redis rtpengine}
    ;;
  *)
    echo "usage: $0 up|down [service...]" >&2
    exit 1
    ;;
esac
