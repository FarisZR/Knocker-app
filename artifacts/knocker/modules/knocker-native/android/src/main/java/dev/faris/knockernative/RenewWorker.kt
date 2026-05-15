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

    return when (val knockResult = KnockerHttp.knock(profile)) {
      is KnockOutcome.Success -> {
        val updated = KnockerStore.updateExpiry(applicationContext, profileId, knockResult.expiresAtMillis)
        val nextFireAt = updated?.renewalAtMillis()
        if (nextFireAt != null) {
          KnockerRenewScheduler.schedule(applicationContext, profileId, nextFireAt)
        } else if (updated != null) {
          KnockerRenewScheduler.cancel(applicationContext, profileId)
        }
        KnockerTileService.refreshAll(applicationContext)
        Result.success()
      }
      is KnockOutcome.Failure -> Result.failure()
    }
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
