set main_js=etc\tests\test_helper.js

if defined JAVA_HOME goto run
echo 'Could not find a runtime environment. Please setup environment variable JAVA_HOME'
exit 1

run:

"%JAVA_HOME%\bin\jjs" -Dlog4j.configurationFile=./config/log4j2.xml -cp libs/app.deps.jar -doe=true -ot=true -strict=false -scripting=true %main_js% -- %*
