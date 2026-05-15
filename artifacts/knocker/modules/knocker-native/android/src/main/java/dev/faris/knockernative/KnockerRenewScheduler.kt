package dev.faris.knockernative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

object KnockerRenewScheduler {
  private const val ACTION_RENEW = "dev.faris.knockernative.action.RENEW"
  private const val EXTRA_PROFILE_ID = "profileId"
  private const val SCHEDULED_IDS_KEY = "scheduledProfileIds"
  private const val REQUEST_CODE_RENEWAL = 0
  private val scheduleLock = Any()

  fun schedule(context: Context, profileId: String, fireAtMillis: Long) {
    synchronized(scheduleLock) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      val pendingIntent = pendingIntent(context, profileId)
      val triggerAtMillis = fireAtMillis.coerceAtLeast(System.currentTimeMillis())

      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
          if (alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
          } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
          }
        }
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> {
          alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        }
        else -> {
          alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        }
      }

      trackScheduledProfileId(context, profileId)
    }
  }

  fun cancel(context: Context, profileId: String) {
    synchronized(scheduleLock) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      alarmManager.cancel(pendingIntent(context, profileId))
      untrackScheduledProfileId(context, profileId)
    }
  }

  fun cancelAll(context: Context) {
    synchronized(scheduleLock) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      for (profileId in trackedScheduledProfileIds(context)) {
        alarmManager.cancel(pendingIntent(context, profileId))
      }
      clearTrackedScheduledProfileIds(context)
    }
  }

  fun profileId(intent: Intent?): String? {
    return intent?.getStringExtra(EXTRA_PROFILE_ID)?.takeIf { it.isNotBlank() }
  }

  private fun pendingIntent(context: Context, profileId: String): PendingIntent {
    val intent = Intent(context, RenewAlarmReceiver::class.java).apply {
      action = ACTION_RENEW
      data = Uri.parse("knocker://renew/${Uri.encode(profileId)}")
      putExtra(EXTRA_PROFILE_ID, profileId)
    }

    return PendingIntent.getBroadcast(
      context,
      REQUEST_CODE_RENEWAL,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun trackScheduledProfileId(context: Context, profileId: String) {
    synchronized(scheduleLock) {
      val updated = trackedScheduledProfileIds(context).toMutableSet()
      updated.add(profileId)
      prefs(context).edit().putStringSet(SCHEDULED_IDS_KEY, updated).apply()
    }
  }

  private fun untrackScheduledProfileId(context: Context, profileId: String) {
    synchronized(scheduleLock) {
      val updated = trackedScheduledProfileIds(context).toMutableSet()
      if (updated.remove(profileId)) {
        prefs(context).edit().putStringSet(SCHEDULED_IDS_KEY, updated).apply()
      }
    }
  }

  private fun clearTrackedScheduledProfileIds(context: Context) {
    synchronized(scheduleLock) {
      prefs(context).edit().remove(SCHEDULED_IDS_KEY).apply()
    }
  }

  private fun trackedScheduledProfileIds(context: Context): Set<String> {
    synchronized(scheduleLock) {
      return (prefs(context).getStringSet(SCHEDULED_IDS_KEY, emptySet()) ?: emptySet()).toSet()
    }
  }

  private fun prefs(context: Context) =
    KnockerPrefs.preferences(context)
}
