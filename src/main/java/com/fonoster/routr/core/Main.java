/**
 * @author Pedro Sanders
 * @since v1
 */
package com.fonoster.routr.core;

import org.graalvm.polyglot.Context;

public class Main {

    static public void main(String... args) {
        new Main().jsLaunch();
    }

    public void jsLaunch() {
        Context polyglot = Context
          .newBuilder()
          .allowExperimentalOptions(true)
          .allowIO(true)
          .allowAllAccess(true).build();

          Timer timer = new Timer();
          polyglot.getBindings("js").putMember("timer", timer);

          polyglot.eval("js", "const System = Java.type('java.lang.System');"
            + "load(System.getProperty('user.dir') + '/mod/core/main.js')");
    }

    public static class Timer {

        public void schedule(final JSFunc func, long delay, long period) {
            java.util.Timer timer = new java.util.Timer();
            timer.schedule(new java.util.TimerTask() {
                @Override
                public void run () {
                    func.execute();
                }
            }, delay, period);
        }
    }

    public interface JSFunc {
       void execute();
    }

}
