package dev.faris.knockernative

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KnockerNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KnockerNative")

    AsyncFunction("syncProfiles") { profilesJson: String ->
      KnockerStore.replaceProfiles(context, profilesJson)
      KnockerTileService.refreshAll(context)
    }

    AsyncFunction("scheduleRenewal") { profileId: String, fireAtMs: Double ->
      KnockerRenewScheduler.schedule(context, profileId, fireAtMs.toLong())
    }

    AsyncFunction("cancelRenewal") { profileId: String ->
      KnockerRenewScheduler.cancel(context, profileId)
    }

    AsyncFunction("cancelAllRenewals") {
      KnockerRenewScheduler.cancelAll(context)
    }

    AsyncFunction("canScheduleExactAlarms") {
      canScheduleExactAlarms(context)
    }

    AsyncFunction("openExactAlarmSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${context.packageName}")
        }
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
          data = Uri.parse("package:${context.packageName}")
        }
      }

      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  private fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return false
    return alarmManager.canScheduleExactAlarms()
  }
}
