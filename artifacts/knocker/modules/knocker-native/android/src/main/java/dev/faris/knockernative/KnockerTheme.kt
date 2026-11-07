@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class)

package dev.faris.knockernative

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/** The app and instrumentation tests use the same Android appearance and dynamic palette. */
@Composable
internal fun KnockerTheme(content: @Composable () -> Unit) {
  val context = LocalContext.current
  val dark = isSystemInDarkTheme()
  val scheme = if (Build.VERSION.SDK_INT >= 31) {
    if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
  } else if (dark) darkColorScheme() else lightColorScheme()
  MaterialExpressiveTheme(colorScheme = scheme, content = content)
}
