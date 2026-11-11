import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
test("fallback detects offline, transport switches and Wi-Fi reconnects without a native module", async () => {
  let state = { type: "WIFI", isConnected: true };
  const { recordNetworkState, currentNetworkIdentity } = loadTypeScript(
    new URL("../lib/networkIdentity.ts", import.meta.url),
    {
      "knocker-native": { getNetworkIdentity: async () => null },
      "expo-network": { getNetworkStateAsync: async () => state },
    },
  );
  const first = await currentNetworkIdentity();
  assert.equal(first.type, "Wi-Fi");
  state = { type: "CELLULAR", isConnected: true };
  assert.notEqual((await currentNetworkIdentity()).id, first.id);
  recordNetworkState({ type: "WIFI", isConnected: false });
  state = { type: "WIFI", isConnected: true };
  assert.notEqual((await currentNetworkIdentity()).id, first.id);
  state = { type: "NONE", isConnected: false };
  assert.equal((await currentNetworkIdentity()).isConnected, false);
});
