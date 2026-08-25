package dev.faris.knockernative

import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

sealed interface KnockOutcome {
  data class Success(
    val expiresAtMillis: Long?,
    val whitelistedEntry: String?,
    val expiresInSeconds: Long?,
    val requestedTtlSeconds: Int?,
    val ttlCapped: Boolean
  ) : KnockOutcome

  data class Failure(
    val status: Int?,
    val message: String
  ) : KnockOutcome
}

object KnockerHttp {
  fun knock(profile: StoredProfile): KnockOutcome {
    if (!profile.canKnock()) {
      return KnockOutcome.Failure(null, "Profile is not fully configured")
    }

    val body = JSONObject().apply {
      profile.ipOverride?.trim()?.takeIf { it.isNotEmpty() }?.let {
        put("ip_address", it)
      }
      profile.ttlSeconds?.takeIf { it > 0 }?.let {
        put("ttl", it)
      }
    }

    var connection: HttpURLConnection? = null

    return try {
      val url = URL(profile.endpointUrl.trimEnd('/') + "/knock")
      connection = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 10_000
        readTimeout = 10_000
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("X-Api-Key", profile.apiKey)
        setRequestProperty("Accept", "application/json")
      }

      if (body.length() > 0) {
        connection.doOutput = true
        connection.outputStream.use { output ->
          output.write(body.toString().toByteArray(Charsets.UTF_8))
        }
      }

      val status = connection.responseCode
      val stream = if (status in 200..299) connection.inputStream else connection.errorStream
      val payload = stream.readTextSafely()

      if (status !in 200..299) {
        val message = payload?.let(::extractErrorMessage)
          ?: connection.responseMessage
          ?: "Request failed"
        return KnockOutcome.Failure(status, message)
      }

      val json = payload?.let { JSONObject(it) } ?: JSONObject()
      val requestedTtl = profile.ttlSeconds?.takeIf { it > 0 }
      val expiresInSeconds = json.optNullableLong("expires_in_seconds")
      val ttlCapped = requestedTtl != null &&
        expiresInSeconds != null &&
        expiresInSeconds > 0 &&
        expiresInSeconds < requestedTtl.toLong() - 5L
      KnockOutcome.Success(
        expiresAtMillis = json.optNullableLong("expires_at")?.times(1000L),
        whitelistedEntry = json.optNullableString("whitelisted_entry"),
        expiresInSeconds = expiresInSeconds,
        requestedTtlSeconds = requestedTtl,
        ttlCapped = ttlCapped
      )
    } catch (error: Exception) {
      val message = when (error) {
        is java.net.SocketTimeoutException -> "Network timeout"
        else -> error.message ?: "Network error"
      }
      KnockOutcome.Failure(null, message)
    } finally {
      connection?.disconnect()
    }
  }

  private fun InputStream?.readTextSafely(): String? {
    if (this == null) return null
    return use { input ->
      input.bufferedReader().use { it.readText() }
    }.takeIf { it.isNotBlank() }
  }

  private fun extractErrorMessage(raw: String): String {
    return try {
      val json = JSONObject(raw)
      json.optNullableString("error") ?: raw
    } catch (_: Exception) {
      raw
    }
  }

  private fun JSONObject.optNullableLong(key: String): Long? {
    if (isNull(key) || !has(key)) return null
    return optLong(key)
  }

  private fun JSONObject.optNullableString(key: String): String? {
    if (isNull(key) || !has(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
  }
}
