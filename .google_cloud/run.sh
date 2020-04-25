#!/usr/bin/env sh

echo "PORT IS $PORT"
export ROUTR_EXTERN_ADDR=no-op
export PORT=4567
redis-server --appendonly yes --daemonize yes
./routr