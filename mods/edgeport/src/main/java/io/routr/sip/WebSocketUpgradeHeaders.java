/*
 * Copyright (C) 2026 by Fonoster Inc (https://fonoster.com)
 * http://github.com/fonoster/routr
 *
 * This file is part of Routr.
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
package io.routr.sip;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

/**
 * Holds back a WebSocket upgrade request until it is complete and rewrites
 * the header names JAIN-SIP reads to the case it expects.
 *
 * <p>JAIN-SIP 1.3.0-91 answers the upgrade in
 * {@code WebSocketHttpHandshake.createHttpResponse}, which stores each header
 * in a HashMap under its name exactly as received and then looks up
 * {@code Sec-WebSocket-Key}, {@code Sec-WebSocket-Protocol}, {@code Host},
 * {@code Origin} and {@code Protocol} case-sensitively. HTTP header names are
 * case-insensitive (RFC 9110), and Node's built-in WebSocket and HTTP/2 front
 * ends send them in lowercase. The 101 then carries no
 * {@code Sec-WebSocket-Protocol}, and its {@code Sec-WebSocket-Accept} is
 * computed from {@code null} instead of the client's key, so the client
 * closes the connection (fonoster/routr#432).
 *
 * <p>The stock channel also answers as soon as a read ends in a line break,
 * so a request split across reads gets a 101 built from its first lines
 * only. Waiting for the blank line that ends the request fixes that too, and
 * is what lets a header name split across reads be rewritten.
 *
 * <p>One instance per channel. It is fed from the channel's selector thread
 * only, like the stock {@code addBytes}.
 */
final class WebSocketUpgradeHeaders {

  /** Past this many bytes without a blank line, give up and pass bytes through. */
  private static final int MAX_HEAD_BYTES = 16 * 1024;

  /** The names {@code WebSocketHttpHandshake} looks up, keyed by their lowercase form. */
  private static final Map<String, String> CANONICAL_NAMES = Map.of(
      "host", "Host",
      "origin", "Origin",
      "protocol", "Protocol",
      "sec-websocket-key", "Sec-WebSocket-Key",
      "sec-websocket-protocol", "Sec-WebSocket-Protocol");

  private ByteArrayOutputStream head = new ByteArrayOutputStream();

  /**
   * Returns the bytes to hand to JAIN-SIP now, or {@code null} while the
   * request is still incomplete. Once the request has been passed on, every
   * later read is returned unchanged.
   */
  byte[] accept(byte[] bytes) {
    if (head == null) {
      return bytes;
    }
    head.writeBytes(bytes);
    byte[] buffered = head.toByteArray();
    int end = endOfHead(buffered);
    if (end < 0) {
      if (buffered.length <= MAX_HEAD_BYTES) {
        return null;
      }
      // Not a request we can make sense of; leave it to JAIN-SIP as before.
      head = null;
      return buffered;
    }
    head = null;

    String request = new String(buffered, 0, end, StandardCharsets.ISO_8859_1);
    if (request.startsWith("HTTP")) {
      // A response to an upgrade we sent; JAIN-SIP only logs it.
      return buffered;
    }
    byte[] rewritten = canonicalize(request).getBytes(StandardCharsets.ISO_8859_1);
    byte[] out = new byte[rewritten.length + buffered.length - end];
    System.arraycopy(rewritten, 0, out, 0, rewritten.length);
    System.arraycopy(buffered, end, out, rewritten.length, buffered.length - end);
    return out;
  }

  /** Index just past the {@code \r\n\r\n} that ends the request, or -1. */
  private static int endOfHead(byte[] bytes) {
    for (int i = 0; i + 3 < bytes.length; i++) {
      if (bytes[i] == '\r' && bytes[i + 1] == '\n' && bytes[i + 2] == '\r' && bytes[i + 3] == '\n') {
        return i + 4;
      }
    }
    return -1;
  }

  static String canonicalize(String request) {
    String[] lines = request.split("\r\n", -1);
    StringBuilder out = new StringBuilder(request.length());
    for (int i = 0; i < lines.length; i++) {
      String line = lines[i];
      int colon = line.indexOf(':');
      if (i > 0 && colon > 0) {
        String canonical = CANONICAL_NAMES.get(
            line.substring(0, colon).trim().toLowerCase(Locale.ROOT));
        if (canonical != null) {
          line = canonical + line.substring(colon);
        }
      }
      if (i > 0) {
        out.append("\r\n");
      }
      out.append(line);
    }
    return out.toString();
  }
}
