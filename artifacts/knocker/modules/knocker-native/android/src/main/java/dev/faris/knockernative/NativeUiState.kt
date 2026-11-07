package dev.faris.knockernative

import org.json.JSONObject

/** A read-only rendering snapshot; HTTP, secrets and grant reconciliation keep their existing owner. */
internal data class NativeUiState(val json: JSONObject = JSONObject()) {
  val loaded = json.optBoolean("loaded")
  val profiles: List<JSONObject> = json.optJSONArray("profiles")?.let { array ->
    (0 until array.length()).mapNotNull { array.optJSONObject(it) }
  }.orEmpty()
  // Rendering identity must tolerate damaged IDs without rewriting persistent
  // IDs or moving API keys. Reserve every real ID before allocating fallback keys.
  val profileRenderKeys: List<String> = run {
    val reserved = profiles.mapNotNull { it.textOrNull("id") }.toSet()
    val used = mutableSetOf<String>()
    profiles.mapIndexed { index, profile ->
      val id = profile.textOrNull("id").orEmpty()
      if (id.isNotBlank() && used.add(id)) id
      else generateSequence("profile-row:$index") { "$it:" }
        .first { it !in reserved && used.add(it) }
    }
  }
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
