/**
 * @author Pedro Sanders
 * @since v1
 */
package com.fonoster.routr.core;

public class Timer {

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
