import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useI18n } from "../i18n";
import type { Config, ScanResult, DedupResult, TrashEntry } from "../types";

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
  const [gameExePath, setGameExePath] = useState(config.game_exe_path);
  const [relaunchAfterKill, setRelaunchAfterKill] = useState(config.relaunch_after_kill);
  const [autoUpdate, setAutoUpdate] = useState(config.auto_update);
  const [detecting, setDetecting] = useState(false);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupConfirm, setDedupConfirm] = useState<{ groups: number; files: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashEntry[]>([]);

  useEffect(() => {
    if (!gameExePath) {
      handleAutoDetect(true);
    }
  }, []);

  const browseSave = async () => {
    const selected = await open({ directory: true, title: t("settings.selectSaveDir") });
    if (selected) setSaveDir(selected);
  };

  const browseBackup = async () => {
    const selected = await open({ directory: true, title: t("settings.selectBackupDir") });
    if (selected) setBackupDir(selected);
  };

  const browseGame = async () => {
    const selected = await open({
      filters: [{ name: "Executable", extensions: ["exe"] }],
      title: t("settings.gamePath"),
    });
    if (selected) setGameExePath(selected);
  };

  const handleAutoDetect = async (silent?: boolean) => {
    setDetecting(true);
    try {
      const path = await invoke<string | null>("detect_game_path");
      if (path) {
        setGameExePath(path);
        if (!silent) toast.success(t("toast.autoDetectSuccess"), { description: path });
      } else if (!silent) {
        toast.error(t("toast.autoDetectFail"));
      }
    } catch (e) {
      if (!silent) toast.error(t("toast.autoDetectFail"), { description: String(e) });
    }
    setDetecting(false);
  };

  const handleSave = () => {
    onSave({
      ...config,
      save_dir: saveDir.trim(),
      backup_dir: backupDir.trim(),
      auto_refresh_interval: refreshInterval,
      game_exe_path: gameExePath.trim(),
      relaunch_after_kill: relaunchAfterKill,
      auto_update: autoUpdate,
    });
  };

  const restoreDefaults = () => {
    setSaveDir("");
    setBackupDir("");
    setRefreshInterval(30);
    setGameExePath("");
    setRelaunchAfterKill(true);
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
        gameBackupDir: config.save_dir,
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
        gameBackupDir: config.save_dir,
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

  const effectiveBackupDirValue = config.backup_dir || `${config.save_dir}\\LoaderBackups`;

  const handleOpenTrash = async () => {
    try {
      const items = await invoke<TrashEntry[]>("list_trash", { backupDir: effectiveBackupDirValue });
      setTrashItems(items);
      setShowTrash(true);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleRestoreTrash = async (trashPath: string) => {
    try {
      await invoke("restore_from_trash", { trashPath, backupDir: effectiveBackupDirValue });
      toast.success(t("toast.trashRestoreSuccess"));
      const items = await invoke<TrashEntry[]>("list_trash", { backupDir: effectiveBackupDirValue });
      setTrashItems(items);
      onRefresh();
    } catch (e) {
      toast.error(t("toast.trashRestoreFail"), { description: String(e) });
    }
  };

  const handleClearTrash = async () => {
    try {
      await invoke("clear_trash", { backupDir: effectiveBackupDirValue });
      toast.success(t("toast.trashClearSuccess"));
      setTrashItems([]);
    } catch (e) {
      toast.error(t("toast.trashClearFail"), { description: String(e) });
    }
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
            {t("settings.gameSection")}
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={gameExePath}
              onChange={(e) => setGameExePath(e.target.value)}
              placeholder={t("settings.gamePathPlaceholder")}
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={browseGame}>
              {t("settings.browse")}
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "8px 16px", fontSize: 14 }}
              onClick={() => handleAutoDetect()}
              disabled={detecting}
            >
              {detecting ? t("settings.detecting") : t("settings.autoDetect")}
            </button>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={relaunchAfterKill}
              onChange={(e) => setRelaunchAfterKill(e.target.checked)}
            />
            <span style={{ fontWeight: "bold" }}>{t("settings.relaunchAfterKill")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={(e) => setAutoUpdate(e.target.checked)}
            />
            <span style={{ fontWeight: "bold" }}>{t("settings.autoUpdate")}</span>
          </label>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: "bold", marginTop: 4 }}>
            {t("settings.gamePathHint")}
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

        <div
          style={{
            borderTop: "3px solid #e2e8f0",
            paddingTop: 16,
            marginBottom: 24,
          }}
        >
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            {t("settings.trash")}
          </label>
          <button
            className="btn-secondary"
            style={{ padding: "8px 16px", fontSize: 14 }}
            onClick={handleOpenTrash}
          >
            {t("settings.openTrash")}
          </button>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: "bold", marginTop: 4 }}>
            {t("settings.trashHint")}
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

        {showTrash && (
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
            onClick={() => setShowTrash(false)}
          >
            <div
              className="dialog-content"
              style={{ minWidth: 500, maxHeight: "70vh", display: "flex", flexDirection: "column" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>{t("settings.trashTitle")}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {trashItems.length > 0 && (
                    <button
                      className="btn-small red"
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      onClick={handleClearTrash}
                    >
                      {t("settings.trashClear")}
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    style={{ padding: "6px 16px", fontSize: 13 }}
                    onClick={() => setShowTrash(false)}
                  >
                    {t("settings.trashClose")}
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {trashItems.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontWeight: 800, fontSize: 14 }}>
                    {t("settings.trashEmpty")}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {trashItems.map((item) => (
                      <div
                        key={item.path}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          background: "#fff",
                          border: "3px solid #1e293b",
                          borderRadius: 12,
                          boxShadow: "2px 2px 0 #1e293b",
                        }}
                      >
                        <span style={{ fontSize: 18 }}>🗑️</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.filename}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", fontWeight: "bold" }}>
                            {item.deleted_time.replace("T", " ")}
                          </div>
                        </div>
                        <button
                          className="btn-small blue"
                          style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
                          onClick={() => handleRestoreTrash(item.path)}
                        >
                          {t("settings.trashRestore")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
