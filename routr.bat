@echo off
setlocal

set BASE_DIR=%~dp0
set RESTART_CODE=123

if exist %BASE_DIR%jre (set JAVA_HOME=%BASE_DIR%jre)
if "%ROUTR_LOG4J2%"=="" (set ROUTR_LOG4J2=config\log4j2.yml)
if defined JAVA_HOME goto run
echo 'Could not find a runtime environment. Please setup the JAVA_HOME environment variable '
exit 1

:run
cd %BASE_DIR%
set ROUTR_JAVA_OPTS=%ROUTR_JAVA_OPTS% -Dgraal.TruffleFunctionInlining=false -Dgraal.CompilationFailureAction=Silent -Dpolyglot.js.experimental-foreign-object-prototype=true -Dpolyglot.js.nashorn-compat=true -Dnashorn.args="--no-deprecation-warning"
"%JAVA_HOME%\bin\java" %ROUTR_JAVA_OPTS% -Dlog4j.configurationFile=%ROUTR_LOG4J2% -classpath %BASE_DIR%\libs\* io.routr.core.Launcher

if "%ERRORLEVEL%"=="%RESTART_CODE%" goto run

endlocal
@echo on
