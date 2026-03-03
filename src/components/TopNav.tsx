import React from "react";

interface TopNavProps {
  currentSlot: number;
  onSlotChange: (slot: number) => void;
  onSettingsClick: () => void;
  onGameBackupClick: () => void;
}

const TopNav: React.FC<TopNavProps> = ({
  currentSlot,
  onSlotChange,
  onSettingsClick,
  onGameBackupClick,
}) => {
  return (
    <div style={{ padding: "0 0 0 0" }}>
      <div
        style={{
          background: "#ffffff",
          border: "4px solid #1e293b",
          borderRadius: "24px",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          boxShadow: "6px 6px 0 #1e293b",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "#fca5a5",
              border: "3px solid #1e293b",
              borderRadius: 12,
              padding: "4px 8px",
              fontSize: 20,
            }}
          >
            🐱
          </span>
          <span style={{ fontWeight: 900, fontSize: 24, marginLeft: 4 }}>
            MeowLoader
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Slot tabs */}
        <div style={{ display: "flex", gap: 16 }}>
          {[1, 2, 3].map((slot) => (
            <button
              key={slot}
              onClick={() => onSlotChange(slot)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  currentSlot === slot
                    ? "4px solid #22c55e"
                    : "4px solid transparent",
                color: currentSlot === slot ? "#1e293b" : "#64748b",
                fontSize: 16,
                fontWeight: 900,
                padding: "8px 16px",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              槽位 {slot}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <button className="btn-nav" onClick={onSettingsClick}>
            设置 (Settings)
          </button>
          <button className="btn-nav-primary" onClick={onGameBackupClick}>
            游戏备份
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopNav;
