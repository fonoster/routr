#!/usr/bin/jjs -Dlog4j.configurationFile=config/log4j2.xml -cp libs/app.deps.jar -doe=true -ot=true -scripting=true

// Ctl expects to find this variable
var args = arguments

load ('libs/jvm-npm.js')
load ('libs/ctl.bundle.js')
