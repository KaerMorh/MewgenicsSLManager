import React, { useState } from "react";
import { useI18n } from "../i18n";
import { getMapDisplayName } from "../utils/mapNames";
import type { SaveSummary } from "../types";

interface HeroSectionProps {
  summary: SaveSummary | null;
  slot: number;
  backupCount: number;
  onBackupNow: () => void;
  onRefresh: () => Promise<void>;
  onEditSave?: () => void;
  onQuickRestart?: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  summary,
  slot,
  backupCount,
  onBackupNow,
  onRefresh,
  onEditSave,
  onQuickRestart,
}) => {
  const { t, lang } = useI18n();
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
    : t("hero.noSave");

  const showSquad = exists && summary!.in_adventure && summary!.adventure_cats.length > 0;

  return (
    <div
      className="card"
      style={{
        padding: "14px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flexShrink: 0,
      }}
    >
      {/* Row 1: action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 900 }}>
            {t("hero.currentSave", { slot })}
          </span>
          {exists && (
            <span className={`tag ${summary!.in_adventure ? "tag-adventure" : "tag-home"}`}>
              {summary!.in_adventure
                ? `${t("hero.inAdventure")}${getMapDisplayName(summary!.adventure_map, lang) ? ` - ${getMapDisplayName(summary!.adventure_map, lang)}` : ""}`
                : t("hero.atHome")}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ width: 140, flexShrink: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b" }}>{t("hero.progress")}</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#22c55e" }}>{pct}%</span>
          </div>
          <div className="progress-bar" style={{ height: 12 }}>
            <div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>

        <div
          style={{
            width: 3,
            height: 36,
            background: "#e2e8f0",
            borderRadius: 2,
            flexShrink: 0,
          }}
        />

        <div style={{ flexShrink: 0 }}>
          <MiniStat value={String(backupCount)} label={t("hero.backups")} />
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          <button
            className="btn-small blue"
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
            onClick={handleRefresh}
            disabled={refreshing}
            title={t("hero.refreshTitle")}
          >
            <span
              className={refreshing ? "spin-refresh" : ""}
              style={{ display: "inline-block", fontSize: 16 }}
            >
              🔄
            </span>
          </button>
          {onQuickRestart && (
            <button
              className="btn-small red"
              style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
              onClick={onQuickRestart}
              title={t("hero.quickRestartTitle")}
            >
              <span style={{ display: "inline-block", fontSize: 16 }}>⟳</span>
            </button>
          )}
          {exists && onEditSave && (
            <button
              className="btn-secondary"
              style={{ fontSize: 13, padding: "8px 16px", flexShrink: 0 }}
              onClick={onEditSave}
            >
              {t("editor.editSave")}
            </button>
          )}
          <button
            className="btn-primary"
            style={{ fontSize: 13, padding: "8px 16px", flexShrink: 0 }}
            onClick={onBackupNow}
          >
            {t("hero.backupNow")}
          </button>
        </div>
      </div>

      {/* Row 2: info line */}
      <div
        style={{
          marginTop: 8,
          marginLeft: 64,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: "bold", color: "#64748b" }}>
          {dayInfo}
        </div>
        {showSquad && (
          <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
            {"🗡️ "}
            {summary!.adventure_cats.map(
              (c) => `${c.name}(Lv${c.level}${c.cat_class ? " " + c.cat_class : ""})`
            ).join(", ")}
          </div>
        )}
      </div>
    </div>
  );
};

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: "bold", color: "#64748b" }}>{label}</div>
    </div>
  );
}

export default HeroSection;
