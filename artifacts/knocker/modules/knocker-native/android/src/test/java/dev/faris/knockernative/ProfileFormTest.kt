package dev.faris.knockernative

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject

class ProfileFormTest {
  private val valid = ProfileForm(name = "Home", endpoint = "https://knock.example.com:8562", key = "fake-key")

  @Test fun requiresAnHttpsHostAndDoesNotAcceptEmbeddedCredentials() {
    assertTrue(valid.errors().isEmpty())
    assertTrue(valid.copy(endpoint = "HTTPS://knock.example.com").errors().isEmpty())
    for (endpoint in listOf("http://knock.example.com", "https://", "not a URL", "https://user:password@example.com", "https://example.com/#fragment"))
      assertTrue(endpoint, "endpoint" in valid.copy(endpoint = endpoint).errors())
  }

  @Test fun numericSettingsRejectOverflowAndNonpositiveTtls() {
    for (ttl in listOf("0", "-1", "letters", "999999999999999999999"))
      assertTrue(ttl, "ttl" in valid.copy(ttl = ttl).errors())
    assertFalse("ttl" in valid.copy(ttl = "60").errors())
    assertFalse("safety" in valid.copy(safety = "0").errors())
    assertTrue("safety" in valid.copy(safety = "").errors())
    assertFalse("safety" in valid.copy(renew = false, safety = "").errors())
  }

  @Test fun remoteTargetsAcceptOnlyNumericAddressesAndBoundedPrefixes() {
    for (target in listOf("203.0.113.42", "203.0.113.0/24", "2001:db8::1", "2001:db8::/64", "::ffff:203.0.113.42"))
      assertTrue(target, ProfileForm.isIpTarget(target))
    for (target in listOf("example.com", "", "999.1.1.1", "203.0.113.1/33", "2001:db8::/129", "::/", "::/64/1", "2001::db8::1"))
      assertFalse(target, ProfileForm.isIpTarget(target))
  }

  @Test fun draftIdentityIgnoresExternalGrantMetadataAndKeepsUnsavedText() {
    val saved = JSONObject(valid.toJson())
    val renewed = JSONObject(saved.toString()).put("expiresAt", 1800000000000L)
      .put("whitelistedAt", 1799999900000L).put("whitelistedEntry", "203.0.113.42")
      .put("lastKnockStatus", "success").put("grantNetworkId", "another-network")
    assertEquals(ProfileForm.from(saved), ProfileForm.from(renewed))
    assertEquals(valid, valid.copy())
    assertNotEquals(valid, valid.copy(name = "Unsaved"))
    assertNotEquals(valid, valid.copy(key = "new-secret"))
    assertNotEquals(valid, valid.copy(slot = 2, pinned = true))
  }
}
