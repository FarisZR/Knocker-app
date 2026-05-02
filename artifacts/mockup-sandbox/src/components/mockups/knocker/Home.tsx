import "./_group.css";
import { StatusBar, NavBar } from "./_chrome";
import { Search, MoreVertical, Plus, CheckCircle2, Clock, AlertCircle, Globe, Zap, ChevronRight } from "lucide-react";

type ProfileStatus = "active" | "idle" | "error";

interface Profile {
  name: string;
  host: string;
  status: ProfileStatus;
  expiresIn?: string;
  lastIp?: string;
  autoRenew: boolean;
  errorText?: string;
}

const profiles: Profile[] = [
  {
    name: "Home Server",
    host: "knock.home.faris.dev",
    status: "active",
    expiresIn: "23h 41m",
    lastIp: "98.142.10.41",
    autoRenew: true,
  },
  {
    name: "Work VPN",
    host: "vpn.acme.io",
    status: "idle",
    autoRenew: false,
  },
  {
    name: "NAS · Media",
    host: "nas.faris.dev",
    status: "active",
    expiresIn: "5h 12m",
    lastIp: "98.142.10.41",
    autoRenew: true,
  },
  {
    name: "Lab Cluster",
    host: "lab.internal.dev",
    status: "error",
    errorText: "401 — invalid API key",
    autoRenew: false,
  },
];

function StatusDot({ s }: { s: ProfileStatus }) {
  if (s === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--md-success)" }}>
        <CheckCircle2 size={14} strokeWidth={2.5} />
        Whitelisted
      </span>
    );
  }
  if (s === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--md-error)" }}>
        <AlertCircle size={14} strokeWidth={2.5} />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
      <Clock size={14} strokeWidth={2.5} />
      Idle
    </span>
  );
}

function ProfileRow({ p }: { p: Profile }) {
  const isActive = p.status === "active";
  return (
    <div
      style={{
        background: "var(--md-surface)",
        borderRadius: 24,
        padding: "16px 18px",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-[16.5px] font-semibold tracking-tight truncate">{p.name}</div>
            {p.autoRenew && (
              <span style={{ color: "var(--md-primary)" }} title="Auto-renew on">
                <Zap size={11} strokeWidth={2.5} fill="currentColor" />
              </span>
            )}
          </div>
          <div className="text-[12px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--md-on-surface-muted)" }}>
            <Globe size={11} strokeWidth={2} />
            <span className="truncate">{p.host}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px]">
            <StatusDot s={p.status} />
            {isActive && (
              <>
                <span style={{ color: "var(--md-outline)" }}>·</span>
                <span style={{ color: "var(--md-on-surface-variant)" }}>{p.expiresIn}</span>
              </>
            )}
            {p.errorText && (
              <>
                <span style={{ color: "var(--md-outline)" }}>·</span>
                <span style={{ color: "var(--md-error)" }} className="truncate">
                  {p.errorText}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={18} style={{ color: "var(--md-on-surface-muted)", flexShrink: 0 }} />
      </div>
    </div>
  );
}

export function Home() {
  return (
    <div className="knocker-md3">
      <div className="knocker-frame">
        <StatusBar />

        {/* App bar */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
              4 profiles · 2 active
            </span>
            <div className="flex items-center gap-1">
              <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: "var(--md-on-surface-variant)" }}>
                <Search size={20} strokeWidth={2} />
              </button>
              <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: "var(--md-on-surface-variant)" }}>
                <MoreVertical size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
          <h1 className="text-[32px] font-normal tracking-tight mt-2 leading-tight">Knocker</h1>
        </div>

        {/* List — tap a row to knock just that one */}
        <div className="flex-1 overflow-hidden px-4 pt-2 pb-4 space-y-2">
          {profiles.map((p) => (
            <ProfileRow key={p.name} p={p} />
          ))}
        </div>

        {/* Stacked FABs: Knock all (primary) above New profile (secondary) */}
        <div style={{ position: "absolute", right: 18, bottom: 56, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
          <button
            style={{
              background: "transparent",
              color: "var(--md-on-surface-variant)",
              borderRadius: 18,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--md-outline)",
              backdropFilter: "blur(8px)",
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            New profile
          </button>
          <button
            style={{
              background: "var(--md-primary)",
              color: "var(--md-on-primary)",
              borderRadius: 22,
              padding: "18px 26px",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 0.2,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 6px 20px rgba(252,211,77,0.25), 0 4px 14px rgba(0,0,0,0.45)",
              border: "none",
            }}
          >
            <Zap size={22} strokeWidth={2.5} fill="currentColor" />
            Knock all
          </button>
        </div>

        <NavBar />
      </div>
    </div>
  );
}
