import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Config } from "../types";

interface SettingsDialogProps {
  config: Config;
  onSave: (config: Config) => void;
  onClose: () => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [saveDir, setSaveDir] = useState(config.save_dir);
  const [backupDir, setBackupDir] = useState(config.backup_dir);

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
    });
  };

  const restoreDefaults = () => {
    setSaveDir("");
    setBackupDir("");
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
      </div>
    </div>
  );
};

export default SettingsDialog;
