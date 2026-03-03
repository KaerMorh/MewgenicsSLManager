import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useI18n } from "../i18n";
import type { Config, ScanResult, DedupResult } from "../types";

interface SettingsDialogProps {
  config: Config;
  onSave: (config: Config) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  config,
  onSave,
  onClose,
  onRefresh,
}) => {
  const { t } = useI18n();
  const [saveDir, setSaveDir] = useState(config.save_dir);
  const [backupDir, setBackupDir] = useState(config.backup_dir);
  const [refreshInterval, setRefreshInterval] = useState(config.auto_refresh_interval);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupConfirm, setDedupConfirm] = useState<{ groups: number; files: number } | null>(null);

  const browseSave = async () => {
    const selected = await open({ directory: true, title: t("settings.selectSaveDir") });
    if (selected) setSaveDir(selected);
  };

  const browseBackup = async () => {
    const selected = await open({ directory: true, title: t("settings.selectBackupDir") });
    if (selected) setBackupDir(selected);
  };

  const handleSave = () => {
    onSave({
      ...config,
      save_dir: saveDir.trim(),
      backup_dir: backupDir.trim(),
      auto_refresh_interval: refreshInterval,
    });
  };

  const restoreDefaults = () => {
    setSaveDir("");
    setBackupDir("");
    setRefreshInterval(30);
  };

  const handleOpenDir = async (dir: string, fallback?: string) => {
    const target = dir.trim() || fallback || "";
    if (!target) {
      toast.error(t("toast.pathEmpty"));
      return;
    }
    try {
      await invoke("open_in_explorer", { path: target });
    } catch (e) {
      toast.error(t("toast.openFail"), { description: String(e) });
    }
  };

  const effectiveBackupDir = () =>
    backupDir.trim() || (saveDir.trim() ? `${saveDir.trim()}\\LoaderBackups` : "");

  const handleScanDuplicates = async () => {
    const dir = config.backup_dir || `${config.save_dir}\\LoaderBackups`;
    if (!dir) {
      toast.error(t("toast.backupDirNotSet"));
      return;
    }
    setDedupLoading(true);
    try {
      const result = await invoke<ScanResult>("scan_duplicates", {
        backupDir: dir,
        slot: config.current_slot,
      });
      if (result.groups === 0) {
        toast.info(t("toast.noDuplicates"));
      } else {
        setDedupConfirm({ groups: result.groups, files: result.redundant_files });
      }
    } catch (e) {
      toast.error(t("toast.scanFail"), { description: String(e) });
    }
    setDedupLoading(false);
  };

  const handleDedup = async () => {
    setDedupConfirm(null);
    setDedupLoading(true);
    const dir = config.backup_dir || `${config.save_dir}\\LoaderBackups`;
    try {
      const result = await invoke<DedupResult>("dedup_backups", {
        backupDir: dir,
        slot: config.current_slot,
      });
      const desc = t("toast.dedupDoneDesc", { groups: result.groups_found, files: result.files_removed }) +
        (result.notes_merged > 0 ? t("toast.dedupDoneNotes", { notes: result.notes_merged }) : "");
      toast.success(t("toast.dedupDone"), { description: desc });
      onRefresh();
    } catch (e) {
      toast.error(t("toast.dedupFail"), { description: String(e) });
    }
    setDedupLoading(false);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 24 }}>
          {t("settings.title")}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            {t("settings.savePath")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={saveDir}
              onChange={(e) => setSaveDir(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={browseSave}>
              {t("settings.browse")}
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "8px 12px", fontSize: 14 }}
              title={t("settings.openInExplorer")}
              onClick={() => handleOpenDir(saveDir)}
            >
              📂
            </button>
          </div>
          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              fontWeight: "bold",
              marginTop: 4,
            }}
          >
            {t("settings.pathHint")}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            {t("settings.backupPath")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={backupDir}
              onChange={(e) => setBackupDir(e.target.value)}
              placeholder={t("settings.backupPlaceholder")}
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={browseBackup}>
              {t("settings.browse")}
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "8px 12px", fontSize: 14 }}
              title={t("settings.openInExplorer")}
              onClick={() => handleOpenDir(backupDir, effectiveBackupDir())}
            >
              📂
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            {t("settings.refreshInterval")}
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{ minWidth: 160 }}
            >
              <option value={0}>{t("settings.disablePolling")}</option>
              <option value={10}>{t("settings.sec10")}</option>
              <option value={15}>{t("settings.sec15")}</option>
              <option value={30}>{t("settings.sec30")}</option>
              <option value={60}>{t("settings.sec60")}</option>
              <option value={120}>{t("settings.sec120")}</option>
            </select>
            <span
              className="tag tag-home"
              style={{ fontSize: 11 }}
            >
              {t("settings.watcherAlwaysOn")}
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: "bold", marginTop: 4 }}>
            {t("settings.refreshHint")}
          </div>
        </div>

        <div
          style={{
            borderTop: "3px solid #e2e8f0",
            paddingTop: 16,
            marginBottom: 24,
          }}
        >
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            {t("settings.backupMgmt")}
          </label>
          <button
            className="btn-secondary"
            style={{ padding: "8px 16px", fontSize: 14 }}
            onClick={handleScanDuplicates}
            disabled={dedupLoading}
          >
            {dedupLoading ? t("settings.scanning") : t("settings.scanDedup")}
          </button>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: "bold", marginTop: 4 }}>
            {t("settings.dedupHint")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={restoreDefaults}>
            {t("settings.restoreDefaults")}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={handleSave}>
            {t("settings.save")}
          </button>
        </div>

        {dedupConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setDedupConfirm(null)}
          >
            <div
              className="confirm-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>{t("settings.confirmDedup")}</h3>
              <p
                dangerouslySetInnerHTML={{
                  __html:
                    t("settings.dedupFound", { groups: dedupConfirm.groups, files: dedupConfirm.files }) +
                    "<br />" +
                    t("settings.dedupWarn") +
                    "<br />" +
                    t("settings.continue"),
                }}
              />
              <div className="btn-row">
                <button
                  className="btn-secondary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={() => setDedupConfirm(null)}
                >
                  {t("settings.cancel")}
                </button>
                <button
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={handleDedup}
                >
                  {t("settings.confirmDedup")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsDialog;
