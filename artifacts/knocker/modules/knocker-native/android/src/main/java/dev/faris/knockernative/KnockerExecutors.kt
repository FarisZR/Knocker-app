package dev.faris.knockernative

import java.util.concurrent.Executor
import java.util.concurrent.ExecutorService
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadFactory
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

object KnockerExecutors {
  private val threadCounter = AtomicInteger(1)

  private val executor: ExecutorService = ThreadPoolExecutor(
    4,
    4,
    60L,
    TimeUnit.SECONDS,
    LinkedBlockingQueue(64),
    ThreadFactory { runnable ->
      Thread(runnable, "knocker-io-${threadCounter.getAndIncrement()}").apply {
        isDaemon = false
      }
    },
    ThreadPoolExecutor.CallerRunsPolicy()
  )

  val io: Executor = executor
}
