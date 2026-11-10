package dev.faris.knockernative

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONArray
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KnockerNativeModule : Module() {
  /** Exposes asynchronous storage and request bridges while preparing launch state without starting HTTP. */
  override fun definition() = ModuleDefinition {
    Name("KnockerNative")

    View(KnockerAppView::class) {
      Events("onAction")
      Prop("stateJson") { view: KnockerAppView, value: String -> view.setState(value) }
    }

    // Allocate only lightweight state on module creation; no storage or HTTP.
    Events("onKnockStateChanged")
    OnCreate {
      LaunchKnocker.prepareForLaunch()
      KnockerRequests.addObserver(pendingObserver)
    }
    OnDestroy { KnockerRequests.removeObserver(pendingObserver) }

    AsyncFunction("getPendingKnockIdsJson") { JSONArray(KnockerRequests.pendingIds()).toString() }
    AsyncFunction("knockProfileJson") { profileId: String, fingerprint: String, promise: Promise ->
      val profile = KnockerStore.findProfileById(context, profileId)
      if (profile == null || profile.configurationFingerprint != fingerprint) promise.resolve(null)
      else KnockerRequests.knock(context, profile).whenComplete { result, error ->
        if (error == null) promise.resolve(result.toJson().toString())
        else promise.reject("KNOCK_FAILED", "Native knock failed", error)
      }
    }

    AsyncFunction("startLaunchKnocks") {
      LaunchKnocker.startForLaunch(context)
      null
    }

    // Do not block Expo's module queue while HTTP runs on the IO pool.
    AsyncFunction("getLaunchKnockResultsJson") { promise: Promise ->
      LaunchKnocker.resultsFuture().whenComplete { results, error ->
        promise.resolve(LaunchKnocker.resultsToJson(if (error == null) results else emptyList()))
      }
    }

    AsyncFunction("getNetworkIdentity") { KnockerNetwork.snapshot(context).toMap() }

    AsyncFunction("syncProfiles") { profilesJson: String ->
      val previous = KnockerStore.readProfiles(context).associateBy { it.id }
      KnockerStore.replaceProfiles(context, profilesJson)
      NetworkChangeMonitor.update(context)
      if (KnockerStore.readProfiles(context).any { current ->
        val old = previous[current.id]
        current.autoRenew && current.canKnock() && current.ipOverride.isNullOrBlank() &&
          (old?.autoRenew != true || old.requestIdentity() != current.requestIdentity())
      }) NetworkChangeWorker.enqueue(context)
      KnockerTileService.refreshAll(context)
    }

    AsyncFunction("getProfilesJson") {
      KnockerStore.readProfilesJson(context)
    }

    AsyncFunction("scheduleRenewal") { profileId: String, fireAtMs: Double ->
      val stored = KnockerStore.findProfileById(context, profileId)
      KnockerRenewScheduler.schedule(context, profileId, stored?.let { RenewalTiming.renewalAt(context, it) } ?: fireAtMs.toLong())
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

  private val pendingObserver: (List<String>) -> Unit = { ids ->
    sendEvent("onKnockStateChanged", mapOf("profileIds" to ids))
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  /** Handles pre-Android-12 devices without requiring exact-alarm permission checks. */
  private fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return false
    return alarmManager.canScheduleExactAlarms()
  }
}
