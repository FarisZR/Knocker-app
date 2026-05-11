package dev.faris.knockernative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object KnockerRenewScheduler {
  private const val ACTION_RENEW = "dev.faris.knockernative.action.RENEW"
  private const val EXTRA_PROFILE_ID = "profileId"

  fun schedule(context: Context, profileId: String, fireAtMillis: Long) {
    val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
    val pendingIntent = pendingIntent(context, profileId)
    val triggerAtMillis = fireAtMillis.coerceAtLeast(System.currentTimeMillis())

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarmManager.canScheduleExactAlarms()) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
      return
    }

    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
  }

  fun cancel(context: Context, profileId: String) {
    val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
    alarmManager.cancel(pendingIntent(context, profileId))
  }

  fun cancelAll(context: Context) {
    for (profile in KnockerStore.readProfiles(context)) {
      cancel(context, profile.id)
    }
  }

  fun profileId(intent: Intent?): String? {
    return intent?.getStringExtra(EXTRA_PROFILE_ID)?.takeIf { it.isNotBlank() }
  }

  private fun pendingIntent(context: Context, profileId: String): PendingIntent {
    val intent = Intent(context, RenewAlarmReceiver::class.java).apply {
      action = ACTION_RENEW
      putExtra(EXTRA_PROFILE_ID, profileId)
    }

    return PendingIntent.getBroadcast(
      context,
      profileId.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
