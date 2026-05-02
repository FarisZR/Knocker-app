import { Wifi, Signal, BatteryFull } from "lucide-react";

export function StatusBar({ time = "9:41" }: { time?: string }) {
  return (
    <div className="statusbar">
      <span>{time}</span>
      <div className="icons">
        <Signal size={14} strokeWidth={2.5} />
        <Wifi size={14} strokeWidth={2.5} />
        <BatteryFull size={16} strokeWidth={2.5} />
      </div>
    </div>
  );
}

export function NavBar() {
  return (
    <div className="navbar-spacer flex items-center justify-center">
      <div style={{ width: 108, height: 4, borderRadius: 2, background: "#5a5a5d" }} />
    </div>
  );
}
