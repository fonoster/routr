#!/usr/bin/env sh

run_with_local_redis() {
    export SIPIO_DS_PROVIDER=redis_data_provider

    redis-server --daemonize yes &>/dev/null

    while ! nc -z localhost 6379; do
      sleep 0.1
    done
}

run_wrapped() {

# We wrapped the script because this some JAVA OPTS don't work with Nashorn
cat > SipIOLauncher.java <<- EOM
public class SipIOLauncher {
    static public void main(String... args) throws javax.script.ScriptException {
        javax.script.ScriptEngine engine = new javax.script.ScriptEngineManager().getEngineByName("nashorn");
        engine.eval("load ('libs/jvm-npm.js');load ('libs/app.bundle.js')");
    }
}
EOM

    javac SipIOLauncher.java
    rm SipIOLauncher.java
    java -Dlog4j.configurationFile=config/log4j2.xml \
    $SIPIO_JAVA_OPTS \
    -cp .:libs/app.deps.jar \
    SipIOLauncher
}

run() {
    jjs -Dlog4j.configurationFile=config/log4j2.xml \
        -cp libs/app.deps.jar \
        --optimistic-types=true \
        -dump-on-error=true sipio
}

[ -z "$SIPIO_EXTERN_ADDR" ] && { echo "Must define environment variable SIPIO_EXTERN_ADDR when running inside a container"; exit 1; }
[ -z "$SIPIO_LOCALNETS" ] && export SIPIO_LOCALNETS=$(ip addr show eth0 | grep "inet\b" | awk '{print $2}');
[ -z "$SIPIO_DS_PROVIDER" ] && run_with_local_redis;

if [ ! -z "$SIPIO_JAVA_OPTS" ] ; then
    run_wrapped
else
    run
fi

while sleep 3600; do :; done


docker run -it \
    -p 9090:9090 \
    -p 4567:4567 \
    -p 5060:5060 \
    -p 5060:5060/udp \
    -p 5061-5063:5061-5063 \
    -e SIPIO_EXTERN_ADDR=192.168.1.2 \
    fonoster/sipio