import React, { useMemo, useRef, useEffect } from "react";
import { useI18n } from "../../i18n";
import type { CatDetail, CatChanges } from "../../types";

export interface CatListState {
  search: string;
  adventureOnly: boolean;
  classFilter: string;
  scrollTop: number;
}

interface Props {
  cats: CatDetail[];
  catEdits: Record<string, CatChanges>;
  getCatWithEdits: (cat: CatDetail) => CatDetail;
  onSelectCat: (index: number) => void;
  listState: CatListState;
  onListStateChange: (state: CatListState) => void;
}

function isEffectivelyDead(cat: CatDetail): boolean {
  return cat.dead || cat.level === 0;
}

function catSortPriority(cat: CatDetail): number {
  if (cat.room === "(ADVENTURE)") return 0;
  if (isEffectivelyDead(cat)) return 2;
  return 1;
}

const CatListEditor: React.FC<Props> = ({
  cats,
  catEdits,
  getCatWithEdits,
  onSelectCat,
  listState,
  onListStateChange,
}) => {
  const { t } = useI18n();
  const edited = (key: number) => !!catEdits[String(key)];
  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore scroll position on mount
  useEffect(() => {
    if (scrollRef.current && listState.scrollTop > 0) {
      scrollRef.current.scrollTop = listState.scrollTop;
    }
  }, []);

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    for (const cat of cats) {
      const c = getCatWithEdits(cat);
      if (c.cat_class) classes.add(c.cat_class);
    }
    return Array.from(classes).sort();
  }, [cats, getCatWithEdits]);

  const sortedAndFiltered = useMemo(() => {
    let result = cats.map((cat, originalIndex) => ({ cat, originalIndex }));

    // Sort: adventure > normal > dead
    result.sort((a, b) => {
      const ca = getCatWithEdits(a.cat);
      const cb = getCatWithEdits(b.cat);
      return catSortPriority(ca) - catSortPriority(cb);
    });

    // Filter: adventure only
    if (listState.adventureOnly) {
      result = result.filter(({ cat }) => cat.room === "(ADVENTURE)");
    }

    // Filter: class
    if (listState.classFilter) {
      result = result.filter(({ cat }) => {
        const c = getCatWithEdits(cat);
        return c.cat_class === listState.classFilter;
      });
    }

    // Filter: search by name
    if (listState.search.trim()) {
      const q = listState.search.toLowerCase();
      result = result.filter(({ cat }) => {
        const c = getCatWithEdits(cat);
        return c.name.toLowerCase().includes(q);
      });
    }

    return result;
  }, [cats, listState.search, listState.adventureOnly, listState.classFilter, getCatWithEdits]);

  const handleSelectCat = (originalIndex: number) => {
    if (scrollRef.current) {
      onListStateChange({ ...listState, scrollTop: scrollRef.current.scrollTop });
    }
    onSelectCat(originalIndex);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header with count */}
      <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b", marginBottom: 12 }}>
        {t("editor.catList")} — {t("editor.catCount", { count: String(cats.length) })}
      </div>

      {/* Search & filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input
          type="text"
          value={listState.search}
          onChange={(e) => onListStateChange({ ...listState, search: e.target.value })}
          placeholder={t("editor.searchCat")}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontWeight: 800,
            fontSize: 13,
            border: "3px solid #1e293b",
            borderRadius: 10,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            padding: "8px 12px",
            background: listState.adventureOnly ? "#dbeafe" : "#f1f5f9",
            border: `3px solid ${listState.adventureOnly ? "#3b82f6" : "#cbd5e1"}`,
            borderRadius: 10,
            fontWeight: 900,
            fontSize: 12,
            whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}
        >
          <input
            type="checkbox"
            checked={listState.adventureOnly}
            onChange={(e) => onListStateChange({ ...listState, adventureOnly: e.target.checked })}
            style={{ width: 14, height: 14, accentColor: "#3b82f6" }}
          />
          ⚔️ {t("editor.onlyAdventure")}
        </label>
        <select
          value={listState.classFilter}
          onChange={(e) => onListStateChange({ ...listState, classFilter: e.target.value })}
          style={{
            padding: "8px 12px",
            background: listState.classFilter ? "#dbeafe" : "#f1f5f9",
            border: `3px solid ${listState.classFilter ? "#3b82f6" : "#cbd5e1"}`,
            borderRadius: 10,
            fontWeight: 900,
            fontSize: 12,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <option value="">{t("editor.allClasses")}</option>
          {availableClasses.map((cls) => (
            <option key={cls} value={cls}>{cls}</option>
          ))}
        </select>
      </div>

      {/* Cat list */}
      <div
        ref={scrollRef}
        style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1 }}
      >
        {sortedAndFiltered.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontWeight: 800, fontSize: 14 }}>
            {t("editor.noResults")}
          </div>
        )}
        {sortedAndFiltered.map(({ cat, originalIndex }) => {
          const c = getCatWithEdits(cat);
          const isEdited = edited(cat.key);
          const isAdventure = cat.room === "(ADVENTURE)";

          return (
            <div
              key={cat.key}
              onClick={() => handleSelectCat(originalIndex)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 16px",
                background: isAdventure
                  ? "#eff6ff"
                  : isEdited
                    ? "#fef9c3"
                    : "#fff",
                border: `3px solid ${
                  isAdventure ? "#3b82f6" : isEdited ? "#eab308" : "#1e293b"
                }`,
                borderRadius: 14,
                boxShadow: isAdventure
                  ? "3px 3px 0 #3b82f6"
                  : "3px 3px 0 #1e293b",
                cursor: "pointer",
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translate(-1px,-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              <span style={{ fontSize: 24 }}>
                {isEffectivelyDead(c) ? "💀" : isAdventure ? "⚔️" : c.retired ? "🏖️" : "🐱"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                  {c.name || `Cat #${cat.key}`}
                  {isAdventure && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        background: "#3b82f6",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: 6,
                      }}
                    >
                      {t("editor.adventureTag")}
                    </span>
                  )}
                  {isEdited && (
                    <span style={{ color: "#eab308", fontSize: 12 }}>*</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: "bold" }}>
                  {c.cat_class || "?"} · Lv{c.level} · {c.sex} · Age {c.age}
                  {c.room && c.room !== "(ADVENTURE)" ? ` · ${c.room}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {["STR", "DEX", "CON", "INT", "SPD", "CHA", "LCK"].map((s, si) => {
                  const vals = [c.stats.STR, c.stats.DEX, c.stats.CON, c.stats.INT, c.stats.SPD, c.stats.CHA, c.stats.LUCK];
                  return (
                    <div
                      key={s}
                      style={{
                        textAlign: "center",
                        background: "#f1f5f9",
                        borderRadius: 6,
                        padding: "2px 4px",
                        minWidth: 28,
                      }}
                    >
                      <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8" }}>{s}</div>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{vals[si]}</div>
                    </div>
                  );
                })}
              </div>
              <span style={{ color: "#94a3b8", fontWeight: 900, fontSize: 18 }}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CatListEditor;
