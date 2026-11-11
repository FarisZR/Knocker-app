package dev.faris.knockernative

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

internal object KnockerPrefs {
  private const val TAG = "KnockerPrefs"
  private const val PREFS_NAME = "knocker.native"
  private val prefsLock = Any()

  @Volatile
  private var cachedPreferences: SharedPreferences? = null

  fun preferences(context: Context): SharedPreferences {
    val appContext = context.applicationContext
    cachedPreferences?.let { return it }

    synchronized(prefsLock) {
      cachedPreferences?.let { return it }

      try {
        val masterKey = MasterKey.Builder(appContext)
          .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
          .build()

        val preferences = EncryptedSharedPreferences.create(
          appContext,
          PREFS_NAME,
          masterKey,
          EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
          EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        cachedPreferences = preferences
        return preferences
      } catch (error: Exception) {
        Log.e(TAG, "Encrypted storage unavailable (keystore/security provider issue).", error)
        throw IllegalStateException(
          "Encrypted storage unavailable (keystore/security provider issue)",
          error
        )
      }
    }
  }
}
