package dev.faris.knockernative

import java.security.MessageDigest

/** Hashes HTTP inputs only, so rename, pin, slot and renewal edits share in-flight work. */
internal fun StoredProfile.requestIdentity(): String {
  val target = grantConfigurationFingerprint.takeIf { it.isNotEmpty() }
    ?: listOf(endpointUrl.trim().trimEnd('/'), apiKey.trim(), ipOverride?.trim().orEmpty())
      .joinToString("") { "${it.length}:$it" }
  val raw = "$target:${ttlSeconds?.takeIf { it > 0 }}"
  return MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
    .joinToString("") { "%02x".format(it) }
}
