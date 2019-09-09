/**
 * @author Pedro Sanders
 * @since v1
 */
package io.routr.core;

import java.util.TimerTask;

public class Timer {
    public void schedule(final JSFunc func, long delay, long period) {
        java.util.Timer timer = new java.util.Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run () {
                func.execute();
            }
        }, delay, period);
    }
}
