#!/usr/bin/env sh

cross-env NODE_ENV=dev \
  DATABASE_URL=postgresql://routr:changeme@localhost:5432/routr?schema=public \
  RTPENGINE_HOST=localhost \
  EDGEPORT_RUNNER=$(pwd)/mods/edgeport/edgeport.sh \
  LOGS_LEVEL=verbose \
  nodemon mods/one/src/runner
