package io.routr.core

import com.google.gson.Gson

class Config {
  val bindAddr: String = "0.0.0.0"
  val port: Int = 4567
  val unsecured: Boolean = false
  val keyStorePassword: String? = null
  val keyStore: String? = null
  val trustStore: String? = null
  val trustStorePassword: String? = null
  val maxThreads: Int = 8
  val minThreads: Int = 8
  val timeoutMillis: Int = 5000
  val apiPath: String ?= null

  override fun toString(): String {
    return """
      Config(
        apiPath = $apiPath 
        bindAddr = $bindAddr 
        port = $port
        unsecured = $unsecured
        keyStorePassword = /REDACTED/
        keyStore = $keyStore
        trustStore = $trustStore
        trustStorePassword = /REDACTED/
        maxThreads = $maxThreads
        minThreads = $minThreads
        timeoutMillis = $timeoutMillis
      )
      """.trimIndent()
  }
}

fun jsonStringToConfig(jsonString: String): Config {
  return Gson().fromJson(jsonString, Config::class.java)
}
