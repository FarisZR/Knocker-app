package dev.faris.knockernative

import android.content.Context
import android.content.SharedPreferences
import java.io.IOException

internal const val DIAGNOSTICS_ENABLED_KEY = "enabled"

/** The crash-report choice is not a secret, so it lives in plain preferences that load without the Keystore. */
internal fun diagnosticsPreferences(context: Context): SharedPreferences =
  context.getSharedPreferences("knocker_diagnostics", Context.MODE_PRIVATE)

/** Crash reporting is on until the user turns it off in Settings. */
internal fun diagnosticsEnabled(context: Context): Boolean =
  diagnosticsPreferences(context).getBoolean(DIAGNOSTICS_ENABLED_KEY, true)

/** Commits synchronously so a "stopped" report can never be followed by a stale stored value. */
internal fun setDiagnosticsEnabled(context: Context, enabled: Boolean) {
  if (!diagnosticsPreferences(context).edit().putBoolean(DIAGNOSTICS_ENABLED_KEY, enabled).commit()) {
    throw IOException("Failed to store the crash report setting.")
  }
}
