package dev.faris.knockernative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class RenewAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val profileId = KnockerRenewScheduler.profileId(intent) ?: return
    RenewWorker.enqueue(context, profileId)
  }
}
