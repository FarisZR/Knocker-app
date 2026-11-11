package dev.faris.knockernative

import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker.Result
import androidx.work.testing.TestWorkerBuilder
import androidx.work.workDataOf
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.net.ServerSocket
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import kotlin.concurrent.thread

class NetworkChangeWorkerTest {
  private val context get() = InstrumentationRegistry.getInstrumentation().targetContext

  /** Real HTTP on the emulator, exercising saved settings and native grant reconciliation. */
  private fun fixture(covered: Boolean? = false, enabled: Boolean = true, overrideIp: String? = null, oversized: Boolean = false, drip: Boolean = false,
    coveredSeconds: Long = 3600L, lastKnockSeconds: Long? = null, block: (MutableList<String>, (Int) -> Result) -> Unit) {
    val original = KnockerStore.readProfilesJson(context)
    val socket = ServerSocket(0)
    val calls = CopyOnWriteArrayList<String>()
    val id = UUID.randomUUID().toString()
    val server = thread(isDaemon = true) {
      while (!socket.isClosed) {
        val client = runCatching { socket.accept() }.getOrNull() ?: break
        client.use {
          val reader = it.getInputStream().bufferedReader()
          val request = reader.readLine() ?: return@use
          var length = 0
          while (true) {
            val line = reader.readLine() ?: break
            if (line.isEmpty()) break
            if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
          }
          repeat(length) { reader.read() }
          calls.add(request.substringBefore(" HTTP"))
          val knock = request.startsWith("POST")
          val expiry = System.currentTimeMillis() / 1000L + 3600L
          val json = if (oversized && !knock) "x".repeat(20000) else if (knock) """{"whitelisted_entry":"198.51.100.7","expires_at":$expiry,"expires_in_seconds":3600}"""
            else if (covered == null) "{}"
            else """{"ip_address":"198.51.100.7","whitelisted":$covered,"expires_at":${if (covered) System.currentTimeMillis() / 1000L + coveredSeconds else "null"},"expires_in_seconds":${if (covered) coveredSeconds else 0}}"""
          val bytes = json.toByteArray()
          runCatching {
            val output = it.getOutputStream()
            output.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray())
            if (drip) for (byte in bytes) { output.write(byte.toInt()); output.flush(); Thread.sleep(100) }
            else output.write(bytes)
          }
        }
      }
    }
    val executor = Executors.newSingleThreadExecutor()
    try {
      KnockerStore.replaceProfiles(context, JSONArray().put(JSONObject()
        .put("id", id).put("endpointUrl", "http://127.0.0.1:${socket.localPort}").put("apiKey", "demo-key")
        .put("autoRenew", enabled).put("ipOverride", overrideIp ?: JSONObject.NULL).put("grantNetworkId", "previous-network")
        .put("expiresAt", lastKnockSeconds?.let { System.currentTimeMillis() + it * 1000L } ?: JSONObject.NULL)).toString())
      block(calls) { attempt -> TestWorkerBuilder<NetworkChangeWorker>(context, executor, runAttemptCount = attempt).build().doWork() }
    } finally {
      socket.close()
      server.join(1000)
      executor.shutdownNow()
      KnockerRenewScheduler.cancel(context, id)
      KnockerStore.replaceProfiles(context, original)
      NetworkChangeMonitor.update(context)
      KnockerPrefs.preferences(context).edit().remove("networkCheck.$id").remove("networkCheck.$id.attempt").remove("networkCheck.$id.expires").commit()
    }
  }

  @Test fun uncoveredNetworkKnocksOnceAndDuplicateEventsDoNothing() = fixture { calls, run ->
    assertEquals(Result.success(), run(0))
    assertEquals(listOf("GET /status", "POST /knock"), calls.toList())
    assertEquals("198.51.100.7", KnockerStore.readProfiles(context).single().whitelistedEntry)
    assertEquals(Result.success(), run(0))
    assertEquals(2, calls.size)
  }

  @Test fun knockCoordinatorRetainsTheCheckedConnection() = fixture { calls, _ ->
    val profile = KnockerStore.readProfiles(context).single()
    val captured = KnockerNetwork.capture(context).let { it.copy(identity = it.identity.copy(id = "checked-connection")) }
    assertTrue(KnockerRequests.knock(context, profile, captured).get().ok)
    assertEquals("checked-connection", KnockerStore.readProfiles(context).single().grantNetworkId)
    assertEquals(listOf("POST /knock"), calls.toList())
  }

  @Test fun coveredNetworkDoesNotKnockOrRewriteLastGrant() = fixture(covered = true) { calls, run ->
    assertEquals(Result.success(), run(0))
    assertEquals(listOf("GET /status"), calls.toList())
    assertNull(KnockerStore.readProfiles(context).single().whitelistedEntry)
    assertEquals(Result.success(), run(0))
    assertEquals(1, calls.size)
  }

  @Test fun unknownStatusRetriesWithoutKnockingAndRespectsCooldown() = fixture(covered = null) { calls, run ->
    assertEquals(Result.retry(), run(0))
    assertEquals(Result.retry(), run(0))
    assertEquals(Result.retry(), run(2))
    assertEquals(Result.success(), run(3))
    assertEquals(listOf("GET /status"), calls.toList())
  }

  @Test fun expiredCachedCoverageIsCheckedAgain() = fixture(covered = true) { calls, run ->
    assertEquals(Result.success(), run(0))
    val id = KnockerStore.readProfiles(context).single().id
    KnockerPrefs.preferences(context).edit().putLong("networkCheck.$id.expires", 0L)
      .putLong("networkCheck.$id.attempt", 0L).commit()
    assertEquals(Result.success(), run(0))
    assertEquals(listOf("GET /status", "GET /status"), calls.toList())
  }

  @Test fun oversizedStatusIsUnknownAndNeverKnocks() = fixture(oversized = true) { calls, run ->
    assertEquals(Result.retry(), run(0))
    assertEquals(listOf("GET /status"), calls.toList())
  }

  @Test fun streamingStatusCannotExtendTheTotalDeadline() = fixture(drip = true) { calls, run ->
    val started = android.os.SystemClock.elapsedRealtime()
    assertEquals(Result.retry(), run(0))
    assertTrue(android.os.SystemClock.elapsedRealtime() - started < 5500L)
    assertEquals(listOf("GET /status"), calls.toList())
  }

  @Test fun remoteIpProfilesAreNotCheckedAgainstTheCallersAddress() = fixture(overrideIp = "203.0.113.99") { calls, run ->
    assertEquals(Result.success(), run(0))
    assertTrue(calls.isEmpty())
  }

  @Test fun disabledAutoRenewSendsNoRequests() = fixture(enabled = false) { calls, run ->
    assertEquals(Result.success(), run(0))
    assertTrue(calls.isEmpty())
  }

  private fun renewNow(): Result {
    val executor = Executors.newSingleThreadExecutor()
    try {
      return TestWorkerBuilder<RenewWorker>(context, executor,
        workDataOf("profileId" to KnockerStore.readProfiles(context).single().id)).build().doWork()
    } finally { executor.shutdownNow() }
  }

  private fun assertScheduledNear(expected: Long) {
    val at = KnockerRenewScheduler.scheduledAt(context, KnockerStore.readProfiles(context).single().id)
    assertNotNull(at)
    assertTrue("scheduled ${at!! - expected}ms from expected", kotlin.math.abs(at - expected) < 10_000L)
  }

  // The last knock was on another network and lasts an hour; this network's grant ends in 15 minutes.
  @Test fun coveredNetworkTimesRenewalFromItsOwnGrant() = fixture(covered = true, coveredSeconds = 900L, lastKnockSeconds = 3600L) { calls, run ->
    assertEquals(Result.success(), run(0))
    assertEquals(listOf("GET /status"), calls.toList())
    assertScheduledNear(System.currentTimeMillis() + (900L - 300L) * 1000L)
  }

  @Test fun renewalAlarmMovesInsteadOfKnockingWhileThisNetworkIsCovered() = fixture(covered = true, coveredSeconds = 3600L, lastKnockSeconds = 600L) { calls, _ ->
    assertEquals(Result.success(), renewNow())
    assertEquals(listOf("GET /status"), calls.toList())
    assertScheduledNear(System.currentTimeMillis() + (3600L - 300L) * 1000L)
  }

  @Test fun renewalAlarmKnocksWhenThisNetworksGrantIsDue() = fixture(covered = true, coveredSeconds = 200L, lastKnockSeconds = 600L) { calls, _ ->
    assertEquals(Result.success(), renewNow())
    assertEquals(listOf("GET /status", "POST /knock"), calls.toList())
  }
}
