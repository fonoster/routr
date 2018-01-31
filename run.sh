#!/usr/bin/env bash

[ -z "$EXTERN_ADDR" ] && { echo "Must define environment variable EXTERN_ADDR when running SipIO in a container"; exit 1; }
[ -z "$LOCALNETS" ] && { export LOCALNETS=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}'); }

./sipio && sleep infinity