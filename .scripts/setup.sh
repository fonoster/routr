#!/usr/bin/env bash

[ -z "$JAVA_HOME" ] && { echo "Could not find a runtime environment. Please setup environment variable JAVA_HOME"; exit 1; }

./gradlew build copyRuntimeLibs