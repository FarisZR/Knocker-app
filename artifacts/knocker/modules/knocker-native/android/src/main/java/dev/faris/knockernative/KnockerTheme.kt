@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class)

package dev.faris.knockernative

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

internal val KnockerYellow = Color(0xFFFDE562)
internal const val WALLPAPER_COLORS_KEY = "wallpaperColors"
internal fun themePreferences(context: Context): SharedPreferences =
  context.getSharedPreferences("knocker_appearance", Context.MODE_PRIVATE)

internal data class Appearance(val wallpaperColors: Boolean = false, val setWallpaperColors: (Boolean) -> Unit = {})
internal val LocalAppearance = staticCompositionLocalOf { Appearance() }

// Light surfaces carry a little of the wordmark's warmth instead of flat grey,
// and filled actions use the actual wordmark yellow. Primary text and focus
// indicators stay dark instead of becoming olive.
internal val KnockerLightColors = lightColorScheme(
  primary = Color(0xFF282820), onPrimary = Color.White,
  primaryContainer = KnockerYellow, onPrimaryContainer = Color(0xFF221F10),
  inversePrimary = KnockerYellow,
  secondary = Color(0xFF55523F), onSecondary = Color.White,
  secondaryContainer = Color(0xFFFFF2AC), onSecondaryContainer = Color(0xFF282410),
  tertiary = Color(0xFF45664C), onTertiary = Color.White,
  tertiaryContainer = Color(0xFFC7ECCB), onTertiaryContainer = Color(0xFF082010),
  background = Color(0xFFFDFBF5), onBackground = Color(0xFF1D1C16),
  surface = Color(0xFFFDFBF5), onSurface = Color(0xFF1D1C16),
  surfaceVariant = Color(0xFFE9E4D4), onSurfaceVariant = Color(0xFF4A4739),
  surfaceTint = Color.Transparent,
  inverseSurface = Color(0xFF32302A), inverseOnSurface = Color(0xFFF6F1E6),
  outline = Color(0xFF7B7767), outlineVariant = Color(0xFFCDC8B7),
  surfaceDim = Color(0xFFDFDBD0), surfaceBright = Color(0xFFFDFBF5),
  surfaceContainerLowest = Color.White, surfaceContainerLow = Color(0xFFF8F5EC),
  surfaceContainer = Color(0xFFF3EFE5), surfaceContainerHigh = Color(0xFFEDE9DF),
  surfaceContainerHighest = Color(0xFFE7E3D9)
)

internal data class ActionColors(val container: Color, val content: Color)

/** Filled actions use brand yellow without making text buttons yellow on white. */
@Composable
internal fun knockerActionColors(): ActionColors {
  val colors = MaterialTheme.colorScheme
  return if (!isSystemInDarkTheme() && !LocalAppearance.current.wallpaperColors) {
    ActionColors(KnockerYellow, KnockerLightColors.onPrimaryContainer)
  } else ActionColors(colors.primary, colors.onPrimary)
}

/** Checked switches follow the filled actions, so light mode shows brand yellow rather than black. */
@Composable
internal fun knockerSwitchColors(): SwitchColors {
  val action = knockerActionColors()
  return SwitchDefaults.colors(checkedTrackColor = action.container, checkedThumbColor = action.content,
    checkedIconColor = action.container)
}

internal val KnockerDarkColors = darkColorScheme(
  primary = KnockerYellow, onPrimary = Color(0xFF3B3000),
  primaryContainer = Color(0xFF554600), onPrimaryContainer = KnockerYellow,
  inversePrimary = Color(0xFF705D00),
  secondary = Color(0xFFD2C7A2), onSecondary = Color(0xFF363016),
  secondaryContainer = Color(0xFF4D472B), onSecondaryContainer = Color(0xFFEFE3BC),
  tertiary = Color(0xFFACD0B0), onTertiary = Color(0xFF193722),
  tertiaryContainer = Color(0xFF2F4E37), onTertiaryContainer = Color(0xFFC7ECCB),
  background = Color(0xFF17140C), onBackground = Color(0xFFEAE1D2),
  surface = Color(0xFF17140C), onSurface = Color(0xFFEAE1D2),
  surfaceVariant = Color(0xFF4B4639), onSurfaceVariant = Color(0xFFCEC6B4),
  surfaceTint = KnockerYellow,
  inverseSurface = Color(0xFFEAE1D2), inverseOnSurface = Color(0xFF353026),
  outline = Color(0xFF969080), outlineVariant = Color(0xFF4B4639),
  surfaceDim = Color(0xFF17140C), surfaceBright = Color(0xFF3E392F),
  surfaceContainerLowest = Color(0xFF110F08), surfaceContainerLow = Color(0xFF201C13),
  surfaceContainer = Color(0xFF242017), surfaceContainerHigh = Color(0xFF2F2A21),
  surfaceContainerHighest = Color(0xFF3A352B)
)

/** Appearance is native, available on the first frame, and shared by every destination. */
@Composable
internal fun KnockerTheme(content: @Composable () -> Unit) {
  val context = LocalContext.current
  val preferences = remember(context) { themePreferences(context) }
  var wallpaperColors by remember(preferences) { mutableStateOf(preferences.getBoolean(WALLPAPER_COLORS_KEY, false)) }
  DisposableEffect(preferences) {
    val listener = SharedPreferences.OnSharedPreferenceChangeListener { prefs, key ->
      if (key == WALLPAPER_COLORS_KEY) wallpaperColors = prefs.getBoolean(key, false)
    }
    preferences.registerOnSharedPreferenceChangeListener(listener)
    onDispose { preferences.unregisterOnSharedPreferenceChangeListener(listener) }
  }
  val dark = isSystemInDarkTheme()
  val scheme = if (wallpaperColors && Build.VERSION.SDK_INT >= 31) {
    if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
  } else if (dark) KnockerDarkColors else KnockerLightColors
  CompositionLocalProvider(LocalAppearance provides Appearance(wallpaperColors) { enabled ->
    preferences.edit().putBoolean(WALLPAPER_COLORS_KEY, enabled).apply()
    wallpaperColors = enabled
  }) {
    MaterialExpressiveTheme(colorScheme = scheme, content = content)
  }
}
