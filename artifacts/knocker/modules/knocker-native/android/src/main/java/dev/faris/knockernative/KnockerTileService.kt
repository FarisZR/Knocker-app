package dev.faris.knockernative

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

abstract class KnockerTileService : TileService() {
  protected abstract val slot: Int

  override fun onStartListening() {
    super.onStartListening()
    renderCurrentState()
  }

  override fun onClick() {
    super.onClick()

    val profile = KnockerStore.findProfileBySlot(this, slot)
    if (profile == null || !profile.canKnock()) {
      renderCurrentState()
      return
    }

    renderTile(profile, Tile.STATE_ACTIVE, "Knocking...")
    KnockerExecutors.io.execute {
      val result = KnockerHttp.knock(profile)
      if (result is KnockOutcome.Success) {
        val updated = KnockerStore.updateExpiry(this, profile.id, result.expiresAtMillis)
        val nextFireAt = updated?.renewalAtMillis()
        if (nextFireAt != null) {
          KnockerRenewScheduler.schedule(this, profile.id, nextFireAt)
        }
      }
      renderCurrentState()
    }
  }

  protected fun renderCurrentState() {
    val profile = KnockerStore.findProfileBySlot(this, slot)
    if (profile == null || !profile.canKnock()) {
      renderTile(null, Tile.STATE_UNAVAILABLE, "Assign this tile in Knocker")
      return
    }

    renderTile(profile, Tile.STATE_INACTIVE, profileSubtitle(profile))
  }

  private fun renderTile(profile: StoredProfile?, state: Int, subtitle: String?) {
    Handler(Looper.getMainLooper()).post {
      val tile = qsTile ?: return@post
      tile.state = state
      tile.label = profile?.name?.takeIf { it.isNotBlank() } ?: "Knock $slot"
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        tile.subtitle = subtitle
      }
      tile.updateTile()
    }
  }

  private fun profileSubtitle(profile: StoredProfile): String? {
    val expiresAt = profile.expiresAt ?: return "Ready"
    val minutes = ((expiresAt - System.currentTimeMillis()) / 60_000L).coerceAtLeast(0L)
    return if (minutes == 0L) "Ready" else "Expires in ${minutes}m"
  }
}
