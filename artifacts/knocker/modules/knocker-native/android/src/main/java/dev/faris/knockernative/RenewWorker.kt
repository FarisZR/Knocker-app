package dev.faris.knockernative

import android.content.Context
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf

class RenewWorker(
  appContext: Context,
  params: WorkerParameters
) : Worker(appContext, params) {
  /** Renews the current enabled profile through shared request work and reports its persisted outcome. */
  override fun doWork(): Result {
    val profileId = inputData.getString(KEY_PROFILE_ID)?.takeIf { it.isNotBlank() }
      ?: return Result.failure()
    val profile = KnockerStore.findProfileById(applicationContext, profileId) ?: return Result.failure()

    if (!profile.autoRenew) return Result.success()
    // This alarm may be timed from a grant on another network. When /status shows
    // this network is covered for longer, move the alarm instead of knocking.
    if (profile.ipOverride.isNullOrBlank()) {
      val captured = KnockerNetwork.capture(applicationContext)
      val networkId = captured.identity.id
      val status = if (networkId == null) null else checkConnectionStatus(profile, captured)
      val renewAt = status?.expiresAt?.minus(profile.autoRenewSafetyWindowSec.toLong() * 1000L)
      if (networkId != null && status?.whitelisted == true && renewAt != null &&
        renewAt > System.currentTimeMillis() + 60_000L && KnockerNetwork.snapshot(applicationContext).id == networkId) {
        RenewalTiming.recordCoverage(applicationContext, profile, networkId, status.expiresAt)
        KnockerRenewScheduler.schedule(applicationContext, profile.id, renewAt)
        return Result.success()
      }
    }
    val result = runCatching { KnockerRequests.knock(applicationContext, profile).get() }.getOrNull()
    val current = KnockerStore.findProfileById(applicationContext, profileId) ?: profile
    if (result?.ok == true) {
      KnockerTileNotifier.notifySuccess(applicationContext, current.tileSlot ?: 0, current, result.whitelistedEntry)
    } else {
      KnockerTileNotifier.notifyFailure(applicationContext, current.tileSlot ?: 0, current, result?.message ?: "Native knock failed")
    }
    KnockerTileService.refreshAll(applicationContext)
    return if (result?.ok == true) Result.success() else Result.failure()
  }

  companion object {
    private const val KEY_PROFILE_ID = "profileId"
    private const val UNIQUE_WORK_PREFIX = "knocker.renew."

    fun enqueue(context: Context, profileId: String) {
      val workRequest = OneTimeWorkRequestBuilder<RenewWorker>()
        .setInputData(workDataOf(KEY_PROFILE_ID to profileId))
        .build()

      WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
        UNIQUE_WORK_PREFIX + profileId,
        ExistingWorkPolicy.REPLACE,
        workRequest
      )
    }
  }
}
