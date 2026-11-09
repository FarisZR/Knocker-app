@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)

package dev.faris.knockernative

import android.content.Context
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
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

/** One Android-owned Compose tree, including navigation, insets, IME, dialogs and feedback. */
class KnockerAppView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private var snapshot by mutableStateOf(NativeUiState())
  private val onAction by EventDispatcher<Map<String, Any?>>()

  init {
    addView(ComposeView(context).apply {
      setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindowOrReleasedFromPool)
      setContent {
        KnockerTheme {
          NativeApp(snapshot, ::emit, ::haptic)
        }
      }
    }, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  /** Invalid transport data cannot replace the last complete rendering snapshot. */
  fun setState(raw: String) { NativeUiState.parse(raw)?.let { snapshot = it } }

  /**
   * Expo posts a measure after every requestLayout. One can land after Back has
   * finished the activity and detached this view, and a ComposeView measured
   * without a window throws, crashing the process on exit.
   */
  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    if (!isAttachedToWindow) {
      setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
      return
    }
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

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
  var route by rememberSaveable { mutableStateOf("home") }
  val snackbar = remember { SnackbarHostState() }
  var dirty by remember { mutableStateOf(false) }
  var discardDestination by remember { mutableStateOf<String?>(null) }
  var pendingOperation by remember { mutableStateOf<String?>(null) }
  var editorError by remember { mutableStateOf<String?>(null) }

  fun navigate(next: String) {
    if (pendingOperation != null) return
    if (dirty) {
      discardDestination = next
      return
    }
    editorError = null
    route = next
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
      // A delete can remove metadata before secret cleanup fails. Keep that
      // failure visible even though its destination no longer exists.
      if (route.startsWith("profile:") && state.profiles.none { it.optString("id") == route.removePrefix("profile:") }) {
        val message = editorError.orEmpty()
        dirty = false; navigate("home")
        snackbar.currentSnackbarData?.dismiss()
        snackbar.showSnackbar(message, withDismissAction = true)
      }
    }
  }
  LaunchedEffect(state.feedback?.optLong("id")) {
    val feedback = state.feedback ?: return@LaunchedEffect
    feedback.textOrNull("outcome")?.let(haptic)
    snackbar.currentSnackbarData?.dismiss()
    val success = feedback.optString("outcome") == "success"
    // Loading is already visible on the cards and action buttons.
    if (feedback.textOrNull("outcome") == null && feedback.optString("tone") == "info" && feedback.optBoolean("persistent") && !feedback.optBoolean("retry")) return@LaunchedEffect
    val message = if (success) {
      if (feedback.optString("tone") == "info") "Connected · TTL capped" else "Connected"
    } else listOfNotNull(feedback.textOrNull("text"), feedback.textOrNull("detail")).joinToString("\n").take(240)
    val result = snackbar.showSnackbar(message,
      actionLabel = if (!success && feedback.optBoolean("retry")) "Retry" else null,
      withDismissAction = !success,
      duration = if (!success && (feedback.optBoolean("persistent") || feedback.optBoolean("retry"))) SnackbarDuration.Indefinite else SnackbarDuration.Short)
    if (result == SnackbarResult.ActionPerformed) dispatch("retry") else emit("dismiss", emptyMap())
  }
  BackHandler(enabled = route != "home" && (dirty || pendingOperation != null)) { navigate("home") }

  NavDisplay(
    backStack = if (route == "home") listOf("home") else listOf("home", route),
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
              Button(onClick = { dispatch("restart") }, colors = knockerActionColors().let {
                ButtonDefaults.buttonColors(containerColor = it.container, contentColor = it.content)
              }) { Text("Try again") }
            }
          }
        } else if (destination == "home") {
          NativeHome(sceneState, snackbar, onOpen = { haptic("tap"); navigate("profile:$it") },
            onNew = { haptic("tap"); navigate("new") },
            onKnock = { dispatch("knock", mapOf("id" to it)) },
            onKnockAll = { dispatch("knockAll") },
            onPreferences = { haptic("tap"); navigate("settings") })
        } else if (destination == "settings") {
          NativeSettings(snackbar, onBack = { navigate("home") },
            onRefreshStatus = { dispatch("refreshStatus") }, feedback = haptic)
        } else {
          NativeEditor(if (destination == "new") null else destination.removePrefix("profile:"), sceneState, snackbar, pendingOperation != null, editorError,
            onDirty = { dirty = it }, onBack = { navigate("home") },
            onSave = { operation("save", profile = it) },
            onDelete = { operation("delete", id = it) }, feedback = haptic)
        }
      }
    }
  )
  if (discardDestination != null) AlertDialog(
    onDismissRequest = { discardDestination = null },
    title = { Text("Discard unsaved changes?") },
    text = { Text("Your changes to this profile have not been saved.") },
    confirmButton = { TextButton(onClick = {
      haptic("tap")
      dirty = false
      discardDestination?.let { navigate(it) }
      discardDestination = null
    }) { Text("Discard") } },
    dismissButton = { TextButton(onClick = { discardDestination = null }) { Text("Keep editing") } }
  )
}
