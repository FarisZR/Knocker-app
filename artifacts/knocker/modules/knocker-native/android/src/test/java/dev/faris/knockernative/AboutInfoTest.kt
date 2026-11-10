package dev.faris.knockernative

import org.junit.Assert.*
import org.junit.Test

class AboutInfoTest {
  @Test fun theLinksAreTheFixedPublicAddresses() {
    // terms.remal.org builds /<app>/privacy-policy/ from content/knocker/privacy-policy.md.
    assertEquals("https://terms.remal.org/knocker/privacy-policy/", PRIVACY_POLICY_URL)
    assertEquals("https://github.com/FarisZR/Knocker-app", SOURCE_CODE_URL)
  }

  @Test fun everyLinkIsHttps() {
    assertTrue(PRIVACY_POLICY_URL.startsWith("https://"))
    assertTrue(SOURCE_CODE_URL.startsWith("https://"))
  }

  @Test fun rowsShowTheAddressWithoutSchemeOrTrailingSlash() {
    assertEquals("terms.remal.org/knocker/privacy-policy", displayUrl(PRIVACY_POLICY_URL))
    assertEquals("github.com/FarisZR/Knocker-app", displayUrl(SOURCE_CODE_URL))
  }
}
