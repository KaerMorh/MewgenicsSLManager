import React, { useState } from "react";
import type { SaveSummary } from "../types";

interface HeroSectionProps {
  summary: SaveSummary | null;
  slot: number;
  backupCount: number;
  onBackupNow: () => void;
  onRefresh: () => Promise<void>;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  summary,
  slot,
  backupCount,
  onBackupNow,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };
  const exists = summary?.exists ?? false;
  const pct = exists ? (summary?.save_percent ?? 0) : 0;

  const dayInfo = exists
    ? `Day ${summary!.current_day} · 🐱${summary!.cat_alive} 💀${summary!.cat_dead} · 💰${summary!.house_gold} · 🍖${summary!.house_food}`
    : "未检测到存档";

  const adventureText = () => {
    if (!summary || !exists) return null;
    if (summary.in_adventure && summary.adventure_cats.length > 0) {
      const parts = summary.adventure_cats.map(
        (c) => `${c.name}(Lv${c.level}${c.cat_class ? " " + c.cat_class : ""})`
      );
      return "🗡️ " + parts.join(", ");
    }
    if (summary.in_adventure) return "🗡️ 冒险中";
    return "🏠 在家休息";
  };

  return (
    <div
      className="card"
      style={{
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        gap: 28,
        flexShrink: 0,
      }}
    >
      {/* Save icon */}
      <span
        style={{
          background: "#bae6fd",
          border: "3px solid #1e293b",
          borderRadius: 12,
          fontSize: 22,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ▶
      </span>

      {/* Save info */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 900 }}>
            当前存档 (Slot {slot})
          </span>
          {exists && adventureText() && (
            <span
              className={`tag ${summary!.in_adventure ? "tag-adventure" : "tag-home"}`}
            >
              {adventureText()}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: "bold", color: "#64748b" }}>
          {dayInfo}
        </div>
      </div>

      {/* Progress */}
      <div style={{ width: 160, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>完成度</span>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#22c55e" }}>{pct}%</span>
        </div>
        <div className="progress-bar" style={{ height: 14 }}>
          <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 3,
          alignSelf: "stretch",
          background: "#e2e8f0",
          borderRadius: 2,
          flexShrink: 0,
        }}
      />

      {/* Stats */}
      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        <MiniStat value={String(backupCount)} label="备份" />
        <MiniStat value={`${pct}%`} label="完成度" />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
        <button
          className="btn-small blue"
          style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          onClick={handleRefresh}
          disabled={refreshing}
          title="刷新当前存档信息"
        >
          <span
            className={refreshing ? "spin-refresh" : ""}
            style={{ display: "inline-block", fontSize: 18 }}
          >
            🔄
          </span>
        </button>
        <button
          className="btn-primary"
          style={{ fontSize: 14, padding: "10px 20px", flexShrink: 0 }}
          onClick={onBackupNow}
        >
          立即备份 →
        </button>
      </div>
    </div>
  );
};

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: "bold", color: "#64748b" }}>{label}</div>
    </div>
  );
}

export default HeroSection;
