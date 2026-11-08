import ipaddr from "ipaddr.js";

export type Addresses = Partial<Record<"ipv4" | "ipv6", string>>;
export type AddressMatch = "same" | "changed" | "unknown";

/** Compare in the grant's address family, including server-returned CIDRs. */
export function compareGrantAddress(
  entry: string | null,
  addresses: Addresses,
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
