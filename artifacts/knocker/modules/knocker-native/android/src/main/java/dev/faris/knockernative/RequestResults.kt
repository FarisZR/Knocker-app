package dev.faris.knockernative

import java.util.concurrent.CompletableFuture

/** Settles each request independently without blocking executor threads or dropping successful siblings. */
internal fun <T> collectRequestResults(
  requests: List<CompletableFuture<T>>,
  failed: (Int, Throwable) -> T
): CompletableFuture<List<T>> {
  val settled = requests.mapIndexed { index, request ->
    request.handle { value, error -> if (error != null) failed(index, error) else value }
  }
  return CompletableFuture.allOf(*settled.toTypedArray()).thenApply { settled.map { it.join() } }
}
