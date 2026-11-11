package dev.faris.knockernative

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object KnockerTileNotifier {
  private const val CHANNEL_ID = "quick_tile_knocks"
  private const val CHANNEL_NAME = "Quick tile knocks"

  fun notifySuccess(
    context: Context,
    slot: Int,
    profile: StoredProfile,
    whitelistedEntry: String?
  ) {
    val appContext = context.applicationContext
    if (!canPostNotifications(appContext)) return

    ensureChannel(appContext)
    cancelLegacyNotifications(appContext, slot)

    val detailParts = buildList {
      whitelistedEntry?.takeIf { it.isNotBlank() }?.let { add(it) }
      add(ttlText(profile.expiresAt))
    }
    val statusText = buildString {
      append("Latest knock succeeded")
      if (detailParts.isNotEmpty()) {
        append(" - ")
        append(detailParts.joinToString(" - "))
      }
    }

    val notification = NotificationCompat.Builder(appContext, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_sync_noanim)
      .setContentTitle(profileDisplayName(profile))
      .setContentText(statusText)
      .setStyle(NotificationCompat.BigTextStyle().bigText(statusText))
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(System.currentTimeMillis())
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setContentIntent(contentIntent(appContext))
      .build()

    NotificationManagerCompat.from(appContext).notify(notificationId(slot, profile), notification)
  }

  fun notifyFailure(
    context: Context,
    slot: Int,
    profile: StoredProfile?,
    message: String
  ) {
    val appContext = context.applicationContext
    if (!canPostNotifications(appContext)) return

    ensureChannel(appContext)
    cancelLegacyNotifications(appContext, slot)

    val title = profile?.let(::profileDisplayName) ?: "Knock $slot"
    val body = "Latest knock failed - $message"
    val notification = NotificationCompat.Builder(appContext, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_error)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(System.currentTimeMillis())
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setContentIntent(contentIntent(appContext))
      .build()

    NotificationManagerCompat.from(appContext).notify(notificationId(slot, profile), notification)
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Silent status updates for Quick Settings knocks"
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  private fun canPostNotifications(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(
      context,
      Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun contentIntent(context: Context): PendingIntent? {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun ttlText(expiresAt: Long?): String {
    if (expiresAt == null) return "TTL active"
    val remainingSeconds = ((expiresAt - System.currentTimeMillis()) / 1000L).coerceAtLeast(0L)
    val minutes = remainingSeconds / 60L
    val seconds = remainingSeconds % 60L
    return if (minutes > 0L) {
      "Expires in ${minutes}m"
    } else {
      "Expires in ${seconds}s"
    }
  }

  private fun profileDisplayName(profile: StoredProfile): String {
    return profile.name.takeIf { it.isNotBlank() } ?: "profile"
  }

  private fun notificationId(slot: Int, profile: StoredProfile?): Int {
    val stableProfileId = profile?.id?.hashCode()?.and(Int.MAX_VALUE)
    return stableProfileId ?: (10_000 + slot)
  }

  private fun cancelLegacyNotifications(context: Context, slot: Int) {
    val notifications = NotificationManagerCompat.from(context)
    notifications.cancel(slot)
    notifications.cancel(1000 + slot)
  }
}
