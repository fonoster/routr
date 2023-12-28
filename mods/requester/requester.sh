#!/usr/bin/env sh
export HOME="$(cd "$(dirname "$0")"; pwd)"

[ -z "$LOG4J2" ] && LOG4J2=config/log4j2.yaml
[ -z "$JAVA_HOME" ] && { echo "Could not find a runtime environment. Please setup environment variable JAVA_HOME"; exit 1; }

export JAVA_OPTS="-Dlog4j.configurationFile=${LOG4J2} \
  -Dsun.rmi.dgc.client.gcInterval=3600000 \
  -Djava.net.preferIPv4Stack=true"

$JAVA_HOME/bin/java $JAVA_OPTS -classpath "${HOME}/libs/*" io.routr.requester.Launcher