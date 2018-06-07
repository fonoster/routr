@echo off
setlocal

if defined JAVA_HOME goto run
set JAVA_HOME=jre

:run
"%JAVA_HOME%\bin\jrunscript.exe" -Dlog4j.configurationFile=config/log4j2.xml -cp libs\app.deps.jar -e "var home = Packages.java.lang.System.getProperty('user.dir');load(home + '\\libs\\jvm-npm.js');load(home + '\\libs\\app.bundle.js')"

endlocal
@echo on