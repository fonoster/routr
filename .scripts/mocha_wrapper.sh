#!/usr/bin/env bash

[ -z "$JAVA_HOME" ] && { echo "Could not find a runtime environment. Please setup environment variable JAVA_HOME"; exit 1; }

$JAVA_HOME/bin/node --vm.classpath=$(for i in libs/*.jar ; do echo -n $i: ; done). \
  --vm.Dlog4j.configurationFile=config/log4j2.yaml \
  --jvm node_modules/mocha/bin/mocha --timeout 3000 "$@"