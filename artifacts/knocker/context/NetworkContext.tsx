import * as Network from "expo-network";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { isNativeAvailable, type NativeNetworkIdentity } from "knocker-native";
import {
  currentNetworkIdentity,
  recordNetworkState,
} from "@/lib/networkIdentity";
import { checkServerStatus, type ServerStatus } from "@/lib/serverStatus";
import { grantConfigurationFingerprint } from "@/lib/profileConfiguration";
import { useProfiles } from "./ProfilesContext";

interface NetworkStatus {
  connection: NativeNetworkIdentity | null;
  statuses: Record<string, ServerStatus | null>;
  refresh: () => void;
}
const NetworkContext = createContext<NetworkStatus | null>(null);

/** Local events trigger bounded checks against each profile's own server. No IP polling. */
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { profiles, loaded, knockOne } = useProfiles();
  const [connection, setConnection] = useState<NativeNetworkIdentity | null>(
    null,
  );
  const [statuses, setStatuses] = useState<Record<string, ServerStatus | null>>(
    {},
  );
  const generation = useRef(0);
  const sampling = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const connectionRef = useRef<NativeNetworkIdentity | null>(null);
  const latest = useRef({ profiles, knockOne });
  latest.current = { profiles, knockOne };
  // Only target/grant changes invalidate observations; display edits do not send requests.
  const targets = JSON.stringify(
    profiles.map((p) => [
      p.id,
      grantConfigurationFingerprint(p),
      p.grantRecordedAt,
      p.autoRenew,
    ]),
  );

  const refresh = useCallback(async (force = true) => {
    const sample = ++sampling.current;
    const local = await currentNetworkIdentity();
    if (sample !== sampling.current || AppState.currentState !== "active")
      return;
    const changed = local?.id !== connectionRef.current?.id;
    connectionRef.current = local;
    setConnection(local);
    if (!force && !changed) return;
    const version = ++generation.current;
    controller.current?.abort();
    setStatuses({});
    if (!local?.isConnected) return;
    const pending = new AbortController();
    controller.current = pending;
    const timer = setTimeout(() => pending.abort(), 4000);
    try {
      await Promise.all(
        latest.current.profiles
          .filter((p) => !p.ipOverride)
          .map(async (profile) => {
            const status = await checkServerStatus(profile, pending.signal);
            const current = latest.current.profiles.find(
              (p) => p.id === profile.id,
            );
            if (
              (pending.signal.aborted && status !== null) ||
              version !== generation.current ||
              !current ||
              grantConfigurationFingerprint(current) !==
                grantConfigurationFingerprint(profile)
            )
              return;
            setStatuses((previous) => ({ ...previous, [profile.id]: status }));
            // Android handles automatic recovery natively, including when JS is suspended.
            if (
              !isNativeAvailable &&
              current.autoRenew &&
              status &&
              !status.whitelisted
            )
              void latest.current.knockOne(profile.id);
          }),
      );
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void refresh();
    return () => {
      ++sampling.current;
      ++generation.current;
      controller.current?.abort();
    };
  }, [loaded, targets, refresh]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const network = Network.addNetworkStateListener((state) => {
      recordNetworkState(state);
      ++sampling.current;
      ++generation.current;
      controller.current?.abort();
      setStatuses({});
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        void refresh();
      }, 1500);
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
      else {
        ++sampling.current;
        ++generation.current;
        controller.current?.abort();
        clearTimeout(debounce);
      }
    });
    // Local sampling catches default-network/VPN changes without HTTP polling.
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh(false);
    }, 10000);
    return () => {
      ++sampling.current;
      ++generation.current;
      controller.current?.abort();
      clearTimeout(debounce);
      clearInterval(timer);
      network.remove();
      app.remove();
    };
  }, [refresh]);

  return (
    <NetworkContext.Provider
      value={{
        connection,
        statuses,
        refresh: () => {
          void refresh();
        },
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  const context = useContext(NetworkContext);
  if (!context)
    throw new Error("useNetworkStatus must be used inside NetworkProvider");
  return context;
}
