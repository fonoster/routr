@echo off
setlocal

if defined JAVA_HOME goto run
set JAVA_HOME=jre

:run
"%JAVA_HOME%\bin\java" %ROUTR_JAVA_OPTS% -Dlog4j.configurationFile=config/log4j2.xml -classpath libs\* com.fonoster.routr.core.Launcher

endlocal
@echo on
