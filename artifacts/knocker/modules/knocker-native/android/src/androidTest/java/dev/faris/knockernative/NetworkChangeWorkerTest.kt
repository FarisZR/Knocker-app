package dev.faris.knockernative

import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker.Result
import androidx.work.testing.TestWorkerBuilder
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
  private fun fixture(covered: Boolean? = false, enabled: Boolean = true, overrideIp: String? = null, block: (MutableList<String>, () -> Result) -> Unit) {
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
          val json = if (knock) """{"whitelisted_entry":"198.51.100.7","expires_at":$expiry,"expires_in_seconds":3600}"""
            else if (covered == null) "{}"
            else """{"ip_address":"198.51.100.7","whitelisted":$covered,"expires_at":${if (covered) expiry else "null"},"expires_in_seconds":${if (covered) 3600 else 0}}"""
          val bytes = json.toByteArray()
          it.getOutputStream().write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray() + bytes)
        }
      }
    }
    val executor = Executors.newSingleThreadExecutor()
    try {
      KnockerStore.replaceProfiles(context, JSONArray().put(JSONObject()
        .put("id", id).put("endpointUrl", "http://127.0.0.1:${socket.localPort}").put("apiKey", "demo-key")
        .put("autoRenew", enabled).put("ipOverride", overrideIp ?: JSONObject.NULL).put("grantNetworkId", "previous-network")).toString())
      block(calls) { TestWorkerBuilder<NetworkChangeWorker>(context, executor).build().doWork() }
    } finally {
      socket.close()
      server.join(1000)
      executor.shutdownNow()
      KnockerRenewScheduler.cancel(context, id)
      KnockerStore.replaceProfiles(context, original)
      NetworkChangeMonitor.update(context)
      KnockerPrefs.preferences(context).edit().remove("networkCheck.$id").remove("networkCheck.$id.attempt").commit()
    }
  }

  @Test fun uncoveredNetworkKnocksOnceAndDuplicateEventsDoNothing() = fixture { calls, run ->
    assertEquals(Result.success(), run())
    assertEquals(listOf("GET /status", "POST /knock"), calls.toList())
    assertEquals("198.51.100.7", KnockerStore.readProfiles(context).single().whitelistedEntry)
    assertEquals(Result.success(), run())
    assertEquals(2, calls.size)
  }

  @Test fun coveredNetworkDoesNotKnockOrRewriteLastGrant() = fixture(covered = true) { calls, run ->
    assertEquals(Result.success(), run())
    assertEquals(listOf("GET /status"), calls.toList())
    assertNull(KnockerStore.readProfiles(context).single().whitelistedEntry)
    assertEquals(Result.success(), run())
    assertEquals(1, calls.size)
  }

  @Test fun unknownStatusRetriesWithoutKnockingAndRespectsCooldown() = fixture(covered = null) { calls, run ->
    assertEquals(Result.retry(), run())
    assertEquals(Result.retry(), run())
    assertEquals(listOf("GET /status"), calls.toList())
  }

  @Test fun remoteIpProfilesAreNotCheckedAgainstTheCallersAddress() = fixture(overrideIp = "203.0.113.99") { calls, run ->
    assertEquals(Result.success(), run())
    assertTrue(calls.isEmpty())
  }

  @Test fun disabledAutoRenewSendsNoRequests() = fixture(enabled = false) { calls, run ->
    assertEquals(Result.success(), run())
    assertTrue(calls.isEmpty())
  }
}
