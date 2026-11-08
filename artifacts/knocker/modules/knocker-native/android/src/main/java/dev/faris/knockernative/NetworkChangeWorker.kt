package dev.faris.knockernative

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

/** One bounded batch after a connection transition; expiry alarms remain independent. */
class NetworkChangeWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  /** Rechecks expired observations and only knocks over the checked connection. */
  override fun doWork(): Result {
    val retryResult = if (runAttemptCount < 3) Result.retry() else Result.success()
    val captured = KnockerNetwork.capture(applicationContext)
    val networkId = captured.identity.id ?: return retryResult
    val prefs = KnockerPrefs.preferences(applicationContext)
    var retry = false
    for (profile in KnockerStore.readProfiles(applicationContext)) {
      if (isStopped) return Result.success()
      if (!profile.autoRenew || !profile.canKnock() || !profile.ipOverride.isNullOrBlank()) continue
      val key = "networkCheck.${profile.id}"
      val target = profile.requestIdentity()
      val observation = "$target:$networkId"
      if (profile.grantNetworkId == networkId && (profile.expiresAt ?: 0L) > System.currentTimeMillis()) continue
      if (prefs.getString(key, null) == observation && prefs.getLong("$key.expires", 0L) > System.currentTimeMillis()) continue
      val now = System.currentTimeMillis()
      if (now - prefs.getLong("$key.attempt", 0L) < 60_000L) { retry = true; continue }
      prefs.edit().putLong("$key.attempt", now).apply()
      val status = checkConnectionStatus(profile, captured)
      if (KnockerNetwork.snapshot(applicationContext).id != networkId) return retryResult
      val current = KnockerStore.findProfileById(applicationContext, profile.id) ?: continue
      if (!current.autoRenew || current.requestIdentity() != target) continue
      if (status == null) { retry = true; continue }
      if (!status.whitelisted) {
        // A foreground/manual request may have completed during the status check.
        if (current.grantRecordedAt != profile.grantRecordedAt && current.grantNetworkId == networkId) continue
        val result = runCatching { KnockerRequests.knock(applicationContext, current, captured).get() }.getOrNull()
        if (result?.ok != true) { retry = true; continue }
      }
      prefs.edit().putString(key, observation).putLong("$key.expires", status.expiresAt ?: 0L).apply()
    }
    NetworkChangeMonitor.update(applicationContext, enqueueInitial = false)
    KnockerTileService.refreshAll(applicationContext)
    // A bounded retry window tolerates handover and temporary failures without polling forever.
    if (KnockerNetwork.snapshot(applicationContext).id != networkId) retry = true
    return if (retry) retryResult else Result.success()
  }

  companion object {
    private const val WORK_NAME = "knocker.network-change"
    /** Keeps a follow-up batch when another transition arrives during an active check. */
    fun enqueue(context: Context) {
      WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE,
        OneTimeWorkRequestBuilder<NetworkChangeWorker>()
          .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
          .setInitialDelay(5, TimeUnit.SECONDS)
          .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
          .build())
    }
    /** Removes queued recovery when all self-knock profiles opt out. */
    fun cancel(context: Context) { WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME) }
  }
}
