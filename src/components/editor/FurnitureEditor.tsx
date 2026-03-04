import React, { useState, useMemo } from "react";
import { useI18n } from "../../i18n";
import type { FurnitureData, FurnitureItem, FurnitureDB } from "../../types";

interface Props {
  furniture: FurnitureData;
  furnitureDB: FurnitureDB | null;
  added: FurnitureItem[];
  removed: number[];
  onAdd: (item: FurnitureItem) => void;
  onRemove: (key: number) => void;
  onUndoAdd: (index: number) => void;
  onUndoRemove: (key: number) => void;
}

const FurnitureEditor: React.FC<Props> = ({
  furniture,
  furnitureDB,
  added,
  removed,
  onAdd,
  onRemove,
  onUndoAdd,
  onUndoRemove,
}) => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [showDB, setShowDB] = useState(false);

  const allExisting = useMemo(
    () => [...furniture.backpack, ...furniture.placed],
    [furniture]
  );

  const dbEntries = useMemo(() => {
    if (!furnitureDB) return [];
    return Object.entries(furnitureDB)
      .filter(([, entry]) => !entry.removed)
      .map(([key, entry]) => ({ ...entry, id: key }));
  }, [furnitureDB]);

  const filteredDB = useMemo(() => {
    if (!search.trim()) return dbEntries;
    const q = search.toLowerCase();
    return dbEntries.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.desc || "").toLowerCase().includes(q)
    );
  }, [dbEntries, search]);

  const nextKey = useMemo(() => {
    const keys = allExisting.map((f) => f.key);
    const addedKeys = added.map((f) => f.key);
    const allKeys = [...keys, ...addedKeys];
    return allKeys.length > 0 ? Math.max(...allKeys) + 1 : 1;
  }, [allExisting, added]);

  const isRemoved = (key: number) => removed.includes(key);

  const getDisplayName = (fid: string) => {
    if (furnitureDB && furnitureDB[fid]) {
      return furnitureDB[fid].name;
    }
    return fid;
  };

  return (
    <div>
      {/* Existing furniture */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b", marginBottom: 10 }}>
          {t("editor.furnitureBackpack")} ({furniture.backpack.length}) + {t("editor.furniturePlaced")} ({furniture.placed.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {allExisting.map((item) => {
            const markedRemoved = isRemoved(item.key);
            return (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  border: `2px solid ${markedRemoved ? "#ef4444" : "#1e293b"}`,
                  borderRadius: 8,
                  background: markedRemoved ? "#fee2e2" : item.room ? "#dbeafe" : "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  opacity: markedRemoved ? 0.5 : 1,
                  textDecoration: markedRemoved ? "line-through" : "none",
                }}
              >
                <span>{getDisplayName(item.furniture_id)}</span>
                {item.room && (
                  <span style={{ fontSize: 10, color: "#64748b" }}>({item.room})</span>
                )}
                {markedRemoved ? (
                  <button
                    onClick={() => onUndoRemove(item.key)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 900,
                      color: "#22c55e",
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    ↩
                  </button>
                ) : (
                  <button
                    onClick={() => onRemove(item.key)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 900,
                      color: "#ef4444",
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending additions */}
      {added.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#22c55e", marginBottom: 8 }}>
            + {t("editor.furnitureAdd")} ({added.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {added.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  border: "2px solid #22c55e",
                  borderRadius: 8,
                  background: "#dcfce7",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                <span>+ {getDisplayName(item.furniture_id)}</span>
                <button
                  onClick={() => onUndoAdd(idx)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 900,
                    color: "#ef4444",
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add from DB */}
      <div>
        <button
          className="btn-small blue"
          style={{ padding: "6px 16px", fontSize: 13, marginBottom: 12 }}
          onClick={() => setShowDB(!showDB)}
        >
          {showDB ? "▲ " : "▼ "}{t("editor.furnitureDB")}
        </button>

        {showDB && (
          <div>
            <input
              type="text"
              placeholder={t("editor.furnitureSearch")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: 10,
                border: "3px solid #1e293b",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <div
              style={{
                maxHeight: 300,
                overflowY: "auto",
                border: "2px solid #e2e8f0",
                borderRadius: 10,
                padding: 8,
              }}
            >
              {filteredDB.slice(0, 100).map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: 6,
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div>
                    <span style={{ fontWeight: 900, fontSize: 13 }}>{entry.name}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>
                      {entry.id}
                    </span>
                    {entry.effects && (
                      <span style={{ fontSize: 10, color: "#64748b", marginLeft: 6 }}>
                        {Object.entries(entry.effects)
                          .map(([k, v]) => `${k}: ${v > 0 ? "+" : ""}${v}`)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                  <button
                    className="btn-small blue"
                    style={{ padding: "2px 10px", fontSize: 11 }}
                    onClick={() =>
                      onAdd({
                        key: nextKey + added.length,
                        furniture_id: entry.id,
                      })
                    }
                  >
                    +
                  </button>
                </div>
              ))}
              {filteredDB.length > 100 && (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: 8 }}>
                  ... {filteredDB.length - 100} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FurnitureEditor;
