import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useI18n } from "../../i18n";
import BasicDataEditor from "./BasicDataEditor";
import CatListEditor from "./CatListEditor";
import type { CatListState } from "./CatListEditor";
import CatDetailEditor from "./CatDetailEditor";
import FurnitureEditor from "./FurnitureEditor";
import type {
  SaveDetail,
  SaveChanges,
  CatDetail,
  CatChanges,
  BasicData,
  FurnitureItem,
  AbilityDB,
  MutationDB,
  FurnitureDB,
} from "../../types";

interface Props {
  savePath: string;
  onClose: () => void;
  onSaved: () => void;
}

type Tab = "basic" | "cats" | "furniture";

const SaveEditorDialog: React.FC<Props> = ({ savePath, onClose, onSaved }) => {
  const { t } = useI18n();
  const [detail, setDetail] = useState<SaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("basic");
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [catListState, setCatListState] = useState<CatListState>({
    search: "",
    adventureOnly: false,
    classFilter: "",
    scrollTop: 0,
  });

  // Edited state
  const [basicEdits, setBasicEdits] = useState<Partial<BasicData>>({});
  const [catEdits, setCatEdits] = useState<Record<string, CatChanges>>({});
  const [furnitureAdded, setFurnitureAdded] = useState<FurnitureItem[]>([]);
  const [furnitureRemoved, setFurnitureRemoved] = useState<number[]>([]);

  // Data DBs
  const [abilityDB, setAbilityDB] = useState<AbilityDB | null>(null);
  const [mutationDB, setMutationDB] = useState<MutationDB | null>(null);
  const [furnitureDB, setFurnitureDB] = useState<FurnitureDB | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, adb, mdb, fdb] = await Promise.all([
        invoke<SaveDetail>("get_save_detail", { path: savePath }),
        invoke<AbilityDB>("get_ability_db"),
        invoke<MutationDB>("get_mutation_db"),
        invoke<FurnitureDB>("get_furniture_db"),
      ]);
      setDetail(d);
      setAbilityDB(adb);
      setMutationDB(mdb);
      setFurnitureDB(fdb);
    } catch (e) {
      toast.error(t("toast.editorLoadFail"), { description: String(e) });
    }
    setLoading(false);
  }, [savePath, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const changes: SaveChanges = {
        basic:
          Object.keys(basicEdits).length > 0
            ? {
                current_day: basicEdits.current_day,
                house_gold: basicEdits.house_gold,
                house_food: basicEdits.house_food,
                save_percent: basicEdits.save_percent,
              }
            : undefined,
        cats: catEdits,
        furniture:
          furnitureAdded.length > 0 || furnitureRemoved.length > 0
            ? { added: furnitureAdded, removed: furnitureRemoved }
            : undefined,
      };
      await invoke("modify_save", { path: savePath, changes });
      toast.success(t("toast.editorSaveSuccess"));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(t("toast.editorSaveFail"), { description: String(e) });
    }
    setSaving(false);
  };

  const getCatWithEdits = (cat: CatDetail): CatDetail => {
    const edits = catEdits[String(cat.key)];
    if (!edits) return cat;
    return {
      ...cat,
      name: edits.name ?? cat.name,
      sex: edits.sex ?? cat.sex,
      age: edits.age ?? cat.age,
      level: edits.level ?? cat.level,
      retired: edits.retired ?? cat.retired,
      stats: edits.stats ?? cat.stats,
      abilities: edits.abilities ?? cat.abilities,
      mutations: edits.mutations ?? cat.mutations,
    };
  };

  const updateCatEdit = (key: number, changes: Partial<CatChanges>) => {
    const cat = detail?.cats.find((c) => c.key === key);
    if (!cat) return;
    setCatEdits((prev) => ({
      ...prev,
      [String(key)]: {
        ...prev[String(key)],
        ...changes,
        _name_end: cat._name_end,
        _name_len: cat._name_len,
        _level_offset: cat._level_offset,
        _birth_day_offset: cat._birth_day_offset,
        _stats_offset: cat._stats_offset,
        _birth_day: cat._birth_day,
        _current_day: cat._current_day,
      },
    }));
  };

  const hasChanges =
    Object.keys(basicEdits).length > 0 ||
    Object.keys(catEdits).length > 0 ||
    furnitureAdded.length > 0 ||
    furnitureRemoved.length > 0;

  if (loading) {
    return (
      <div className="dialog-overlay" onClick={onClose}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{t("editor.loading")}</div>
        </div>
      </div>
    );
  }

  if (!detail || detail.error) {
    return (
      <div className="dialog-overlay" onClick={onClose}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>{t("editor.noSave")}</div>
          <div style={{ color: "#64748b" }}>{detail?.error}</div>
          <button className="btn-secondary" style={{ marginTop: 24, padding: "8px 24px", fontSize: 14 }} onClick={onClose}>
            {t("editor.close")}
          </button>
        </div>
      </div>
    );
  }

  const editingCat = editingCatIndex !== null ? detail.cats[editingCatIndex] : null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 900, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}
      >
        {/* Header */}
        <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{t("editor.title")}</h2>
              <span
                style={{
                  padding: "4px 12px",
                  background: "#f0fdf4",
                  border: "2px solid #22c55e",
                  borderRadius: 8,
                  fontWeight: 900,
                  fontSize: 12,
                  color: "#16a34a",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onClick={() => invoke("open_url", { url: "https://mewgenics.wiki.gg/" })}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#dcfce7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
              >
                📖 Wiki
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary"
                style={{ padding: "8px 20px", fontSize: 14, opacity: hasChanges ? 1 : 0.5 }}
                onClick={handleSave}
                disabled={!hasChanges || saving}
              >
                {saving ? t("editor.saving") : t("editor.save")}
              </button>
              <button className="btn-secondary" style={{ padding: "8px 20px", fontSize: 14 }} onClick={onClose}>
                {t("editor.close")}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#ef4444", fontWeight: "bold", marginBottom: 12 }}>
            {t("editor.warning")}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "3px solid #1e293b" }}>
            {(["basic", "cats", "furniture"] as Tab[]).map((t_) => (
              <button
                key={t_}
                onClick={() => setTab(t_)}
                style={{
                  padding: "8px 20px",
                  fontWeight: 900,
                  fontSize: 14,
                  border: "3px solid #1e293b",
                  borderBottom: "none",
                  borderRadius: "12px 12px 0 0",
                  cursor: "pointer",
                  background: tab === t_ ? "#fff" : "#f1f5f9",
                  color: tab === t_ ? "#1e293b" : "#64748b",
                  marginBottom: -3,
                  position: "relative",
                  zIndex: tab === t_ ? 2 : 1,
                }}
              >
                {t_ === "basic" && t("editor.tabBasic")}
                {t_ === "cats" && `${t("editor.tabCats")} (${detail.cats.length})`}
                {t_ === "furniture" && t("editor.tabFurniture")}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px 28px 24px" }}>
          {tab === "basic" && (
            <BasicDataEditor
              basic={detail.basic}
              edits={basicEdits}
              onChange={setBasicEdits}
            />
          )}
          {tab === "cats" && !editingCat && (
            <CatListEditor
              cats={detail.cats}
              catEdits={catEdits}
              getCatWithEdits={getCatWithEdits}
              onSelectCat={setEditingCatIndex}
              listState={catListState}
              onListStateChange={setCatListState}
            />
          )}
          {tab === "cats" && editingCat && (
            <CatDetailEditor
              cat={getCatWithEdits(editingCat)}
              catIndex={editingCatIndex!}
              totalCats={detail.cats.length}
              abilityDB={abilityDB}
              mutationDB={mutationDB}
              onUpdate={(changes) => updateCatEdit(editingCat.key, changes)}
              onBack={() => setEditingCatIndex(null)}
              onNav={(idx) => setEditingCatIndex(idx)}
            />
          )}
          {tab === "furniture" && (
            <FurnitureEditor
              furniture={detail.furniture}
              furnitureDB={furnitureDB}
              added={furnitureAdded}
              removed={furnitureRemoved}
              onAdd={(item) => setFurnitureAdded((prev) => [...prev, item])}
              onRemove={(key) => setFurnitureRemoved((prev) => [...prev, key])}
              onUndoAdd={(idx) => setFurnitureAdded((prev) => prev.filter((_, i) => i !== idx))}
              onUndoRemove={(key) => setFurnitureRemoved((prev) => prev.filter((k) => k !== key))}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveEditorDialog;
