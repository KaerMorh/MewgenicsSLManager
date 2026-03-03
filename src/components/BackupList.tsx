import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import BackupItem from "./BackupItem";
import type { BackupEntry, SaveSummary } from "../types";

interface BackupListProps {
  entries: BackupEntry[];
  sortKey: string;
  sortAscending: boolean;
  onSortChange: (key: string, ascending: boolean) => void;
  onLoad: (path: string) => void;
  onCopy: (path: string) => void;
  onDelete: (path: string) => void;
  onEditNote: (path: string) => void;
}

const BackupList: React.FC<BackupListProps> = ({
  entries,
  sortKey,
  sortAscending,
  onSortChange,
  onLoad,
  onCopy,
  onDelete,
  onEditNote,
}) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<Record<string, SaveSummary>>({});

  // Parse summaries for all entries in background
  useEffect(() => {
    setSummaries({});
    setExpandedIdx(null);
    let cancelled = false;

    async function parseAll() {
      for (const entry of entries) {
        if (cancelled) break;
        try {
          const s = await invoke<SaveSummary>("parse_backup_summary", {
            path: entry.path,
          });
          if (!cancelled) {
            setSummaries((prev) => ({ ...prev, [entry.path]: s }));
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    parseAll();
    return () => { cancelled = true; };
  }, [entries]);

  // Sort entries locally with summaries
  const sorted = [...entries].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "day") {
      const dayA = summaries[a.path]?.exists ? summaries[a.path].current_day : a.day_in_name;
      const dayB = summaries[b.path]?.exists ? summaries[b.path].current_day : b.day_in_name;
      cmp = dayA - dayB;
    } else if (sortKey === "adventure") {
      const advA = summaries[a.path]?.in_adventure ? 1 : 0;
      const advB = summaries[b.path]?.in_adventure ? 1 : 0;
      cmp = advA - advB || a.backup_time.localeCompare(b.backup_time);
    } else {
      cmp = a.backup_time.localeCompare(b.backup_time);
    }
    return sortAscending ? cmp : -cmp;
  });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 32, fontWeight: 900, flex: 1 }}>
          备份目录 (Backups)
        </h2>
        <span
          style={{ color: "#64748b", fontWeight: "bold", marginRight: 16 }}
        >
          共 {entries.length} 个备份
        </span>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value, sortAscending)}
        >
          <option value="time">按时间排序</option>
          <option value="day">按天数排序</option>
          <option value="adventure">按冒险状态排序</option>
        </select>
        <select
          value={sortAscending ? "asc" : "desc"}
          onChange={(e) => onSortChange(sortKey, e.target.value === "asc")}
        >
          <option value="desc">▼ 降序</option>
          <option value="asc">▲ 升序</option>
        </select>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sorted.map((entry, idx) => (
          <BackupItem
            key={entry.path}
            entry={entry}
            isExpanded={expandedIdx === idx}
            onToggle={() =>
              setExpandedIdx(expandedIdx === idx ? null : idx)
            }
            onLoad={onLoad}
            onCopy={onCopy}
            onDelete={onDelete}
            onEditNote={onEditNote}
            summary={summaries[entry.path] ?? null}
          />
        ))}
        {entries.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#64748b",
              fontWeight: "bold",
              fontSize: 16,
              padding: 40,
            }}
          >
            暂无备份文件
          </div>
        )}
      </div>
    </div>
  );
};

export default BackupList;
