package dev.faris.knockernative

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

internal object KnockerPrefs {
  private const val TAG = "KnockerPrefs"
  const val PREFS_NAME = "knocker.native"

  fun preferences(context: Context): SharedPreferences {
    return runCatching {
      val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

      EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
      )
    }.getOrElse { error ->
      Log.e(TAG, "Encrypted storage unavailable.", error)
      throw IllegalStateException("Encrypted storage unavailable", error)
    }
  }
}
