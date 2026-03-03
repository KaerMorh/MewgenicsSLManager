import React from "react";
import type { SaveSummary } from "../types";

interface SaveInfoCardProps {
  summary: SaveSummary | null;
  slot: number;
}

const SaveInfoCard: React.FC<SaveInfoCardProps> = ({ summary, slot }) => {
  const exists = summary?.exists ?? false;

  const adventureText = () => {
    if (!summary || !exists) return null;
    if (summary.in_adventure && summary.adventure_cats.length > 0) {
      const parts = summary.adventure_cats.map(
        (c) => `${c.name}(Lv${c.level}${c.cat_class ? " " + c.cat_class : ""})`
      );
      return "🗡️ 冒险队: " + parts.join(", ");
    }
    if (summary.in_adventure) return "🗡️ 状态: 冒险中";
    return "🏠 状态: 在家";
  };

  const pct = exists ? (summary?.save_percent ?? 0) : 0;

  return (
    <div
      className="card"
      style={{
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            background: "#bae6fd",
            border: "3px solid #1e293b",
            borderRadius: 12,
            fontSize: 24,
            width: 48,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ▶
        </span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            当前活跃存档 (Slot {slot})
          </div>
          <div style={{ fontSize: 14, fontWeight: "bold", color: "#64748b" }}>
            {exists
              ? `Day ${summary!.current_day} • 🐱${summary!.cat_alive} 💀${summary!.cat_dead} • 金币 ${summary!.house_gold} • 食物 ${summary!.house_food}`
              : "Day 0 • 🐱0 💀0 • 金币 0"}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span
            style={{ fontSize: 13, fontWeight: 900, color: "#64748b" }}
          >
            游戏完成度 (Progress)
          </span>
          <span
            style={{ fontSize: 13, fontWeight: 900, color: "#22c55e" }}
          >
            {pct}%
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        {adventureText() && (
          <div
            style={{
              fontSize: 13,
              fontWeight: "bold",
              color: "#1e293b",
              marginTop: 8,
            }}
          >
            {adventureText()}
          </div>
        )}
      </div>
    </div>
  );
};

export default SaveInfoCard;
