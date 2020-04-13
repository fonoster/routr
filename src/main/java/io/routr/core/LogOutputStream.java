package io.routr.core;

import java.io.IOException;
import java.io.OutputStream;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.LogManager;

/**
 * @author Pedro Sanders
 * @since v1
 */
public class LogOutputStream extends OutputStream {

    private static final Logger LOG = LogManager.getLogger();
    private StringBuilder sb = new StringBuilder();

    @Override
    public void write(int b) throws IOException {
        if (b == '\n') {
            LOG.debug(sb.toString());
            sb.setLength(0);
        } else {
            sb.append((char) b);
        }
    }
}
