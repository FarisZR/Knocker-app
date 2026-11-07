import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useProfiles } from "@/context/ProfilesContext";
import { useNetworkStatus } from "@/context/NetworkContext";
import { compareGrantAddress } from "@/lib/addresses";
import { newProfile, type Profile } from "@/lib/profiles";
import {
  NativeAppView,
  type NativeAction,
} from "../modules/knocker-native/NativeAppView";

/** Only data and commands cross this boundary; Compose owns layout, input, navigation and feedback. */
export function NativeApp() {
  const store = useProfiles();
  const network = useNetworkStatus();
  const router = useRouter();
  const { profile } = useLocalSearchParams<{ profile?: string }>();
  const [operation, setOperation] = useState<{
    token?: string;
    ok: boolean;
    message: string;
  } | null>(null);
  const stateJson = JSON.stringify({
    loaded: store.loaded,
    profiles: store.profiles.map((p) => {
      const status = network.statuses[p.id];
      return {
        ...p,
        statusChecked: Object.hasOwn(network.statuses, p.id),
        connectionStatus: status ?? null,
        addressMatch: compareGrantAddress(
          p.whitelistedEntry,
          status
            ? {
                [status.ipAddress.includes(":") ? "ipv6" : "ipv4"]:
                  status.ipAddress,
              }
            : {},
        ),
      };
    }),
    pending: [...store.pendingKnocks],
    requestedProfile: profile ?? null,
    network: {
      connection: network.connection,
    },
    feedback: store.snackbar
      ? { ...store.snackbar, retry: !!store.snackbar.retry }
      : null,
    operation,
  });

  /** Acknowledge persistence explicitly so native drafts close only after a successful write. */
  async function handle(action: NativeAction) {
    try {
      switch (action.type) {
        case "knock":
          if (action.id) await store.knockOne(action.id);
          break;
        case "knockAll":
          await store.knockAll();
          break;
        case "save": {
          if (!action.profileJson) throw new Error("Profile data is missing");
          const candidate: Profile = {
            ...newProfile(),
            ...JSON.parse(action.profileJson),
          };
          await store.upsert(candidate);
          setOperation({
            token: action.token,
            ok: true,
            message: "Profile saved",
          });
          break;
        }
        case "delete":
          if (!action.id) throw new Error("Profile is missing");
          await store.remove(action.id);
          setOperation({
            token: action.token,
            ok: true,
            message: "Profile deleted",
          });
          break;
        case "refreshStatus":
          network.refresh();
          break;
        case "dismiss":
          store.dismissSnackbar();
          break;
        case "retry": {
          const retry = store.snackbar?.retry;
          store.dismissSnackbar();
          retry?.();
          break;
        }
        case "consumeRoute":
          router.setParams({ profile: undefined });
          break;
      }
    } catch (error) {
      // Only editor commands own this acknowledgement channel. An unrelated
      // knock failure must not replace a save/delete result awaiting Compose.
      if (!action.token) {
        console.warn("Native action failed.", error);
        return;
      }
      setOperation({
        token: action.token,
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not complete the action. Try again.",
      });
    }
  }
  return (
    <NativeAppView
      style={{ flex: 1 }}
      stateJson={stateJson}
      onAction={(event) => {
        void handle(event.nativeEvent);
      }}
    />
  );
}
