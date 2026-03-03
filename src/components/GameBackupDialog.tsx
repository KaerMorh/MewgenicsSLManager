import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BackupEntry, SaveSummary } from "../types";

interface GameBackupDialogProps {
  gameBackupDir: string;
  slot: number;
  onImport: (path: string) => void;
  onClose: () => void;
}

const GameBackupDialog: React.FC<GameBackupDialogProps> = ({
  gameBackupDir,
  slot,
  onImport,
  onClose,
}) => {
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SaveSummary>>({});
  const [confirmPath, setConfirmPath] = useState<string | null>(null);

  useEffect(() => {
    invoke<BackupEntry[]>("list_game_backups", {
      gameBackupDir,
      slot,
    }).then((list) => {
      const sorted = list.sort(
        (a, b) => b.backup_time.localeCompare(a.backup_time)
      );
      setEntries(sorted);

      // Parse summaries in background
      (async () => {
        for (const entry of sorted) {
          try {
            const s = await invoke<SaveSummary>("parse_backup_summary", {
              path: entry.path,
            });
            setSummaries((prev) => ({ ...prev, [entry.path]: s }));
          } catch {
            // ignore
          }
        }
      })();
    });
  }, [gameBackupDir, slot]);

  const handleImport = (path: string) => {
    setConfirmPath(path);
  };

  const confirmImport = () => {
    if (confirmPath) {
      onImport(confirmPath);
      onClose();
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content"
        style={{ minWidth: 640, maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
          游戏自动备份
        </h2>
        <p
          style={{
            color: "#64748b",
            fontWeight: "bold",
            marginBottom: 16,
          }}
        >
          选择一个游戏备份导入（导入时会自动备份当前存档）
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
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
              未找到游戏备份文件
            </div>
          )}
          {entries.map((entry) => {
            const s = summaries[entry.path];
            const timeStr = formatTime(entry.backup_time);
            let infoText = "";
            if (s?.exists) {
              const status = s.in_adventure ? "🗡️ 冒险中" : "🏠 在家";
              infoText = `Day ${s.current_day}  |  🐱 猫 x${s.cat_count}  |  ${status}`;
            }
            return (
              <div
                key={entry.path}
                style={{
                  background: "#ffffff",
                  border: "3px solid #1e293b",
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  boxShadow: "4px 4px 0 #1e293b",
                }}
              >
                <span style={{ fontWeight: 900, fontSize: 16 }}>{timeStr}</span>
                <span
                  style={{ color: "#64748b", fontWeight: "bold", flex: 1 }}
                >
                  {infoText}
                </span>
                <button
                  className="btn-primary"
                  style={{ padding: "6px 16px", fontSize: 14 }}
                  onClick={() => handleImport(entry.path)}
                >
                  导入
                </button>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <button
            className="btn-secondary"
            style={{ padding: "8px 16px", fontSize: 14 }}
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        {/* Confirm dialog */}
        {confirmPath && (
          <div className="dialog-overlay" onClick={() => setConfirmPath(null)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>确认导入</h3>
              <p>
                导入此备份将自动备份当前存档，然后将此备份加载为活跃存档。
                <br />
                继续？
              </p>
              <div className="btn-row">
                <button
                  className="btn-secondary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={() => setConfirmPath(null)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={confirmImport}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default GameBackupDialog;
