package dev.faris.knockernative

import org.junit.Assert.*
import org.junit.Test

class GrantReconciliationTest {
  private val sent = StoredProfile("home", "Home", "https://example.test", "key", 300, null,
    false, 30, 1, null, configurationFingerprint = "original", grantConfigurationFingerprint = "target")
  private val grant = KnockOutcome.Success(22000L, "203.0.113.42", 2000L, "wifi", "Wi-Fi",
    20L, 300, false, 2100L)

  @Test fun renamePinAndRenewalEditsRetainTheGrantAndCurrentSettings() {
    val edited = sent.copy(name = "Renamed", tileSlot = 2, autoRenew = true,
      autoRenewSafetyWindowSec = 5, configurationFingerprint = "edited")
    val saved = KnockerStore.reconcileGrant(edited, sent, grant)!!
    assertEquals("Renamed", saved.name)
    assertEquals(2, saved.tileSlot)
    assertEquals(22000L, saved.expiresAt)
    assertEquals(17000L, saved.renewalAtMillis())
    assertEquals(2100L, saved.grantRecordedAt)
  }

  @Test fun changedPermissionTargetRejectsAnInFlightGrant() {
    assertNull(KnockerStore.reconcileGrant(sent.copy(grantConfigurationFingerprint = "changed"), sent, grant))
    val legacy = sent.copy(grantConfigurationFingerprint = "")
    assertNull(KnockerStore.reconcileGrant(legacy.copy(apiKey = "rotated"), legacy, grant))
    assertNull(KnockerStore.reconcileGrant(legacy.copy(endpointUrl = "https://other.test"), legacy, grant))
    assertNull(KnockerStore.reconcileGrant(legacy.copy(ipOverride = "198.51.100.1"), legacy, grant))
  }

  @Test fun anOlderResponseDoesNotReplaceANewerGrantEvenWithALaterExpiry() {
    val current = sent.copy(whitelistedAt = 3000L, grantRecordedAt = 3100L, expiresAt = 9000L)
    assertSame(current, KnockerStore.reconcileGrant(current, sent, grant))
    val sameSecond = sent.copy(whitelistedAt = 2000L, grantRecordedAt = 2200L, expiresAt = 9000L)
    assertSame(sameSecond, KnockerStore.reconcileGrant(sameSecond, sent, grant))
  }

  @Test fun displayEditsShareWorkButDifferentTargetsAndTtlsDoNot() {
    assertEquals(sent.requestIdentity(), sent.copy(name = "Renamed", tileSlot = 2, autoRenew = true,
      configurationFingerprint = "edited").requestIdentity())
    assertNotEquals(sent.requestIdentity(), sent.copy(ttlSeconds = 60).requestIdentity())
    assertNotEquals(sent.requestIdentity(), sent.copy(grantConfigurationFingerprint = "changed").requestIdentity())
    val legacy = sent.copy(grantConfigurationFingerprint = "")
    assertNotEquals(legacy.requestIdentity(), legacy.copy(apiKey = "rotated").requestIdentity())
  }
}
