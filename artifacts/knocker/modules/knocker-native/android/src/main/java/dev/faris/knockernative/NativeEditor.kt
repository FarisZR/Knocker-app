@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.faris.knockernative

import android.Manifest
import android.app.AlarmManager
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect

/**
 * Unsaved editor state. Folding, unfolding or resizing between one and two panes moves
 * the editor into another navigation scene, which discards state remembered inside it,
 * so NativeApp holds drafts above navigation instead. They stay in memory only: a draft
 * can hold an API key, which must not be written into a saved-state Bundle.
 */
internal class EditorDraft(initial: ProfileForm) {
  var baseline by mutableStateOf(initial)
  var draft by mutableStateOf(initial)
  var showKey by mutableStateOf(false)
  var attempted by mutableStateOf(false)
}

/** Drafts for the open editor route; navigation to any other route clears them. */
internal class EditorDrafts {
  private val drafts = HashMap<String?, EditorDraft>()
  fun get(id: String?, initial: () -> ProfileForm): EditorDraft = drafts.getOrPut(id) { EditorDraft(initial()) }
  fun clear() = drafts.clear()
}

internal val LocalEditorDrafts = staticCompositionLocalOf<EditorDrafts?> { null }

/** System permission prompts leave the app's window; tests of the editor itself turn them off. */
internal val LocalSystemPrompts = staticCompositionLocalOf { true }

/** A native editor has one app-bar title; drafts and IME interaction never round-trip through JS. */
@Composable
internal fun NativeEditor(id: String?, state: NativeUiState, snackbar: SnackbarHostState, saving: Boolean, error: String?,
  onDirty: (Boolean) -> Unit, onBack: () -> Unit, onSave: (ProfileForm, Int?) -> Unit, onDelete: (String) -> Unit,
  feedback: (String) -> Unit) {
  val current = state.profiles.firstOrNull { !it.textOrNull("id").isNullOrBlank() && it.optString("id") == id }?.let(ProfileForm::from)
  if (!state.loaded || (id != null && current == null)) {
    // Restored routes can outlive their profile. Never turn one into a new draft,
    // and let a deletion's acknowledgement arrive before leaving its route.
    if (state.loaded && !saving) LaunchedEffect(id) { onDirty(false); onBack() }
    Scaffold(containerColor = detailContainerColor(),
      topBar = { TopAppBar(title = { Text(if (id == null) "New profile" else "Edit profile") }, colors = detailBarColors()) }) { padding ->
      Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
    return
  }
  val drafts = LocalEditorDrafts.current ?: remember { EditorDrafts() }
  val editor = drafts.get(id) { current ?: ProfileForm() }
  var baseline by editor::baseline
  var draft by editor::draft
  var showKey by editor::showKey
  var attempted by editor::attempted
  var confirmDelete by remember(id) { mutableStateOf(false) }
  var requestAlarmAccess by remember(id) { mutableStateOf(false) }
  // Notifications only report tile and background renewal results, so ask when either is turned on.
  val context = LocalContext.current
  val notificationAccess = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
  val promptsAllowed = LocalSystemPrompts.current
  fun requestNotifications() {
    if (promptsAllowed && Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) notificationAccess.launch(Manifest.permission.POST_NOTIFICATIONS)
  }
  val dirty = draft != baseline
  val errors = draft.errors()
  LaunchedEffect(dirty) { onDirty(dirty) }
  // A clean editor follows external saved settings; grant-only updates never reset a draft.
  LaunchedEffect(current) {
    if (!dirty && current != null) { baseline = current; draft = current }
  }
  fun change(next: ProfileForm) { if (!saving) draft = next }
  fun save() {
    attempted = true
    // A newly chosen tile slot is offered to Quick Settings once the save lands.
    if (errors.isEmpty()) onSave(draft, draft.slot.takeIf { it != baseline.slot }) else feedback("error")
  }
  val actionColors = knockerActionColors()
  val scrollBehavior = TopAppBarDefaults.pinnedScrollBehavior()
  val inset = Modifier.padding(horizontal = 16.dp)
  Scaffold(
    modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
    containerColor = detailContainerColor(),
    // Include the keyboard so the save action and messages stay above it.
    contentWindowInsets = ScaffoldDefaults.contentWindowInsets.union(WindowInsets.ime),
    topBar = {
      TopAppBar(title = { Text(if (id == null) "New profile" else "Edit profile") }, scrollBehavior = scrollBehavior,
        colors = detailBarColors(), navigationIcon = { DetailNavigationIcon(onBack, enabled = !saving) },
        actions = {
          if (id != null) IconButton(onClick = { confirmDelete = true }, enabled = !saving) { Icon(Icons.Default.DeleteOutline, "Delete profile") }
        })
    },
    snackbarHost = { DetailSnackbarHost(snackbar) },
    // The primary action sits where home keeps Knock all: bottom right, under the thumb.
    floatingActionButton = {
      Button(onClick = ::save, enabled = dirty && !saving, shapes = ButtonDefaults.shapes(),
        modifier = Modifier.heightIn(min = 64.dp),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = actionColors.container, contentColor = actionColors.content,
          disabledContainerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
          disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant)
      ) {
        if (saving) LoadingIndicator(Modifier.size(28.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        else Icon(Icons.Default.Check, null)
        Spacer(Modifier.width(10.dp))
        Text(if (saving) "Saving…" else "Save", style = MaterialTheme.typography.titleLarge)
      }
    }
  ) { padding ->
    // Wide panes and landscape windows set the server fields beside its options instead of
    // stretching one column across the window. Narrow windows keep a single column.
    BoxWithConstraints(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
      val columns = maxWidth >= EDITOR_COLUMNS_MIN_WIDTH
      val server: @Composable ColumnScope.() -> Unit = {
        if (error != null) Text(error, inset.padding(top = 16.dp), color = MaterialTheme.colorScheme.error)
        SettingsSection("Server")
        Column(inset, verticalArrangement = Arrangement.spacedBy(12.dp)) {
          NativeField("Name", draft.name, { change(draft.copy(name = it)) }, saving, if (attempted) errors["name"] else null, KeyboardType.Text)
          NativeField("Endpoint URL", draft.endpoint, { change(draft.copy(endpoint = it)) }, saving,
            if (attempted) errors["endpoint"] else null, KeyboardType.Uri, placeholder = "https://knock.example.com")
          OutlinedTextField(value = draft.key, onValueChange = { change(draft.copy(key = it)) }, enabled = !saving,
            modifier = Modifier.fillMaxWidth(), label = { Text("API key") }, singleLine = true,
            visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Next),
            isError = attempted && "key" in errors,
            supportingText = if (attempted && "key" in errors) ({ Text(errors.getValue("key")) }) else null,
            trailingIcon = { IconButton(onClick = { showKey = !showKey }) {
              Icon(if (showKey) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (showKey) "Hide API key" else "Show API key")
            } })
          NativeField("TTL (seconds)", draft.ttl, { change(draft.copy(ttl = it.filter(Char::isDigit))) }, saving,
            if (attempted) errors["ttl"] else null, KeyboardType.Number, emptyHint = "Leave empty to use the server default")
        }
      }
      val options: @Composable ColumnScope.() -> Unit = {
        SettingsSection("Whitelist target")
        NativeSwitchRow(Icons.Default.Public, "Whitelist a different IP/CIDR", "Requires allow_remote_whitelist on the API key", draft.remote, !saving) {
          feedback("tap"); change(draft.copy(remote = it))
        }
        if (draft.remote) NativeField("IP address or CIDR", draft.ip, { change(draft.copy(ip = it)) }, saving,
          if (attempted) errors["ip"] else null, KeyboardType.Ascii, placeholder = "203.0.113.42 or 2001:db8::/64",
          modifier = inset.padding(top = 4.dp))
        SettingsSection("Automation")
        NativeSwitchRow(Icons.Default.RocketLaunch, "Knock when app opens", null, draft.onOpen, !saving) {
          feedback("tap"); change(draft.copy(onOpen = it))
        }
        NativeSwitchRow(Icons.Default.Autorenew, "Auto-renew", "Re-knock before expiry and after network changes", draft.renew, !saving) {
          feedback("tap"); change(draft.copy(renew = it))
          requestAlarmAccess = it
          // A failed background renewal is reported in a notification too.
          if (it) requestNotifications()
        }
        if (draft.renew) Column(inset.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          RenewalAlarmPermission(enabled = !saving, showPrompt = requestAlarmAccess,
            onPromptChange = { requestAlarmAccess = it })
          NativeField("Renewal safety window (seconds)", draft.safety,
            { change(draft.copy(safety = it.filter(Char::isDigit))) }, saving,
            if (attempted) errors["safety"] else null, KeyboardType.Number)
          if ((draft.ttl.toIntOrNull() ?: Int.MAX_VALUE) < 120) Text("Android may delay renewal with short TTLs.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        SettingsSection("Shortcuts")
        NativeSwitchRow(Icons.Default.PushPin, "Pin to home", "Adds a knock button for this profile above Knock all", draft.pinned, !saving) {
          feedback("tap"); change(draft.copy(pinned = it))
        }
        SettingsRow(Icons.Default.Dashboard, "Quick Settings tile", "Knock from the notification shade. Results arrive as a notification.")
        FlowRow(Modifier.padding(start = 56.dp, end = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalArrangement = Arrangement.spacedBy(4.dp)) {
          listOf(null, 1, 2, 3, 4, 5).forEach { slot ->
            val owner = state.profiles.firstOrNull { it.optString("id") != draft.id && slot != null && it.optInt("tileSlot", -1) == slot }
            FilterChip(selected = draft.slot == slot, enabled = !saving && owner == null,
              onClick = {
                val next = if (draft.slot == slot) null else slot
                change(draft.copy(slot = next))
                if (next != null) requestNotifications()
              },
              label = { Text(if (slot == null) "Off" else if (owner != null) "$slot · ${owner.optString("name")}" else "Slot $slot") })
          }
        }
      }
      Column(Modifier.widthIn(max = if (columns) 1040.dp else 840.dp).fillMaxSize().verticalScroll(rememberScrollState())) {
        if (columns) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Column(Modifier.weight(1f), content = server)
          Column(Modifier.weight(1f), content = options)
        } else { server(); options() }
        // Clear the floating save action at the end of the scroll.
        Spacer(Modifier.height(112.dp))
      }
    }
  }
  if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, icon = { Icon(Icons.Default.DeleteOutline, null) },
    title = { Text("Delete profile?") }, text = { Text("${draft.name.ifBlank { "This profile" }} and its saved API key will be removed. This cannot be undone.") },
    confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete(draft.id) }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
    dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } })
}

private val EDITOR_COLUMNS_MIN_WIDTH = 720.dp

/** Exact alarms require an explicit user grant; renewal can still use the inexact fallback. */
@Composable
private fun RenewalAlarmPermission(enabled: Boolean, showPrompt: Boolean, onPromptChange: (Boolean) -> Unit) {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
  val context = LocalContext.current
  val alarms = context.getSystemService(AlarmManager::class.java)
  var allowed by remember { mutableStateOf(alarms.canScheduleExactAlarms()) }
  LifecycleResumeEffect(alarms) {
    allowed = alarms.canScheduleExactAlarms()
    onPauseOrDispose { }
  }
  if (!allowed) {
    Text("Allow alarms and reminders for precise renewal. Without access, Android may renew after your connection expires.",
      style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    FilledTonalButton(enabled = enabled, onClick = { onPromptChange(true) }) { Text("Allow precise renewal") }
    if (showPrompt) AlertDialog(
      onDismissRequest = { onPromptChange(false) },
      icon = { Icon(Icons.Default.Alarm, null) },
      title = { Text("Allow timely background renewal?") },
      text = { Text("Auto-renew renews access before expiry and checks your Knocker server after network changes, knocking again only if needed. Allow alarms and reminders for timely expiry renewal. Network-change recovery works without this permission, but Android may delay background work.") },
      confirmButton = { TextButton(enabled = enabled, onClick = {
        onPromptChange(false)
        context.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }) { Text("Open settings") } },
      dismissButton = { TextButton(onClick = { onPromptChange(false) }) { Text("Not now") } })
  }
}

/** Compose owns text, selection, keyboard actions and validation without controlled RN reconciliation. */
@Composable
private fun NativeField(label: String, value: String, onChange: (String) -> Unit, saving: Boolean, error: String?,
  keyboard: KeyboardType, placeholder: String? = null, emptyHint: String? = null, modifier: Modifier = Modifier) {
  // Examples are placeholders and hints only describe an empty field, so neither reads as a second value.
  val hint = emptyHint.takeIf { value.isEmpty() }
  OutlinedTextField(value = value, onValueChange = onChange, enabled = !saving, label = { Text(label) },
    modifier = modifier.fillMaxWidth(), singleLine = true, isError = error != null,
    placeholder = placeholder?.let { { Text(it) } },
    keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ImeAction.Next),
    supportingText = if (error != null || hint != null) ({ Text(error ?: hint.orEmpty()) }) else null)
}

/** The same full-width list row as Settings; label and description merge with the toggle action. */
@Composable
private fun NativeSwitchRow(icon: ImageVector, title: String, detail: String?, value: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
  SettingsRow(icon, title, detail,
    Modifier.toggleable(value = value, enabled = enabled, role = Role.Switch, onValueChange = onChange)
  ) { Switch(checked = value, onCheckedChange = null, enabled = enabled, colors = knockerSwitchColors()) }
}
