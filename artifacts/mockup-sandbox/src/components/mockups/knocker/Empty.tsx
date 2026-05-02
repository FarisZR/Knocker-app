import "./_group.css";
import { StatusBar, NavBar } from "./_chrome";
import { Plus, DoorOpen } from "lucide-react";

export function Empty() {
  return (
    <div className="knocker-md3">
      <div className="knocker-frame">
        <StatusBar />

        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <h1 className="text-[32px] font-normal tracking-tight mt-2 leading-tight">Knocker</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 -mt-12">
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 32,
              background: "var(--md-primary-container)",
              color: "var(--md-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 28,
            }}
          >
            <DoorOpen size={48} strokeWidth={1.5} />
          </div>
          <h2 className="text-[24px] font-medium tracking-tight text-center mb-3">No profiles yet</h2>
          <p className="text-[14.5px] text-center leading-relaxed" style={{ color: "var(--md-on-surface-muted)" }}>
            Add a Knocker endpoint to start whitelisting your IP. Each profile can have its own Quick Settings tile.
          </p>

          <button
            style={{
              marginTop: 32,
              background: "var(--md-primary)",
              color: "var(--md-on-primary)",
              borderRadius: 999,
              padding: "14px 28px",
              fontSize: 14.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "none",
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
            Create first profile
          </button>

          <button
            style={{
              marginTop: 14,
              background: "transparent",
              color: "var(--md-on-surface-variant)",
              padding: "10px 18px",
              fontSize: 13.5,
              fontWeight: 500,
              border: "none",
            }}
          >
            Import from QR code
          </button>
        </div>

        <NavBar />
      </div>
    </div>
  );
}
