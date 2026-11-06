import ipaddr from "ipaddr.js";

export type PublicAddresses = Partial<Record<"ipv4" | "ipv6", string>>;
export type AddressMatch = "same" | "changed" | "unknown";

/** Compare in the grant's address family, including server-returned CIDRs. */
export function compareGrantAddress(
  entry: string | null,
  addresses: PublicAddresses,
): AddressMatch {
  if (!entry) return "unknown";
  try {
    if (entry.includes("/")) {
      let [network, prefix] = ipaddr.parseCIDR(entry);
      if (
        network.kind() === "ipv6" &&
        (network as ipaddr.IPv6).isIPv4MappedAddress() &&
        prefix >= 96
      ) {
        network = (network as ipaddr.IPv6).toIPv4Address();
        prefix -= 96;
      }
      const current = addresses[network.kind()];
      if (!current) return "unknown";
      const address = ipaddr.process(current);
      if (address.kind() !== network.kind()) return "unknown";
      return address.match(network, prefix) ? "same" : "changed";
    }
    const grant = ipaddr.process(entry);
    const current = addresses[grant.kind()];
    if (!current) return "unknown";
    return grant.toNormalizedString() ===
      ipaddr.process(current).toNormalizedString()
      ? "same"
      : "changed";
  } catch {
    return "unknown";
  }
}

/** The opt-in guard lives at the request boundary as well as in the UI. */
export async function lookupPublicAddresses(
  enabled: boolean,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<PublicAddresses> {
  if (!enabled || signal.aborted) return {};
  const addresses: PublicAddresses = {};
  await Promise.all(
    [
      ["ipv4", "https://api.ipify.org?format=json"],
      ["ipv6", "https://api6.ipify.org?format=json"],
    ].map(async ([family, url]) => {
      try {
        const response = await request(url, { signal, credentials: "omit" });
        if (!response.ok || signal.aborted) return;
        const data = await response.json();
        const address = ipaddr.process(String(data.ip));
        if (address.kind() === family)
          addresses[family as keyof PublicAddresses] = address.toString();
      } catch {
        // Missing IPv6, offline and timeouts are unknown, never an IP change.
      }
    }),
  );
  return addresses;
}
