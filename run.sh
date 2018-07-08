#!/usr/bin/env sh

run_with_local_redis() {
    export ROUTR_DS_PROVIDER=redis_data_provider

    redis-server --daemonize yes &>/dev/null

    while ! nc -z localhost 6379; do
      sleep 0.1
    done
}

run_wrapped() {

# Wrapped the script because we can't pass JAVA OPTS directly into Nashorn
cat > RoutrLauncher.java <<- EOM
public class RoutrLauncher {
    static public void main(String... args) throws javax.script.ScriptException {
        javax.script.ScriptEngine engine = new javax.script.ScriptEngineManager().getEngineByName("nashorn");
        engine.eval("load ('libs/jvm-npm.js');load ('libs/app.bundle.js')");
    }
}
EOM

    javac RoutrLauncher.java
    rm RoutrLauncher.java
    java -Dlog4j.configurationFile=config/log4j2.xml \
    $ROUTR_JAVA_OPTS \
    -cp .:libs/app.deps.jar \
    RoutrLauncher
}

run() {
    jjs -Dlog4j.configurationFile=config/log4j2.xml \
        -cp libs/app.deps.jar \
        --optimistic-types=true \
        -dump-on-error=true routr
}

[ -z "$ROUTR_EXTERN_ADDR" ] && { echo "Must define environment variable ROUTR_EXTERN_ADDR when running inside a container"; exit 1; }
[ -z "$ROUTR_LOCALNETS" ] && export ROUTR_LOCALNETS=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}');
[ -z "$ROUTR_DS_PROVIDER" ] && run_with_local_redis;

if [ ! -z "$ROUTR_JAVA_OPTS" ] ; then
    run_wrapped
else
    run
fi

while sleep 3600; do :; done
