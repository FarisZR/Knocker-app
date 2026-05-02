import "./_group.css";
import { StatusBar, NavBar } from "./_chrome";
import { Search, MoreVertical, Plus, CheckCircle2, Clock, AlertCircle, Globe, Zap } from "lucide-react";

type ProfileStatus = "active" | "idle" | "error";

interface Profile {
  name: string;
  host: string;
  status: ProfileStatus;
  expiresIn?: string;
  lastIp?: string;
  knockOnBoot: boolean;
  background: boolean;
  errorText?: string;
}

const profiles: Profile[] = [
  {
    name: "Home Server",
    host: "knock.home.faris.dev",
    status: "active",
    expiresIn: "23h 41m",
    lastIp: "98.142.10.41",
    knockOnBoot: true,
    background: true,
  },
  {
    name: "Work VPN",
    host: "vpn.acme.io",
    status: "idle",
    knockOnBoot: false,
    background: false,
  },
  {
    name: "NAS · Media",
    host: "nas.faris.dev",
    status: "active",
    expiresIn: "5h 12m",
    lastIp: "98.142.10.41",
    knockOnBoot: true,
    background: false,
  },
  {
    name: "Lab Cluster",
    host: "lab.internal.dev",
    status: "error",
    errorText: "401 — invalid API key",
    knockOnBoot: false,
    background: false,
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

function ProfileCard({ p }: { p: Profile }) {
  const isActive = p.status === "active";
  return (
    <div
      style={{
        background: "var(--md-surface)",
        borderRadius: 28,
        padding: "18px 18px 16px",
        border: "1px solid transparent",
      }}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="min-w-0">
          <div className="text-[17px] font-semibold tracking-tight">{p.name}</div>
          <div className="text-[12.5px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--md-on-surface-muted)" }}>
            <Globe size={12} strokeWidth={2} />
            <span className="truncate">{p.host}</span>
          </div>
        </div>
        <StatusDot s={p.status} />
      </div>

      {isActive && (
        <div className="mt-3 flex items-center gap-3 text-[12px]" style={{ color: "var(--md-on-surface-variant)" }}>
          <span className="font-medium" style={{ color: "var(--md-primary)" }}>
            {p.lastIp}
          </span>
          <span style={{ color: "var(--md-outline)" }}>•</span>
          <span>expires in {p.expiresIn}</span>
        </div>
      )}
      {p.errorText && (
        <div className="mt-3 text-[12px]" style={{ color: "var(--md-error)" }}>
          {p.errorText}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {p.knockOnBoot && <Chip>Boot</Chip>}
        {p.background && <Chip>Background</Chip>}
        <div className="flex-1" />
        <button
          style={{
            background: "var(--md-primary)",
            color: "var(--md-on-primary)",
            borderRadius: 999,
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
          }}
        >
          <Zap size={14} strokeWidth={2.5} fill="currentColor" />
          Knock
        </button>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: "var(--md-secondary-container)",
        color: "var(--md-on-surface-variant)",
        borderRadius: 8,
        padding: "3px 9px",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

export function Home() {
  return (
    <div className="knocker-md3">
      <div className="knocker-frame">
        <StatusBar />

        {/* Top app bar - MD3 large */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
              4 profiles
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

        {/* List */}
        <div className="flex-1 overflow-hidden px-4 pt-2 pb-4 space-y-2.5">
          {profiles.map((p) => (
            <ProfileCard key={p.name} p={p} />
          ))}
        </div>

        {/* Extended FAB */}
        <div style={{ position: "absolute", right: 18, bottom: 60 }}>
          <button
            style={{
              background: "var(--md-primary-container)",
              color: "var(--md-on-primary-container)",
              borderRadius: 18,
              padding: "16px 22px",
              fontSize: 14,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
              border: "none",
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
            New profile
          </button>
        </div>

        <NavBar />
      </div>
    </div>
  );
}
