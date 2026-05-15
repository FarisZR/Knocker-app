package dev.faris.knockernative

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.widget.Toast

abstract class KnockerTileService : TileService() {
  protected abstract val slot: Int
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onTileAdded() {
    super.onTileAdded()
    renderCurrentState()
  }

  override fun onStartListening() {
    super.onStartListening()
    renderCurrentState()
  }

  override fun onClick() {
    super.onClick()

    val profile = KnockerStore.findProfileBySlot(this, slot)
    if (profile == null) {
      renderTile(null, Tile.STATE_INACTIVE, "Assign this tile in Knocker")
      showToast("Assign a profile to Knock $slot in Knocker")
      openApp()
      return
    }

    if (!profile.canKnock()) {
      renderTile(profile, Tile.STATE_INACTIVE, profileSubtitle("Finish setup in Knocker"))
      showToast("${profileDisplayName(profile)} is missing its endpoint or API key")
      openApp()
      refreshCurrentStateSoon()
      return
    }

    renderTile(profile, Tile.STATE_ACTIVE, profileSubtitle("Knocking..."))
    KnockerExecutors.io.execute {
      val result = KnockerHttp.knock(profile)
      when (result) {
        is KnockOutcome.Success -> {
          val updated = KnockerStore.updateExpiry(this, profile.id, result.expiresAtMillis)
          val current = updated ?: profile
          val nextFireAt = updated?.renewalAtMillis()
          if (nextFireAt != null) {
            KnockerRenewScheduler.schedule(this, profile.id, nextFireAt)
          }
          renderTile(current, Tile.STATE_ACTIVE, profileSubtitle("Knocked"))
          refreshCurrentStateAtExpiry(current)
          KnockerTileNotifier.notifySuccess(this, slot, current, result.whitelistedEntry)
          showToast("Knocked ${profileDisplayName(current)}")
        }
        is KnockOutcome.Failure -> {
          renderTile(profile, currentTileState(profile), profileSubtitle("Failed - tap again"))
          showToast("Knock failed: ${result.message}")
          openApp()
        }
      }
      refreshCurrentStateSoon()
    }
  }

  protected fun renderCurrentState() {
    val profile = KnockerStore.findProfileBySlot(this, slot)
    if (profile == null) {
      renderTile(null, Tile.STATE_INACTIVE, "Assign this tile in Knocker")
      return
    }

    if (!profile.canKnock()) {
      renderTile(profile, Tile.STATE_INACTIVE, profileSubtitle("Finish setup in Knocker"))
      return
    }

    renderTile(profile, currentTileState(profile), profileSubtitle(currentStatus(profile)))
    refreshCurrentStateAtExpiry(profile)
  }

  private fun renderTile(profile: StoredProfile?, state: Int, subtitle: String?) {
    mainHandler.post {
      val tile = qsTile ?: return@post
      tile.state = state
      tile.label = profile?.let(::profileDisplayName) ?: "Knock $slot"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        tile.subtitle = subtitle
      }
      tile.updateTile()
    }
  }

  private fun profileSubtitle(status: String): String {
    return "Tile $slot - $status"
  }

  private fun currentTileState(profile: StoredProfile): Int {
    val expiresAt = profile.expiresAt ?: return Tile.STATE_INACTIVE
    return if (expiresAt > System.currentTimeMillis()) {
      Tile.STATE_ACTIVE
    } else {
      Tile.STATE_INACTIVE
    }
  }

  private fun profileDisplayName(profile: StoredProfile): String {
    return profile.name.takeIf { it.isNotBlank() } ?: "Profile"
  }

  private fun currentStatus(profile: StoredProfile): String {
    val expiresAt = profile.expiresAt ?: return "Ready"
    val minutes = ((expiresAt - System.currentTimeMillis()) / 60_000L).coerceAtLeast(0L)
    return if (minutes == 0L) "Ready" else "Expires in ${minutes}m"
  }

  private fun refreshCurrentStateSoon() {
    mainHandler.postDelayed({ renderCurrentState() }, 1500L)
  }

  private fun refreshCurrentStateAtExpiry(profile: StoredProfile) {
    val expiresAt = profile.expiresAt ?: return
    val delay = (expiresAt - System.currentTimeMillis()).coerceAtLeast(0L)
    if (delay == 0L) return
    mainHandler.postDelayed({ renderCurrentState() }, delay)
  }

  private fun showToast(message: String) {
    mainHandler.post {
      Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
    }
  }

  private fun openApp() {
    mainHandler.post {
      val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return@post
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val pendingIntent = PendingIntent.getActivity(
          applicationContext,
          slot,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        startActivityAndCollapse(pendingIntent)
      } else {
        @Suppress("DEPRECATION")
        startActivityAndCollapse(launchIntent)
      }
    }
  }

  companion object {
    fun refreshAll(context: android.content.Context) {
      val appContext = context.applicationContext
      tileComponents.forEach { component ->
        requestListeningState(appContext, component)
      }
    }

    private val tileComponents = listOf(
      ComponentName("dev.faris.knocker", KnockerTileService1::class.java.name),
      ComponentName("dev.faris.knocker", KnockerTileService2::class.java.name),
      ComponentName("dev.faris.knocker", KnockerTileService3::class.java.name),
      ComponentName("dev.faris.knocker", KnockerTileService4::class.java.name),
      ComponentName("dev.faris.knocker", KnockerTileService5::class.java.name),
    )
  }
}
