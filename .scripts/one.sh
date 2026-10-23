#!/usr/bin/env sh
#
# Runs the all-in-one distribution, starting only the services this run needs: Postgres
# always, Redis when LOCATION_CACHE_PROVIDER is redis, RTPEngine when RTPENGINE_HOST is set.
#
set -e

export DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/routr?schema=public}

deps="postgres"
case "$LOCATION_CACHE_PROVIDER" in
  [Rr][Ee][Dd][Ii][Ss]) deps="$deps redis" ;;
esac
[ -n "$RTPENGINE_HOST" ] && deps="$deps rtpengine"

# shellcheck disable=SC2086
./.scripts/deps.sh up $deps
npm run db:migrate

cross-env NODE_ENV=dev \
  EDGEPORT_RUNNER=$(pwd)/mods/edgeport/edgeport.sh \
  LOGS_LEVEL=verbose \
  nodemon mods/one/src/runner
