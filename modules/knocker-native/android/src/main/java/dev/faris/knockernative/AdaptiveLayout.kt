@file:OptIn(androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi::class)

package dev.faris.knockernative

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.layout.PaneScaffoldDirective
import androidx.compose.material3.adaptive.layout.calculatePaneScaffoldDirective
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize

/**
 * Tablets, unfolded foldables and large windows show the profile list beside the open
 * profile or Settings. With nothing open, home keeps the whole window. Two panes need room for a phone-width list and a usable editor,
 * and a window taller than a phone on its side, which keeps its single, full-width page.
 */
@Composable
internal fun knockerPaneDirective(): PaneScaffoldDirective {
  val size = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.toSize().toDpSize() }
  val twoPane = size.width >= TWO_PANE_MIN_WIDTH && size.height >= TWO_PANE_MIN_HEIGHT
  return calculatePaneScaffoldDirective(currentWindowAdaptiveInfoV2()).copy(
    maxHorizontalPartitions = if (twoPane) 2 else 1,
    horizontalPartitionSpacerSize = if (twoPane) 24.dp else 0.dp,
    // Panes sit side by side only; a stacked list above an editor leaves both too short.
    maxVerticalPartitions = 1, verticalPartitionSpacerSize = 0.dp,
    defaultPanePreferredWidth = if (size.width >= 1000.dp) 412.dp else 360.dp)
}

private val TWO_PANE_MIN_WIDTH = 720.dp
private val TWO_PANE_MIN_HEIGHT = 480.dp

/** True inside the rounded detail container beside the profile list. */
internal val LocalDetailPane = staticCompositionLocalOf { false }

/**
 * In two panes, the open profile or Settings sits in one rounded
 * container beside the list. The container pads for the window edges it touches,
 * which consumes those insets, so app bars and forms inside do not pad twice.
 */
@Composable
internal fun DetailPane(enabled: Boolean, content: @Composable () -> Unit) {
  if (!enabled) return content()
  val edges = WindowInsets.systemBars.union(WindowInsets.displayCutout)
    .only(WindowInsetsSides.Top + WindowInsetsSides.End + WindowInsetsSides.Bottom)
  Surface(Modifier.fillMaxSize().windowInsetsPadding(edges).padding(top = 8.dp, end = 16.dp, bottom = 16.dp),
    shape = MaterialTheme.shapes.extraLarge, color = MaterialTheme.colorScheme.surfaceContainerLow) {
    CompositionLocalProvider(LocalDetailPane provides true, content = content)
  }
}

/** Detail screens draw on their container; a scrolled bar lifts to the next container tone. */
@Composable
internal fun detailContainerColor(): Color =
  if (LocalDetailPane.current) Color.Transparent else MaterialTheme.colorScheme.background

@Composable
internal fun detailBarColors(): TopAppBarColors =
  if (LocalDetailPane.current) TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent,
    scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer)
  else TopAppBarDefaults.topAppBarColors()

/** Beside the list a detail closes in place; as a full page it goes back. */
@Composable
internal fun DetailNavigationIcon(onClick: () -> Unit, enabled: Boolean = true) {
  IconButton(onClick = onClick, enabled = enabled) {
    if (LocalDetailPane.current) Icon(Icons.Default.Close, "Close")
    else Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
  }
}

/** Beside the list, feedback appears once, in the list pane's host above its actions. */
@Composable
internal fun DetailSnackbarHost(state: SnackbarHostState) {
  if (!LocalDetailPane.current) SnackbarHost(state)
}
