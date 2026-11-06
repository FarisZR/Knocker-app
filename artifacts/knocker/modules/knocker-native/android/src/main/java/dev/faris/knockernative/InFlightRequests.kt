package dev.faris.knockernative

import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executor

/** One future per request key, shared by every caller; no worker waits on another worker. */
class InFlightRequests<K, V>(private val executor: Executor, private val changed: () -> Unit = {}) {
  private val running = mutableMapOf<K, CompletableFuture<V>>()
  @Synchronized fun keys(): Set<K> = running.keys.toSet()

  fun submit(key: K, work: () -> V): CompletableFuture<V> {
    val result: CompletableFuture<V>
    synchronized(this) {
      running[key]?.let { return it }
      result = CompletableFuture()
      running[key] = result
    }
    changed()
    val task = Runnable {
      try { result.complete(work()) }
      catch (error: Throwable) { result.completeExceptionally(error) }
      finally {
        synchronized(this) { if (running[key] === result) running.remove(key) }
        changed()
      }
    }
    try { executor.execute(task) }
    catch (error: Throwable) {
      synchronized(this) { running.remove(key) }
      result.completeExceptionally(error)
      changed()
    }
    return result
  }
}
