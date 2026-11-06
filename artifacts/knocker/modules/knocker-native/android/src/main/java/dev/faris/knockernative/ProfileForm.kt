package dev.faris.knockernative

import java.net.URI
import java.net.InetAddress
import java.util.UUID
import org.json.JSONObject

/** Native editor values stay on the UI thread; only validated saved settings cross the bridge. */
internal data class ProfileForm(
  val id: String = UUID.randomUUID().toString(),
  val name: String = "",
  val endpoint: String = "",
  val key: String = "",
  val ttl: String = "",
  val remote: Boolean = false,
  val ip: String = "",
  val onOpen: Boolean = true,
  val renew: Boolean = true,
  val safety: String = "300",
  val pinned: Boolean = false,
  val slot: Int? = null
) {
  /** Reports actionable field errors without DNS lookups or coercing invalid numbers. */
  fun errors(): Map<String, String> = buildMap {
    if (name.isBlank()) put("name", "Enter a profile name")
    val url = runCatching { URI(endpoint.trim()) }.getOrNull()
    if (url == null || !url.scheme.equals("https", ignoreCase = true) || url.host.isNullOrBlank() || url.rawUserInfo != null || url.rawFragment != null)
      put("endpoint", "Enter an HTTPS URL, such as https://knock.example.com")
    if (key.isBlank()) put("key", "Enter the API key")
    if (ttl.isNotBlank() && (ttl.toIntOrNull() ?: 0) <= 0) put("ttl", "Enter positive seconds or leave blank")
    if (renew && (safety.toIntOrNull() ?: -1) < 0) put("safety", "Enter zero or positive seconds")
    if (remote && !isIpTarget(ip.trim())) put("ip", "Enter an IPv4, IPv6 or CIDR target")
  }

  /** Produces settings only; the shared store merges current grants and attempt metadata. */
  fun toJson(): String = JSONObject().apply {
    put("id", id); put("name", name.trim()); put("endpointUrl", endpoint.trim()); put("apiKey", key.trim())
    put("ttlSeconds", ttl.toIntOrNull() ?: JSONObject.NULL)
    put("ipOverride", if (remote) ip.trim() else JSONObject.NULL)
    put("knockOnOpen", onOpen); put("autoRenew", renew)
    put("autoRenewSafetyWindowSec", safety.toIntOrNull() ?: 300)
    put("pinnedToHome", pinned); put("tileSlot", slot ?: JSONObject.NULL)
  }.toString()

  companion object {
    /** Initializes a draft once per destination, excluding volatile grant metadata. */
    fun from(profile: JSONObject): ProfileForm = ProfileForm(
      id = profile.getString("id"), name = profile.optString("name"), endpoint = profile.optString("endpointUrl"),
      key = profile.optString("apiKey"), ttl = profile.textOrNull("ttlSeconds").orEmpty(),
      remote = !profile.textOrNull("ipOverride").isNullOrBlank(), ip = profile.textOrNull("ipOverride").orEmpty(),
      onOpen = profile.optBoolean("knockOnOpen", true), renew = profile.optBoolean("autoRenew", true),
      safety = profile.optInt("autoRenewSafetyWindowSec", 300).toString(),
      pinned = profile.optBoolean("pinnedToHome"), slot = profile.textOrNull("tileSlot")?.toIntOrNull()
    )

    /** Accepts numeric address literals only, so validation never discloses a hostname to DNS. */
    internal fun isIpTarget(value: String): Boolean {
      val parts = value.split('/')
      if (parts.size !in 1..2) return false
      val address = parts[0]
      val ipv6 = ':' in address
      if (ipv6) {
        if (!address.matches(Regex("[0-9a-fA-F:.]+"))) return false
        if (runCatching { InetAddress.getByName(address) }.isFailure) return false
      } else {
        val bytes = address.split('.')
        if (bytes.size != 4 || bytes.any { it.isEmpty() || !it.all(Char::isDigit) || (it.toIntOrNull() ?: -1) !in 0..255 }) return false
      }
      return parts.size == 1 || parts[1].toIntOrNull()?.let { it in 0..if (ipv6) 128 else 32 } == true
    }
  }
}

/** JSON null must not become the literal string "null" in native text fields. */
internal fun JSONObject.textOrNull(key: String): String? =
  if (!has(key) || isNull(key)) null else optString(key)
