package dev.faris.knockernative

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class KnockFailureTextTest {
  @Test fun failuresAreDescribedWithoutExceptionText() {
    val host = java.net.UnknownHostException("Unable to resolve host \"knock.example.test\": No address associated with hostname")
    assertFalse("knock.example.test" in KnockerHttp.describeFailure(host))
    assertEquals("Network timeout", KnockerHttp.describeFailure(java.net.SocketTimeoutException("timeout")))
    assertEquals("Can't connect to server", KnockerHttp.describeFailure(java.net.ConnectException("ECONNREFUSED")))
    assertEquals("Network error", KnockerHttp.describeFailure(IllegalStateException("boom")))
  }
}
