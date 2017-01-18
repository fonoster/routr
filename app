#!/usr/bin/env sh
main_js="$(pwd)/main.js"

for i in $(ls lib); do
    DEPS+="lib/$i:";
done;

JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-9.jdk/Contents/Home

if [[ $(echo $JAVA_HOME 2>&1) != *"jdk-9"* ]];
then
    echo 'This app requires some  features from JS Nashorn (including ES6)';
    echo 'that are only available in Java 9. You must install Java 9!'
    echo 'Once installed just open the file ./app an replace JAVA_HOME with'
    echo 'the path to your JDK 9.'
    exit;
fi

# Replace

jjs -Dlog4j.configurationFile=config/log4j2.xml \
    -cp $DEPS --language=es6 -fv -doe -ot -scripting=true "$main_js" -- "$@"