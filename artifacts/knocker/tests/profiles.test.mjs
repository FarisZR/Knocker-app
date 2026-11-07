import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";

function storage({
  keyError,
  metadataError,
  readError,
  platform = "android",
} = {}) {
  const metadata = new Map();
  const secrets = new Map();
  const profiles = loadTypeScript(
    new URL("../lib/profiles.ts", import.meta.url),
    {
      "react-native": { Platform: { OS: platform } },
      "@react-native-async-storage/async-storage": {
        getItem: async (key) => {
          if (readError) throw readError;
          return metadata.get(key) ?? null;
        },
        setItem: async (key, value) => {
          if (metadataError) throw metadataError;
          metadata.set(key, value);
        },
      },
      "expo-secure-store": {
        getItemAsync: async (key) => {
          if (keyError) throw keyError;
          return secrets.get(key) ?? null;
        },
        setItemAsync: async (key, value) => {
          if (keyError) throw keyError;
          secrets.set(key, value);
        },
        deleteItemAsync: async (key) => {
          if (keyError) throw keyError;
          secrets.delete(key);
        },
      },
    },
  );
  return { ...profiles, metadata, secrets };
}

test("saved profiles round-trip while keys stay out of metadata", async () => {
  const store = storage();
  const profile = { ...store.newProfile(), apiKey: "private-test-key" };
  await store.saveProfiles([profile]);
  assert.deepEqual(await store.loadProfiles(), [profile]);
  for (const raw of store.metadata.values()) {
    assert.equal(raw.includes(profile.apiKey), false);
    assert.equal(Object.hasOwn(JSON.parse(raw)[0], "apiKey"), false);
  }
});

test("key-write failures reject a save before profile metadata is committed", async () => {
  const keyError = new Error("Secure storage unavailable");
  const store = storage({ keyError });
  await assert.rejects(
    store.saveProfiles([{ ...store.newProfile(), apiKey: "key" }]),
    keyError,
  );
  assert.equal(store.metadata.size, 0);
});

test("failed hydration cannot masquerade as an empty profile list or missing key", async () => {
  const readError = new Error("Storage unavailable");
  await assert.rejects(storage({ readError }).loadProfiles(), readError);
  const keyStore = storage({ keyError: readError });
  const raw = JSON.stringify([{ id: "home", name: "Saved server" }]);
  keyStore.metadata.set("knocker.profiles.v1", raw);
  await assert.rejects(keyStore.loadProfiles(), readError);
  assert.equal(keyStore.metadata.get("knocker.profiles.v1"), raw);
});

test("missing profile data is empty, while corrupted data rejects without erasing it", async () => {
  const store = storage();
  assert.deepEqual(await store.loadProfiles(), []);
  for (const raw of ["", "broken-json", "{}", "null"]) {
    store.metadata.set("knocker.profiles.v1", raw);
    await assert.rejects(store.loadProfiles());
    assert.equal(store.metadata.get("knocker.profiles.v1"), raw);
  }
});

test("metadata-write failures are reported to the editor", async () => {
  const metadataError = new Error("Storage full");
  const store = storage({ metadataError });
  await assert.rejects(
    store.saveProfiles([{ ...store.newProfile(), apiKey: "key" }]),
    metadataError,
  );
});

test("secret deletion cannot silently acknowledge a failed cleanup", async () => {
  const keyError = new Error("Key cleanup failed");
  const store = storage({ keyError });
  await assert.rejects(store.deleteProfileSecret("home"), keyError);
});

test("unavailable browser key storage rejects rather than saving a keyless profile", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: undefined,
  });
  try {
    const store = storage({ platform: "web" });
    await assert.rejects(
      store.saveProfiles([{ ...store.newProfile(), apiKey: "key" }]),
      /Key storage is unavailable/,
    );
    assert.equal(store.metadata.size, 0);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
