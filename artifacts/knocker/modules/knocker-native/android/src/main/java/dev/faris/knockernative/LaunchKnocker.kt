package dev.faris.knockernative

import android.content.Context
import android.util.Log
import java.util.concurrent.CompletableFuture
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fires launch knocks for every cached profile with [StoredProfile.knockOnOpen] = true.
 *
 * [KnockerNativeModule] prepares a result holder during module creation, but
 * starts this work only after the first app frame is visible. That keeps
 * encrypted storage and HTTP off the UI-critical startup path without waiting
 * for JS profile and secret hydration. The JS side later consumes
 * [KnockerNativeModule.getLaunchKnockResultsJson] to render the snackbar, and
 * picks up the new expiry via the existing native -> JS profile merge.
 *
 * Only one launch-knock batch runs per native/React surface. The session is
 * replaced when a new surface is created; repeated starts and reads are
 * idempotent instead of triggering duplicate HTTP requests.
 */
object LaunchKnocker {
  private const val TAG = "KnockerLaunch"

  private data class LaunchSession(
    val results: CompletableFuture<List<LaunchKnockResult>> = CompletableFuture(),
    var started: Boolean = false
  )

  @Volatile
  private var session: LaunchSession? = null

  /** Resets cheap per-surface state without touching storage or the network. */
  fun prepareForLaunch() {
    synchronized(this) {
      session = LaunchSession()
    }
  }

  /** Starts a new batch for a newly created native/React surface. */
  fun startForLaunch(context: Context): CompletableFuture<List<LaunchKnockResult>> {
    val current: LaunchSession
    val shouldStart: Boolean
    synchronized(this) {
      current = session ?: LaunchSession().also { session = it }
      shouldStart = !current.started
      current.started = true
    }
    if (shouldStart) {
      KnockerExecutors.io.execute {
        performLaunchKnocks(context.applicationContext, current.results)
      }
    }
    return current.results
  }

  /**
   * Returns this surface's result batch.
   *
   * Keep the completed future until [prepareForLaunch] replaces it for the next
   * native/React surface. Clearing it here would let repeated reads lose the
   * result from the same launch.
   */
  fun awaitAndConsume(): List<LaunchKnockResult> {
    val current = synchronized(this) {
      session ?: LaunchSession().also { session = it }
    }
    return current.results.get()
  }

  private fun performLaunchKnocks(
    context: Context,
    future: CompletableFuture<List<LaunchKnockResult>>
  ) {
    try {
      val targets = KnockerStore.readProfiles(context)
        .filter { it.knockOnOpen && it.canKnock() }

      if (targets.isEmpty()) {
        future.complete(emptyList())
        return
      }

      Log.i(TAG, "Dispatching cached launch knock batch.")
      // This function itself occupies one of the shared IO workers. Use that
      // worker for the first request and schedule the remainder, so a four-
      // profile launch can still put all four requests in flight together.
      val resultFutures = targets.drop(1).map { profile ->
        CompletableFuture.supplyAsync(
          { ProfileKnocker.knock(context, profile) },
          KnockerExecutors.io
        )
      }
      val firstResult = ProfileKnocker.knock(context, targets.first())
      val results = listOf(firstResult) + resultFutures.map { it.join() }
      future.complete(results)
      KnockerTileService.refreshAll(context)
    } catch (error: Exception) {
      Log.w(TAG, "Launch knock batch failed.", error)
      future.complete(emptyList())
    }
  }

  fun resultsToJson(results: List<LaunchKnockResult>): String {
    val array = JSONArray()
    for (result in results) {
      array.put(result.toJson())
    }
    return array.toString()
  }
}

private object ProfileKnocker {
  fun knock(context: Context, profile: StoredProfile): LaunchKnockResult {
    return when (val outcome = KnockerHttp.knock(profile)) {
      is KnockOutcome.Success -> {
        val updated = KnockerStore.updateExpiry(
          context,
          profile.id,
          outcome.expiresAtMillis,
          profile.configurationFingerprint
        )
        val nextFireAt = updated?.renewalAtMillis()
        if (nextFireAt != null) {
          KnockerRenewScheduler.schedule(context, profile.id, nextFireAt)
        } else if (updated != null) {
          KnockerRenewScheduler.cancel(context, profile.id)
        }
        LaunchKnockResult(
          profileId = profile.id,
          name = profile.name,
          ok = true,
          message = null,
          whitelistedEntry = outcome.whitelistedEntry,
          expiresInSeconds = outcome.expiresInSeconds,
          expiresAtMillis = outcome.expiresAtMillis,
          requestedTtlSeconds = outcome.requestedTtlSeconds,
          ttlCapped = outcome.ttlCapped,
          configurationFingerprint = profile.configurationFingerprint
        )
      }
      is KnockOutcome.Failure -> LaunchKnockResult(
        profileId = profile.id,
        name = profile.name,
        ok = false,
        message = outcome.message,
        whitelistedEntry = null,
        expiresInSeconds = null,
        expiresAtMillis = null,
        requestedTtlSeconds = profile.ttlSeconds,
        ttlCapped = false,
        configurationFingerprint = profile.configurationFingerprint
      )
    }
  }
}

data class LaunchKnockResult(
  val profileId: String,
  val name: String,
  val ok: Boolean,
  val message: String?,
  val whitelistedEntry: String?,
  val expiresInSeconds: Long?,
  val expiresAtMillis: Long?,
  val requestedTtlSeconds: Int?,
  val ttlCapped: Boolean,
  val configurationFingerprint: String
) {
  fun toJson(): JSONObject {
    return JSONObject().apply {
      put("profileId", profileId)
      put("name", name)
      put("ok", ok)
      message?.let { put("message", it) } ?: put("message", JSONObject.NULL)
      whitelistedEntry?.let { put("whitelistedEntry", it) } ?: put("whitelistedEntry", JSONObject.NULL)
      expiresInSeconds?.let { put("expiresInSeconds", it) } ?: put("expiresInSeconds", JSONObject.NULL)
      expiresAtMillis?.let { put("expiresAtMillis", it) } ?: put("expiresAtMillis", JSONObject.NULL)
      requestedTtlSeconds?.let { put("requestedTtlSeconds", it) } ?: put("requestedTtlSeconds", JSONObject.NULL)
      put("ttlCapped", ttlCapped)
      put("configurationFingerprint", configurationFingerprint)
    }
  }
}
