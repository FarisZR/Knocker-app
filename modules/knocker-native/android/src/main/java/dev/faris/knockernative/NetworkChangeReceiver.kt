package dev.faris.knockernative

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build

/** System-owned availability subscription survives ordinary app process death. */
class NetworkChangeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val pending = goAsync()
    KnockerExecutors.io.execute {
      try {
        if (KnockerStore.readProfiles(context).any { it.autoRenew }) NetworkChangeWorker.enqueue(context)
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
          NetworkChangeMonitor.update(context)
          KnockerStore.readProfiles(context).forEach { profile ->
            RenewalTiming.renewalAt(context, profile)?.let { KnockerRenewScheduler.schedule(context, profile.id, it) }
          }
        }
      } finally { pending.finish() }
    }
  }
}

internal object NetworkChangeMonitor {
  private var callback: ConnectivityManager.NetworkCallback? = null
  private var watchedTransport: Int? = null

  @Synchronized fun update(context: Context, enqueueInitial: Boolean = true) {
    val app = context.applicationContext
    val manager = app.getSystemService(ConnectivityManager::class.java) ?: return
    fun intent(transport: Int) = PendingIntent.getBroadcast(app, transport,
      Intent(app, NetworkChangeReceiver::class.java).setAction("dev.faris.knockernative.NETWORK_AVAILABLE.$transport"),
      PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
    val enabled = KnockerStore.readProfiles(app).any { it.autoRenew && it.canKnock() && it.ipOverride.isNullOrBlank() }
    if (!enabled) {
      listOf(NetworkCapabilities.TRANSPORT_WIFI, NetworkCapabilities.TRANSPORT_CELLULAR).forEach {
        manager.unregisterNetworkCallback(intent(it))
      }
      callback?.let { manager.unregisterNetworkCallback(it) }
      callback = null
      watchedTransport = null
      NetworkChangeWorker.cancel(app)
      return
    }
    // Availability PendingIntents are consumed after delivery. Watch the next
    // transport, with separate identities so releasing the old one cannot cancel
    // its replacement. FOREGROUND excludes the usual standby cellular network.
    val next = if (KnockerNetwork.snapshot(app).type == "Wi-Fi")
      NetworkCapabilities.TRANSPORT_CELLULAR else NetworkCapabilities.TRANSPORT_WIFI
    if (next != watchedTransport) {
      watchedTransport?.let { manager.unregisterNetworkCallback(intent(it)) }
      manager.registerNetworkCallback(NetworkRequest.Builder().addTransportType(next)
        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .addCapability(NetworkCapabilities.NET_CAPABILITY_FOREGROUND)
        .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED).build(), intent(next))
      watchedTransport = next
    }
    if (callback != null) return
    callback = object : ConnectivityManager.NetworkCallback() {
      // Do not query activeNetwork inside callbacks: it may still describe the
      // old route. The debounced worker captures the settled default network.
      override fun onAvailable(network: Network) { NetworkChangeWorker.enqueue(app) }
      override fun onLost(network: Network) { NetworkChangeWorker.enqueue(app) }
    }.also { manager.registerDefaultNetworkCallback(it) }
    if (enqueueInitial) NetworkChangeWorker.enqueue(app)
  }
}
