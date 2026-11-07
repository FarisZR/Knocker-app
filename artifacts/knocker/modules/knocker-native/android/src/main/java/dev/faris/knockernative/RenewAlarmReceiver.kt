package dev.faris.knockernative

import android.app.AlarmManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class RenewAlarmReceiver : BroadcastReceiver() {
  /** Claims alarm deliveries or upgrades pending alarms after a grant, with storage work off the UI thread. */
  override fun onReceive(context: Context, intent: Intent?) {
    val pending = goAsync()
    KnockerExecutors.io.execute {
      try {
        if (intent?.action == AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED) {
          KnockerRenewScheduler.reschedulePending(context)
        } else {
          val profileId = KnockerRenewScheduler.consume(context, intent) ?: return@execute
          RenewWorker.enqueue(context, profileId)
        }
      } catch (error: Exception) {
        Log.w("KnockerRenewAlarm", "Could not dispatch renewal alarm", error)
      } finally {
        pending.finish()
      }
    }
  }
}
