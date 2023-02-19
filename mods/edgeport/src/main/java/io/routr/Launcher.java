/*
 * Copyright (C) 2022 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr
 *
 * Licensed under the MIT License (the "License");
 * you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 *
 *    https://opensource.org/licenses/MIT
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.routr;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.HostAccess;

import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;

/**
 * Wrapper class for Routr.
 */
public class Launcher {
  private final static Logger LOG = LogManager.getLogger(HealthCheck.class);
  private static final String launchScript =
    "console = { log: print, warn: print, error: print };" +
      "var System = Java.type('java.lang.System');" +
      "load(System.getenv('HOME') + '/libs/jvm-npm.js');" +
      "load(System.getenv('HOME') + '/libs/edgeport.bundle.js')";

  static public void main(String... args) {
    try {
      new Launcher().launch();

      boolean enableHealthChecks = System.getenv().get("ENABLE_HEALTHCHECKS") != null && !System.getenv().get("ENABLE_HEALTHCHECKS").isEmpty()
          ? Boolean.parseBoolean(System.getenv().get("ENABLE_HEALTHCHECKS"))
          : true;

      if (enableHealthChecks) {
        new HealthCheck(8080).start();
      }
    } catch (Exception ex) {
      LOG.fatal("unable to run edgeport: " + ex.getMessage());
      System.exit(1);
    }
  }

  public void launch() throws ScriptException {
    String engine = System.getenv("JS_ENGINE");

    if (engine != null && engine.equals("graal.js")) {
      launchWithGraalJS();
    } else if (engine != null && engine.equals("nashorn")) {
      launchWithNashorn();
    } else {
      launchWithGraalJS();
    }
  }

  public void launchWithNashorn() throws ScriptException {
    ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
    engine.eval(launchScript);
  }

  public void launchWithGraalJS() {
    Context polyglot = Context
      .newBuilder()
      .allowExperimentalOptions(true)
      .allowHostAccess(HostAccess.ALL)
      .allowCreateThread(true)
      .option("js.nashorn-compat", "true")
      .allowExperimentalOptions(true)
      .allowIO(true)
      .allowAllAccess(true).build();

    polyglot.eval("js", launchScript);
  }
}