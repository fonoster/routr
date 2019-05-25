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
    private static Timer timer = new Timer();

    static public void main(String... args) {
        new Launcher().launch();
    }

    public void launch() {
        String engine = System.getenv("ROUTR_JS_ENGINE");

        if (engine != null && engine.equals("graaljs")) {
          launchWithGraalJS();
        } else if (engine != null && engine.equals("nashorn")) {
          launchWithNashorn();
        } else {
          launchWithNashorn();
        }
    }

    public void launchWithNashorn() {
        try {
            ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
            engine.put("timer", timer);
            engine.eval(launchScript);
        } catch(ScriptException ex) {
            System.out.println("Unable to run with 'nashorn' engine: " + ex.getMessage());
        }
    }

    public void launchWithGraalJS() {
        Context polyglot = Context
          .newBuilder()
          .option("js.nashorn-compat", "true")
          .allowExperimentalOptions(true)
          .allowIO(true)
          .allowAllAccess(true).build();

          polyglot.getBindings("js").putMember("timer", timer);
          polyglot.eval("js", launchScript);
    }
}
