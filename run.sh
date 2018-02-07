#!/usr/bin/env sh

[ -z "$EXTERN_ADDR" ] && { echo "Must define environment variable EXTERN_ADDR when running SipIO in a container"; exit 1; }
[ -z "$LOCALNETS" ] && { export LOCALNETS=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}'); }

jrunscript -Dlog4j.configurationFile=config/log4j2.xml -cp libs/app.deps.jar \
    -e "load('libs/jvm-npm.js'); load('libs/app.bundle.js')"

while sleep 3600; do :; done



