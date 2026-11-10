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
import { RecoveryBudget } from "@/lib/recoveryBudget";
import { useProfiles } from "./ProfilesContext";

interface NetworkStatus {
  connection: NativeNetworkIdentity | null;
  statuses: Record<string, ServerStatus | null>;
  /** True while a status request is in flight, so a pull can wait for real results. */
  checking: boolean;
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
  // A check made while a new network is still coming up often fails. Retry it
  // shortly on every platform instead of leaving the last knock on screen.
  const statusRetries = useRef(new RecoveryBudget(4, 3000));
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const forcing = useRef(0);
  const [checking, setChecking] = useState(false);
  const automaticKnocks = useRef(new RecoveryBudget());
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
    // Background sampling must not cancel a check the user asked for.
    if (!force && forcing.current > 0) return;
    if (force) forcing.current++;
    try {
      await sampleAndCheck(force);
    } finally {
      if (force) forcing.current--;
    }
  }, []);

  const sampleAndCheck = useCallback(async (force: boolean) => {
    const sample = ++sampling.current;
    const local = await currentNetworkIdentity();
    if (sample !== sampling.current || AppState.currentState !== "active")
      return;
    const changed = local?.id !== connectionRef.current?.id;
    connectionRef.current = local;
    setConnection(local);
    const keyFor = (p: (typeof profiles)[number]) =>
      `${p.id}:${grantConfigurationFingerprint(p)}:${local?.id}`;
    const targetsToCheck = latest.current.profiles.filter(
      (p) =>
        !p.ipOverride &&
        (force ||
          changed ||
          statusRetries.current.ready(keyFor(p))),
    );
    if (!targetsToCheck.length && !force && !changed) return;
    const version = ++generation.current;
    controller.current?.abort();
    if (force || changed) setStatuses({});
    if (!local?.isConnected || !targetsToCheck.length) {
      setChecking(false);
      return;
    }
    const pending = new AbortController();
    controller.current = pending;
    clearTimeout(retryTimer.current);
    setChecking(true);
    let failed = false;
    const timer = setTimeout(() => pending.abort(), 4000);
    try {
      await Promise.all(
        targetsToCheck.map(async (profile) => {
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
          const key = keyFor(current);
          if (status === null) failed = statusRetries.current.claim(key) || failed;
          else statusRetries.current.forget(key);
          setStatuses((previous) => ({ ...previous, [profile.id]: status }));
          // Android handles automatic recovery natively, including when JS is suspended.
          if (
            !isNativeAvailable &&
            current.autoRenew &&
            status &&
            !status.whitelisted &&
            automaticKnocks.current.claim(key)
          )
            void latest.current.knockOne(profile.id);
        }),
      );
    } finally {
      clearTimeout(timer);
      if (version === generation.current) {
        setChecking(false);
        if (failed)
          retryTimer.current = setTimeout(() => void refresh(false), 3500);
      }
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
      clearTimeout(retryTimer.current);
      network.remove();
      app.remove();
    };
  }, [refresh]);

  return (
    <NetworkContext.Provider
      value={{
        connection,
        statuses,
        checking,
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
