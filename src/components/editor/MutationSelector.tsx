import React, { useMemo } from "react";
import { useI18n } from "../../i18n";
import SearchableSelect from "./SearchableSelect";
import type { SelectOption } from "./SearchableSelect";
import type { MutationDB } from "../../types";

interface Props {
  mutations: Record<string, number>;
  mutationDB: MutationDB | null;
  onChange: (field: string, value: number) => void;
}

const BODY_PARTS: { label: string; dbKey: string; fields: string[] }[] = [
  { label: "Body", dbKey: "body", fields: ["body", "bodyFur"] },
  { label: "Head", dbKey: "head", fields: ["head", "headFur"] },
  { label: "Tail", dbKey: "tail", fields: ["tail", "tailFur"] },
  { label: "Left Leg", dbKey: "legs", fields: ["legL", "legLFur"] },
  { label: "Right Leg", dbKey: "legs", fields: ["legR", "legRFur"] },
  { label: "Left Arm", dbKey: "legs", fields: ["armL", "armLFur"] },
  { label: "Right Arm", dbKey: "legs", fields: ["armR", "armRFur"] },
  { label: "Left Eye", dbKey: "eyes", fields: ["eyeL", "eyeLFur"] },
  { label: "Right Eye", dbKey: "eyes", fields: ["eyeR", "eyeRFur"] },
  { label: "Left Eyebrow", dbKey: "eyebrows", fields: ["eyebrowL", "eyebrowLFur"] },
  { label: "Right Eyebrow", dbKey: "eyebrows", fields: ["eyebrowR", "eyebrowRFur"] },
  { label: "Left Ear", dbKey: "ears", fields: ["earL", "earLFur"] },
  { label: "Right Ear", dbKey: "ears", fields: ["earR", "earRFur"] },
  { label: "Mouth", dbKey: "mouth", fields: ["mouth", "mouthFur"] },
];

const MutationSelector: React.FC<Props> = ({ mutations, mutationDB, onChange }) => {
  const { t } = useI18n();

  const optionsMap = useMemo(() => {
    const map: Record<string, SelectOption[]> = {};
    for (const part of BODY_PARTS) {
      const key = part.fields[0];
      if (map[key]) continue;
      const opts: SelectOption[] = [
        { value: "0", label: t("editor.noMutation") },
      ];
      if (mutationDB && mutationDB[part.dbKey]) {
        const category = mutationDB[part.dbKey];
        for (const [id, info] of Object.entries(category)) {
          opts.push({ value: id, label: `${info.name} (#${id})` });
        }
      }
      // Ensure current value is visible even if not in DB
      const cv = mutations[key];
      if (cv && cv > 1 && !opts.some((o) => o.value === String(cv))) {
        opts.splice(1, 0, { value: String(cv), label: `#${cv} (current)` });
      }
      map[key] = opts;
    }
    return map;
  }, [mutationDB, mutations, t]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {BODY_PARTS.map((part) => {
        const mainField = part.fields[0];
        const currentValue = mutations[mainField] || 0;
        const options = optionsMap[mainField] || [];

        return (
          <div
            key={mainField}
            style={{
              border: "2px solid #e2e8f0",
              borderRadius: 8,
              padding: "6px 8px",
              background: currentValue > 1 ? "#fef3c7" : "#fafafa",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", marginBottom: 4 }}>
              {part.label}
            </div>
            <SearchableSelect
              value={String(currentValue)}
              options={options}
              placeholder={t("editor.searchMutation")}
              onChange={(v) => {
                const val = parseInt(v, 10) || 0;
                onChange(mainField, val);
                if (part.fields.length > 1) {
                  onChange(part.fields[1], val);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default MutationSelector;
