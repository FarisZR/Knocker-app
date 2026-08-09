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

    // Fire launch knocks as early as possible — before the JS bundle finishes
    // loading — so whitelisting happens promptly when the user opens the app.
    // JS later picks up the result via `getLaunchKnockResultsJson`.
    OnCreate {
      val ctx = appContext.reactContext ?: return@OnCreate
      LaunchKnocker.startForLaunch(ctx)
    }

    AsyncFunction("syncProfiles") { profilesJson: String ->
      KnockerStore.replaceProfiles(context, profilesJson)
      KnockerTileService.refreshAll(context)
    }

    AsyncFunction("getProfilesJson") {
      KnockerStore.readProfilesJson(context)
    }

    AsyncFunction("getLaunchKnockResultsJson") {
      // Awaits and consumes the launch-knock batch started in OnCreate. If a
      // later React surface asks again, it gets a fresh batch instead of the
      // previous surface's results.
      val ctx = appContext.reactContext
      if (ctx == null) {
        return@AsyncFunction "[]"
      }
      val results = LaunchKnocker.awaitAndConsume(ctx)
      LaunchKnocker.resultsToJson(results)
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
