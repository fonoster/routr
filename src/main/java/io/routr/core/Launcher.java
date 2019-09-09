/**
 * @author Pedro Sanders
 * @since v1
 */
package io.routr.core;

import java.util.TimerTask;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

import org.graalvm.polyglot.Context;
import org.apache.log4j.BasicConfigurator;
import org.apache.log4j.varia.NullAppender;

public class Launcher {
    private static String mainScript =
        "var System = Java.type('java.lang.System');"
            + "load(System.getProperty('user.dir') + '/libs/app.bundle.js')";
    private static String mainScriptDev =
        "var System = Java.type('java.lang.System');"
            + "load(System.getProperty('user.dir') + "
                + "'/node_modules/@routr/core/main.js')";
    private static String registryScript =
        "var System = Java.type('java.lang.System');"
            + "load(System.getProperty('user.dir') + "
                + "'/node_modules/@routr/registry/registry.js');"
                    + "new Registry().registerAll()";

    static public void main(String... args) {
        // Avoids old log4j and jetty logs
        System.setProperty("org.eclipse.jetty.LEVEL", "WARN");
        BasicConfigurator.configure(new NullAppender());
        try {
            new Launcher().launch();
        } catch(ScriptException ex) {
            System.out.println("Unable to run server: " + ex.getMessage());
        }
    }

    // TODO: Check Java version and show warning if version >= 11
    public void launch() throws ScriptException {
        String engine = System.getenv("ROUTR_JS_ENGINE");
        String mode = System.getenv("ROUTR_LAUNCH_MODE");
        String mainScript = this.mainScript;

        if (mode != null && System.getenv("ROUTR_LAUNCH_MODE")
            .equalsIgnoreCase("dev")) {
            mainScript = this.mainScriptDev;
        }

        if (engine != null && engine.equals("graal.js")) {
            launchWithGraalJS(mainScript, registryScript);
        } else if (engine != null && engine.equals("nashorn")) {
            launchWithNashorn(mainScript);
        } else {
            launchWithNashorn(mainScript);
        }
    }

    public void launchWithNashorn(String mainScript) throws ScriptException {
        ScriptEngine engine = new ScriptEngineManager()
            .getEngineByName("nashorn");
        engine.put("timer", new Timer());
        engine.eval(mainScript);
    }

    public void launchWithGraalJS(String mainScript, String registryScript) {
        Context mainCtx = Context
          .newBuilder()
          .option("js.nashorn-compat", "true")
          .allowExperimentalOptions(true)
          .allowIO(true)
          .allowAllAccess(true).build();

          mainCtx.eval("js", mainScript);

          java.util.Timer timer = new java.util.Timer();
          timer.schedule(new TimerTask() {
              @Override
              public void run () {
                  Context registryCtx = Context
                    .newBuilder()
                    .option("js.nashorn-compat", "true")
                    .allowExperimentalOptions(true)
                    .allowIO(true)
                    .allowAllAccess(true).build();
                    registryCtx.eval("js", registryScript);
                    registryCtx.close();
              }
          }, 10000, 60 * 1000);

    }
}
