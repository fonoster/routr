#!/usr/bin/env sh

[ -z "$CONFIG_PATH" ] && export CONFIG_PATH=$(pwd)/config/edgeport.json
[ -z "$JAVA_HOME" ] && { echo "Could not find a runtime environment. Please setup environment variable JAVA_HOME"; exit 1; }

export JAVA_OPTS="-Dpolyglot.js.experimental-foreign-object-prototype=true -Dpolyglot.js.nashorn-compat=true -Dnashorn.args=--language=es6 -Xmn256m -Xmx7000M -Xms1024M -XX:CMSInitiatingOccupancyFraction=80 -Dsun.rmi.dgc.client.gcInterval=3600000 -Djava.net.preferIPv4Stack=true"

$JAVA_HOME/bin/java $JAVA_OPTS -classpath "libs/*" io.routr.Launcher