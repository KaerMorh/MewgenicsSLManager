import React from "react";
import SaveInfoCard from "./SaveInfoCard";
import type { SaveSummary } from "../types";

interface HeroSectionProps {
  summary: SaveSummary | null;
  slot: number;
  backupCount: number;
  onBackupNow: () => void;
  onBrowseBackups: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  summary,
  slot,
  backupCount,
  onBackupNow,
  onBrowseBackups,
}) => {
  const pct = summary?.exists ? `${summary.save_percent}%` : "0%";

  return (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
      {/* Left text */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span className="tag tag-new" style={{ alignSelf: "flex-start" }}>
          ● New: 自动备份已就绪
        </span>

        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1.2,
            marginTop: 20,
          }}
        >
          管理存档，
          <br />
          <span style={{ color: "#22c55e" }}>随时</span>，
          <br />
          随地！
        </h1>

        <p
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: "#64748b",
            marginTop: 20,
          }}
        >
          加入无数铲屎官的行列，轻松管理你的 Mewgenics
          存档。告别永久死亡，守护每一只探险猫！
        </p>

        <div style={{ display: "flex", gap: 16, marginTop: 30 }}>
          <button className="btn-primary" onClick={onBackupNow}>
            立即备份当前存档 →
          </button>
          <button className="btn-secondary" onClick={onBrowseBackups}>
            浏览备份
          </button>
        </div>

        <div style={{ display: "flex", gap: 30, marginTop: 40 }}>
          <StatBlock value={String(backupCount)} label="可用备份" />
          <StatBlock value={pct} label="平均完成度" />
          <StatBlock value="3" label="活跃槽位" />
        </div>
      </div>

      {/* Right card */}
      <div style={{ flex: 1 }}>
        <SaveInfoCard summary={summary} slot={slot} />
      </div>
    </div>
  );
};

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: "bold", color: "#64748b" }}>
        {label}
      </div>
    </div>
  );
}

export default HeroSection;
