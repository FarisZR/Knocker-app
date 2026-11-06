@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class)

package dev.faris.knockernative

import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.v2.createComposeRule
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
    "knockOnOpen":true,"pinnedToHome":true}],"network":{"checksEnabled":false}
  }"""))

  @Test fun hydrationUpdatesAnExistingNavigationEntryAndEditorHasOneTitle() {
    val state = mutableStateOf(NativeUiState())
    compose.setContent { MaterialExpressiveTheme { NativeApp(state.value, { _, _ -> }, {}) } }
    compose.onNodeWithText("Loading profiles…").assertExists()
    compose.runOnIdle { state.value = loaded() }
    compose.onNodeWithText("Home server").assertExists()
    compose.onNodeWithText("Loading profiles…").assertDoesNotExist()
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

  @Test fun knockActionsAndDistinctResultHapticsDoNotWaitForAnimationCompletion() {
    val state = mutableStateOf(loaded())
    val actions = mutableListOf<String>()
    val haptics = mutableListOf<String>()
    compose.setContent { MaterialExpressiveTheme { NativeApp(state.value, { type, _ -> actions.add(type) }, { haptics.add(it) }) } }
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
}
