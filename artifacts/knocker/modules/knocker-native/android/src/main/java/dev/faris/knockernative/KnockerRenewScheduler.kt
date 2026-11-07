package dev.faris.knockernative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import java.util.UUID

object KnockerRenewScheduler {
  private const val ACTION_RENEW = "dev.faris.knockernative.action.RENEW"
  private const val EXTRA_PROFILE_ID = "profileId"
  private const val EXTRA_TOKEN = "renewalToken"
  private const val TOKEN_PREFIX = "renewalToken."
  private const val SCHEDULED_IDS_KEY = "scheduledProfileIds"
  private const val REQUEST_CODE_RENEWAL = 0
  private const val REQUEST_CODE_FALLBACK = 1
  private val scheduleLock = Any()

  /** Keeps an independent inexact alarm even when precise scheduling is available. */
  fun schedule(context: Context, profileId: String, fireAtMillis: Long) {
    synchronized(scheduleLock) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      val token = UUID.randomUUID().toString()
      val exactAlarm = pendingIntent(context, profileId, REQUEST_CODE_RENEWAL, token)
      val triggerAtMillis = fireAtMillis.coerceAtLeast(System.currentTimeMillis())

      // Revoking exact-alarm access removes exact alarms, but leaves this backup.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis,
          pendingIntent(context, profileId, REQUEST_CODE_FALLBACK, token))
      }
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
          if (alarmManager.canScheduleExactAlarms()) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, exactAlarm)
          } else {
            alarmManager.cancel(exactAlarm)
          }
        }
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> {
          alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, exactAlarm)
        }
        else -> {
          alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, exactAlarm)
        }
      }

      trackScheduledProfileId(context, profileId, token)
    }
  }

  /** Cancels both delivery paths and removes the pending generation. */
  fun cancel(context: Context, profileId: String) {
    synchronized(scheduleLock) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      alarmManager.cancel(pendingIntent(context, profileId, REQUEST_CODE_RENEWAL))
      alarmManager.cancel(pendingIntent(context, profileId, REQUEST_CODE_FALLBACK))
      untrackScheduledProfileId(context, profileId)
    }
  }

  /** Cancels every tracked profile, including its backup alarm. */
  fun cancelAll(context: Context) {
    synchronized(scheduleLock) {
      val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return
      for (profileId in trackedScheduledProfileIds(context)) {
        alarmManager.cancel(pendingIntent(context, profileId, REQUEST_CODE_RENEWAL))
        alarmManager.cancel(pendingIntent(context, profileId, REQUEST_CODE_FALLBACK))
        prefs(context).edit().remove(TOKEN_PREFIX + profileId).apply()
      }
      clearTrackedScheduledProfileIds(context)
    }
  }

  /** Accepts one current alarm and cancels its sibling; stale deliveries cannot consume a newer schedule. */
  fun consume(context: Context, intent: Intent?): String? = synchronized(scheduleLock) {
    val profileId = intent?.getStringExtra(EXTRA_PROFILE_ID)?.takeIf { it.isNotBlank() }
      ?: return@synchronized null
    if (profileId !in trackedScheduledProfileIds(context)) return@synchronized null
    if (intent.getStringExtra(EXTRA_TOKEN) != prefs(context).getString(TOKEN_PREFIX + profileId, null))
      return@synchronized null
    // A pre-upgrade alarm has no token and is accepted only if no token replaced it.
    cancel(context, profileId)
    profileId
  }

  /** Upgrades only still-pending renewals after the system reports an access grant. */
  fun reschedulePending(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || !alarms.canScheduleExactAlarms()) return
    synchronized(scheduleLock) {
      for (profileId in trackedScheduledProfileIds(context)) {
        val fireAt = KnockerStore.findProfileById(context, profileId)?.renewalAtMillis()
        if (fireAt == null) cancel(context, profileId) else schedule(context, profileId, fireAt)
      }
    }
  }

  /** Keeps alarm identities stable across replacements, with the current generation in extras. */
  private fun pendingIntent(context: Context, profileId: String, requestCode: Int, token: String? = null): PendingIntent {
    val intent = Intent(context, RenewAlarmReceiver::class.java).apply {
      action = ACTION_RENEW
      data = Uri.parse("knocker://renew/${Uri.encode(profileId)}")
      putExtra(EXTRA_PROFILE_ID, profileId)
      putExtra(EXTRA_TOKEN, token)
    }

    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** Persists the pending profile and generation together for cold receiver starts. */
  private fun trackScheduledProfileId(context: Context, profileId: String, token: String) {
    synchronized(scheduleLock) {
      val updated = trackedScheduledProfileIds(context).toMutableSet()
      updated.add(profileId)
      prefs(context).edit().putStringSet(SCHEDULED_IDS_KEY, updated)
        .putString(TOKEN_PREFIX + profileId, token).apply()
    }
  }

  /** Removes the consumed or canceled generation along with its profile ID. */
  private fun untrackScheduledProfileId(context: Context, profileId: String) {
    synchronized(scheduleLock) {
      val updated = trackedScheduledProfileIds(context).toMutableSet()
      if (updated.remove(profileId)) {
        prefs(context).edit().putStringSet(SCHEDULED_IDS_KEY, updated)
          .remove(TOKEN_PREFIX + profileId).apply()
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
