#!/usr/bin/env bash

SIPP_PORT=5080
ROUTR_HOST=192.168.1.127
SCENARIO_FILE=uac_register.xml
REGISTER_FILE=register.csv
REPORT_FILE=report.trace

docker pull ctaloi/sipp

docker run -it -p $SIPP_PORT:$SIPP_PORT/udp \
    -v $PWD:/sipp \
    ctaloi/sipp $ROUTR_HOST \
    -t t1 \
    -trace_err \
    -trace_stat \
    -p $SIPP_PORT \
    -sf $SCENARIO_FILE \
    -inf $REGISTER_FILE \
    -r 1400 \
    -m 200000 \
    -l 1400
    #-rate_increase 1000 -fd 5s
