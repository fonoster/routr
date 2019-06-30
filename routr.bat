@echo off
setlocal

set BASE_DIR=%~dp0

if exist %BASE_DIR%jre (set JAVA_HOME=%BASE_DIR%jre)
if defined JAVA_HOME goto run
echo 'Could not find a runtime environment. Please setup environment variable JAVA_HOME'
exit 1

:run
cd %BASE_DIR%
REM Uncomment to activate jvm profiler. You must use a full JVM(not the custom one) to profile CPU usage
REM set ROUTR_JAVA_OPTS=-javaagent:libs/jvm-profiler-master-SNAPSHOT.jar=reporter=com.uber.profiling.reporters.FileOutputReporter,outputDir=out,tag=routr,metricInterval=5000
"%JAVA_HOME%\bin\java" %ROUTR_JAVA_OPTS% -Dlog4j.configurationFile=config\log4j2.xml -classpath libs\* com.fonoster.routr.core.Launcher

endlocal
@echo on
