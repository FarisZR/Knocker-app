@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package dev.faris.knockernative

import android.os.Build
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

/** Settings is a full destination with standard list rows, not a dialog over home. */
@Composable
internal fun NativeSettings(snackbar: SnackbarHostState, onBack: () -> Unit, onRefreshStatus: () -> Unit, feedback: (String) -> Unit) {
  val appearance = LocalAppearance.current
  val context = LocalContext.current
  val scope = rememberCoroutineScope()
  val version = remember(context) {
    runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull()
  }
  val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
  Scaffold(
    modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
    topBar = {
      TopAppBar(title = { Text("Settings") }, scrollBehavior = scrollBehavior,
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
    },
    snackbarHost = { SnackbarHost(snackbar) }
  ) { padding ->
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
      Column(Modifier.widthIn(max = 840.dp).fillMaxSize().verticalScroll(rememberScrollState())) {
        if (Build.VERSION.SDK_INT >= 31) {
          SettingsSection("Appearance")
          SettingsRow(Icons.Default.Palette, "Use wallpaper colors", "Material You · off uses Knocker yellow",
            Modifier.toggleable(value = appearance.wallpaperColors, role = Role.Switch,
              onValueChange = { feedback("tap"); appearance.setWallpaperColors(it) })
          ) { Switch(checked = appearance.wallpaperColors, onCheckedChange = null, colors = knockerSwitchColors()) }
        }
        SettingsSection("Connection")
        SettingsRow(Icons.Default.Sync, "Check connection status", "Connection checks use only your configured Knocker servers.",
          Modifier.clickable(role = Role.Button) {
            onRefreshStatus()
            scope.launch {
              snackbar.currentSnackbarData?.dismiss()
              snackbar.showSnackbar("Checking your servers", duration = SnackbarDuration.Short)
            }
          })
        SettingsSection("About")
        SettingsRow(Icons.Default.Info, "Version", version ?: "Unknown")
      }
    }
  }
}

@Composable
internal fun SettingsSection(title: String) {
  Text(title, Modifier.padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 8.dp).semantics { heading() },
    style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
}

/** Full-width rows keep ripples edge to edge and merge their text with the row action. */
@Composable
internal fun SettingsRow(icon: ImageVector, title: String, detail: String?, modifier: Modifier = Modifier,
  trailing: (@Composable () -> Unit)? = null) {
  ListItem(headlineContent = { Text(title) }, supportingContent = detail?.let { { Text(it) } },
    leadingContent = { Icon(icon, null) }, trailingContent = trailing,
    colors = ListItemDefaults.colors(containerColor = Color.Transparent), modifier = modifier.fillMaxWidth())
}
