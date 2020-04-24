@file:JvmName("VersionUtil")

package io.routr.util

fun getVersion(): Int {
    var version = System.getProperty("java.version")
    if(version.startsWith("1.")) {
      version = version.substring(2, 3)
    } else {
      val dot = version.indexOf(".")
      if(dot != -1) {
        version = version.substring(0, dot)
      }
    }
    return Integer.parseInt(version)
}
