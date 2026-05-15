package dev.faris.knockernative

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.widget.Toast

abstract class KnockerTileService : TileService() {
  protected abstract val slot: Int
  private val mainHandler = Handler(Looper.getMainLooper())

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
      return
    }

    if (!profile.canKnock()) {
      renderTile(profile, Tile.STATE_INACTIVE, profileSubtitle("Finish setup in Knocker"))
      showToast("${profileDisplayName(profile)} is missing its endpoint or API key")
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
          showToast("Knocked ${profileDisplayName(current)}")
        }
        is KnockOutcome.Failure -> {
          renderTile(profile, Tile.STATE_ACTIVE, profileSubtitle("Failed - tap again"))
          showToast("Knock failed: ${result.message}")
        }
      }
      refreshCurrentStateSoon()
    }
  }

  protected fun renderCurrentState() {
    val profile = KnockerStore.findProfileBySlot(this, slot)
    if (profile == null) {
      renderTile(null, Tile.STATE_UNAVAILABLE, "Assign this tile in Knocker")
      return
    }

    if (!profile.canKnock()) {
      renderTile(profile, Tile.STATE_INACTIVE, profileSubtitle("Finish setup in Knocker"))
      return
    }

    renderTile(profile, Tile.STATE_ACTIVE, profileSubtitle(currentStatus(profile)))
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

  private fun showToast(message: String) {
    mainHandler.post {
      Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
    }
  }
}
