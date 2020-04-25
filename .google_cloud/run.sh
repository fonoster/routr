#!/usr/bin/env sh

redis-server --appendonly yes --daemonize yes
./routr