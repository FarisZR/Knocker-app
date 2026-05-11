package dev.faris.knockernative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class RenewAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val profileId = KnockerRenewScheduler.profileId(intent) ?: return
    val pendingResult = goAsync()

    KnockerExecutors.io.execute {
      try {
        val profile = KnockerStore.findProfileById(context, profileId) ?: return@execute
        val result = KnockerHttp.knock(profile)
        if (result is KnockOutcome.Success) {
          val updated = KnockerStore.updateExpiry(context, profileId, result.expiresAtMillis)
          val nextFireAt = updated?.renewalAtMillis()
          if (nextFireAt != null) {
            KnockerRenewScheduler.schedule(context, profileId, nextFireAt)
          }
        }
      } finally {
        pendingResult.finish()
      }
    }
  }
}
