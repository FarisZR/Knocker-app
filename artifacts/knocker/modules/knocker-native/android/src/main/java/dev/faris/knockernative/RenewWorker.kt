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
  override fun doWork(): Result {
    val profileId = inputData.getString(KEY_PROFILE_ID)?.takeIf { it.isNotBlank() }
      ?: return Result.failure()
    val profile = KnockerStore.findProfileById(applicationContext, profileId) ?: return Result.failure()

    if (!profile.autoRenew) return Result.success()
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
