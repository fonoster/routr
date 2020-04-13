package io.routr.core;

import org.eclipse.jetty.websocket.api.*;
import org.eclipse.jetty.websocket.api.annotations.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.lang.System;

/**
 * @author Pedro Sanders
 * @since v1
 */
 @WebSocket
 public class LogsHandler {

     // Store sessions if you want to, for example, broadcast a message to all users
     private static final Queue<Session> sessions = new ConcurrentLinkedQueue<>();

     @OnWebSocketConnect
     public void connected(Session session) {
         sessions.add(session);
     }

     @OnWebSocketClose
     public void closed(Session session, int statusCode, String reason) {
         sessions.remove(session);
     }

     @OnWebSocketMessage
     public void message(Session session, String message) throws IOException, InterruptedException{
        BufferedReader br = null;
        try {
            String base = System.getenv("ROUTR_DATA") != null
              ? System.getenv("ROUTR_DATA")
              : ".";
            File file = new File(base + "/logs/routr.log");
            br = new BufferedReader( new FileReader(file) );
            while (true) {
              String line = br.readLine();
              if (line == null) { // end of file, start polling
                  Thread.sleep(5 * 1000);
              } else {
                  session.getRemote().sendString(line);
              }
            }
        } finally {
          if (br != null) br.close();
        }
     }

 }
