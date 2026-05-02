import "./_group.css";
import { StatusBar, NavBar } from "./_chrome";
import { DoorOpen, CheckCircle2, Zap } from "lucide-react";

export function Result() {
  return (
    <div className="knocker-md3">
      <div className="knocker-frame">
        <StatusBar />

        {/* App opens, immediately knocks for active profile */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="text-[14px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
            Auto-knocked on launch
          </div>
          <h1 className="text-[32px] font-normal tracking-tight mt-2 leading-tight">Knocker</h1>
        </div>

        {/* Hero status card — large, central, MD3 expressive */}
        <div className="px-4 pt-4">
          <div
            style={{
              background: "var(--md-primary-container)",
              borderRadius: 32,
              padding: "26px 22px 22px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: -40,
                top: -40,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "rgba(252,211,77,0.12)",
              }}
            />
            <div className="flex items-start gap-3 relative">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: "var(--md-primary)",
                  color: "var(--md-on-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <DoorOpen size={26} strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--md-primary)" }}>
                  Home Server
                </div>
                <div className="text-[22px] font-medium tracking-tight mt-1 leading-tight" style={{ color: "var(--md-on-surface)" }}>
                  IP whitelisted
                </div>
                <div className="text-[13px] mt-2" style={{ color: "var(--md-on-surface-variant)" }}>
                  knock.home.faris.dev
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 relative">
              <div>
                <div className="text-[11px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
                  Whitelisted IP
                </div>
                <div className="text-[15px] font-semibold mt-0.5 font-mono" style={{ color: "var(--md-primary)" }}>
                  98.142.10.41
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
                  Expires in
                </div>
                <div className="text-[15px] font-semibold mt-0.5" style={{ color: "var(--md-on-surface)" }}>
                  23h 59m 58s
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2 relative">
              <button
                style={{
                  flex: 1,
                  background: "var(--md-primary)",
                  color: "var(--md-on-primary)",
                  borderRadius: 999,
                  padding: "11px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Zap size={14} strokeWidth={2.5} fill="currentColor" />
                Knock again
              </button>
              <button
                style={{
                  background: "transparent",
                  color: "var(--md-on-primary-container)",
                  borderRadius: 999,
                  padding: "11px 18px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  border: "1px solid var(--md-outline)",
                }}
              >
                Switch profile
              </button>
            </div>
          </div>
        </div>

        {/* Activity timeline */}
        <div className="px-5 pt-6 pb-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: "var(--md-on-surface-muted)" }}>
            Recent activity
          </div>
          <div className="space-y-3">
            {[
              { t: "Just now", d: "Auto-knock on launch", ok: true },
              { t: "30 min ago", d: "Background re-knock", ok: true },
              { t: "1 h ago", d: "Background re-knock", ok: true },
              { t: "Today, 09:14", d: "Quick Settings tile", ok: true },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 size={16} strokeWidth={2.5} style={{ color: "var(--md-success)" }} />
                <div className="flex-1 text-[13.5px]">{r.d}</div>
                <div className="text-[12px]" style={{ color: "var(--md-on-surface-muted)" }}>
                  {r.t}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {/* Snackbar */}
        <div className="px-4 pb-4">
          <div
            style={{
              background: "var(--md-on-surface)",
              color: "var(--md-bg)",
              borderRadius: 14,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 6px 22px rgba(0,0,0,0.5)",
            }}
          >
            <CheckCircle2 size={18} strokeWidth={2.5} />
            <div className="flex-1 text-[13.5px] font-medium">Knocked · expires in 24h</div>
            <button
              style={{
                background: "transparent",
                color: "var(--md-primary)",
                fontSize: 13,
                fontWeight: 600,
                padding: "4px 10px",
                border: "none",
              }}
            >
              UNDO
            </button>
          </div>
        </div>

        <NavBar />
      </div>
    </div>
  );
}
