import React from "react";
import { useI18n } from "../i18n";
import { getMapDisplayName } from "../utils/mapNames";
import type { SaveSummary } from "../types";

interface SaveInfoCardProps {
  summary: SaveSummary | null;
  slot: number;
}

const SaveInfoCard: React.FC<SaveInfoCardProps> = ({ summary, slot }) => {
  const { t, lang } = useI18n();
  const exists = summary?.exists ?? false;

  const adventureText = () => {
    if (!summary || !exists) return null;
    const mapName = getMapDisplayName(summary.adventure_map, lang);
    if (summary.in_adventure && summary.adventure_cats.length > 0) {
      const parts = summary.adventure_cats.map(
        (c) => `${c.name}(Lv${c.level}${c.cat_class ? " " + c.cat_class : ""})`
      );
      const prefix = mapName
        ? `🗡️ ${mapName} | `
        : t("save.squadPrefix");
      return prefix + parts.join(", ");
    }
    if (summary.in_adventure) {
      return mapName
        ? `🗡️ ${t("save.statusAdventure")} - ${mapName}`
        : t("save.statusAdventure");
    }
    return t("save.statusHome");
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
            {t("save.currentActive", { slot })}
          </div>
          <div style={{ fontSize: 14, fontWeight: "bold", color: "#64748b" }}>
            {exists
              ? `Day ${summary!.current_day} • 🐱${summary!.cat_alive} 💀${summary!.cat_dead} • ${t("save.gold")} ${summary!.house_gold} • ${t("save.food")} ${summary!.house_food}`
              : `Day 0 • 🐱0 💀0 • ${t("save.gold")} 0`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span
            style={{ fontSize: 13, fontWeight: 900, color: "#64748b" }}
          >
            {t("save.gameProgress")}
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
