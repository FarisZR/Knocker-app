package dev.faris.knockernative

import java.net.HttpURLConnection
import java.net.URL
import java.net.InetAddress
import org.json.JSONObject

/** Observation of this connection, deliberately separate from the last knock's grant. */
internal data class ConnectionStatus(val ipAddress: String, val whitelisted: Boolean, val expiresAt: Long?) {
  companion object {
    fun parse(json: JSONObject): ConnectionStatus {
      val ip = json.getString("ip_address")
      // Restrict syntax before parsing so malformed payloads can never cause DNS lookups.
      require(ip.contains(":") || ip.matches(Regex("[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+")))
      InetAddress.getByName(ip)
      val covered = json.get("whitelisted") as Boolean
      val seconds = json.get("expires_in_seconds") as Number
      require(seconds.toLong() >= 0 && seconds.toDouble() == seconds.toLong().toDouble())
      if (covered) require(json.get("expires_at") is Number && json.getLong("expires_at") > 0)
      else require(json.has("expires_at") && json.isNull("expires_at") && seconds.toLong() == 0L)
      return ConnectionStatus(ip, covered, if (covered) System.currentTimeMillis() + seconds.toLong() * 1000L else null)
    }
  }
}

/** Reads status over the same captured network used to identify the observation. */
internal fun checkConnectionStatus(profile: StoredProfile, captured: KnockerNetwork.Connection): ConnectionStatus? {
  var connection: HttpURLConnection? = null
  return try {
    val url = URL(profile.endpointUrl.trimEnd('/') + "/status")
    connection = ((captured.network?.openConnection(url) ?: url.openConnection()) as HttpURLConnection).apply {
      requestMethod = "GET"
      connectTimeout = 4000
      readTimeout = 4000
      instanceFollowRedirects = false
      useCaches = false
      setRequestProperty("X-Api-Key", profile.apiKey)
      setRequestProperty("Accept", "application/json")
    }
    if (connection.responseCode != 200) null
    else connection.inputStream.bufferedReader().use { ConnectionStatus.parse(JSONObject(it.readText())) }
  } catch (_: Exception) { null }
  finally { connection?.disconnect() }
}
