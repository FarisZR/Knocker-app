@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.faris.knockernative

import android.app.AlarmManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect

/** A native editor has one app-bar title; drafts and IME interaction never round-trip through JS. */
@Composable
internal fun NativeEditor(id: String?, state: NativeUiState, snackbar: SnackbarHostState, saving: Boolean, error: String?,
  onDirty: (Boolean) -> Unit, onBack: () -> Unit, onSave: (ProfileForm) -> Unit, onDelete: (String) -> Unit,
  feedback: (String) -> Unit) {
  val current = state.profiles.firstOrNull { !it.textOrNull("id").isNullOrBlank() && it.optString("id") == id }?.let(ProfileForm::from)
  if (!state.loaded || (id != null && current == null)) {
    // Restored routes can outlive their profile. Never turn one into a new draft,
    // and let a deletion's acknowledgement arrive before leaving its route.
    if (state.loaded && !saving) LaunchedEffect(id) { onDirty(false); onBack() }
    Scaffold(topBar = { TopAppBar(title = { Text(if (id == null) "New profile" else "Edit profile") }) }) { padding ->
      Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
    return
  }
  var baseline by remember(id) { mutableStateOf(current ?: ProfileForm()) }
  var draft by remember(id) { mutableStateOf(baseline) }
  var showKey by remember(id) { mutableStateOf(false) }
  var attempted by remember(id) { mutableStateOf(false) }
  var confirmDelete by remember(id) { mutableStateOf(false) }
  var requestAlarmAccess by remember(id) { mutableStateOf(false) }
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
    if (errors.isEmpty()) onSave(draft) else feedback("error")
  }
  Scaffold(
    topBar = {
      TopAppBar(title = { Text(if (id == null) "New profile" else "Edit profile") },
        navigationIcon = { IconButton(onClick = { feedback("tap"); onBack() }, enabled = !saving) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
        actions = {
          if (id != null) IconButton(onClick = { feedback("tap"); confirmDelete = true }, enabled = !saving) { Icon(Icons.Default.DeleteOutline, "Delete profile") }
          TextButton(onClick = ::save, enabled = !saving) {
            if (saving) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("Save")
          }
        })
    },
    snackbarHost = { SnackbarHost(snackbar) }
  ) { padding ->
    Box(Modifier.fillMaxSize().padding(padding).imePadding(), contentAlignment = Alignment.TopCenter) {
      Column(Modifier.widthIn(max = 840.dp).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
        FormSection("Server")
        NativeField("Name", draft.name, { change(draft.copy(name = it)) }, saving, if (attempted) errors["name"] else null, KeyboardType.Text)
        NativeField("Endpoint URL", draft.endpoint, { change(draft.copy(endpoint = it)) }, saving,
          if (attempted) errors["endpoint"] else null, KeyboardType.Uri, "https://knock.example.com")
        OutlinedTextField(value = draft.key, onValueChange = { change(draft.copy(key = it)) }, enabled = !saving,
          modifier = Modifier.fillMaxWidth(), label = { Text("API key") }, singleLine = true,
          visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Next),
          isError = attempted && "key" in errors,
          supportingText = if (attempted && "key" in errors) ({ Text(errors.getValue("key")) }) else null,
          trailingIcon = { IconButton(onClick = { showKey = !showKey; feedback("tap") }) {
            Icon(if (showKey) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (showKey) "Hide API key" else "Show API key")
          } })
        NativeField("TTL (seconds)", draft.ttl, { change(draft.copy(ttl = it.filter(Char::isDigit))) }, saving,
          if (attempted) errors["ttl"] else null, KeyboardType.Number, "Default")
        HorizontalDivider()
        FormSection("Whitelist target")
        NativeSwitchRow("Whitelist a different IP/CIDR", "Requires allow_remote_whitelist on the API key", draft.remote, !saving) {
          feedback("tap"); change(draft.copy(remote = it))
        }
        if (draft.remote) NativeField("IP address or CIDR", draft.ip, { change(draft.copy(ip = it)) }, saving,
          if (attempted) errors["ip"] else null, KeyboardType.Ascii, "203.0.113.42 or 2001:db8::/64")
        HorizontalDivider()
        FormSection("Automation")
        NativeSwitchRow("Knock when app opens", null, draft.onOpen, !saving) {
          feedback("tap"); change(draft.copy(onOpen = it))
        }
        NativeSwitchRow("Auto-renew", "Re-knock before expiry and after network changes", draft.renew, !saving) {
          feedback("tap"); change(draft.copy(renew = it))
          requestAlarmAccess = it
        }
        if (draft.renew) {
          RenewalAlarmPermission(enabled = !saving, showPrompt = requestAlarmAccess,
            onPromptChange = { requestAlarmAccess = it })
          NativeField("Renewal safety window (seconds)", draft.safety,
            { change(draft.copy(safety = it.filter(Char::isDigit))) }, saving,
            if (attempted) errors["safety"] else null, KeyboardType.Number)
          if ((draft.ttl.toIntOrNull() ?: Int.MAX_VALUE) < 120) Text("Android may delay renewal with short TTLs.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        HorizontalDivider()
        FormSection("Shortcuts")
        NativeSwitchRow("Pin to home", null, draft.pinned, !saving) {
          feedback("tap"); change(draft.copy(pinned = it))
        }
        Text("Quick Settings tile", style = MaterialTheme.typography.titleSmall)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          listOf(null, 1, 2, 3, 4, 5).forEach { slot ->
            val owner = state.profiles.firstOrNull { it.optString("id") != draft.id && slot != null && it.optInt("tileSlot", -1) == slot }
            FilterChip(selected = draft.slot == slot, enabled = !saving && owner == null,
              onClick = { feedback("tap"); change(draft.copy(slot = if (draft.slot == slot) null else slot)) },
              label = { Text(if (slot == null) "Off" else if (owner != null) "$slot · ${owner.optString("name")}" else "Slot $slot") })
          }
        }
        Spacer(Modifier.height(24.dp))
      }
    }
  }
  if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, icon = { Icon(Icons.Default.DeleteOutline, null) },
    title = { Text("Delete profile?") }, text = { Text("${draft.name.ifBlank { "This profile" }} and its saved API key will be removed. This cannot be undone.") },
    confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete(draft.id) }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
    dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } })
}

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

@Composable
private fun FormSection(title: String) { Text(title, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary) }

/** Compose owns text, selection, keyboard actions and validation without controlled RN reconciliation. */
@Composable
private fun NativeField(label: String, value: String, onChange: (String) -> Unit, saving: Boolean, error: String?,
  keyboard: KeyboardType, help: String? = null) {
  OutlinedTextField(value = value, onValueChange = onChange, enabled = !saving, label = { Text(label) },
    modifier = Modifier.fillMaxWidth(), singleLine = true, isError = error != null,
    keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ImeAction.Next),
    supportingText = if (error != null || help != null) ({ Text(error ?: help.orEmpty()) }) else null)
}

/** Native switch semantics merge the label and supporting description with its toggle action. */
@Composable
private fun NativeSwitchRow(title: String, detail: String?, value: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
  Row(Modifier.fillMaxWidth().toggleable(value = value, enabled = enabled, role = Role.Switch, onValueChange = onChange),
    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(title, style = MaterialTheme.typography.bodyLarge)
      if (detail != null) Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    Switch(checked = value, onCheckedChange = null, enabled = enabled)
  }
}
