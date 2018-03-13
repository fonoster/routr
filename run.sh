#!/usr/bin/env sh

run_local_redis() {
    export SIPIO_DS_PROVIDER=redis_data_provider

    redis-server --daemonize yes &>/dev/null

    while ! nc -z localhost 6379; do
      sleep 0.1
    done
}

[ -z "$SIPIO_EXTERN_ADDR" ] && { echo "Must define environment variable SIPIO_EXTERN_ADDR when running inside a container"; exit 1; }
[ -z "$SIPIO_LOCALNETS" ] && { export SIPIO_LOCALNETS=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}'); }
[ -z "$SIPIO_DS_PROVIDER" ] && run_local_redis

jrunscript -Dlog4j.configurationFile=config/log4j2.xml -cp libs/app.deps.jar \
    -e "load('libs/jvm-npm.js'); load('libs/app.bundle.js')"

while sleep 3600; do :; done
