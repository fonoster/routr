@file:JvmName("JSContext")

package io.routr.core

import java.util.*
import org.apache.logging.log4j.LogManager
import org.graalvm.polyglot.Context
import org.graalvm.polyglot.HostAccess

fun createJSContext(src: String?, `var`: String = ""): Context {
  val LOG = LogManager.getLogger(Launcher::class.java)
  val baseScript =
      java.lang.String.join(
          System.getProperty("line.separator"),
          "var System = Java.type('java.lang.System')"
      )
  val ctx =
      Context.newBuilder("js")
          .allowExperimentalOptions(true)
          .allowIO(true)
          .allowHostClassLookup { true }
          .allowHostAccess(HostAccess.ALL)
          // .allowCreateThread(true)
          .build()
  ctx.eval("js", baseScript)
  ctx.getBindings("js").putMember(`var`, null)

  try {
    ctx.eval("js", src)
  } catch (ex: Exception) {
    LOG.error(ex.message)
  }

  return ctx
}
