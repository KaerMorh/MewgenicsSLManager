import React, { useMemo } from "react";
import { useI18n } from "../../i18n";
import SearchableSelect from "./SearchableSelect";
import type { SelectOption } from "./SearchableSelect";
import type { AbilityDB } from "../../types";

interface Props {
  label: string;
  value: string | null;
  type: "active" | "passive" | "disorder";
  slotIndex: number;
  catClass: string;
  abilityDB: AbilityDB | null;
  onChange: (value: string | null) => void;
}

const ALL_CLASSES = [
  "colorless", "mage", "fighter", "hunter", "thief", "tank",
  "medic", "monk", "butcher", "druid", "tinkerer", "necromancer",
  "psychic", "jester",
];

const AbilitySelector: React.FC<Props> = ({
  label,
  value,
  type,
  slotIndex,
  catClass,
  abilityDB,
  onChange,
}) => {
  const { t } = useI18n();

  const options = useMemo(() => {
    if (!abilityDB) return [];
    const result: SelectOption[] = [];

    if (type === "active") {
      if (slotIndex === 0) {
        const moves = abilityDB["basic_move"];
        if (moves) {
          for (const entry of moves) {
            result.push({ value: entry.name, label: entry.name, group: "Basic Move" });
          }
        }
      } else if (slotIndex === 1) {
        const attacks = abilityDB["basic_attack"];
        if (attacks) {
          for (const entry of attacks) {
            result.push({ value: entry.name, label: entry.name, group: "Basic Attack" });
          }
        }
      } else {
        const cls = catClass.toLowerCase();
        const classActive = abilityDB[`${cls}_active`];
        if (classActive) {
          for (const entry of classActive) {
            result.push({ value: entry.name, label: entry.name, group: `${catClass} Active` });
          }
        }
        for (const c of ALL_CLASSES) {
          if (c === cls) continue;
          const ca = abilityDB[`${c}_active`];
          if (ca) {
            const groupName = `${c.charAt(0).toUpperCase() + c.slice(1)} Active`;
            for (const entry of ca) {
              result.push({ value: entry.name, label: entry.name, group: groupName });
            }
          }
        }
      }
    } else if (type === "passive") {
      const cls = catClass.toLowerCase();
      const classPassive = abilityDB[`${cls}_passive`];
      if (classPassive) {
        for (const entry of classPassive) {
          result.push({ value: entry.name, label: entry.name, group: `${catClass} Passive` });
        }
      }
      for (const c of ALL_CLASSES) {
        if (c === cls) continue;
        const cp = abilityDB[`${c}_passive`];
        if (cp) {
          const groupName = `${c.charAt(0).toUpperCase() + c.slice(1)} Passive`;
          for (const entry of cp) {
            result.push({ value: entry.name, label: entry.name, group: groupName });
          }
        }
      }
    } else {
      const disorders = abilityDB["disorder"];
      if (disorders) {
        for (const entry of disorders) {
          result.push({ value: entry.name, label: entry.name, group: "Disorder" });
        }
      }
    }

    // Ensure current value is always visible even if not in DB
    if (value && !result.some((o) => o.value === value)) {
      result.unshift({ value, label: `${value} (current)`, group: "Current" });
    }

    return result;
  }, [abilityDB, type, slotIndex, catClass, value]);

  const borderColor = type === "active" ? "#3b82f6" : type === "passive" ? "#22c55e" : "#ef4444";

  return (
    <div
      style={{
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: "6px 8px",
        background: "#fafafa",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8" }}>{label}</span>
      </div>
      <SearchableSelect
        value={value || ""}
        options={options}
        placeholder={t("editor.searchAbility")}
        borderColor={borderColor}
        showClear={!!value}
        onClear={() => onChange(null)}
        onChange={(v) => onChange(v || null)}
        allowCustom
      />
    </div>
  );
};

export default AbilitySelector;
