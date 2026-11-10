@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class)

package dev.faris.knockernative

import android.app.AlarmManager
import android.content.SharedPreferences
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Exercises the real NavDisplay/Material tree on Android, including late bridge updates. */
class NativeAppTest {
  @get:Rule val compose = createComposeRule()
  private fun loaded(): NativeUiState = NativeUiState(JSONObject("""{
    "loaded":true,"pending":[],"profiles":[{"id":"home","name":"Home server",
    "endpointUrl":"https://example.test","apiKey":"fake-key","autoRenew":false,
    "knockOnOpen":true,"pinnedToHome":true}],"network":{}
  }"""))

  @Test fun backgroundRenewalIsOptInAndPermissionControlsFollowTheSwitch() {
    compose.setContent {
      CompositionLocalProvider(LocalSystemPrompts provides false) { KnockerTheme { NativeApp(loaded(), { _, _ -> }, {}) } }
    }
    compose.onNodeWithContentDescription("New profile").performClick()
    compose.onNodeWithText("Auto-renew").performScrollTo().assertIsOff()
    compose.onNodeWithText("Allow precise renewal").assertDoesNotExist()
    compose.onNodeWithText("Allow timely background renewal?").assertDoesNotExist()
    compose.onNodeWithText("Auto-renew").performClick()
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      !context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()) {
      compose.onNodeWithText("Allow timely background renewal?").assertExists()
      compose.onNodeWithText("Network-change recovery works without this permission", substring = true).assertExists()
      compose.onNodeWithText("Not now").performClick()
      compose.onNodeWithText("Allow timely background renewal?").assertDoesNotExist()
      compose.onNodeWithText("Allow precise renewal").performScrollTo().assertExists()
      compose.onNodeWithText("Allow precise renewal").performClick()
      compose.onNodeWithText("Allow timely background renewal?").assertExists()
      compose.onNodeWithText("Network-change recovery works without this permission", substring = true).assertExists()
      compose.onNodeWithText("Not now").performClick()
    }
    compose.onNodeWithText("Auto-renew").performScrollTo().performClick()
    compose.onNodeWithText("Allow precise renewal").assertDoesNotExist()
  }

  @Test fun wallpaperColorsAreOptInPersistAndCanReturnToBrandColors() {
    if (Build.VERSION.SDK_INT < 31) return
    val generation = mutableStateOf(0)
    lateinit var preferences: SharedPreferences
    lateinit var actual: ColorScheme
    lateinit var brand: ColorScheme
    lateinit var dynamic: ColorScheme
    compose.setContent {
      val context = LocalContext.current
      remember { themePreferences(context).also {
        preferences = it
        it.edit().remove(WALLPAPER_COLORS_KEY).commit()
      } }
      val dark = isSystemInDarkTheme()
      brand = if (dark) KnockerDarkColors else KnockerLightColors
      dynamic = if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
      key(generation.value) {
        KnockerTheme {
          actual = MaterialTheme.colorScheme
          NativeApp(loaded(), { _, _ -> }, {})
        }
      }
    }
    try {
      compose.runOnIdle { assertEquals(brand.primary, actual.primary); assertEquals(brand.surface, actual.surface) }
      compose.onNodeWithContentDescription("Settings").performClick()
      compose.onNodeWithText("Use wallpaper colors").assertIsOff().performClick()
      compose.runOnIdle {
        assertEquals(dynamic.primary, actual.primary); assertEquals(dynamic.surface, actual.surface)
        assertTrue(preferences.getBoolean(WALLPAPER_COLORS_KEY, false))
        generation.value++ // Recreate the theme to read the persisted preference.
      }
      compose.onNodeWithContentDescription("Settings").performClick()
      compose.onNodeWithText("Use wallpaper colors").assertIsOn().performClick()
      compose.runOnIdle {
        assertEquals(brand.primary, actual.primary); assertEquals(brand.surface, actual.surface)
        assertFalse(preferences.getBoolean(WALLPAPER_COLORS_KEY, true))
      }
    } finally {
      compose.runOnIdle { preferences.edit().remove(WALLPAPER_COLORS_KEY).commit() }
    }
  }

  @Test fun hydrationUpdatesAnExistingNavigationEntryAndEditorHasOneTitle() {
    val state = mutableStateOf(NativeUiState())
    compose.setContent { KnockerTheme { NativeApp(state.value, { _, _ -> }, {}) } }
    compose.onNodeWithContentDescription("Loading profiles").assertExists()
    compose.onNodeWithText("No servers yet").assertDoesNotExist()
    compose.runOnIdle { state.value = loaded() }
    compose.onNodeWithText("Home server").assertExists()
    compose.onNodeWithText("Ready to connect").assertDoesNotExist()
    compose.onNodeWithText("Not connected").assertDoesNotExist()
    compose.onNodeWithContentDescription("Loading profiles").assertDoesNotExist()
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onAllNodesWithText("Edit profile").assertCountEquals(1)
    compose.onNodeWithText("New profile").assertDoesNotExist()
    compose.onNodeWithText("Name").performTextReplacement("Unsaved name")
    compose.onNodeWithContentDescription("Back").performClick()
    compose.onNodeWithText("Discard unsaved changes?").assertExists()
    compose.onNodeWithText("Keep editing").performClick()
    compose.onNodeWithText("Unsaved name").assertExists()
    compose.onNodeWithContentDescription("Back").performClick()
    compose.onNodeWithText("Discard").performClick()
    compose.onNodeWithText("Home server").assertExists()
  }

  @Test fun aProfileNamedNewStillOpensTheExistingEditor() {
    val json = loaded().json
    json.getJSONArray("profiles").getJSONObject(0).put("id", "new")
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { _, _ -> }, {}) } }
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onNodeWithText("Edit profile").assertExists()
    compose.onNodeWithContentDescription("Delete profile").assertExists()
    compose.onNodeWithText("Name").assertTextContains("Home server")
  }

  @Test fun saveWaitsForAChangeAndExamplesNeverReadAsValues() {
    compose.setContent { KnockerTheme { NativeApp(loaded(), { _, _ -> }, {}) } }
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onNodeWithText("Save").assertIsNotEnabled()
    compose.onNodeWithText("https://knock.example.com").assertDoesNotExist()
    compose.onNodeWithText("Leave empty to use the server default").assertExists()
    compose.onNodeWithText("TTL (seconds)").performTextReplacement("600")
    compose.onNodeWithText("Leave empty to use the server default").assertDoesNotExist()
    compose.onNodeWithText("Save").assertIsEnabled()
  }

  @Test fun aFailedSaveKeepsItsDraftAndRequiresAMatchingAcknowledgement() {
    val state = mutableStateOf(loaded())
    val actions = mutableListOf<Pair<String, Map<String, Any?>>>()
    compose.setContent { KnockerTheme { NativeApp(state.value, { type, payload -> actions.add(type to payload) }, {}) } }
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onNodeWithText("Name").performTextReplacement("Unsaved name")
    compose.onNodeWithText("Save").performClick()
    lateinit var token: String
    compose.runOnIdle {
      token = actions.first { it.first == "save" }.second["token"] as String
      state.value = NativeUiState(loaded().json.put("operation",
        JSONObject().put("token", "unrelated").put("ok", true)))
    }
    compose.onNodeWithContentDescription("Back").assertIsNotEnabled()
    compose.onNodeWithText("Unsaved name").assertExists()
    compose.runOnIdle {
      state.value = NativeUiState(loaded().json.put("operation",
        JSONObject().put("token", token).put("ok", false).put("message", "Storage unavailable")))
    }
    compose.onNodeWithText("Storage unavailable").assertExists()
    compose.onNodeWithText("Unsaved name").assertExists()
    compose.onNodeWithText("Save").assertIsEnabled().performClick()
    compose.runOnIdle {
      val retryToken = actions.last { it.first == "save" }.second["token"] as String
      assertNotEquals(token, retryToken)
      state.value = NativeUiState(loaded().json.put("operation",
        JSONObject().put("token", retryToken).put("ok", true).put("message", "Profile saved")))
    }
    compose.onNodeWithContentDescription("Knocker").assertExists()
  }

  @Test fun knockActionsAndDistinctResultHapticsDoNotWaitForAnimationCompletion() {
    val state = mutableStateOf(loaded())
    val actions = mutableListOf<String>()
    val haptics = mutableListOf<String>()
    compose.setContent { KnockerTheme { NativeApp(state.value, { type, _ -> actions.add(type) }, { haptics.add(it) }) } }
    compose.onNodeWithContentDescription("Knock all servers").performClick()
    compose.runOnIdle { assertTrue("knockAll" in actions); assertTrue("tap" in haptics) }
    for ((id, outcome) in listOf(1 to "success", 2 to "error")) {
      compose.runOnIdle {
        val json = JSONObject(loaded().json.toString())
        json.put("feedback", JSONObject().put("id", id).put("text", "Result $id").put("outcome", outcome))
        state.value = NativeUiState(json)
      }
      compose.waitForIdle()
      compose.runOnIdle { assertTrue(outcome, outcome in haptics) }
    }
  }

  @Test fun homeKeepsUsefulTextAndAttachesWarningsToTheProfilePanel() {
    val json = loaded().json
    val profile = json.getJSONArray("profiles").getJSONObject(0)
    val now = System.currentTimeMillis()
    profile.put("expiresAt", now + 60000).put("whitelistedAt", now).put("whitelistedEntry", "203.0.113.42")
      .put("grantNetworkId", "previous").put("statusChecked", true).put("autoRenew", true)
      .put("lastKnockStatus", "error").put("lastError", JSONObject.NULL)
    json.getJSONObject("network").put("connection", JSONObject().put("id", "current").put("type", "Wi-Fi").put("isConnected", true))
    val actions = mutableListOf<String>()
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { type, _ -> actions.add(type) }, {}) } }
    compose.onNodeWithContentDescription("Knocker").assertExists()
    compose.onNodeWithText("IP · 203.0.113.42").assertExists()
    compose.onNodeWithText("Failed").assertExists()
    compose.onNodeWithText("null").assertDoesNotExist()
    compose.onNodeWithText("Whitelisted IP", substring = true).assertDoesNotExist()
    compose.onNodeWithText("Pinned").assertDoesNotExist()
    compose.onNodeWithText("Auto-renew").assertDoesNotExist()
    compose.onNodeWithText("Wi-Fi").assertDoesNotExist()
    compose.onNodeWithText("IP checks: off").assertDoesNotExist()
    compose.onNodeWithText("1 profile", substring = true).assertDoesNotExist()
    compose.onNodeWithText("Network changed · status unverified")
      .assert(hasAnyAncestor(hasContentDescription("Edit Home server")).not())
      .assert(hasAnyAncestor(hasContentDescription("Profile Home server")))
    compose.onNodeWithContentDescription("Settings").performClick()
    compose.onNodeWithText("Connection checks use only your configured Knocker servers.").assertExists()
    compose.onAllNodesWithText("Settings").assertCountEquals(1)
    compose.onNodeWithText("Check connection status").performClick()
    compose.runOnIdle { assertEquals("refreshStatus", actions.last()) }
    compose.onNodeWithContentDescription("Back").performClick()
    compose.onNodeWithContentDescription("Knocker").assertExists()
  }

  @Test fun serverCoverageSuppressesWarningEvenWhenAddressAndNetworkChanged() {
    val json = loaded().json
    json.getJSONArray("profiles").getJSONObject(0)
      .put("expiresAt", System.currentTimeMillis() + 60000).put("grantNetworkId", "previous")
      .put("statusChecked", true).put("addressMatch", "changed").put("connectionStatus", JSONObject()
        .put("ipAddress", "198.51.100.7").put("whitelisted", true).put("expiresAt", System.currentTimeMillis() + 60000))
    json.getJSONObject("network").put("connection", JSONObject().put("id", "current").put("isConnected", true))
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { _, _ -> }, {}) } }
    compose.onNodeWithContentDescription("Connection notice for Home server").assertDoesNotExist()
  }

  @Test fun aRenewedGrantSupersedesAnOlderStatusObservation() {
    val now = System.currentTimeMillis()
    val json = loaded().json
    json.getJSONArray("profiles").getJSONObject(0)
      .put("expiresAt", now + 3600000).put("whitelistedAt", now).put("grantRecordedAt", now)
      .put("connectionStatus", JSONObject().put("whitelisted", true).put("expiresAt", now + 600000).put("checkedAt", now - 5000))
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { _, _ -> }, {}) } }
    compose.onNodeWithText("Whitelisted · 59m", substring = true).assertExists()
  }

  @Test fun expiredObservationDoesNotReviveTheOlderSavedExpiry() {
    val json = loaded().json
    json.getJSONArray("profiles").getJSONObject(0)
      .put("expiresAt", System.currentTimeMillis() + 60000)
      .put("connectionStatus", JSONObject().put("whitelisted", true).put("expiresAt", System.currentTimeMillis() - 1000))
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { _, _ -> }, {}) } }
    compose.onNodeWithText("Expired").assertExists()
    compose.onNodeWithText("Whitelisted", substring = true).assertDoesNotExist()
  }

  @Test fun uncoveredConnectionShowsBothLastKnockAndCurrentIp() {
    val json = loaded().json
    json.getJSONArray("profiles").getJSONObject(0)
      .put("expiresAt", System.currentTimeMillis() + 60000).put("whitelistedEntry", "203.0.113.42")
      .put("statusChecked", true).put("addressMatch", "changed").put("connectionStatus", JSONObject()
        .put("ipAddress", "198.51.100.7").put("whitelisted", false))
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { _, _ -> }, {}) } }
    compose.onNodeWithText("IP · 203.0.113.42").assertExists()
    compose.onNodeWithText("IP · 198.51.100.7").assertExists()
    compose.onNodeWithText("IP changed · not whitelisted").assertExists()
  }

  @Test fun successfulFeedbackAutoDismissesEvenIfAnOldSnapshotMarksItPersistent() {
    val json = loaded().json.put("feedback", JSONObject().put("id", 10).put("text", "Launch knock succeeded")
      .put("outcome", "success").put("persistent", true))
    val actions = mutableListOf<String>()
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { type, _ -> actions.add(type) }, {}) } }
    compose.onNodeWithText("Connected").assertExists()
    compose.onNodeWithContentDescription("Dismiss").assertDoesNotExist()
    compose.waitUntil(timeoutMillis = 10000) { "dismiss" in actions }
    compose.onNodeWithText("Connected").assertDoesNotExist()
  }

  @Test fun aDeletedProfileRouteReturnsHomeWithoutCreatingANewDraft() {
    val state = mutableStateOf(loaded())
    compose.setContent { KnockerTheme { NativeApp(state.value, { _, _ -> }, {}) } }
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onNodeWithText("Name").performTextReplacement("Unsaved name")
    compose.runOnIdle { state.value = NativeUiState(loaded().json.put("profiles", org.json.JSONArray())) }
    compose.onNodeWithContentDescription("Knocker").assertExists()
    compose.onNodeWithText("Name").assertDoesNotExist()
    compose.onNodeWithText("Discard unsaved changes?").assertDoesNotExist()
    compose.onNodeWithText("No servers yet").assertExists()
    compose.onNodeWithContentDescription("New profile").assertDoesNotExist()
    compose.onNodeWithText("New profile", useUnmergedTree = true).performClick()
    compose.onNodeWithText("Name").assertExists()
  }

  @Test fun deletionWaitsForItsAcknowledgementAfterTheProfileDisappears() {
    val state = mutableStateOf(loaded())
    val actions = mutableListOf<Pair<String, Map<String, Any?>>>()
    compose.setContent { KnockerTheme { NativeApp(state.value, { type, payload -> actions.add(type to payload) }, {}) } }
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onNodeWithContentDescription("Delete profile").performClick()
    compose.onNodeWithText("Delete", useUnmergedTree = true).performClick()
    lateinit var token: String
    compose.runOnIdle {
      token = actions.first { it.first == "delete" }.second["token"] as String
      state.value = NativeUiState(loaded().json.put("profiles", org.json.JSONArray()))
    }
    compose.onNodeWithText("Edit profile").assertExists()
    compose.onNodeWithContentDescription("Knocker").assertDoesNotExist()
    compose.runOnIdle {
      state.value = NativeUiState(JSONObject(state.value.json.toString()).put("operation",
        JSONObject().put("token", token).put("ok", true).put("message", "Profile deleted")))
    }
    compose.onNodeWithContentDescription("Knocker").assertExists()
  }

  @Test fun failedSecretCleanupRemainsVisibleAfterTheProfileWasDeleted() {
    val state = mutableStateOf(loaded())
    val actions = mutableListOf<Pair<String, Map<String, Any?>>>()
    compose.setContent { KnockerTheme { NativeApp(state.value, { type, payload -> actions.add(type to payload) }, {}) } }
    compose.onNodeWithContentDescription("Edit Home server").performClick()
    compose.onNodeWithContentDescription("Delete profile").performClick()
    compose.onNodeWithText("Delete", useUnmergedTree = true).performClick()
    compose.runOnIdle {
      val token = actions.first { it.first == "delete" }.second["token"] as String
      state.value = NativeUiState(loaded().json.put("profiles", org.json.JSONArray()).put("operation",
        JSONObject().put("token", token).put("ok", false).put("message", "Key cleanup failed")))
    }
    compose.onNodeWithContentDescription("Knocker").assertExists()
    compose.onNodeWithText("Key cleanup failed").assertExists()
  }

  @Test fun malformedProfileIdsRenderEveryRowWithoutDuplicateKeyCrashes() {
    val json = loaded().json.put("profiles", org.json.JSONArray("""[
      {"id":"same","name":"First server"}, {"id":"same","name":"Second server"},
      {"name":"Third server"}, {"name":"Fourth server"}
    ]"""))
    compose.setContent { KnockerTheme { NativeApp(NativeUiState(json), { _, _ -> }, {}) } }
    for (name in listOf("First server", "Second server", "Third server", "Fourth server"))
      compose.onNodeWithText(name).assertExists()
    compose.onNodeWithContentDescription("Edit Third server").assertIsNotEnabled()
    compose.onNodeWithContentDescription("Edit Fourth server").assertIsNotEnabled()
  }

  @Test fun warningAnimatesWithoutDelayingAKnock() {
    val json = loaded().json
    val now = System.currentTimeMillis()
    json.getJSONArray("profiles").getJSONObject(0).put("expiresAt", now + 60000)
      .put("whitelistedAt", now).put("grantNetworkId", "wifi").put("statusChecked", true)
    json.getJSONObject("network").put("connection", JSONObject().put("id", "wifi").put("isConnected", true))
    val state = mutableStateOf(NativeUiState(json))
    val knocks = mutableListOf<String>()
    compose.setContent { KnockerTheme {
      NativeApp(state.value, { type, payload -> if (type == "knock") knocks.add(payload["id"] as String) }, {})
    } }
    compose.mainClock.autoAdvance = false
    compose.runOnIdle {
      val changed = JSONObject(json.toString())
      changed.getJSONObject("network").getJSONObject("connection").put("id", "cellular")
      state.value = NativeUiState(changed)
    }
    compose.mainClock.advanceTimeBy(64)
    val notice = compose.onNodeWithContentDescription("Connection notice for Home server")
    val initialHeight = notice.fetchSemanticsNode().boundsInRoot.height
    compose.onNodeWithContentDescription("Knock Home server").performClick()
    compose.runOnIdle { assertEquals(listOf("home"), knocks) }
    compose.mainClock.advanceTimeBy(2000)
    val fullHeight = notice.fetchSemanticsNode().boundsInRoot.height
    assertTrue("The footer expands with native motion", fullHeight > initialHeight)
    compose.runOnIdle { state.value = NativeUiState(JSONObject(json.toString())) }
    compose.mainClock.advanceTimeByFrame()
    compose.mainClock.advanceTimeBy(100)
    assertTrue("The footer shrinks on dismissal", notice.fetchSemanticsNode().boundsInRoot.height < fullHeight)
    compose.mainClock.advanceTimeBy(2000)
    notice.assertDoesNotExist()
    compose.runOnIdle {
      val changed = JSONObject(json.toString())
      changed.getJSONObject("network").getJSONObject("connection").put("id", "cellular")
      state.value = NativeUiState(changed)
    }
    compose.mainClock.advanceTimeBy(64)
    assertTrue("Repeated appearances must animate too", notice.fetchSemanticsNode().boundsInRoot.height < fullHeight)
    compose.mainClock.advanceTimeBy(2000)
    compose.mainClock.autoAdvance = true
  }
  @Test fun aHydratedWarningAnimatesOnItsFirstAppearance() {
    val state = mutableStateOf(loaded().let { NativeUiState(JSONObject(it.json.toString()).put("profiles", org.json.JSONArray())) })
    compose.setContent { KnockerTheme { NativeApp(state.value, { _, _ -> }, {}) } }
    compose.mainClock.autoAdvance = false
    compose.runOnIdle {
      val json = loaded().json
      val now = System.currentTimeMillis()
      json.getJSONArray("profiles").getJSONObject(0).put("expiresAt", now + 60000)
        .put("whitelistedAt", now).put("grantNetworkId", "wifi").put("statusChecked", true)
      json.getJSONObject("network").put("connection", JSONObject().put("id", "cellular").put("isConnected", true))
      state.value = NativeUiState(json)
    }
    compose.mainClock.advanceTimeBy(64)
    val notice = compose.onNodeWithContentDescription("Connection notice for Home server")
    val firstHeight = notice.fetchSemanticsNode().boundsInRoot.height
    compose.mainClock.advanceTimeBy(2000)
    assertTrue("A newly composed notice must expand in", notice.fetchSemanticsNode().boundsInRoot.height > firstHeight)
    compose.mainClock.autoAdvance = true
  }

}
