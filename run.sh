#!/usr/bin/env sh

[ -z "$SIPIO_EXTERN_ADDR" ] && { echo "Must define environment variable SIPIO_EXTERN_ADDR when running SipIO in a container"; exit 1; }
[ -z "$SIPIO_LOCALNETS" ] && { export SIPIO_LOCALNETS=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}'); }

jrunscript -Dlog4j.configurationFile=config/log4j2.xml -cp libs/app.deps.jar \
    -e "load('libs/jvm-npm.js'); load('libs/app.bundle.js')"

while sleep 3600; do :; done



