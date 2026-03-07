import React from "react";
import { useI18n } from "../../i18n";
import AbilitySelector from "./AbilitySelector";
import MutationSelector from "./MutationSelector";
import type { CatDetail, CatChanges, CatStats, SkillSlot, AbilityDB, MutationDB } from "../../types";

interface Props {
  cat: CatDetail;
  catIndex: number;
  totalCats: number;
  abilityDB: AbilityDB | null;
  mutationDB: MutationDB | null;
  onUpdate: (changes: Partial<CatChanges>) => void;
  onBack: () => void;
  onNav: (index: number) => void;
}

const STAT_KEYS: (keyof CatStats)[] = ["STR", "DEX", "CON", "INT", "SPD", "CHA", "LUCK"];
const STAT_COLORS: Record<string, string> = {
  STR: "#ef4444",
  DEX: "#f59e0b",
  CON: "#22c55e",
  INT: "#3b82f6",
  SPD: "#a855f7",
  CHA: "#ec4899",
  LUCK: "#14b8a6",
};

const SEX_OPTIONS = ["Male", "Female", "Ditto"];

const CatDetailEditor: React.FC<Props> = ({
  cat,
  catIndex,
  totalCats,
  abilityDB,
  mutationDB,
  onUpdate,
  onBack,
  onNav,
}) => {
  const { t } = useI18n();

  const updateStat = (key: keyof CatStats, val: number) => {
    const clamped = Math.max(1, Math.min(7, val));
    onUpdate({ stats: { ...cat.stats, [key]: clamped } });
  };

  const updateAbility = (
    type: "active" | "passive" | "disorder",
    index: number,
    value: string | null
  ) => {
    if (type === "active") {
      const newActive = [...cat.abilities.active];
      newActive[index] = value;
      onUpdate({ abilities: { ...cat.abilities, active: newActive } });
    } else {
      const arr: SkillSlot[] = [...cat.abilities[type]];
      if (value === null) {
        arr[index] = { name: null, tier: 1 };
      } else if (value.endsWith("2")) {
        arr[index] = { name: value.slice(0, -1), tier: 2 };
      } else {
        arr[index] = { name: value, tier: 1 };
      }
      onUpdate({ abilities: { ...cat.abilities, [type]: arr } });
    }
  };

  const updateMutation = (field: string, value: number) => {
    const newMutations = { ...cat.mutations };
    if (value <= 1) {
      delete newMutations[field];
    } else {
      newMutations[field] = value;
    }
    onUpdate({ mutations: newMutations });
  };

  const sectionStyle: React.CSSProperties = {
    background: "#fff",
    border: "3px solid #1e293b",
    borderRadius: 16,
    padding: "16px 20px",
    boxShadow: "3px 3px 0 #1e293b",
    marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 900,
    color: "#64748b",
    marginBottom: 8,
    display: "block",
  };

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button
          className="btn-small blue"
          style={{ padding: "6px 16px", fontSize: 13 }}
          onClick={onBack}
        >
          ← {t("editor.catList")}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-small white"
            style={{ padding: "6px 14px", fontSize: 13 }}
            onClick={() => onNav(catIndex - 1)}
            disabled={catIndex <= 0}
          >
            ◀ {t("editor.prevCat")}
          </button>
          <span style={{ fontWeight: 900, fontSize: 14, padding: "6px 0", color: "#64748b" }}>
            {catIndex + 1} / {totalCats}
          </span>
          <button
            className="btn-small white"
            style={{ padding: "6px 14px", fontSize: 13 }}
            onClick={() => onNav(catIndex + 1)}
            disabled={catIndex >= totalCats - 1}
          >
            {t("editor.nextCat")} ▶
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div style={sectionStyle}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>{t("editor.catName")}</label>
            <input
              type="text"
              value={cat.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontWeight: 900,
                border: "3px solid #1e293b",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>{t("editor.catSex")}</label>
            <select
              value={cat.sex}
              onChange={(e) => onUpdate({ sex: e.target.value })}
              style={{ width: "100%", padding: "6px 10px", fontWeight: 900 }}
            >
              {SEX_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{t("editor.catAge")}</label>
            <input
              type="number"
              value={cat.age}
              min={0}
              onChange={(e) => onUpdate({ age: parseInt(e.target.value, 10) || 0 })}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontWeight: 900,
                border: "3px solid #1e293b",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>{t("editor.catLevel")}</label>
            <input
              type="number"
              value={cat.level}
              min={1}
              max={100}
              onChange={(e) => onUpdate({ level: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)) })}
              style={{
                width: "100%",
                padding: "6px 10px",
                fontWeight: 900,
                border: "3px solid #1e293b",
                borderRadius: 8,
                fontSize: 14,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: "#64748b" }}>
            {t("editor.catClass")}: <strong style={{ color: "#1e293b" }}>{cat.cat_class || "?"}</strong>
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={cat.retired}
              onChange={(e) => onUpdate({ retired: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: "#22c55e" }}
            />
            <span style={{ fontWeight: 900, fontSize: 13 }}>{t("editor.catRetired")}</span>
          </label>
          {(cat.dead || cat.level === 0) && (
            <span style={{ fontWeight: 900, fontSize: 13, color: "#ef4444" }}>
              💀 {t("editor.catDead")}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("editor.catStats")}</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {STAT_KEYS.map((key) => (
            <div key={key} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: STAT_COLORS[key],
                  marginBottom: 4,
                }}
              >
                {key}
              </div>
              <input
                type="number"
                value={cat.stats[key]}
                min={1}
                max={7}
                onChange={(e) => updateStat(key, parseInt(e.target.value, 10) || 1)}
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "6px 2px",
                  fontWeight: 900,
                  fontSize: 18,
                  border: `3px solid ${STAT_COLORS[key]}`,
                  borderRadius: 10,
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <input
                type="range"
                value={cat.stats[key]}
                min={1}
                max={7}
                onChange={(e) => updateStat(key, parseInt(e.target.value, 10))}
                style={{ width: "100%", marginTop: 4, accentColor: STAT_COLORS[key] }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Abilities */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("editor.catAbilities")}</label>

        {/* Active */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#3b82f6", marginBottom: 6 }}>
            {t("editor.activeSkills")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {cat.abilities.active.map((val, idx) => {
              const slotLabel =
                idx === 0 ? t("editor.basicMove") : idx === 1 ? t("editor.basicAttack") : `Slot ${idx + 1}`;
              return (
                <AbilitySelector
                  key={idx}
                  label={slotLabel}
                  value={val}
                  type="active"
                  slotIndex={idx}
                  catClass={cat.cat_class}
                  abilityDB={abilityDB}
                  onChange={(v) => updateAbility("active", idx, v)}
                />
              );
            })}
          </div>
        </div>

        {/* Passive */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#22c55e", marginBottom: 6 }}>
            {t("editor.passiveSkills")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {cat.abilities.passive.map((slot, idx) => (
              <AbilitySelector
                key={idx}
                label={`Passive ${idx + 1}`}
                value={slot.name ? (slot.tier >= 2 ? slot.name + "2" : slot.name) : null}
                type="passive"
                slotIndex={idx}
                catClass={cat.cat_class}
                abilityDB={abilityDB}
                onChange={(v) => updateAbility("passive", idx, v)}
              />
            ))}
          </div>
        </div>

        {/* Disorder */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#ef4444", marginBottom: 6 }}>
            {t("editor.disorderSkills")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {cat.abilities.disorder.map((slot, idx) => (
              <AbilitySelector
                key={idx}
                label={`Disorder ${idx + 1}`}
                value={slot.name ? (slot.tier >= 2 ? slot.name + "2" : slot.name) : null}
                type="disorder"
                slotIndex={idx}
                catClass={cat.cat_class}
                abilityDB={abilityDB}
                onChange={(v) => updateAbility("disorder", idx, v)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mutations */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("editor.catMutations")}</label>
        <MutationSelector
          mutations={cat.mutations}
          mutationDB={mutationDB}
          onChange={updateMutation}
        />
      </div>
    </div>
  );
};

export default CatDetailEditor;
