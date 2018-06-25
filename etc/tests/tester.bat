set main_js=etc\tests\test_helper.js

"%JAVA_HOME%\bin\jjs" -Dlog4j.configurationFile=./config/log4j2.xml -cp libs/app.deps.jar -doe=true -ot=true -strict=false -scripting=true %main_js% -- %*
