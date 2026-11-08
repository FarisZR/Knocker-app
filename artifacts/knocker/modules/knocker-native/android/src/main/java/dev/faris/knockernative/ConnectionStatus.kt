package dev.faris.knockernative

import android.os.SystemClock
import java.io.ByteArrayOutputStream
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import java.net.HttpURLConnection
import java.net.URL
import java.net.InetAddress
import org.json.JSONObject

/** Observation of this connection, deliberately separate from the last knock's grant. */
internal data class ConnectionStatus(val ipAddress: String, val whitelisted: Boolean, val expiresAt: Long?) {
  companion object {
    /** Validates explicit coverage and derives expiry from remaining server time. */
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
  val deadline = SystemClock.elapsedRealtime() + 4000L
  var connection: HttpURLConnection? = null
  var timeout: java.util.concurrent.ScheduledFuture<*>? = null
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
    val active = connection
    timeout = KnockerExecutors.deadlines.schedule({ active.disconnect() },
      (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0L), TimeUnit.MILLISECONDS)
    if (active.responseCode != 200) null
    else active.inputStream.use { input ->
      val bytes = ByteArrayOutputStream()
      val buffer = ByteArray(1024)
      while (true) {
        val remaining = deadline - SystemClock.elapsedRealtime()
        if (remaining <= 0) throw SocketTimeoutException("Status deadline exceeded")
        active.readTimeout = remaining.toInt()
        val count = input.read(buffer)
        if (count < 0) break
        require(bytes.size() + count <= 16384) { "Status response too large" }
        bytes.write(buffer, 0, count)
      }
      ConnectionStatus.parse(JSONObject(bytes.toString("UTF-8")))
    }
  } catch (_: Exception) { null }
  finally { timeout?.cancel(false); connection?.disconnect() }
}
