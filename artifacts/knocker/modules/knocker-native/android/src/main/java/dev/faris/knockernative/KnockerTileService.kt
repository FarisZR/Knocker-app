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
import java.util.concurrent.atomic.AtomicBoolean

abstract class KnockerTileService : TileService() {
  protected abstract val slot: Int
  private val mainHandler = Handler(Looper.getMainLooper())
  private val isKnocking = AtomicBoolean(false)

  @Volatile
  private var latestProfile: StoredProfile? = null

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

    val cachedProfile = latestProfile

    if (isKnocking.get()) {
      renderTile(cachedProfile, Tile.STATE_UNAVAILABLE, profileSubtitle("Knocking..."))
      return
    }

    if (!isKnocking.compareAndSet(false, true)) {
      renderTile(cachedProfile, Tile.STATE_UNAVAILABLE, profileSubtitle("Knocking..."))
      return
    }

    renderTile(cachedProfile, Tile.STATE_UNAVAILABLE, profileSubtitle("Knocking..."))
    KnockerExecutors.io.execute {
      try {
        val profile = KnockerStore.findProfileBySlot(applicationContext, slot)
        latestProfile = profile
        if (profile == null || !profile.canKnock()) {
          renderTile(profile, Tile.STATE_INACTIVE, "Assign this tile in Knocker")
          KnockerTileNotifier.notifyFailure(this, slot, profile, "Assign a configured profile to Knock $slot in Knocker.")
          openApp()
          finishCurrentKnock()
          return@execute
        }
        // The coordinator also serves foreground, startup and renewal callers.
        // Attach a callback instead of occupying an IO worker waiting on IO.
        KnockerRequests.knock(this, profile).whenComplete { result, error ->
          try {
            val current = KnockerStore.findProfileById(this, profile.id) ?: profile
            latestProfile = current
            if (error == null && result.ok) {
              renderTile(current, currentTileState(current), profileSubtitle("Knocked"))
              refreshCurrentStateAtExpiry(current)
              KnockerTileNotifier.notifySuccess(this, slot, current, result.whitelistedEntry)
              showToast("Knocked ${profileDisplayName(current)}")
            } else {
              val message = if (error == null) result.message ?: "Request failed" else "Native knock failed"
              renderTile(current, currentTileState(current), profileSubtitle("Failed - tap again"))
              KnockerTileNotifier.notifyFailure(this, slot, current, message)
              showToast("Knock failed: $message")
              openApp()
            }
          } finally { finishCurrentKnock() }
        }
      } catch (_: Exception) { finishCurrentKnock() }
    }
  }

  private fun finishCurrentKnock() {
    isKnocking.set(false)
    refreshCurrentStateSoon()
  }

  protected fun renderCurrentState() {
    KnockerExecutors.io.execute {
      val profile = KnockerStore.findProfileBySlot(applicationContext, slot)
      latestProfile = profile

      if (isKnocking.get()) {
        renderTile(profile, Tile.STATE_UNAVAILABLE, profileSubtitle("Knocking..."))
        return@execute
      }

      if (profile == null) {
        renderTile(null, Tile.STATE_INACTIVE, "Assign this tile in Knocker")
        return@execute
      }

      if (!profile.canKnock()) {
        renderTile(profile, Tile.STATE_INACTIVE, profileSubtitle("Finish setup in Knocker"))
        return@execute
      }

      renderTile(profile, currentTileState(profile), profileSubtitle(currentStatus(profile)))
      refreshCurrentStateAtExpiry(profile)
    }
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
      tileComponents(appContext).forEach { component ->
        requestListeningState(appContext, component)
      }
    }

    private fun tileComponents(context: android.content.Context) = listOf(
      ComponentName(context.packageName, KnockerTileService1::class.java.name),
      ComponentName(context.packageName, KnockerTileService2::class.java.name),
      ComponentName(context.packageName, KnockerTileService3::class.java.name),
      ComponentName(context.packageName, KnockerTileService4::class.java.name),
      ComponentName(context.packageName, KnockerTileService5::class.java.name),
    )
  }
}
