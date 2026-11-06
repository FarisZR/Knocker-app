package dev.faris.knockernative

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import java.io.IOException
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
  val expiresAt: Long?,
  val whitelistedAt: Long? = null,
  val whitelistedEntry: String? = null,
  val grantNetworkId: String? = null,
  val grantNetworkType: String? = null,
  val knockOnOpen: Boolean = false,
  val configurationFingerprint: String = "",
  val grantConfigurationFingerprint: String = "",
  val grantRecordedAt: Long? = null
) {
  fun canKnock(): Boolean {
    return endpointUrl.isNotBlank() && apiKey.isNotBlank()
  }

  fun renewalAtMillis(): Long? {
    if (!autoRenew || expiresAt == null) return null
    return expiresAt - autoRenewSafetyWindowSec.toLong() * 1000L
  }

  fun withGrant(grant: KnockOutcome.Success): StoredProfile = copy(
    expiresAt = grant.expiresAtMillis,
    whitelistedAt = grant.whitelistedAtMillis,
    whitelistedEntry = grant.whitelistedEntry,
    grantNetworkId = grant.networkId,
    grantNetworkType = grant.networkType,
    grantRecordedAt = grant.completedAtMillis
  )
}

object KnockerStore {
  private const val TAG = "KnockerStore"
  private const val PROFILES_KEY = "profiles"
  private val profileLock = Any()

  fun replaceProfiles(context: Context, profilesJson: String) {
    val profiles = parseProfiles(profilesJson)
    if (profiles == null) {
      Log.w(TAG, "Skipping profile sync because the snapshot payload could not be parsed.")
      return
    }

    synchronized(profileLock) {
      val previous = readProfiles(context).associateBy { it.id }
      val merged = profiles.map { incoming ->
        val cached = previous[incoming.id]
        if (cached != null && sameGrantTarget(cached, incoming) && newerGrant(cached, incoming)) {
          incoming.copy(expiresAt = cached.expiresAt, whitelistedAt = cached.whitelistedAt,
            whitelistedEntry = cached.whitelistedEntry, grantNetworkId = cached.grantNetworkId,
            grantNetworkType = cached.grantNetworkType, grantRecordedAt = cached.grantRecordedAt)
        } else incoming
      }
      writeProfiles(context, merged)
    }
  }

  fun readProfiles(context: Context): List<StoredProfile> {
    val raw = readProfilesJson(context)
    return parseProfiles(raw) ?: emptyList()
  }

  fun readProfilesJson(context: Context): String {
    return preferences(context).getString(PROFILES_KEY, "[]") ?: "[]"
  }

  fun findProfileById(context: Context, profileId: String): StoredProfile? {
    return readProfiles(context).firstOrNull { it.id == profileId }
  }

  fun findProfileBySlot(context: Context, slot: Int): StoredProfile? {
    return readProfiles(context).firstOrNull { it.tileSlot == slot }
  }

  fun updateGrant(
    context: Context,
    profileId: String,
    grant: KnockOutcome.Success,
    expectedConfigurationFingerprint: String
  ): StoredProfile? {
    synchronized(profileLock) {
      val profiles = readProfiles(context).toMutableList()
      val index = profiles.indexOfFirst { it.id == profileId }
      if (index < 0 || profiles[index].configurationFingerprint != expectedConfigurationFingerprint) return null
      if ((profiles[index].whitelistedAt ?: 0L) > grant.whitelistedAtMillis) return null

      val updated = profiles[index].withGrant(grant)
      profiles[index] = updated
      writeProfiles(context, profiles)
      return updated
    }
  }

  private fun sameGrantTarget(a: StoredProfile, b: StoredProfile): Boolean {
    if (a.grantConfigurationFingerprint.isNotEmpty() && b.grantConfigurationFingerprint.isNotEmpty())
      return a.grantConfigurationFingerprint == b.grantConfigurationFingerprint
    return a.endpointUrl.trimEnd('/') == b.endpointUrl.trimEnd('/') && a.apiKey == b.apiKey &&
      a.ipOverride?.trim().orEmpty() == b.ipOverride?.trim().orEmpty()
  }

  private fun newerGrant(a: StoredProfile, b: StoredProfile): Boolean {
    if (a.expiresAt == null) return false
    if (b.whitelistedAt != null) {
      if (a.whitelistedAt == null) return false
      if (a.whitelistedAt != b.whitelistedAt) return a.whitelistedAt > b.whitelistedAt
    } else if (a.whitelistedAt != null) return true
    if (a.grantRecordedAt != null && b.grantRecordedAt != null && a.grantRecordedAt != b.grantRecordedAt)
      return a.grantRecordedAt > b.grantRecordedAt
    return a.expiresAt > (b.expiresAt ?: 0L)
  }

  private fun preferences(context: Context): SharedPreferences {
    return KnockerPrefs.preferences(context)
  }

  private fun writeProfiles(context: Context, profiles: List<StoredProfile>) {
    val json = JSONArray()
    for (profile in profiles) {
      json.put(profile.toJson())
    }
    val committed = preferences(context).edit().putString(PROFILES_KEY, json.toString()).commit()
    if (!committed) {
      throw IOException("Failed to commit stored profiles.")
    }
  }

  private fun parseProfiles(raw: String): List<StoredProfile>? {
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
              ttlSeconds = objectJson.optStrictNullableInt("ttlSeconds"),
              ipOverride = objectJson.optNullableString("ipOverride"),
              autoRenew = objectJson.optBoolean("autoRenew", false),
              autoRenewSafetyWindowSec = objectJson.optStrictNullableInt("autoRenewSafetyWindowSec") ?: 300,
              tileSlot = objectJson.optStrictNullableInt("tileSlot"),
              expiresAt = objectJson.optStrictNullableLong("expiresAt"),
              whitelistedAt = objectJson.optStrictNullableLong("whitelistedAt"),
              whitelistedEntry = objectJson.optNullableString("whitelistedEntry"),
              grantNetworkId = objectJson.optNullableString("grantNetworkId"),
              grantNetworkType = objectJson.optNullableString("grantNetworkType"),
              knockOnOpen = objectJson.optBoolean("knockOnOpen", false),
              configurationFingerprint = objectJson.optString("configurationFingerprint"),
              grantConfigurationFingerprint = objectJson.optString("grantConfigurationFingerprint"),
              grantRecordedAt = objectJson.optStrictNullableLong("grantRecordedAt")
            )
          )
        }
      }
    } catch (error: Exception) {
      Log.w(TAG, "Failed to parse stored profiles.", error)
      null
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
      putNullable("whitelistedAt", whitelistedAt)
      putNullable("whitelistedEntry", whitelistedEntry)
      putNullable("grantNetworkId", grantNetworkId)
      putNullable("grantNetworkType", grantNetworkType)
      put("knockOnOpen", knockOnOpen)
      put("configurationFingerprint", configurationFingerprint)
      put("grantConfigurationFingerprint", grantConfigurationFingerprint)
      putNullable("grantRecordedAt", grantRecordedAt)
    }
  }

  private fun JSONObject.putNullable(key: String, value: Any?) {
    put(key, value ?: JSONObject.NULL)
  }

  private fun JSONObject.optStrictNullableInt(key: String): Int? {
    val value = optNullableValue(key) ?: return null
    return when (value) {
      is Int -> value
      is Long -> value.toIntOrNullSafe()
      is Number -> value.toInt()
      is String -> value.toIntOrNull()
      else -> null
    }
  }

  private fun JSONObject.optStrictNullableLong(key: String): Long? {
    val value = optNullableValue(key) ?: return null
    return when (value) {
      is Int -> value.toLong()
      is Long -> value
      is Number -> value.toLong()
      is String -> value.toLongOrNull()
      else -> null
    }
  }

  private fun JSONObject.optNullableString(key: String): String? {
    if (isNull(key) || !has(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
  }

  private fun JSONObject.optNullableValue(key: String): Any? {
    if (!has(key) || isNull(key)) return null
    return get(key)
  }

  private fun Long.toIntOrNullSafe(): Int? {
    return if (this in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) toInt() else null
  }
}
