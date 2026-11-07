package dev.faris.knockernative

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeUiStateTest {
  @Test fun uniqueProfileIdsKeepTheirRenderingIdentity() {
    val state = NativeUiState(JSONObject("""{"profiles":[{"id":"home"},{"id":"studio"}]}"""))
    assertEquals(listOf("home", "studio"), state.profileRenderKeys)
  }

  @Test fun damagedIdsCannotCollideOrRewriteProfilesAndSecrets() {
    val json = JSONObject("""{"profiles":[
      {"id":"same","apiKey":"first-secret"},
      {"id":"same","apiKey":"second-secret"},
      {"apiKey":"missing-secret"}, {"id":null}, {"id":""},
      {"id":"profile-row:1"}, {"id":"profile-row:2"}
    ]}""")
    val before = json.toString()
    val state = NativeUiState(json)
    assertEquals(7, state.profiles.size)
    assertEquals(7, state.profileRenderKeys.toSet().size)
    assertTrue(state.profileRenderKeys.none { it.isBlank() })
    assertEquals("same", state.profileRenderKeys[0])
    assertEquals("profile-row:1", state.profileRenderKeys[5])
    assertEquals("profile-row:2", state.profileRenderKeys[6])
    assertEquals(before, json.toString())
    assertEquals(state.profileRenderKeys, NativeUiState(JSONObject(before)).profileRenderKeys)
  }
}
