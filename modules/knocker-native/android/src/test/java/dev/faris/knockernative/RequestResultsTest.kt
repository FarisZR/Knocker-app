package dev.faris.knockernative

import java.util.concurrent.CompletableFuture
import org.junit.Assert.*
import org.junit.Test

class RequestResultsTest {
  @Test fun anExceptionalRequestDoesNotEraseSuccessfulSiblingsOrLeaveAHoleForFallback() {
    val first = CompletableFuture<String>()
    val second = CompletableFuture<String>()
    val third = CompletableFuture<String>()
    val results = collectRequestResults(listOf(first, second, third)) { index, _ -> "failed:$index" }
    second.completeExceptionally(IllegalStateException("synthetic failure"))
    first.complete("success:first")
    assertFalse(results.isDone)
    third.complete("success:third")
    assertEquals(listOf("success:first", "failed:1", "success:third"), results.get())
  }

  @Test fun anEmptyBatchCompletesImmediately() {
    val results = collectRequestResults(emptyList<CompletableFuture<String>>()) { _, _ -> "failure" }
    assertTrue(results.isDone)
    assertEquals(emptyList<String>(), results.get())
  }
}
