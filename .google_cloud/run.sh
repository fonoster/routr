#!/usr/bin/env sh

export ROUTR_EXTERN_ADDR=no-op
redis-server --appendonly yes --daemonize yes
python -m SimpleHTTPServer 8080 &
./routr