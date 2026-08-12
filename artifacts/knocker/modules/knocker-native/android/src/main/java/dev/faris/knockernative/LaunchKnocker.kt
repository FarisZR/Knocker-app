package dev.faris.knockernative

import android.content.Context
import android.util.Log
import java.util.concurrent.CompletableFuture
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fires launch knocks for every cached profile with [StoredProfile.knockOnOpen] = true.
 *
 * This runs as early as possible in the app lifecycle (see [KnockerNativeModule]'s
 * OnCreate hook) so the whitelisting request reaches the server well before the
 * React Native JS bundle finishes loading. The JS side later consumes
 * [KnockerNativeModule.getLaunchKnockResultsJson] to render the snackbar, and
 * picks up the new expiry via the existing native -> JS profile merge.
 *
 * Only one launch-knock batch runs per native/React surface. The batch is
 * replaced when a new surface is created; retaining its completed future makes
 * repeated JS reads idempotent instead of triggering duplicate HTTP requests.
 */
object LaunchKnocker {
  private const val TAG = "KnockerLaunch"

  @Volatile
  private var pending: CompletableFuture<List<LaunchKnockResult>>? = null

  /** Starts a new batch for a newly created native/React surface. */
  fun startForLaunch(context: Context): CompletableFuture<List<LaunchKnockResult>> {
    synchronized(this) {
      val future = CompletableFuture<List<LaunchKnockResult>>()
      pending = future
      KnockerExecutors.io.execute {
        performLaunchKnocks(context.applicationContext, future)
      }
      return future
    }
  }

  fun runOnce(context: Context): CompletableFuture<List<LaunchKnockResult>> {
    pending?.let { return it }
    synchronized(this) {
      pending?.let { return it }
      return startForLaunch(context)
    }
  }

  /**
   * Returns this surface's result batch.
   *
   * Keep the completed future until [startForLaunch] replaces it for the next
   * native/React surface. Clearing it here would let a repeated JS read start a
   * second knock batch during the same app launch.
   */
  fun awaitAndConsume(context: Context): List<LaunchKnockResult> =
    runOnce(context).get()

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

      val resultFutures = targets.map { profile ->
        CompletableFuture.supplyAsync(
          { ProfileKnocker.knock(context, profile) },
          KnockerExecutors.io
        )
      }
      val results = resultFutures.map { it.join() }
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
