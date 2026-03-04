import React from "react";
import { useI18n } from "../../i18n";
import type { BasicData } from "../../types";

interface Props {
  basic: BasicData;
  edits: Partial<BasicData>;
  onChange: (edits: Partial<BasicData>) => void;
}

const FIELDS: { key: keyof BasicData; emoji: string; i18nKey: string }[] = [
  { key: "current_day", emoji: "📅", i18nKey: "editor.day" },
  { key: "house_gold", emoji: "💰", i18nKey: "editor.gold" },
  { key: "house_food", emoji: "🍖", i18nKey: "editor.food" },
  { key: "save_percent", emoji: "📊", i18nKey: "editor.completion" },
];

const BasicDataEditor: React.FC<Props> = ({ basic, edits, onChange }) => {
  const { t } = useI18n();

  const getValue = (key: keyof BasicData) =>
    edits[key] !== undefined ? edits[key]! : basic[key];

  const handleChange = (key: keyof BasicData, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    onChange({ ...edits, [key]: num });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {FIELDS.map(({ key, emoji, i18nKey }) => (
        <div
          key={key}
          style={{
            background: "#fff",
            border: "3px solid #1e293b",
            borderRadius: 16,
            padding: "16px 20px",
            boxShadow: "4px 4px 0 #1e293b",
          }}
        >
          <label
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#64748b",
              display: "block",
              marginBottom: 8,
            }}
          >
            {emoji} {t(i18nKey)}
          </label>
          <input
            type="number"
            value={getValue(key)}
            onChange={(e) => handleChange(key, e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 18,
              fontWeight: 900,
              border: "3px solid #1e293b",
              borderRadius: 8,
              boxShadow: "3px 3px 0 #1e293b",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default BasicDataEditor;
