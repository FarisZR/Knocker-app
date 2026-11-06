@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)

package dev.faris.knockernative

import android.content.Context
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.ui.NavDisplay
import com.facebook.react.uimanager.events.NativeGestureUtil
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.launch
import org.json.JSONObject

/** One Android-owned Compose tree, including navigation, insets, IME, dialogs and feedback. */
class KnockerAppView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private var snapshot by mutableStateOf(NativeUiState())
  private val onAction by EventDispatcher<Map<String, Any?>>()

  init {
    addView(ComposeView(context).apply {
      setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindowOrReleasedFromPool)
      setContent {
        val dark = isSystemInDarkTheme()
        val scheme = if (Build.VERSION.SDK_INT >= 31) {
          if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        } else if (dark) darkColorScheme() else lightColorScheme()
        MaterialExpressiveTheme(colorScheme = scheme) {
          NativeApp(snapshot, ::emit, ::haptic)
        }
      }
    }, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  /** Invalid transport data cannot replace the last complete rendering snapshot. */
  fun setState(raw: String) { NativeUiState.parse(raw)?.let { snapshot = it } }

  /** Compose owns this entire surface's gesture stream; no JS responder participates. */
  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      parent?.requestDisallowInterceptTouchEvent(true)
      NativeGestureUtil.notifyNativeGestureStarted(this, event)
    }
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
      NativeGestureUtil.notifyNativeGestureEnded(this, event)
      parent?.requestDisallowInterceptTouchEvent(false)
    }
    return handled
  }

  private fun emit(type: String, payload: Map<String, Any?> = emptyMap()) { onAction(payload + ("type" to type)) }

  /** Device-tuned action feedback respects Android touch-feedback preferences and foreground state. */
  private fun haptic(kind: String) {
    if (!isShown || !hasWindowFocus()) return
    val effect = when {
      kind == "success" && Build.VERSION.SDK_INT >= 30 -> HapticFeedbackConstants.CONFIRM
      kind == "error" && Build.VERSION.SDK_INT >= 30 -> HapticFeedbackConstants.REJECT
      else -> HapticFeedbackConstants.CONTEXT_CLICK
    }
    performHapticFeedback(effect)
  }
}

/** Jetpack Navigation owns screen transitions and back; Material Scaffold owns screen chrome. */
@Composable
internal fun NativeApp(state: NativeUiState, emit: (String, Map<String, Any?>) -> Unit, haptic: (String) -> Unit) {
  // NavEntry retains destination content. Read the current bridge snapshot inside
  // that content instead of capturing the snapshot that created the entry.
  val latestState = rememberUpdatedState(state)
  val scope = rememberCoroutineScope()
  var route by rememberSaveable { mutableStateOf("home") }
  val backStack = remember { mutableStateListOf("home").apply { if (route != "home") add(route) } }
  val snackbar = remember { SnackbarHostState() }
  var dirty by remember { mutableStateOf(false) }
  var discardAction by remember { mutableStateOf<(() -> Unit)?>(null) }
  var preferences by remember { mutableStateOf(false) }
  var pendingOperation by remember { mutableStateOf<String?>(null) }
  var editorError by remember { mutableStateOf<String?>(null) }

  fun navigate(next: String) {
    val action = {
      dirty = false; editorError = null
      if (next == "home") { while (backStack.size > 1) backStack.removeAt(backStack.lastIndex) }
      else if (backStack.size == 1) backStack.add(next) else backStack[backStack.lastIndex] = next
      route = next
    }
    if (pendingOperation != null) return
    if (dirty) discardAction = action else action()
  }
  fun dispatch(type: String, payload: Map<String, Any?> = emptyMap()) {
    haptic("tap"); emit(type, payload)
  }
  fun operation(type: String, profile: ProfileForm? = null, id: String? = null) {
    val token = java.util.UUID.randomUUID().toString()
    pendingOperation = token; editorError = null
    dispatch(type, mapOf("token" to token, "profileJson" to profile?.toJson(), "id" to id))
  }

  LaunchedEffect(state.loaded, state.requestedProfile) {
    if (!state.loaded || state.requestedProfile == null) return@LaunchedEffect
    val id = state.requestedProfile
    if (id == "new") navigate("new")
    else if (state.profiles.any { it.optString("id") == id }) navigate("profile:$id")
    emit("consumeRoute", emptyMap())
  }
  LaunchedEffect(state.operation?.optString("token")) {
    val result = state.operation ?: return@LaunchedEffect
    if (result.optString("token") != pendingOperation) return@LaunchedEffect
    pendingOperation = null
    if (result.optBoolean("ok")) {
      dirty = false; navigate("home"); haptic("success")
      snackbar.currentSnackbarData?.dismiss()
      snackbar.showSnackbar(result.optString("message", "Profile saved"), withDismissAction = true)
    } else {
      editorError = result.optString("message", "Could not save. Try again."); haptic("error")
    }
  }
  LaunchedEffect(state.feedback?.optLong("id")) {
    val feedback = state.feedback ?: return@LaunchedEffect
    feedback.textOrNull("outcome")?.let(haptic)
    snackbar.currentSnackbarData?.dismiss()
    val message = listOfNotNull(feedback.textOrNull("text"), feedback.textOrNull("detail")).joinToString("\n").take(240)
    val result = snackbar.showSnackbar(message,
      actionLabel = if (feedback.optBoolean("retry")) "Retry" else null,
      withDismissAction = true,
      duration = if (feedback.optBoolean("persistent") || feedback.optBoolean("retry")) SnackbarDuration.Indefinite else SnackbarDuration.Short)
    if (result == SnackbarResult.ActionPerformed) dispatch("retry") else emit("dismiss", emptyMap())
  }
  BackHandler(enabled = backStack.size > 1 && (dirty || pendingOperation != null)) { navigate("home") }

  run {
    NavDisplay(
      backStack = backStack,
      modifier = Modifier.fillMaxSize(),
      onBack = { navigate("home") },
      entryProvider = { destination ->
        NavEntry(destination) {
          val sceneState = latestState.value
          if (sceneState.fatal != null) {
            Scaffold(topBar = { TopAppBar(title = { Text("Knocker") }) }) { padding ->
              Column(Modifier.fillMaxSize().padding(padding).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Unable to open Knocker", style = MaterialTheme.typography.headlineSmall)
                Text(sceneState.fatal)
                Button(onClick = { dispatch("restart") }) { Text("Try again") }
              }
            }
          } else if (destination == "home") {
            NativeHome(sceneState, snackbar, onOpen = { haptic("tap"); navigate("profile:$it") },
              onNew = { haptic("tap"); navigate("new") },
              onKnock = { dispatch("knock", mapOf("id" to it)) },
              onKnockAll = { dispatch("knockAll") },
              onPreferences = { haptic("tap"); preferences = true })
          } else {
            NativeEditor(destination.removePrefix("profile:"), sceneState, snackbar, pendingOperation != null, editorError,
              onDirty = { dirty = it }, onBack = { navigate("home") },
              onSave = { operation("save", profile = it) },
              onDelete = { operation("delete", id = it) }, feedback = haptic)
          }
        }
      }
    )
  }
  if (discardAction != null) AlertDialog(
    onDismissRequest = { discardAction = null },
    title = { Text("Discard unsaved changes?") },
    text = { Text("Your changes to this profile have not been saved.") },
    confirmButton = { TextButton(onClick = { haptic("tap"); discardAction?.invoke(); discardAction = null }) { Text("Discard") } },
    dismissButton = { TextButton(onClick = { discardAction = null }) { Text("Keep editing") } }
  )
  if (preferences) AlertDialog(
    onDismissRequest = { preferences = false },
    icon = { Icon(Icons.Default.PrivacyTip, contentDescription = null) },
    title = { Text("Public-IP checks") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Connection changes are detected on your phone without an IP service.")
        Text("Optional checks share your public IP with ipify to compare IPv4 and IPv6. They run on resume, connection changes and once a minute while foregrounded. They never delay a knock.")
        if (state.network.optBoolean("checksEnabled")) TextButton(onClick = { preferences = false; dispatch("refreshIp") }) { Text("Check now") }
      }
    },
    confirmButton = {
      TextButton(onClick = { preferences = false; dispatch("toggleIp", mapOf("enabled" to !state.network.optBoolean("checksEnabled"))) }) {
        Text(if (state.network.optBoolean("checksEnabled")) "Turn off" else "Enable checks")
      }
    },
    dismissButton = { TextButton(onClick = { preferences = false }) { Text(if (state.network.optBoolean("checksEnabled")) "Close" else "Keep off") } }
  )
}
