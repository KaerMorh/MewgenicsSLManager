import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useI18n } from "./i18n";
import TitleBar from "./components/TitleBar";
import TopNav from "./components/TopNav";
import HeroSection from "./components/HeroSection";
import BackupList from "./components/BackupList";
import SettingsDialog from "./components/SettingsDialog";
import GameBackupDialog from "./components/GameBackupDialog";
import SaveEditorDialog from "./components/editor/SaveEditorDialog";
import type { Config, SaveSummary, BackupEntry } from "./types";


function App() {
  const { t } = useI18n();
  const [config, setConfig] = useState<Config | null>(null);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showGameBackups, setShowGameBackups] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [noteDialog, setNoteDialog] = useState<{
    path: string;
    filename: string;
    currentNote: string;
  } | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    invoke<Config>("get_config").then(setConfig);
  }, []);

  const refresh = useCallback(async () => {
    if (!config) return;
    const slot = config.current_slot;
    const savePath = `${config.save_dir}\\${slotFilename(slot)}`;
    const backupDir = config.backup_dir || `${config.save_dir}\\LoaderBackups`;

    const [s, list] = await Promise.all([
      invoke<SaveSummary>("get_save_summary", { path: savePath }),
      invoke<BackupEntry[]>("list_backups", { backupDir, slot }),
    ]);
    setSummary(s);
    setEntries(list);
  }, [config]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!config?.save_dir) return;
    invoke("start_watcher", { saveDir: config.save_dir });
  }, [config?.save_dir]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const unlisten = listen("save-file-changed", () => {
      refreshRef.current();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    const seconds = config.auto_refresh_interval;
    if (!seconds || seconds <= 0) return;
    const id = setInterval(() => {
      refreshRef.current();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [config?.auto_refresh_interval, config]);

  if (!config) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        {t("loading")}
      </div>
    );
  }

  const backupDir = config.backup_dir || `${config.save_dir}\\LoaderBackups`;
  const slot = config.current_slot;
  const savePath = `${config.save_dir}\\${slotFilename(slot)}`;

  const handleSlotChange = async (newSlot: number) => {
    const newConfig = { ...config, current_slot: newSlot };
    await invoke("save_config", { config: newConfig });
    setConfig(newConfig);
  };

  const handleBackupNow = async () => {
    try {
      const result = await invoke<string>("create_backup", {
        savePath,
        backupDir,
        slot,
      });
      const filename = result.split("\\").pop() || result.split("/").pop() || result;
      toast.success(t("toast.backupSuccess"), { description: t("toast.backupSuccessDesc", { filename }) });
      refresh();
    } catch (e) {
      toast.error(t("toast.backupFail"), { description: String(e) });
    }
  };

  const handleLoad = (backupPath: string) => {
    setConfirmDialog({
      title: t("dialog.confirmLoad"),
      message: t("dialog.confirmLoadMsg"),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await invoke("load_backup", {
            backupPath,
            savePath,
            backupDir,
            slot,
          });
          toast.success(t("toast.loadSuccess"), { description: t("toast.loadSuccessDesc") });
          refresh();
        } catch (e) {
          toast.error(t("toast.loadFail"), { description: String(e) });
        }
      },
    });
  };

  const handleCopy = async (backupPath: string) => {
    try {
      await invoke<string>("copy_backup", { srcPath: backupPath, backupDir });
      toast.success(t("toast.copySuccess"));
      refresh();
    } catch (e) {
      toast.error(t("toast.copyFail"), { description: String(e) });
    }
  };

  const handleDelete = (backupPath: string) => {
    const filename = backupPath.split("\\").pop() || backupPath.split("/").pop() || backupPath;
    setConfirmDialog({
      title: t("dialog.confirmDelete"),
      message: t("dialog.confirmDeleteMsg", { filename }),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await invoke("delete_backup", { path: backupPath });
          toast.success(t("toast.deleteSuccess"));
          refresh();
        } catch (e) {
          toast.error(t("toast.deleteFail"), { description: String(e) });
        }
      },
    });
  };

  const handleEditNote = (backupPath: string) => {
    const filename = backupPath.split("\\").pop() || backupPath.split("/").pop() || backupPath;
    const entry = entries.find((e) => e.path === backupPath);
    const currentNote = entry?.note ?? "";
    setNoteText(currentNote);
    setNoteDialog({ path: backupPath, filename, currentNote });
  };

  const handleSaveNote = async () => {
    if (!noteDialog) return;
    try {
      await invoke("save_note", {
        backupDir,
        filename: noteDialog.filename,
        note: noteText,
      });
      toast.success(t("toast.noteSaved"));
      refresh();
    } catch (e) {
      toast.error(t("toast.notesFail"), { description: String(e) });
    }
    setNoteDialog(null);
  };

  const handleSettingsSave = async (newConfig: Config) => {
    await invoke("save_config", { config: newConfig });
    setConfig(newConfig);
    setShowSettings(false);
    toast.success(t("toast.settingsSaved"));
  };

  const handleSortChange = async (key: string, ascending: boolean) => {
    const newConfig = { ...config, sort_key: key, sort_ascending: ascending };
    await invoke("save_config", { config: newConfig });
    setConfig(newConfig);
  };

  const handleImportGameBackup = async (savbackupPath: string) => {
    try {
      await invoke("load_backup", {
        backupPath: savbackupPath,
        savePath,
        backupDir,
        slot,
      });
      toast.success(t("toast.importSuccess"));
      refresh();
    } catch (e) {
      toast.error(t("toast.importFail"), { description: String(e) });
    }
  };

  const handleQuickRestart = async () => {
    if (config.relaunch_after_kill && !config.game_exe_path) {
      toast.error(t("toast.gamePathNotSet"));
      return;
    }
    const running = await invoke<boolean>("is_game_running");
    if (!running) {
      toast.error(t("toast.gameNotRunning"));
      return;
    }
    try {
      const result = await invoke<string>("kill_and_relaunch_game", {
        gamePath: config.game_exe_path,
        relaunch: config.relaunch_after_kill,
      });
      if (result === "killed_and_relaunched") {
        toast.success(t("toast.killAndRelaunch"));
      } else {
        toast.success(t("toast.killSuccess"));
      }
    } catch (e) {
      toast.error(t("toast.killFail"), { description: String(e) });
    }
  };

  const gameBackupDirPath = `${config.save_dir}\\backups`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <TitleBar />
      <div
        style={{
          padding: "0 30px 16px 20px",
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
          overflow: "hidden",
          width: "100%",
        }}
      >
      <TopNav
        currentSlot={slot}
        onSlotChange={handleSlotChange}
        onSettingsClick={() => setShowSettings(true)}
        onGameBackupClick={() => setShowGameBackups(true)}
      />

      <HeroSection
        summary={summary}
        slot={slot}
        backupCount={entries.length}
        onBackupNow={handleBackupNow}
        onRefresh={refresh}
        onEditSave={() => setShowEditor(true)}
        onQuickRestart={handleQuickRestart}
      />

      <BackupList
        entries={entries}
        sortKey={config.sort_key}
        sortAscending={config.sort_ascending}
        onSortChange={handleSortChange}
        onLoad={handleLoad}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onEditNote={handleEditNote}
      />

      {showSettings && (
        <SettingsDialog
          config={config}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
          onRefresh={refresh}
        />
      )}

      {showGameBackups && (
        <GameBackupDialog
          gameBackupDir={gameBackupDirPath}
          slot={slot}
          onImport={handleImportGameBackup}
          onClose={() => setShowGameBackups(false)}
        />
      )}

      {showEditor && (
        <SaveEditorDialog
          savePath={savePath}
          onClose={() => setShowEditor(false)}
          onSaved={refresh}
        />
      )}

      {confirmDialog && (
        <div className="dialog-overlay" onClick={() => setConfirmDialog(null)}>
          <div
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{confirmDialog.title}</h3>
            <p style={{ whiteSpace: "pre-line" }}>{confirmDialog.message}</p>
            <div className="btn-row">
              <button
                className="btn-secondary"
                style={{ padding: "8px 20px", fontSize: 14 }}
                onClick={() => setConfirmDialog(null)}
              >
                {t("dialog.cancel")}
              </button>
              <button
                className="btn-primary"
                style={{ padding: "8px 20px", fontSize: 14 }}
                onClick={confirmDialog.onConfirm}
              >
                {t("dialog.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {noteDialog && (
        <div className="dialog-overlay" onClick={() => setNoteDialog(null)}>
          <div className="dialog-content" style={{ minWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>
              {t("dialog.editNote")}
            </h3>
            <p style={{ color: "#64748b", fontWeight: "bold", marginBottom: 12 }}>
              {t("dialog.editNoteMsg", { filename: noteDialog.filename })}
            </p>
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveNote();
              }}
              autoFocus
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="btn-secondary"
                style={{ padding: "8px 16px", fontSize: 14 }}
                onClick={() => setNoteDialog(null)}
              >
                {t("dialog.cancel")}
              </button>
              <button
                className="btn-primary"
                style={{ padding: "8px 16px", fontSize: 14 }}
                onClick={handleSaveNote}
              >
                {t("dialog.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function slotFilename(slot: number): string {
  return `steamcampaign0${slot}.sav`;
}

export default App;
