#!/usr/bin/env bash

[ -z "$JAVA_HOME" ] && { echo "Please setup the JAVA_HOME environment variable"; exit 1; }

echo "JAVA_HOME=$JAVA_HOME"

rm -rf jre

$JAVA_HOME/bin/jlink -c --no-man-pages --no-header-files -G \
  --module-path ${JAVA_HOME}/jmods/ \
  --add-modules \
  java.instrument,java.base,java.management,java.naming,java.sql,jdk.crypto.cryptoki,jdk.scripting.nashorn,jdk.management.agent,jdk.management.jfr,jdk.unsupported,jdk.unsupported.desktop \
  --output jre
