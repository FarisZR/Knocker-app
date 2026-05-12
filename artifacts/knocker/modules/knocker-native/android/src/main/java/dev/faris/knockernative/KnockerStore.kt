package dev.faris.knockernative

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class StoredProfile(
  val id: String,
  val name: String,
  val endpointUrl: String,
  val apiKey: String,
  val ttlSeconds: Int?,
  val ipOverride: String?,
  val autoRenew: Boolean,
  val autoRenewSafetyWindowSec: Int,
  val tileSlot: Int?,
  val expiresAt: Long?
) {
  fun canKnock(): Boolean {
    return endpointUrl.isNotBlank() && apiKey.isNotBlank()
  }

  fun renewalAtMillis(): Long? {
    if (!autoRenew || expiresAt == null) return null
    return expiresAt - autoRenewSafetyWindowSec.toLong() * 1000L
  }

  fun withExpiresAt(nextExpiresAt: Long?): StoredProfile {
    return copy(expiresAt = nextExpiresAt)
  }
}

object KnockerStore {
  private const val PROFILES_KEY = "profiles"

  fun replaceProfiles(context: Context, profilesJson: String) {
    val profiles = parseProfiles(profilesJson)
    writeProfiles(context, profiles)
  }

  fun readProfiles(context: Context): List<StoredProfile> {
    val raw = preferences(context).getString(PROFILES_KEY, "[]") ?: "[]"
    return parseProfiles(raw)
  }

  fun findProfileById(context: Context, profileId: String): StoredProfile? {
    return readProfiles(context).firstOrNull { it.id == profileId }
  }

  fun findProfileBySlot(context: Context, slot: Int): StoredProfile? {
    return readProfiles(context).firstOrNull { it.tileSlot == slot }
  }

  fun updateExpiry(
    context: Context,
    profileId: String,
    expiresAt: Long?
  ): StoredProfile? {
    val profiles = readProfiles(context).toMutableList()
    val index = profiles.indexOfFirst { it.id == profileId }
    if (index < 0) return null

    val updated = profiles[index].withExpiresAt(expiresAt)
    profiles[index] = updated
    writeProfiles(context, profiles)
    return updated
  }

  private fun preferences(context: Context): SharedPreferences {
    return KnockerPrefs.preferences(context)
  }

  private fun writeProfiles(context: Context, profiles: List<StoredProfile>) {
    val json = JSONArray()
    for (profile in profiles) {
      json.put(profile.toJson())
    }
    preferences(context).edit().putString(PROFILES_KEY, json.toString()).apply()
  }

  private fun parseProfiles(raw: String): List<StoredProfile> {
    return try {
      val json = JSONArray(raw)
      buildList(json.length()) {
        for (index in 0 until json.length()) {
          val objectJson = json.optJSONObject(index) ?: continue
          val id = objectJson.optString("id").trim()
          if (id.isBlank()) continue
          add(
            StoredProfile(
              id = id,
              name = objectJson.optString("name").trim(),
              endpointUrl = objectJson.optString("endpointUrl").trim(),
              apiKey = objectJson.optString("apiKey"),
              ttlSeconds = objectJson.optNullableInt("ttlSeconds"),
              ipOverride = objectJson.optNullableString("ipOverride"),
              autoRenew = objectJson.optBoolean("autoRenew", false),
              autoRenewSafetyWindowSec = objectJson.optInt("autoRenewSafetyWindowSec", 300),
              tileSlot = objectJson.optNullableInt("tileSlot"),
              expiresAt = objectJson.optNullableLong("expiresAt")
            )
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun StoredProfile.toJson(): JSONObject {
    return JSONObject().apply {
      put("id", id)
      put("name", name)
      put("endpointUrl", endpointUrl)
      put("apiKey", apiKey)
      putNullable("ttlSeconds", ttlSeconds)
      putNullable("ipOverride", ipOverride)
      put("autoRenew", autoRenew)
      put("autoRenewSafetyWindowSec", autoRenewSafetyWindowSec)
      putNullable("tileSlot", tileSlot)
      putNullable("expiresAt", expiresAt)
    }
  }

  private fun JSONObject.putNullable(key: String, value: Any?) {
    put(key, value ?: JSONObject.NULL)
  }

  private fun JSONObject.optNullableInt(key: String): Int? {
    if (isNull(key) || !has(key)) return null
    return optInt(key)
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
