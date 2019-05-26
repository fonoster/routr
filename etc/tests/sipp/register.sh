#!/usr/bin/env bash

SIPP_PORT=5080
ROUTR_HOST=192.168.1.127
SCENARIO_FILE=uac_register.xml
REGISTER_FILE=register.csv

docker pull ctaloi/sipp

docker run -it -p $SIPP_PORT:$SIPP_PORT/udp \
    -v $PWD:/sipp \
    ctaloi/sipp $ROUTR_HOST \
    -t t1 \
    -p $SIPP_PORT \
    -sf $SCENARIO_FILE \
    -inf $REGISTER_FILE \
    -r 5000 \
    -m 200000 \
    -l 100000
