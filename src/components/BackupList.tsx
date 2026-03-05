import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";
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
  const { t } = useI18n();
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
          {t("list.title")}
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#64748b", marginLeft: 12 }}>
            {t("list.total", { count: entries.length })}
          </span>
        </h2>
        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value, sortAscending)}
        >
          <option value="time">{t("list.sortByTime")}</option>
          <option value="day">{t("list.sortByDay")}</option>
          <option value="adventure">{t("list.sortByAdventure")}</option>
        </select>
        <select
          value={sortAscending ? "asc" : "desc"}
          onChange={(e) => onSortChange(sortKey, e.target.value === "asc")}
        >
          <option value="desc">{t("list.descending")}</option>
          <option value="asc">{t("list.ascending")}</option>
        </select>
      </div>

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
            {t("list.empty")}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            flexShrink: 0,
            paddingTop: 4,
            flexWrap: "wrap",
          }}
        >
          {totalPages > 10 && (
            <button
              className="btn-small white"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={safePage < 10}
              onClick={() => { setPage(Math.max(0, safePage - 10)); setExpandedIdx(null); }}
            >
              {t("list.jumpBack10")}
            </button>
          )}
          <button
            className="btn-small white"
            style={{ padding: "6px 12px", fontSize: 13 }}
            disabled={safePage === 0}
            onClick={() => { setPage(safePage - 1); setExpandedIdx(null); }}
          >
            {t("list.prevPage")}
          </button>

          {(() => {
            const maxVisible = 10;
            let start = 0;
            let end = totalPages;
            if (totalPages > maxVisible) {
              start = Math.max(0, safePage - Math.floor(maxVisible / 2));
              end = start + maxVisible;
              if (end > totalPages) {
                end = totalPages;
                start = end - maxVisible;
              }
            }
            return Array.from({ length: end - start }, (_, idx) => {
              const i = start + idx;
              return (
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
              );
            });
          })()}

          <button
            className="btn-small white"
            style={{ padding: "6px 12px", fontSize: 13 }}
            disabled={safePage >= totalPages - 1}
            onClick={() => { setPage(safePage + 1); setExpandedIdx(null); }}
          >
            {t("list.nextPage")}
          </button>
          {totalPages > 10 && (
            <button
              className="btn-small white"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={safePage >= totalPages - 10}
              onClick={() => { setPage(Math.min(totalPages - 1, safePage + 10)); setExpandedIdx(null); }}
            >
              {t("list.jumpForward10")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BackupList;
