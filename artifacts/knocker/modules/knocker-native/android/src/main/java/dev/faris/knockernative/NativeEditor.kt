@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package dev.faris.knockernative

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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp

/** A native editor has one app-bar title; drafts and IME interaction never round-trip through JS. */
@Composable
internal fun NativeEditor(id: String, state: NativeUiState, snackbar: SnackbarHostState, saving: Boolean, error: String?,
  onDirty: (Boolean) -> Unit, onBack: () -> Unit, onSave: (ProfileForm) -> Unit, onDelete: (String) -> Unit,
  feedback: (String) -> Unit) {
  if (!state.loaded) {
    Scaffold(topBar = { TopAppBar(title = { Text(if (id == "new") "New profile" else "Edit profile") }) }) { padding ->
      Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
    return
  }
  val current = state.profiles.firstOrNull { it.optString("id") == id }?.let(ProfileForm::from)
  var baseline by remember(id) { mutableStateOf(current ?: ProfileForm()) }
  var draft by remember(id) { mutableStateOf(baseline) }
  var showKey by remember(id) { mutableStateOf(false) }
  var attempted by remember(id) { mutableStateOf(false) }
  var confirmDelete by remember { mutableStateOf(false) }
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
      TopAppBar(title = { Text(if (id == "new") "New profile" else "Edit profile") },
        navigationIcon = { IconButton(onClick = { feedback("tap"); onBack() }, enabled = !saving) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
        actions = {
          if (id != "new") IconButton(onClick = { feedback("tap"); confirmDelete = true }, enabled = !saving) { Icon(Icons.Default.DeleteOutline, "Delete profile") }
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
          if (attempted) errors["ttl"] else null, KeyboardType.Number, "Leave blank to use the key's maximum")
        HorizontalDivider()
        FormSection("Whitelist target")
        NativeSwitchRow("Whitelist a different IP/CIDR", "Requires allow_remote_whitelist on the API key", draft.remote, !saving) {
          feedback("tap"); change(draft.copy(remote = it))
        }
        if (draft.remote) NativeField("IP address or CIDR", draft.ip, { change(draft.copy(ip = it)) }, saving,
          if (attempted) errors["ip"] else null, KeyboardType.Ascii, "203.0.113.42 or 2001:db8::/64")
        HorizontalDivider()
        FormSection("Automation")
        NativeSwitchRow("Knock when app opens", "Connect automatically when you open Knocker", draft.onOpen, !saving) {
          feedback("tap"); change(draft.copy(onOpen = it))
        }
        NativeSwitchRow("Auto-renew", "Renew access before the whitelist expires", draft.renew, !saving) {
          feedback("tap"); change(draft.copy(renew = it))
        }
        if (draft.renew) {
          NativeField("Renewal safety window (seconds)", draft.safety,
            { change(draft.copy(safety = it.filter(Char::isDigit))) }, saving,
            if (attempted) errors["safety"] else null, KeyboardType.Number)
          if ((draft.ttl.toIntOrNull() ?: Int.MAX_VALUE) < 120) Text("Short TTLs can limit reliable background renewal. Android may defer work while the app is closed.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        HorizontalDivider()
        FormSection("Shortcuts")
        NativeSwitchRow("Pin to home", "Show a direct knock shortcut", draft.pinned, !saving) {
          feedback("tap"); change(draft.copy(pinned = it))
        }
        Text("Quick Settings tile", style = MaterialTheme.typography.titleSmall)
        Text("Add the matching Knock tile in Android Quick Settings.", style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant)
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
private fun NativeSwitchRow(title: String, detail: String, value: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
  Row(Modifier.fillMaxWidth().toggleable(value = value, enabled = enabled, role = Role.Switch, onValueChange = onChange),
    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
      Text(title, style = MaterialTheme.typography.bodyLarge)
      Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    Switch(checked = value, onCheckedChange = null, enabled = enabled)
  }
}
