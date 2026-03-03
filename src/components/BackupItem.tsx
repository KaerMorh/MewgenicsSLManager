import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";
import type { BackupEntry, SaveSummary, CatSummary } from "../types";

interface BackupItemProps {
  entry: BackupEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onLoad: (path: string) => void;
  onCopy: (path: string) => void;
  onDelete: (path: string) => void;
  onEditNote: (path: string) => void;
  summary: SaveSummary | null;
}

const CAT_CLASS_COLORS: Record<string, [string, string]> = {
  Fighter: ["#fef2f2", "#fca5a5"],
  Mage: ["#eff6ff", "#93c5fd"],
  Hunter: ["#f0fdf4", "#86efac"],
  Thief: ["#fefce8", "#fde047"],
  Tank: ["#faf5ff", "#d8b4fe"],
  Medic: ["#fdf2f8", "#f9a8d4"],
  Monk: ["#fff7ed", "#fdba74"],
  Butcher: ["#fef2f2", "#fca5a5"],
  Druid: ["#f0fdf4", "#86efac"],
  Tinkerer: ["#f0f9ff", "#7dd3fc"],
  Necromancer: ["#faf5ff", "#c084fc"],
  Psychic: ["#fdf4ff", "#e879f9"],
  Jester: ["#fffbeb", "#fcd34d"],
};

function CatCard({ cat }: { cat: CatSummary }) {
  const [bg, border] = CAT_CLASS_COLORS[cat.cat_class] ?? ["#f8fafc", "#cbd5e1"];
  return (
    <span
      style={{
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 10,
        padding: "6px 12px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
      }}
    >
      <b>{cat.name}</b>
      <span style={{ color: "#64748b", fontWeight: "bold", fontSize: 11 }}>
        Lv.{cat.level} {cat.cat_class || "Colorless"}
      </span>
      {cat.dead && <span>💀</span>}
    </span>
  );
}

const BackupItem: React.FC<BackupItemProps> = ({
  entry,
  isExpanded,
  onToggle,
  onLoad,
  onCopy,
  onDelete,
  onEditNote,
  summary,
}) => {
  const { t } = useI18n();
  const [detailSummary, setDetailSummary] = useState<SaveSummary | null>(null);

  useEffect(() => {
    if (isExpanded && !detailSummary) {
      invoke<SaveSummary>("parse_backup_summary", { path: entry.path }).then(
        setDetailSummary
      );
    }
  }, [isExpanded, entry.path, detailSummary]);

  const s = summary;
  const ds = detailSummary;
  const timeStr = formatTime(entry.backup_time);

  const statusTag = () => {
    if (!s || !s.exists) return <span className="tag tag-home">{t("item.parsing")}</span>;
    return s.in_adventure ? (
      <span className="tag tag-adventure">{t("item.inAdventure")}</span>
    ) : (
      <span className="tag tag-home">{t("item.atHome")}</span>
    );
  };

  const dayText = s?.exists ? `Day ${s.current_day}` : `Day ${entry.day_in_name || "?"}`;
  const catText = s?.exists ? `🐱${s.cat_alive} 💀${s.cat_dead}` : "🐱? 💀?";

  const squadText = () => {
    if (!s || !s.exists) return "";
    if (s.adventure_cats.length > 0) {
      const parts = s.adventure_cats.map(
        (c) => `${c.name}(Lv${c.level}${c.cat_class ? " " + c.cat_class : ""})`
      );
      return t("item.squad") + parts.join(", ");
    }
    if (s.in_adventure) return t("item.adventureNoInfo");
    return t("item.allHome");
  };

  return (
    <div
      style={{
        background: isExpanded ? "#fafbff" : "#ffffff",
        border: `4px solid ${isExpanded ? "#3b82f6" : "#1e293b"}`,
        borderRadius: 24,
        boxShadow: "8px 8px 0 #1e293b",
        cursor: "pointer",
        transition: "all 0.15s",
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
          <span
            style={{
              background: "#fdfbf7",
              border: "3px solid #1e293b",
              borderRadius: 12,
              fontSize: 24,
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            💾
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{timeStr}</span>
              {entry.is_copy && (
                <span
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "2px solid #f59e0b",
                    borderRadius: 8,
                    padding: "2px 8px",
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {t("item.copy")}
                </span>
              )}
              {statusTag()}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                fontSize: 13,
                fontWeight: "bold",
                color: "#64748b",
              }}
            >
              <span>🏠 {dayText}</span>
              <span>{catText}</span>
              {entry.note && (
                <span className="tag-note" title={entry.note}>
                  📌 {entry.note.length > 20 ? entry.note.slice(0, 18) + "…" : entry.note}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            borderLeft: "3px solid #e2e8f0",
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900 }}>{squadText()}</div>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "#64748b" }}>
            {t("item.filename", { filename: entry.filename })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8" }}>
            {isExpanded ? "▲" : "▼"}
          </span>
          <div
            style={{ display: "flex", gap: 12 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="btn-small white"
              title={t("item.noteBtn")}
              onClick={() => onEditNote(entry.path)}
            >
              📝
            </button>
            <button
              className="btn-small blue"
              title={t("item.loadBtn")}
              onClick={() => onLoad(entry.path)}
            >
              ⬇️
            </button>
            <button
              className="btn-small white"
              title={t("item.copyBtn")}
              onClick={() => onCopy(entry.path)}
            >
              📋
            </button>
            <button
              className="btn-small red"
              title={t("item.deleteBtn")}
              onClick={() => onDelete(entry.path)}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div>
          <div style={{ height: 3, background: "#e2e8f0", margin: "0 8px" }} />
          <div style={{ padding: "20px 24px 8px 24px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "10px 32px",
                marginBottom: 16,
              }}
            >
              <StatCell icon="🏠" label={t("item.daysSurvived")} value={ds?.exists ? String(ds.current_day) : "—"} />
              <StatCell icon="💰" label={t("item.gold")} value={ds?.exists ? ds.house_gold.toLocaleString() : "—"} />
              <StatCell icon="🍖" label={t("item.food")} value={ds?.exists ? ds.house_food.toLocaleString() : "—"} />
              <StatCell icon="🐱" label={t("item.aliveCats")} value={ds?.exists ? String(ds.cat_alive) : "—"} />
              <StatCell icon="💀" label={t("item.deadCats")} value={ds?.exists ? String(ds.cat_dead) : "—"} />
              <StatCell icon="📈" label={t("item.progress")} value={ds?.exists ? `${ds.save_percent}%` : "—"} />
              <StatCell
                icon="📍"
                label={t("item.currentStatus")}
                value={ds?.exists ? (ds.in_adventure ? t("item.statusAdventure") : t("item.statusHome")) : "—"}
                color={ds?.exists ? (ds.in_adventure ? "#ef4444" : "#22c55e") : undefined}
              />
            </div>

            {ds?.exists && ds.adventure_cats.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: "#64748b",
                    marginBottom: 8,
                  }}
                >
                  {t("item.squadTitle")}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {ds.adventure_cats.map((cat, i) => (
                    <CatCard key={i} cat={cat} />
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: "#cbd5e1",
              }}
            >
              📂 {entry.filename}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StatCell({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: "bold", color: "#94a3b8" }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: color ?? "#1e293b" }}>
        {value}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

export default BackupItem;
