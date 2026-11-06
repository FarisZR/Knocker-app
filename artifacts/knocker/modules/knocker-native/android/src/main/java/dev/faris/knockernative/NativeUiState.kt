package dev.faris.knockernative

import org.json.JSONObject

/** A read-only rendering snapshot; HTTP, secrets and grant reconciliation keep their existing owner. */
internal data class NativeUiState(val json: JSONObject = JSONObject()) {
  val loaded = json.optBoolean("loaded")
  val profiles: List<JSONObject> = json.optJSONArray("profiles")?.let { array ->
    (0 until array.length()).mapNotNull { array.optJSONObject(it) }
  }.orEmpty()
  val pending = json.optJSONArray("pending")?.let { array ->
    (0 until array.length()).map { array.optString(it) }.toSet()
  }.orEmpty()
  val network = json.optJSONObject("network") ?: JSONObject()
  val feedback = json.optJSONObject("feedback")
  val operation = json.optJSONObject("operation")
  val requestedProfile = json.textOrNull("requestedProfile")
  val fatal = json.textOrNull("fatal")

  companion object {
    /** Keep the last usable snapshot if the bridge delivers malformed data. */
    fun parse(raw: String): NativeUiState? = runCatching { NativeUiState(JSONObject(raw)) }.getOrNull()
  }
}
