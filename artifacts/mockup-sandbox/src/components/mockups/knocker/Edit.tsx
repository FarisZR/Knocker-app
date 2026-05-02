import "./_group.css";
import { StatusBar, NavBar } from "./_chrome";
import { ArrowLeft, Eye, Trash2, ChevronRight } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] px-1 pb-2 pt-1" style={{ color: "var(--md-primary)" }}>
        {title}
      </div>
      <div
        style={{
          background: "var(--md-surface)",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, hint, action, last = false }: { label: string; value?: string; hint?: string; action?: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--md-bg)",
      }}
      className="flex items-center justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
          {label}
        </div>
        {value && <div className="text-[15px] mt-0.5 truncate font-medium">{value}</div>}
        {hint && (
          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--md-on-surface-muted)" }}>
            {hint}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 52,
        height: 32,
        borderRadius: 999,
        background: on ? "var(--md-primary)" : "transparent",
        border: on ? "2px solid var(--md-primary)" : "2px solid var(--md-outline)",
        position: "relative",
        transition: "all 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: on ? 24 : 16,
          height: on ? 24 : 16,
          borderRadius: 999,
          background: on ? "var(--md-on-primary)" : "var(--md-on-surface-muted)",
          position: "absolute",
          top: "50%",
          left: on ? "auto" : 6,
          right: on ? 2 : "auto",
          transform: "translateY(-50%)",
          transition: "all 0.2s",
        }}
      />
    </div>
  );
}

function Row({ label, sub, action, last = false }: { label: string; sub?: string; action: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        padding: "13px 16px",
        borderBottom: last ? "none" : "1px solid var(--md-bg)",
      }}
      className="flex items-center justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium">{label}</div>
        {sub && (
          <div className="text-[12px] mt-0.5" style={{ color: "var(--md-on-surface-muted)" }}>
            {sub}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export function Edit() {
  return (
    <div className="knocker-md3">
      <div className="knocker-frame">
        <StatusBar />

        {/* App bar */}
        <div className="flex items-center px-2 py-2 flex-shrink-0">
          <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: "var(--md-on-surface)" }}>
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <div className="flex-1 px-1">
            <div className="text-[18px] font-medium tracking-tight">Home Server</div>
          </div>
          <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ color: "var(--md-error)" }}>
            <Trash2 size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden px-4 pt-1 pb-4 space-y-4">
          <Section title="Connection">
            <Field label="Profile name" value="Home Server" />
            <Field label="Endpoint URL" value="https://knock.home.faris.dev" />
            <Field
              label="API key"
              value="••••••••••••8f2a"
              action={
                <button className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--md-on-surface-variant)" }}>
                  <Eye size={18} strokeWidth={2} />
                </button>
              }
              last
            />
          </Section>

          <Section title="Whitelist">
            <Field label="TTL" value="86400 seconds" hint="24 hours" />
            <Row
              label="Whitelist a different IP"
              sub="Requires allow_remote_whitelist on the key"
              action={<Toggle on={false} />}
              last
            />
          </Section>

          <Section title="Triggers">
            <Row label="Knock when app opens" sub="Fire silently on launch" action={<Toggle on={true} />} />
            <Row
              label="Auto-renew before expiry"
              sub="Re-knock 5 min before TTL ends"
              action={<Toggle on={true} />}
              last
            />
          </Section>

          <Section title="Quick access">
            <Row
              label="Pin to home"
              sub="Adds a dedicated knock button above Knock all"
              action={<Toggle on={true} />}
            />
            <Row
              label="Quick Settings tile"
              sub="Tile #1 · Home"
              action={<ChevronRight size={20} style={{ color: "var(--md-on-surface-muted)" }} />}
              last
            />
          </Section>
        </div>

        <NavBar />
      </div>
    </div>
  );
}
