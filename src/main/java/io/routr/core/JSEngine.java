package io.routr.core;

/**
 * @author Pedro Sanders
 * @since v1
 */
public enum JSEngine {
    GRAALJS("graal.js"),
    NASHORN("nashorn");

    // String value for this enum.
    private String name;

    private JSEngine(String name) {
        this.name = name;
    }

    /**
     * Get command enum.
     *
     * @param command command as text.
     * @return command as enum
     */
    static public JSEngine get(String name) {
        for (JSEngine e : JSEngine.values()) {
            if (e.name.equals(name)) {
                return e;
            }
        }

        return null;
    }

    public String getName() {
        return name;
    }
}
