#!/usr/bin/env sh
export HOME="$(cd "$(dirname "$0")"; pwd)"

[ -z "$LOG4J2" ] && LOG4J2=config/log4j2.yml
[ -z "$CONFIG_PATH" ] && export CONFIG_PATH=$(pwd)/config/edgeport.json
[ -z "$JAVA_HOME" ] && { echo "Could not find a runtime environment. Please setup environment variable JAVA_HOME"; exit 1; }

# TODO: Look into performance impact of not having runtime compilation context
export JAVA_OPTS="-Dlog4j.configurationFile=${LOG4J2} \
  -Dpolyglot.engine.WarnInterpreterOnly=false \
  -XX:CMSInitiatingOccupancyFraction=80 \
  -Dsun.rmi.dgc.client.gcInterval=3600000 \
  -Djava.net.preferIPv4Stack=true"

$JAVA_HOME/bin/java $JAVA_OPTS -classpath "${HOME}/libs/*" io.routr.Launcher