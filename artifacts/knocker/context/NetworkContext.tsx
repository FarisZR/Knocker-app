import AsyncStorage from "@react-native-async-storage/async-storage";
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
import type { NativeNetworkIdentity } from "knocker-native";
import {
  currentNetworkIdentity,
  recordNetworkState,
} from "@/lib/networkIdentity";
import { lookupPublicAddresses, type PublicAddresses } from "@/lib/publicIp";

const STORAGE_KEY = "knocker.publicIpChecks.v1";
interface NetworkStatus {
  connection: NativeNetworkIdentity | null;
  checksEnabled: boolean;
  checking: boolean;
  addresses: PublicAddresses;
  setChecksEnabled: (enabled: boolean) => void;
  refresh: () => void;
}
const NetworkContext = createContext<NetworkStatus | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<NativeNetworkIdentity | null>(
    null,
  );
  const [checksEnabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [addresses, setAddresses] = useState<PublicAddresses>({});
  const enabledRef = useRef(false);
  const userChangedPreference = useRef(false);
  const connectionRef = useRef<NativeNetworkIdentity | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async (checkPublic = true) => {
    const version = ++generation.current;
    const local = await currentNetworkIdentity();
    if (version !== generation.current || AppState.currentState !== "active")
      return;
    const changed =
      local?.id !== connectionRef.current?.id ||
      local?.isConnected !== connectionRef.current?.isConnected;
    connectionRef.current = local;
    setConnection(local);
    if (!checkPublic && !changed) return;
    controller.current?.abort();
    setAddresses({});
    if (!enabledRef.current || local?.isConnected === false) {
      setChecking(false);
      return;
    }
    const pending = new AbortController();
    controller.current = pending;
    setChecking(true);
    const timeout = setTimeout(() => pending.abort(), 4000);
    try {
      const result = await lookupPublicAddresses(
        enabledRef.current,
        pending.signal,
      );
      if (controller.current === pending && enabledRef.current)
        setAddresses(result);
    } finally {
      clearTimeout(timeout);
      if (controller.current === pending) {
        controller.current = null;
        setChecking(false);
      }
    }
  }, []);

  const setChecksEnabled = useCallback(
    (enabled: boolean) => {
      userChangedPreference.current = true;
      enabledRef.current = enabled;
      setEnabled(enabled);
      controller.current?.abort();
      controller.current = null;
      setAddresses({});
      setChecking(false);
      void AsyncStorage.setItem(STORAGE_KEY, String(enabled)).catch(() => {});
      if (enabled) void refresh();
    },
    [refresh],
  );

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!mounted || userChangedPreference.current || value !== "true")
          return;
        enabledRef.current = true;
        setEnabled(true);
        void refresh();
      })
      .catch(() => {});
    void refresh(false);
    const network = Network.addNetworkStateListener((state) => {
      recordNetworkState(state);
      void refresh(false);
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
      else {
        ++generation.current;
        controller.current?.abort();
        controller.current = null;
        setChecking(false);
      }
    });
    // Local polling also catches VPN/default-network changes without external requests.
    const localTimer = setInterval(() => {
      if (AppState.currentState === "active") void refresh(false);
    }, 10000);
    const publicTimer = setInterval(() => {
      if (enabledRef.current && AppState.currentState === "active")
        void refresh();
    }, 60000);
    return () => {
      mounted = false;
      ++generation.current;
      controller.current?.abort();
      controller.current = null;
      network.remove();
      app.remove();
      clearInterval(localTimer);
      clearInterval(publicTimer);
    };
  }, [refresh]);

  return (
    <NetworkContext.Provider
      value={{
        connection,
        checksEnabled,
        checking,
        addresses,
        setChecksEnabled,
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
