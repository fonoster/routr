#!/usr/bin/env sh

export ROUTR_EXTERN_ADDR=no-op
ENV PORT 4567
redis-server --appendonly yes --daemonize yes
./routr