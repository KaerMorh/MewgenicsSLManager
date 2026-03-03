import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import BackupItem from "./BackupItem";
import type { BackupEntry, SaveSummary } from "../types";

const PAGE_SIZE = 4;

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
  const [page, setPage] = useState(0);

  const fetchedPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function parseAll() {
      const missingEntries = entries.filter((e) => !fetchedPaths.current.has(e.path));
      if (missingEntries.length === 0) return;

      const newSummaries: Record<string, SaveSummary> = {};

      for (const entry of missingEntries) {
        if (cancelled) break;
        fetchedPaths.current.add(entry.path);
        try {
          const s = await invoke<SaveSummary>("parse_backup_summary", {
            path: entry.path,
          });
          newSummaries[entry.path] = s;
        } catch {
          fetchedPaths.current.delete(entry.path);
        }
      }

      if (!cancelled && Object.keys(newSummaries).length > 0) {
        setSummaries((prev) => ({ ...prev, ...newSummaries }));
      }
    }

    parseAll();
    return () => { cancelled = true; };
  }, [entries]);

  useEffect(() => {
    setPage(0);
    setExpandedIdx(null);
  }, [sortKey, sortAscending]);

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

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 900, flex: 1 }}>
          备份目录
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#64748b", marginLeft: 12 }}>
            共 {entries.length} 个
          </span>
        </h2>
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

      {/* Items */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
          paddingBottom: 10,
        }}
      >
        {pageItems.map((entry, idx) => {
          const globalIdx = safePage * PAGE_SIZE + idx;
          return (
            <BackupItem
              key={entry.path}
              entry={entry}
              isExpanded={expandedIdx === globalIdx}
              onToggle={() =>
                setExpandedIdx(expandedIdx === globalIdx ? null : globalIdx)
              }
              onLoad={onLoad}
              onCopy={onCopy}
              onDelete={onDelete}
              onEditNote={onEditNote}
              summary={summaries[entry.path] ?? null}
            />
          );
        })}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            flexShrink: 0,
            paddingTop: 4,
          }}
        >
          <button
            className="btn-small white"
            style={{ padding: "6px 12px", fontSize: 13 }}
            disabled={safePage === 0}
            onClick={() => { setPage(safePage - 1); setExpandedIdx(null); }}
          >
            ◀ 上一页
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => { setPage(i); setExpandedIdx(null); }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                border: `3px solid ${i === safePage ? "#22c55e" : "#1e293b"}`,
                background: i === safePage ? "#22c55e" : "#ffffff",
                color: i === safePage ? "#ffffff" : "#1e293b",
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: i === safePage ? "none" : "2px 2px 0 #1e293b",
                transition: "all 0.1s ease",
              }}
            >
              {i + 1}
            </button>
          ))}

          <button
            className="btn-small white"
            style={{ padding: "6px 12px", fontSize: 13 }}
            disabled={safePage >= totalPages - 1}
            onClick={() => { setPage(safePage + 1); setExpandedIdx(null); }}
          >
            下一页 ▶
          </button>
        </div>
      )}
    </div>
  );
};

export default BackupList;
