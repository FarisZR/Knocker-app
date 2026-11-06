package dev.faris.knockernative

import android.content.Context
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArraySet

/** Coordinates launch, tile, renewal and foreground requests in this app process. */
object KnockerRequests {
  private data class Key(val id: String, val configuration: String)
  private val observers = CopyOnWriteArraySet<(List<String>) -> Unit>()
  private val requests = InFlightRequests<Key, LaunchKnockResult>(KnockerExecutors.io) { notifyObservers() }

  fun pendingIds(): List<String> = requests.keys().map { it.id }.distinct().sorted()
  fun addObserver(observer: (List<String>) -> Unit) { observers.add(observer) }
  fun removeObserver(observer: (List<String>) -> Unit) { observers.remove(observer) }
  @Synchronized private fun notifyObservers() {
    val ids = pendingIds()
    observers.forEach { runCatching { it(ids) } }
  }

  fun knock(context: Context, profile: StoredProfile): CompletableFuture<LaunchKnockResult> =
    requests.submit(Key(profile.id, profile.configurationFingerprint)) {
      ProfileKnocker.knock(context.applicationContext, profile)
    }
}
