/**
 * @author Pedro Sanders
 * @since v1
 */
package com.fonoster.routr.core;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.graalvm.polyglot.Context;

public class Main {
    private Logger LOG = LogManager.getLogger();

    static public void main(String... args) {
        new Main().jsLaunch();
    }

    public void jsLaunch() {
        Context polyglot = Context
          .newBuilder("js")
          .allowExperimentalOptions(true)
          .allowIO(true)
          .allowHostAccess(true).build();

          polyglot.eval("js", "const System = Java.type('java.lang.System');"
            + "load(System.getProperty('user.dir') + '/node_modules/jvm-npm/src/main/javascript/jvm-npm.js');"
            + "load(System.getProperty('user.dir') + '/mod/core/main.js');");
    }
}
