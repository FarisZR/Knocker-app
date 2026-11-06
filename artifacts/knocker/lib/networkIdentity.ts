import * as Network from "expo-network";
import { getNetworkIdentity, type NativeNetworkIdentity } from "knocker-native";

const session = Date.now().toString(36);
let epoch = 0;
let previous = "";
/** Creates a session-scoped fallback identity that advances after transport or connectivity changes. */
export function recordNetworkState(
  state: Network.NetworkState,
): NativeNetworkIdentity {
  const connected =
    state.isConnected === true && state.isInternetReachable !== false;
  const key = `${state.type}:${connected}`;
  if (key !== previous) {
    previous = key;
    epoch++;
  }
  const names: Record<string, string> = {
    WIFI: "Wi-Fi",
    CELLULAR: "Cellular",
    ETHERNET: "Ethernet",
    VPN: "VPN",
    NONE: "Offline",
    UNKNOWN: "Unknown network",
  };
  return {
    id: connected ? `fallback:${session}:${epoch}:${state.type}` : null,
    type: connected
      ? (names[state.type ?? "UNKNOWN"] ?? "Connected")
      : "Offline",
    isConnected: connected,
  };
}

/** Uses local Android identity when available, with a bounded Expo Network fallback. */
export async function currentNetworkIdentity(): Promise<NativeNetworkIdentity | null> {
  const native = await getNetworkIdentity();
  if (native) return native;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const state = await Promise.race([
      Network.getNetworkStateAsync(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 150);
      }),
    ]);
    return state ? recordNetworkState(state) : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Snapshot whatever local sampling has finished; HTTP results never await it. */
export function captureConnection(): () => NativeNetworkIdentity | null {
  let sampled: NativeNetworkIdentity | null = null;
  void currentNetworkIdentity().then((identity) => {
    sampled = identity;
  });
  return () => sampled;
}
