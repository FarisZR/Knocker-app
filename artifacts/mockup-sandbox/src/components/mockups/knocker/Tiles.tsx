import "./_group.css";
import { StatusBar } from "./_chrome";
import { DoorOpen, Wifi, Bluetooth, Plane, Flashlight, Moon, RotateCw, Volume2, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Tile {
  icon: LucideIcon;
  label: string;
  sub?: string;
  active?: boolean;
  brand?: boolean;
}

const tiles: Tile[] = [
  { icon: DoorOpen, label: "Home", sub: "Whitelisted · 23h", active: true, brand: true },
  { icon: Wifi, label: "Wi-Fi", sub: "Faris-5G", active: true },
  { icon: DoorOpen, label: "NAS", sub: "Whitelisted · 5h", active: true, brand: true },
  { icon: Bluetooth, label: "Bluetooth", active: true },
  { icon: DoorOpen, label: "Work VPN", sub: "Tap to knock", brand: true },
  { icon: Plane, label: "Airplane" },
  { icon: DoorOpen, label: "Lab", sub: "Tap to knock", brand: true },
  { icon: Flashlight, label: "Flashlight" },
];

function TileBox({ t }: { t: Tile }) {
  const bg = t.active ? (t.brand ? "var(--md-primary)" : "var(--md-on-surface)") : "var(--md-surface-3)";
  const fg = t.active ? (t.brand ? "var(--md-on-primary)" : "var(--md-bg)") : "var(--md-on-surface-variant)";
  const Icon = t.icon;
  return (
    <div
      style={{
        background: bg,
        color: fg,
        borderRadius: 28,
        padding: "14px 16px",
        height: 78,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Icon size={22} strokeWidth={2.2} fill={t.brand && t.active ? "currentColor" : "none"} fillOpacity={t.brand && t.active ? 0.15 : 0} />
      <div>
        <div className="text-[13px] font-semibold leading-tight">{t.label}</div>
        {t.sub && (
          <div className="text-[10.5px] leading-tight mt-0.5 opacity-80 truncate">
            {t.sub}
          </div>
        )}
      </div>
    </div>
  );
}

export function Tiles() {
  return (
    <div className="knocker-md3">
      <div
        className="knocker-frame"
        style={{
          background:
            "linear-gradient(180deg, rgba(40,30,5,0.65) 0%, rgba(20,20,22,0.95) 60%, var(--md-bg) 100%), radial-gradient(120% 60% at 50% -20%, rgba(252,211,77,0.25), transparent 70%)",
          backdropFilter: "blur(40px)",
        }}
      >
        <StatusBar />

        {/* Date / time */}
        <div className="px-5 pt-2 pb-1 flex items-end justify-between">
          <div>
            <div className="text-[14px] font-medium" style={{ color: "var(--md-on-surface-variant)" }}>
              Tuesday, March 4
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={14} style={{ color: "var(--md-on-surface-variant)" }} />
          </div>
        </div>

        {/* Brightness slider */}
        <div className="px-4 pt-3">
          <div
            style={{
              height: 44,
              background: "var(--md-surface-3)",
              borderRadius: 22,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, height: 8, background: "var(--md-outline)", borderRadius: 999, position: "relative" }}>
              <div style={{ width: "55%", height: "100%", background: "var(--md-on-surface)", borderRadius: 999 }} />
            </div>
          </div>
        </div>

        {/* Tile grid */}
        <div className="px-4 pt-3 grid grid-cols-2 gap-2">
          {tiles.map((t, i) => (
            <TileBox key={i} t={t} />
          ))}
        </div>

        {/* Page indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <div style={{ width: 18, height: 4, background: "var(--md-on-surface)", borderRadius: 2 }} />
          <div style={{ width: 4, height: 4, background: "var(--md-outline)", borderRadius: 2 }} />
          <div style={{ width: 4, height: 4, background: "var(--md-outline)", borderRadius: 2 }} />
        </div>

        {/* Annotation */}
        <div className="px-4 mt-4">
          <div
            style={{
              background: "rgba(252,211,77,0.08)",
              border: "1px solid rgba(252,211,77,0.25)",
              borderRadius: 16,
              padding: "12px 14px",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <DoorOpen size={14} style={{ color: "var(--md-primary)" }} />
              <div className="text-[12px] font-semibold" style={{ color: "var(--md-primary)" }}>
                Knocker tiles
              </div>
            </div>
            <div className="text-[11.5px] leading-relaxed" style={{ color: "var(--md-on-surface-variant)" }}>
              Each profile gets its own tile. Tap to knock — the tile lights up while the request is in flight, then shows the new expiry. Long-press opens the profile.
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex-1" />
        <div className="px-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 size={20} style={{ color: "var(--md-on-surface-variant)" }} />
            <RotateCw size={20} style={{ color: "var(--md-on-surface-variant)" }} />
            <Moon size={20} style={{ color: "var(--md-on-surface-variant)" }} />
          </div>
          <div className="text-[12px]" style={{ color: "var(--md-on-surface-muted)" }}>
            ⚙
          </div>
        </div>
      </div>
    </div>
  );
}
