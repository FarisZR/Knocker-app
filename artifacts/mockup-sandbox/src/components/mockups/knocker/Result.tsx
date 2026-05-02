import "./_group.css";
import { StatusBar, NavBar } from "./_chrome";
import { Search, MoreVertical, Plus, CheckCircle2, Globe, Zap, AlertCircle, Clock, Pin } from "lucide-react";

/**
 * Shows the same Home screen with the result snackbar popped up over it
 * after a Knock-all action. The result is a brief popup, never a full page —
 * the app stays on the list so the user can immediately back out.
 */
export function Result() {
  return (
    <div className="knocker-md3">
      <div className="knocker-frame">
        <StatusBar />

        {/* App bar */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium" style={{ color: "var(--md-on-surface-muted)" }}>
              4 profiles · 4 active
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

        {/* List (dimmed slightly under the snackbar) */}
        <div className="flex-1 overflow-hidden px-4 pt-2 pb-4 space-y-2">
          {[
            { n: "Home Server", h: "knock.home.faris.dev", t: "24h 00m", just: true, pinned: true },
            { n: "Work VPN",    h: "vpn.acme.io",          t: "1h 00m",  just: true },
            { n: "NAS · Media", h: "nas.faris.dev",        t: "24h 00m", just: true },
            { n: "Lab Cluster", h: "lab.internal.dev",     err: "401 — invalid API key" },
          ].map((p) => (
            <div key={p.n} style={{ background: "var(--md-surface)", borderRadius: 24, padding: "14px 14px 14px 18px" }}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-semibold tracking-tight truncate flex items-center gap-2">
                    {p.n}
                    {p.pinned && <span style={{ color: "var(--md-primary)" }}><Pin size={11} strokeWidth={2.5} fill="currentColor" /></span>}
                    {p.just && (
                      <span style={{ background: "var(--md-primary-container)", color: "var(--md-primary)", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>
                        JUST NOW
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--md-on-surface-muted)" }}>
                    <Globe size={10} strokeWidth={2} />
                    <span className="truncate">{p.h}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11.5px]">
                    {p.err ? (
                      <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--md-error)" }}>
                        <AlertCircle size={14} strokeWidth={2.5} />
                        {p.err}
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: "var(--md-success)" }}>
                          <CheckCircle2 size={14} strokeWidth={2.5} />
                          Whitelisted
                        </span>
                        <span style={{ color: "var(--md-outline)" }}>·</span>
                        <span style={{ color: "var(--md-on-surface-variant)" }}>{p.t}</span>
                      </>
                    )}
                  </div>
                </div>
                <button aria-label={`Knock ${p.n}`} style={{ background: "var(--md-primary)", color: "var(--md-on-primary)", borderRadius: 999, width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", flexShrink: 0 }}>
                  <Zap size={20} strokeWidth={2.5} fill="currentColor" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Stacked FABs */}
        <div style={{ position: "absolute", right: 18, bottom: 56, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
          <button style={{ background: "transparent", color: "var(--md-on-surface-variant)", borderRadius: 18, padding: "10px 16px", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--md-outline)" }}>
            <Plus size={16} strokeWidth={2.5} />
            New profile
          </button>
          <button style={{ background: "var(--md-primary-container)", color: "var(--md-on-primary-container)", borderRadius: 18, padding: "13px 18px", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, border: "none", boxShadow: "0 4px 14px rgba(0,0,0,0.4)" }}>
            <Pin size={13} strokeWidth={2.5} fill="currentColor" />
            <Zap size={16} strokeWidth={2.5} fill="currentColor" />
            Knock Home Server
          </button>
          <button style={{ background: "var(--md-primary)", color: "var(--md-on-primary)", borderRadius: 22, padding: "18px 26px", fontSize: 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 10, boxShadow: "0 6px 20px rgba(252,211,77,0.25), 0 4px 14px rgba(0,0,0,0.45)", border: "none" }}>
            <Zap size={22} strokeWidth={2.5} fill="currentColor" />
            Knock all
          </button>
        </div>

        {/* Snackbar — the entire "result" is just this. */}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 170 }}>
          <div
            style={{
              background: "var(--md-on-surface)",
              color: "var(--md-bg)",
              borderRadius: 16,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
            }}
          >
            <CheckCircle2 size={18} strokeWidth={2.5} style={{ color: "#15803d" }} />
            <div className="flex-1 text-[13.5px] font-medium leading-tight">
              Knocked 3 profiles
              <div className="text-[11.5px] font-normal mt-0.5 opacity-70">1 failed · Lab Cluster</div>
            </div>
            <button style={{ background: "transparent", color: "var(--md-primary)", fontSize: 12.5, fontWeight: 700, padding: "4px 8px", border: "none", letterSpacing: 0.5 }}>
              RETRY
            </button>
          </div>
        </div>

        {/* Hint label */}
        <div style={{ position: "absolute", left: 16, bottom: 240 }}>
          <span style={{ background: "rgba(252,211,77,0.12)", color: "var(--md-primary)", border: "1px dashed rgba(252,211,77,0.4)", borderRadius: 8, padding: "3px 8px", fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4 }}>
            ↓ result is just a snackbar
          </span>
        </div>

        {/* Suppress unused import warning */}
        <div style={{ display: "none" }}><Clock size={1} /></div>

        <NavBar />
      </div>
    </div>
  );
}
