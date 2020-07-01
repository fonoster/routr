package io.routr.core

import org.eclipse.jetty.websocket.api.Session
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage
import org.eclipse.jetty.websocket.api.annotations.WebSocket
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.io.IOException
import java.util.*
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * @author Pedro Sanders
 * @since v1
 */
@WebSocket
class LogsHandler {
    @OnWebSocketConnect
    fun connected(session: Session) {
        sessions.add(session)
    }

    @OnWebSocketClose
    fun closed(session: Session, statusCode: Int, reason: String) {
        sessions.remove(session)
    }

    @OnWebSocketMessage
    @Throws(IOException::class, InterruptedException::class)
    fun message(session: Session, message: String) {
        var br: BufferedReader? = null
        try {
            val base = if (System.getenv("DATA") != null) System.getenv("DATA") else "."
            val file = File("$base/logs/routr.log")
            br = BufferedReader(FileReader(file))
            while (true) {
                val line = br.readLine()
                if (line == null) { // end of file, start polling
                    Thread.sleep(5 * 1000.toLong())
                } else {
                    session.remote.sendString(line)
                }
            }
        } finally {
            br?.close()
        }
    }

    companion object {
        // Store sessions if you want to, for example, broadcast a message to all users
        private val sessions: Queue<Session> = ConcurrentLinkedQueue()
    }
}