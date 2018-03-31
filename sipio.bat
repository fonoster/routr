@echo off

.\jre\bin\jrunscript.exe -Dlog4j.configurationFile=config/log4j2.xml -cp libs\app.deps.jar -e "var home = Packages.java.lang.System.getProperty('user.dir');load(home + '\\libs\\jvm-npm.js');load(home + '\\libs\\app.bundle.js')"

@echo on