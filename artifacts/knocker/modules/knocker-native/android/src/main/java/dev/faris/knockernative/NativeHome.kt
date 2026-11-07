@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)

package dev.faris.knockernative

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.animation.*
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.json.JSONObject

/** A foreground-only clock updates grant rings without gating first render or HTTP. */
@Composable
private fun grantClock(): Long {
  val lifecycle = LocalLifecycleOwner.current.lifecycle
  val now by produceState(System.currentTimeMillis(), lifecycle) {
    lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
      while (isActive) { value = System.currentTimeMillis(); delay(1000) }
    }
  }
  return now
}

/** The native scaffold measures its action stack and places standard feedback above it. */
@Composable
internal fun NativeHome(state: NativeUiState, snackbar: SnackbarHostState, onOpen: (String) -> Unit,
  onNew: () -> Unit, onKnock: (String) -> Unit, onKnockAll: () -> Unit, onPreferences: () -> Unit) {
  val now = grantClock()
  val colors = MaterialTheme.colorScheme
  val actionColors = knockerActionColors()
  var actionsHeight by remember { mutableIntStateOf(0) }
  val density = LocalDensity.current
  val clearance = with(density) { actionsHeight.toDp() } + 24.dp
  Scaffold(
    modifier = Modifier.fillMaxSize(),
    topBar = { TopAppBar(title = { KnockerWordmark() }, expandedHeight = 88.dp, actions = {
      IconButton(onClick = onPreferences) { Icon(Icons.Default.Settings, "Settings") }
    }) },
    snackbarHost = { SnackbarHost(snackbar) },
    floatingActionButton = {
      if (state.loaded) Column(
        Modifier.heightIn(max = (LocalConfiguration.current.screenHeightDp * .5f).dp)
          .onSizeChanged { actionsHeight = it.height }.verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)
      ) {
        if (state.profiles.isNotEmpty()) {
          FilledTonalButton(onClick = onNew, shapes = ButtonDefaults.shapes()) {
            Icon(Icons.Default.Add, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("New profile")
          }
          state.profiles.filter { it.optBoolean("pinnedToHome") }.forEach { profile ->
            val id = profile.optString("id"); val pending = id in state.pending
            FilledTonalButton(onClick = { onKnock(id) }, enabled = !pending, shapes = ButtonDefaults.shapes(),
              colors = ButtonDefaults.filledTonalButtonColors(disabledContainerColor = colors.secondaryContainer,
                disabledContentColor = colors.onSecondaryContainer),
              contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
              modifier = Modifier.semantics { contentDescription = "Pinned knock ${profile.optString("name")}" }
            ) {
              if (pending) LoadingIndicator(Modifier.size(24.dp), color = colors.onSecondaryContainer)
              else Icon(Icons.Default.Bolt, null, Modifier.size(20.dp))
              Spacer(Modifier.width(8.dp))
              Text(if (pending) "Connecting ${profile.optString("name")}" else "Knock ${profile.optString("name")}", maxLines = 1)
            }
          }
          Button(onClick = onKnockAll, enabled = state.pending.isEmpty(), shapes = ButtonDefaults.shapes(),
            modifier = Modifier.heightIn(min = 64.dp).semantics { contentDescription = "Knock all servers" },
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = actionColors.container, contentColor = actionColors.content,
              disabledContainerColor = actionColors.container, disabledContentColor = actionColors.content)
          ) {
            if (state.pending.isNotEmpty()) LoadingIndicator(Modifier.size(28.dp), color = actionColors.content)
            else Icon(Icons.Default.Bolt, null)
            Spacer(Modifier.width(10.dp))
            Text(if (state.pending.isEmpty()) "Knock all" else "Connecting…", style = MaterialTheme.typography.titleLarge)
          }
        } else ExtendedFloatingActionButton(onClick = onNew, icon = { Icon(Icons.Default.Add, null) }, text = { Text("New profile") })
      }
    }
  ) { padding ->
    Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
      LazyColumn(Modifier.widthIn(max = 840.dp).fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = clearance),
        verticalArrangement = Arrangement.spacedBy(12.dp)
      ) {
        if (!state.loaded) item {
          LinearProgressIndicator(Modifier.fillMaxWidth().semantics { contentDescription = "Loading profiles" })
        }
        itemsIndexed(state.profiles, key = { index, _ -> state.profileRenderKeys[index] }) { _, profile ->
          NativeProfileCard(profile, state, now, onOpen, onKnock)
        }
      }
    }
  }
}

/** Permission color is retained during renewal; every pending foreground matches its container. */
@Composable
private fun NativeProfileCard(profile: JSONObject, state: NativeUiState, now: Long,
  onOpen: (String) -> Unit, onKnock: (String) -> Unit) {
  val colors = MaterialTheme.colorScheme
  val actionColors = knockerActionColors()
  val dark = isSystemInDarkTheme()
  val id = profile.optString("id"); val name = profile.optString("name").ifBlank { "Untitled profile" }
  val hasIdentity = !profile.textOrNull("id").isNullOrBlank()
  val pending = id in state.pending
  val observation = profile.optJSONObject("connectionStatus")
  val covered = observation?.optBoolean("whitelisted") == true && observation.optLong("expiresAt") > now
  val expiry = if (covered) observation!!.optLong("expiresAt") else profile.optLong("expiresAt")
  val start = profile.optLong("whitelistedAt")
  val active = expiry > now
  val failed = profile.optString("lastKnockStatus") == "error"
  val green = if (dark) Color(0xFF153B28) else Color(0xFFC9F2D8)
  val onGreen = if (dark) Color(0xFFB5F0CB) else Color(0xFF074D2B)
  val success = if (dark) Color(0xFF91D5AC) else Color(0xFF166B45)
  val onSuccess = if (dark) Color(0xFF063921) else Color.White
  val fill = if (active) green else if (pending) colors.primaryContainer else colors.surfaceContainer
  val content = if (active) onGreen else if (pending) colors.onPrimaryContainer else colors.onSurface
  val supporting = if (active || pending) content else colors.onSurfaceVariant
  val count = ((expiry - now).coerceAtLeast(0L) / 1000L).let { "${it / 60}m ${it % 60}s" }
  val connection = state.network.optJSONObject("connection")
  val match = profile.optString("addressMatch", "unknown")
  val connectionChanged = profile.textOrNull("grantNetworkId")?.let { it != connection?.textOrNull("id") && connection?.textOrNull("id") != null } == true
  val ipChanged = match == "changed"
  val custom = !profile.textOrNull("ipOverride").isNullOrBlank()
  val warning = !custom && !covered && (observation?.optBoolean("whitelisted") == false || (profile.optBoolean("statusChecked") && (connectionChanged || ipChanged)))
  val showNotice = !custom && (warning || (active && connection?.optBoolean("isConnected") == false))
  // A warning may already be present when this row is first hydrated. Start
  // hidden explicitly so that first appearance receives the same entrance.
  val noticeVisibility = remember(id) { MutableTransitionState(false) }
  LaunchedEffect(showNotice) {
    // Give the newly measured row its initial frame before starting entry.
    // This only schedules presentation; action availability uses showNotice.
    if (showNotice) withFrameNanos { }
    noticeVisibility.targetState = showNotice
  }
  val noticeColor = if (dark) Color(0xFF493600) else Color(0xFFFFF1C2)
  val noticeContent = if (dark) Color(0xFFFFE2A4) else Color(0xFF5B4300)
  // One elevated card owns the server and its warning. The amber footer stays
  // outside the clickable green status area, but shares the panel's outline.
  ElevatedCard(modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Profile $name" },
    shape = MaterialTheme.shapes.extraLarge,
    colors = CardDefaults.elevatedCardColors(containerColor = if (showNotice) noticeColor else fill, contentColor = content),
    elevation = CardDefaults.elevatedCardElevation(defaultElevation = if (showNotice) 3.dp else 1.dp)) {
    Surface(onClick = { onOpen(id) }, enabled = hasIdentity, color = fill, contentColor = content,
      modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Edit $name" },
      shape = MaterialTheme.shapes.extraLarge, shadowElevation = if (showNotice) 2.dp else 0.dp
    ) {
      Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
          Box(Modifier.size(52.dp), contentAlignment = Alignment.Center) {
            when {
              active -> {
                val fraction = if (expiry > start && start > 0L) ((expiry - now).toFloat() / (expiry - start)).coerceIn(0f, 1f) else 1f
                CircularProgressIndicator(progress = { fraction }, Modifier.size(52.dp).semantics { contentDescription = "$count of whitelist time remaining" },
                  color = success, trackColor = success.copy(alpha = .22f), strokeWidth = 4.dp)
                if (pending) LoadingIndicator(Modifier.size(28.dp), color = content)
              }
              pending -> LoadingIndicator(Modifier.size(48.dp), color = content)
              failed -> Icon(Icons.Default.ErrorOutline, null, Modifier.size(36.dp), tint = colors.error)
              else -> Icon(Icons.Default.Dns, null, Modifier.size(32.dp), tint = colors.primary)
            }
          }
          Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(profile.optString("endpointUrl").removePrefix("https://").trimEnd('/'), color = supporting,
              style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
          }
          Button(onClick = { onKnock(id) }, enabled = hasIdentity && !pending && profile.optString("apiKey").isNotBlank(), shapes = ButtonDefaults.shapes(),
            colors = ButtonDefaults.buttonColors(containerColor = if (active) success else actionColors.container,
              contentColor = if (active) onSuccess else actionColors.content,
              disabledContainerColor = if (active) success else actionColors.container,
              disabledContentColor = if (active) onSuccess else actionColors.content),
            modifier = Modifier.semantics { contentDescription = "Knock $name" }
          ) { Text(if (pending) "Knocking" else if (warning && active) "Update IP" else if (active) "Renew" else "Knock") }
        }
        val status = if (pending) "${if (active) "Renewing" else "Connecting"}…" else if (active) "Whitelisted · $count" else if (!failed && expiry > 0L) "Expired" else null
        if (status != null) {
          Surface(shape = MaterialTheme.shapes.small, color = if (pending) actionColors.container else if (active) success else colors.secondaryContainer,
            contentColor = if (pending) actionColors.content else if (active) onSuccess else colors.onSecondaryContainer) {
            Text(status, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), style = MaterialTheme.typography.labelMedium)
          }
        }
        if (failed && !pending) Text(profile.textOrNull("lastError") ?: "Failed", color = if (active) content else colors.error, maxLines = 3, overflow = TextOverflow.Ellipsis,
          style = MaterialTheme.typography.bodySmall)
        profile.textOrNull("whitelistedEntry")?.let { entry ->
          Text("IP · $entry",
            color = content, style = MaterialTheme.typography.bodyMedium)
        }
        if (pending) LinearWavyProgressIndicator(Modifier.fillMaxWidth(), color = content)
      }
    }
    AnimatedVisibility(visibleState = noticeVisibility,
      enter = expandVertically(animationSpec = MaterialTheme.motionScheme.slowSpatialSpec(), expandFrom = Alignment.Top) +
        slideInVertically(animationSpec = MaterialTheme.motionScheme.slowSpatialSpec()) { -it } +
        fadeIn(animationSpec = MaterialTheme.motionScheme.defaultEffectsSpec()),
      exit = shrinkVertically(animationSpec = MaterialTheme.motionScheme.defaultSpatialSpec(), shrinkTowards = Alignment.Top) +
        fadeOut(animationSpec = MaterialTheme.motionScheme.fastEffectsSpec())) {
      Surface(color = noticeColor, contentColor = noticeContent,
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Connection notice for $name" }) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
          horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Default.WarningAmber, null, Modifier.size(20.dp))
          Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(when {
              connection?.optBoolean("isConnected") == false -> "Offline"
              ipChanged -> "IP changed · not whitelisted"
              observation != null -> "Current IP is not whitelisted"
              else -> "Network changed · status unverified"
            }, style = MaterialTheme.typography.bodyMedium)
            observation?.textOrNull("ipAddress")?.let { ip ->
              Text("Current IP · $ip", style = MaterialTheme.typography.bodySmall)
            }
          }
        }
      }
    }
  }
}
