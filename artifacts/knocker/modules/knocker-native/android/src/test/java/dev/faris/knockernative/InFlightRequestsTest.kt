package dev.faris.knockernative

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.Executor

class InFlightRequestsTest {
  @Test fun sharesOneRequestAcrossCallersAndClearsStateAfterCompletion() {
    val tasks = mutableListOf<Runnable>()
    val snapshots = mutableListOf<Set<String>>()
    lateinit var requests: InFlightRequests<String, String>
    requests = InFlightRequests(Executor { tasks.add(it) }) { snapshots.add(requests.keys()) }
    var calls = 0
    val launch = requests.submit("profile") { calls++; "ok" }
    val tile = requests.submit("profile") { calls++; "duplicate" }
    val foreground = requests.submit("profile") { calls++; "duplicate" }
    assertSame(launch, tile)
    assertSame(launch, foreground)
    assertEquals(setOf("profile"), requests.keys())
    assertEquals(1, tasks.size)
    tasks.single().run()
    assertEquals("ok", launch.get())
    assertEquals(1, calls)
    assertTrue(requests.keys().isEmpty())
    assertEquals(listOf(setOf("profile"), emptySet<String>()), snapshots)
  }

  @Test fun distinctProfilesAreDispatchedWithoutWaitingForEachOther() {
    val tasks = mutableListOf<Runnable>()
    val requests = InFlightRequests<String, Int>(Executor { tasks.add(it) })
    val first = requests.submit("a") { 1 }
    val second = requests.submit("b") { 2 }
    assertEquals(2, tasks.size)
    assertFalse(first.isDone)
    tasks[1].run()
    assertEquals(2, second.get())
    assertFalse(first.isDone)
    tasks[0].run()
    assertEquals(1, first.get())
  }

  @Test fun aFailureAllowsAFreshRetryWithoutLeavingPendingState() {
    val requests = InFlightRequests<String, String>(Executor { it.run() })
    assertTrue(requests.submit("profile") { error("failure") }.isCompletedExceptionally)
    assertTrue(requests.keys().isEmpty())
    assertEquals("retry", requests.submit("profile") { "retry" }.get())
  }
}
