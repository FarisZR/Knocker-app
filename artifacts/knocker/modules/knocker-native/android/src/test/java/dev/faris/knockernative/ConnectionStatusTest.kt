package dev.faris.knockernative

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ConnectionStatusTest {
  @Test fun inactiveCoverageIsExplicitAndDoesNotInventAnExpiry() {
    val status = ConnectionStatus.parse(JSONObject("""{"ip_address":"198.51.100.7","whitelisted":false,"expires_at":null,"expires_in_seconds":0}"""))
    assertFalse(status.whitelisted)
    assertNull(status.expiresAt)
  }

  @Test fun coverageUsesRemainingTimeInsteadOfTrustingTheDeviceClock() {
    val before = System.currentTimeMillis()
    val status = ConnectionStatus.parse(JSONObject("""{"ip_address":"2001:db8::1","whitelisted":true,"expires_at":12345,"expires_in_seconds":300}"""))
    assertTrue(status.whitelisted)
    assertTrue(status.expiresAt!! >= before + 300000L)
  }

  @Test fun malformedCoverageCannotTriggerAnAutomaticKnock() {
    for (raw in listOf("{}", """{"ip_address":"example.com","whitelisted":false,"expires_at":null,"expires_in_seconds":0}""",
      """{"ip_address":"198.51.100.7","whitelisted":"false","expires_at":null,"expires_in_seconds":0}""")) {
      assertTrue(runCatching { ConnectionStatus.parse(JSONObject(raw)) }.isFailure)
    }
  }
}
