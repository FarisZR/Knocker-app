@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class,
  androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi::class)

package dev.faris.knockernative

import android.app.StatusBarManager
import android.content.ComponentName
import android.content.Context
import android.graphics.drawable.Icon
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.platform.LocalContext
import androidx.navigationevent.NavigationEvent
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.adaptive.navigation.BackNavigationBehavior
import androidx.compose.material3.adaptive.navigation3.ListDetailSceneStrategy
import androidx.compose.material3.adaptive.navigation3.rememberListDetailSceneStrategy
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.scene.Scene
import androidx.navigation3.scene.SceneStrategy
import androidx.navigation3.scene.SceneStrategyScope
import androidx.navigation3.scene.SinglePaneSceneStrategy
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

private const val PAGE_MILLIS = 320

/** Offers the system "Add tile" prompt; Android reports an already added tile without asking again. */
private fun requestAddTile(context: Context, slot: Int) {
  if (Build.VERSION.SDK_INT < 33) return
  runCatching {
    context.getSystemService(StatusBarManager::class.java)?.requestAddTileService(
      ComponentName(context, "dev.faris.knockernative.KnockerTileService$slot"), "Knock $slot",
      Icon.createWithResource(context, R.drawable.ic_tile_knocker), context.mainExecutor) { }
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
  var pendingTile by remember { mutableStateOf<Int?>(null) }
  val drafts = remember { EditorDrafts() }
  val context = LocalContext.current

  fun navigate(next: String) {
    if (pendingOperation != null) return
    if (dirty) {
      discardDestination = next
      return
    }
    editorError = null
    if (next != route) drafts.clear()
    route = next
  }
  // Haptics mark knocks, toggles and results; plain navigation stays silent like system apps.
  fun dispatch(type: String, payload: Map<String, Any?> = emptyMap(), feedback: Boolean = false) {
    if (feedback) haptic("tap")
    emit(type, payload)
  }
  fun operation(type: String, profile: ProfileForm? = null, id: String? = null, tile: Int? = null) {
    val token = java.util.UUID.randomUUID().toString()
    pendingOperation = token; editorError = null; pendingTile = tile
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
      pendingTile?.let { requestAddTile(context, it) }; pendingTile = null
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

  val directive = knockerPaneDirective()
  // Retained entries read the current layout, which changes on fold, unfold or resize.
  val twoPane by rememberUpdatedState(directive.maxHorizontalPartitions > 1)
  // Back from a detail pane closes it through navigate(), which guards unsaved drafts.
  // The default policy would skip it, since the list stays on screen either way, and leave the app.
  val listDetail = rememberListDetailSceneStrategy<String>(backNavigationBehavior = BackNavigationBehavior.PopLatest,
    directive = directive)
  // Home alone keeps the whole window, with its actions in the corner; panes appear once something opens.
  val panes = remember(listDetail) { object : SceneStrategy<String> {
    override fun SceneStrategyScope<String>.calculateScene(entries: List<NavEntry<String>>): Scene<String>? =
      if (entries.size < 2) null else with(listDetail) { calculateScene(entries) }
  } }
  CompositionLocalProvider(LocalEditorDrafts provides drafts) {
    NavDisplay(
      backStack = if (route == "home") listOf("home") else listOf("home", route),
      // Panes leave gaps between and around them; fill those with the app's own background.
      modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
      onBack = { navigate("home") },
      sceneStrategies = listOf(panes, SinglePaneSceneStrategy()),
      // Screens slide like pages. During a back swipe the page follows the finger
      // toward the far edge and only leaves once the gesture is confirmed. Folding,
      // unfolding or resizing keeps the same destination and only swaps layouts.
      // In a large window, opening or closing a pane reflows the list rather than
      // replacing a page, so it cross-fades instead of sliding the list away.
      transitionSpec = {
        if (twoPane || initialState.entries.last().contentKey == targetState.entries.last().contentKey)
          ContentTransform(fadeIn(tween(PAGE_MILLIS)), fadeOut(tween(PAGE_MILLIS)))
        else ContentTransform(slideInHorizontally(tween(PAGE_MILLIS)) { it }, slideOutHorizontally(tween(PAGE_MILLIS)) { -it / 4 })
      },
      popTransitionSpec = {
        if (twoPane) ContentTransform(fadeIn(tween(PAGE_MILLIS)), fadeOut(tween(PAGE_MILLIS)))
        else ContentTransform(slideInHorizontally(tween(PAGE_MILLIS)) { -it / 4 }, slideOutHorizontally(tween(PAGE_MILLIS)) { it },
          targetContentZIndex = -1f)
      },
      predictivePopTransitionSpec = { edge ->
        val direction = if (edge == NavigationEvent.EDGE_RIGHT) -1 else 1
        if (twoPane) ContentTransform(fadeIn(tween(PAGE_MILLIS, easing = LinearEasing)),
          fadeOut(tween(PAGE_MILLIS, easing = LinearEasing)))
        else ContentTransform(slideInHorizontally(tween(PAGE_MILLIS, easing = LinearEasing)) { -direction * it / 4 },
          slideOutHorizontally(tween(PAGE_MILLIS, easing = LinearEasing)) { direction * it }, targetContentZIndex = -1f)
      },
      entryProvider = { destination ->
        // In two panes, home is the list and every other destination opens beside it.
        val metadata = if (destination == "home") ListDetailSceneStrategy.listPane()
          else ListDetailSceneStrategy.detailPane()
        NavEntry(destination, metadata = metadata) {
          DetailPane(twoPane && destination != "home") {
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
              // The list marks whatever is open beside it.
              NativeHome(sceneState, snackbar, openDetail = route.takeIf { twoPane && it != "home" },
                grid = twoPane && route == "home",
                onOpen = { navigate("profile:$it") },
                onNew = { navigate("new") },
                onKnock = { dispatch("knock", mapOf("id" to it), feedback = true) },
                onKnockAll = { dispatch("knockAll", feedback = true) },
                onPreferences = { navigate("settings") },
                onRefresh = { dispatch("refreshStatus") })
            } else if (destination == "settings") {
              NativeSettings(snackbar, onBack = { navigate("home") },
                onRefreshStatus = { dispatch("refreshStatus") },
                diagnosticsEnabled = sceneState.diagnosticsEnabled,
                onDiagnosticsChange = { dispatch("setDiagnostics", mapOf("enabled" to it), feedback = true) },
                feedback = haptic)
            } else {
              NativeEditor(if (destination == "new") null else destination.removePrefix("profile:"), sceneState, snackbar,
                pendingOperation != null, editorError,
                onDirty = { dirty = it }, onBack = { navigate("home") },
                onSave = { form, tile -> operation("save", profile = form, tile = tile) },
                onDelete = { operation("delete", id = it) }, feedback = haptic)
            }
          }
        }
      }
    )
  }
  if (discardDestination != null) AlertDialog(
    onDismissRequest = { discardDestination = null },
    title = { Text("Discard unsaved changes?") },
    text = { Text("Your changes to this profile have not been saved.") },
    confirmButton = { TextButton(onClick = {
      dirty = false
      discardDestination?.let { navigate(it) }
      discardDestination = null
    }) { Text("Discard") } },
    dismissButton = { TextButton(onClick = { discardDestination = null }) { Text("Keep editing") } }
  )
}
