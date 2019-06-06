@echo off
setlocal

set BASE_DIR=%~dp0

if exist %BASE_DIR%jre (set JAVA_HOME=%BASE_DIR%jre)
if defined JAVA_HOME goto run
echo 'Could not find a runtime environment'
exit 1

:run
cd %BASE_DIR%
"%JAVA_HOME%\bin\java" %ROUTR_JAVA_OPTS% -Dlog4j.configurationFile=config\log4j2.xml -classpath libs\* com.fonoster.routr.core.Launcher

endlocal
@echo on
