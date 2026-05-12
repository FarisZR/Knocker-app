package dev.faris.knockernative

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

object KnockerExecutors {
  val io: ExecutorService = Executors.newFixedThreadPool(4)
}
