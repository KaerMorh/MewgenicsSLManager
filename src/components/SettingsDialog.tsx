import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
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
  const [saveDir, setSaveDir] = useState(config.save_dir);
  const [backupDir, setBackupDir] = useState(config.backup_dir);
  const [refreshInterval, setRefreshInterval] = useState(config.auto_refresh_interval);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupConfirm, setDedupConfirm] = useState<{ groups: number; files: number } | null>(null);

  const browseSave = async () => {
    const selected = await open({ directory: true, title: "选择存档目录" });
    if (selected) setSaveDir(selected);
  };

  const browseBackup = async () => {
    const selected = await open({ directory: true, title: "选择备份目录" });
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
      toast.error("路径为空");
      return;
    }
    try {
      await invoke("open_in_explorer", { path: target });
    } catch (e) {
      toast.error("打开失败", { description: String(e) });
    }
  };

  const effectiveBackupDir = () =>
    backupDir.trim() || (saveDir.trim() ? `${saveDir.trim()}\\LoaderBackups` : "");

  const handleScanDuplicates = async () => {
    const dir = config.backup_dir || `${config.save_dir}\\LoaderBackups`;
    if (!dir) {
      toast.error("备份路径未配置");
      return;
    }
    setDedupLoading(true);
    try {
      const result = await invoke<ScanResult>("scan_duplicates", {
        backupDir: dir,
        slot: config.current_slot,
      });
      if (result.groups === 0) {
        toast.info("未发现重复存档");
      } else {
        setDedupConfirm({ groups: result.groups, files: result.redundant_files });
      }
    } catch (e) {
      toast.error("扫描失败", { description: String(e) });
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
      const desc = `发现 ${result.groups_found} 组重复，删除了 ${result.files_removed} 个多余文件` +
        (result.notes_merged > 0 ? `，合并了 ${result.notes_merged} 组备注` : "");
      toast.success("去重完成", { description: desc });
      onRefresh();
    } catch (e) {
      toast.error("去重失败", { description: String(e) });
    }
    setDedupLoading(false);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 24 }}>
          系统设置
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            游戏存档路径:
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={saveDir}
              onChange={(e) => setSaveDir(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={browseSave}>
              浏览...
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "8px 12px", fontSize: 14 }}
              title="在资源管理器中打开"
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
            路径通常为: %APPDATA%\Glaiel Games\Mewgenics\{"{Steam用户编号}"}\saves
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            备份存储路径:
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={backupDir}
              onChange={(e) => setBackupDir(e.target.value)}
              placeholder="留空则使用: 存档路径/LoaderBackups"
              style={{ flex: 1 }}
            />
            <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={browseBackup}>
              浏览...
            </button>
            <button
              className="btn-secondary"
              style={{ padding: "8px 12px", fontSize: 14 }}
              title="在资源管理器中打开"
              onClick={() => handleOpenDir(backupDir, effectiveBackupDir())}
            >
              📂
            </button>
          </div>
        </div>

        {/* Auto refresh section */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            自动刷新间隔 (秒):
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              style={{ minWidth: 160 }}
            >
              <option value={0}>关闭定时轮询</option>
              <option value={10}>10 秒</option>
              <option value={15}>15 秒</option>
              <option value={30}>30 秒 (默认)</option>
              <option value={60}>60 秒</option>
              <option value={120}>120 秒</option>
            </select>
            <span
              className="tag tag-home"
              style={{ fontSize: 11 }}
            >
              文件监听始终开启
            </span>
          </div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: "bold", marginTop: 4 }}>
            定时轮询会按间隔自动刷新存档信息；文件监听会在存档文件被修改时立即刷新
          </div>
        </div>

        {/* Dedup section */}
        <div
          style={{
            borderTop: "3px solid #e2e8f0",
            paddingTop: 16,
            marginBottom: 24,
          }}
        >
          <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
            备份管理:
          </label>
          <button
            className="btn-secondary"
            style={{ padding: "8px 16px", fontSize: 14 }}
            onClick={handleScanDuplicates}
            disabled={dedupLoading}
          >
            {dedupLoading ? "扫描中..." : "🔍 检测并去重"}
          </button>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: "bold", marginTop: 4 }}>
            扫描当前存档位的所有备份，检测内容完全相同的文件，合并备注后仅保留最新的一份
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={restoreDefaults}>
            恢复默认
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn-secondary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 14 }} onClick={handleSave}>
            保存
          </button>
        </div>

        {/* Dedup confirm dialog */}
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
              <h3>确认去重</h3>
              <p>
                发现 <b>{dedupConfirm.groups}</b> 组重复存档，
                共 <b>{dedupConfirm.files}</b> 个多余文件。
                <br />
                去重将合并备注并保留每组中最新的一份，删除其余文件。
                <br />
                继续？
              </p>
              <div className="btn-row">
                <button
                  className="btn-secondary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={() => setDedupConfirm(null)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  style={{ padding: "8px 20px", fontSize: 14 }}
                  onClick={handleDedup}
                >
                  确认去重
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
