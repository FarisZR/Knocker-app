package dev.faris.knockernative

/** Shown in Settings → About. The policy URL is fixed by the site layout (content/knocker/privacy-policy.md). */
internal const val AUTHOR = "FarisZR (RemalApps)"
internal const val SOURCE_CODE_URL = "https://github.com/FarisZR/Knocker-app"
internal const val PRIVACY_POLICY_URL = "https://terms.remal.org/knocker/privacy-policy/"

/** Rows show the address without the scheme or trailing slash, which reads better in a list. */
internal fun displayUrl(url: String): String = url.removePrefix("https://").trimEnd('/')
