#!/usr/bin/env bash

[ -z "$GRAALVM_HOME" ] && { echo "Could not find a runtime environment. Please setup environment variable GRAALVM_HOME"; exit 1; }

$GRAALVM_HOME/bin/node --vm.classpath=$(for i in libs/*.jar ; do echo -n $i: ; done). \
  --vm.Dlog4j.configurationFile=config/log4j2.yml \
  --jvm node_modules/mocha/bin/mocha --timeout 3000 "$@"