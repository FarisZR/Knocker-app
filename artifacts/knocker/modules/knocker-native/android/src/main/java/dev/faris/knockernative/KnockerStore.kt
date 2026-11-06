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
  /** Requires an endpoint and key before native callers may dispatch HTTP. */
  fun canKnock(): Boolean {
    return endpointUrl.isNotBlank() && apiKey.isNotBlank()
  }

  /** Computes the next renewal using the current saved safety window, or disables it. */
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

  /** Replaces settings under the profile lock while retaining newer grants for the same target. */
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

  /** Applies a response to its permission target, using the latest saved renewal settings. */
  fun updateGrant(
    context: Context,
    requestProfile: StoredProfile,
    grant: KnockOutcome.Success
  ): StoredProfile? {
    synchronized(profileLock) {
      val profiles = readProfiles(context).toMutableList()
      val index = profiles.indexOfFirst { it.id == requestProfile.id }
      if (index < 0) return null
      val updated = reconcileGrant(profiles[index], requestProfile, grant) ?: return null
      profiles[index] = updated
      writeProfiles(context, profiles)
      return updated
    }
  }

  /** Rejects changed credentials/targets but preserves newer grants and current UI settings. */
  internal fun reconcileGrant(current: StoredProfile, request: StoredProfile, grant: KnockOutcome.Success): StoredProfile? {
    if (!sameGrantTarget(current, request)) return null
    val candidate = current.withGrant(grant)
    return if (newerGrant(candidate, current)) candidate else current
  }

  /** Uses the canonical JS target digest, with a raw-target fallback for older snapshots. */
  private fun sameGrantTarget(a: StoredProfile, b: StoredProfile): Boolean {
    if (a.grantConfigurationFingerprint.isNotEmpty() && b.grantConfigurationFingerprint.isNotEmpty())
      return a.grantConfigurationFingerprint == b.grantConfigurationFingerprint
    return a.endpointUrl.trim().trimEnd('/') == b.endpointUrl.trim().trimEnd('/') && a.apiKey.trim() == b.apiKey.trim() &&
      a.ipOverride?.trim().orEmpty() == b.ipOverride?.trim().orEmpty()
  }

  /** Orders grants by server start, then receipt, then expiry as a final tie breaker. */
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

  /** Commits one complete snapshot and reports failed persistence instead of claiming success. */
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

  /** Parses optional grant metadata defensively and skips records without a stable ID. */
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

  /** Stores current request settings together with permission identity and grant receipt time. */
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

  /** Accepts nullable numeric fields without converting missing values to zero. */
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

  /** Reads nullable timestamps across JSON numeric and string representations. */
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

  /** Distinguishes missing or blank optional text from a stored value. */
  private fun JSONObject.optNullableString(key: String): String? {
    if (isNull(key) || !has(key)) return null
    return optString(key).takeIf { it.isNotBlank() }
  }

  /** Returns null for absent fields and JSON null before numeric conversion. */
  private fun JSONObject.optNullableValue(key: String): Any? {
    if (!has(key) || isNull(key)) return null
    return get(key)
  }

  /** Rejects out-of-range integer settings rather than wrapping them. */
  private fun Long.toIntOrNullSafe(): Int? {
    return if (this in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) toInt() else null
  }
}
