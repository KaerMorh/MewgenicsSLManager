import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../i18n";
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
  const { t } = useI18n();
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
          {t("gameBackup.title")}
        </h2>
        <p
          style={{
            color: "#64748b",
            fontWeight: "bold",
            marginBottom: 16,
          }}
        >
          {t("gameBackup.desc")}
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
              {t("gameBackup.empty")}
            </div>
          )}
          {entries.map((entry) => {
            const s = summaries[entry.path];
            const timeStr = formatTime(entry.backup_time);
            let infoText = "";
            if (s?.exists) {
              const status = s.in_adventure ? t("gameBackup.inAdventure") : t("gameBackup.atHome");
              infoText = `Day ${s.current_day}  |  ${t("gameBackup.catCount", { count: s.cat_count })}  |  ${status}`;
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
                  {t("gameBackup.import")}
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
            {t("gameBackup.close")}
          </button>
        </div>

        {confirmPath && (
          <div className="dialog-overlay" onClick={() => setConfirmPath(null)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <h3>{t("gameBackup.confirmTitle")}</h3>
              <p>
                {t("gameBackup.confirmMsg")}
                <br />
                {t("gameBackup.confirmContinue")}
              </p>
              <div className="btn-row">
                <button
                  className="btn-secondary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={() => setConfirmPath(null)}
                >
                  {t("dialog.cancel")}
                </button>
                <button
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={confirmImport}
                >
                  {t("dialog.confirm")}
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
