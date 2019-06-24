/**
 * @author Pedro Sanders
 * @since v1
 */
package com.fonoster.routr.core;

import org.graalvm.polyglot.Context;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

public class Launcher {
    private static String launchScript = "var System = Java.type('java.lang.System');"
        + "load(System.getProperty('user.dir') + '/libs/app.bundle.js')";
    private static String launchScriptDev = "var System = Java.type('java.lang.System');"
        + "load(System.getProperty('user.dir') + '/node_modules/@routr/core/main.js')";

    static public void main(String... args) {
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
        String launchScript = this.launchScript;

        if (mode != null && System.getenv("ROUTR_LAUNCH_MODE").equalsIgnoreCase("dev")) {
            launchScript = this.launchScriptDev;
        }

        if (engine != null && engine.equals("graal.js")) {
          launchWithGraalJS(launchScript);
        } else if (engine != null && engine.equals("nashorn")) {
          launchWithNashorn(launchScript);
        } else {
          launchWithNashorn(launchScript);
        }
    }

    public void launchWithNashorn(String launchScript) throws ScriptException {
        ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
        engine.put("timer", new Timer());
        engine.eval(launchScript);
    }

    public void launchWithGraalJS(String launchScript) {
        Context polyglot = Context
          .newBuilder()
          .option("js.nashorn-compat", "true")
          .allowExperimentalOptions(true)
          .allowIO(true)
          .allowAllAccess(true).build();

          polyglot.getBindings("js").putMember("timer", new Timer());
          polyglot.eval("js", launchScript);
    }
}
