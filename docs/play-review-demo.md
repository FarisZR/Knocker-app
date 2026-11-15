# Demo mode for Google Play review

Knocker needs a Knocker server to do anything useful. So that reviewers can try every feature without one, the app has a built-in demo server. A profile whose **Endpoint URL** is just `demo` never goes online: each knock succeeds on the device after a short delay and whitelists the documentation address `203.0.113.42` (or the custom IP you set) for the profile's TTL, or one hour if TTL is blank. Everything else runs for real: renewal in the background, re-knocking after a network change, Quick Settings tiles, notifications and knocking when the app opens.

## Reviewer instructions

Paste this under **App content → App access** in Play Console:

> 1. Open Knocker and tap **+** (New profile).
> 2. Enter any **Name**, type `demo` as the **Endpoint URL** and `demo` as the **API key**. Tap **Save**.
> 3. Tap **Knock**. The profile turns green and counts down the whitelist time.
>
> With `demo` as the endpoint the app does not contact any server, so no account or credentials are needed. Every feature works with this profile. To see background renewal, set **TTL** to `360` and turn on **Auto-renew**, then close the app: about a minute later Knocker renews in the background and posts a notification. Quick Settings tiles, Pin to home and Knock when app opens work the same way.
