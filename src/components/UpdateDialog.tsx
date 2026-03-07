import React, { useState, useEffect } from "react";
import { Update } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useI18n } from "../i18n";

interface UpdateDialogProps {
  onClose: () => void;
  updateResult: Update | null;
  checking: boolean;
  onRecheck: () => void;
}

type UpdateStatus =
  | { kind: "idle" }
  | { kind: "downloading"; progress: number; total: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

const UpdateDialog: React.FC<UpdateDialogProps> = ({
  onClose,
  updateResult,
  checking,
  onRecheck,
}) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    getVersion().then(setCurrentVersion);
  }, []);

  const handleDownload = async () => {
    if (!updateResult) return;
    let downloaded = 0;
    let totalSize = 0;
    setStatus({ kind: "downloading", progress: 0, total: 0 });
    try {
      await updateResult.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalSize = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setStatus({ kind: "downloading", progress: downloaded, total: totalSize });
        } else if (event.event === "Finished") {
          setStatus({ kind: "ready" });
        }
      });
      setStatus({ kind: "ready" });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  };

  const handleRelaunch = async () => {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pct = status.kind === "downloading" && status.total > 0
    ? Math.round((status.progress / status.total) * 100)
    : 0;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-content"
        style={{ minWidth: 420, maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
            {t("update.title")}
          </h2>
          {currentVersion && (
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
              {t("update.currentVersion")}: v{currentVersion}
            </span>
          )}
        </div>

        {status.kind === "idle" && checking && (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontWeight: 800 }}>
            {t("update.checking")}
          </div>
        )}

        {status.kind === "idle" && !checking && !updateResult && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 800, color: "#22c55e" }}>{t("update.upToDate")}</div>
          </div>
        )}

        {status.kind === "idle" && !checking && updateResult && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 800 }}>{t("update.newVersion")}: </span>
              <span style={{ fontWeight: 900, color: "#3b82f6" }}>v{updateResult.version}</span>
            </div>
            {updateResult.body && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "2px solid #e2e8f0",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  maxHeight: 200,
                  overflowY: "auto",
                  marginBottom: 16,
                  whiteSpace: "pre-wrap",
                }}
              >
                {updateResult.body}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-primary"
                style={{ padding: "8px 20px", fontSize: 14 }}
                onClick={handleDownload}
              >
                {t("update.download")}
              </button>
              <button
                className="btn-secondary"
                style={{ padding: "8px 14px", fontSize: 13 }}
                onClick={() =>
                  openUrl("https://github.com/KaerMorh/MewgenicsSLManager/releases/latest")
                }
              >
                {t("update.manualDownload")}
              </button>
            </div>
          </div>
        )}

        {status.kind === "downloading" && (
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("update.downloading")}</div>
            <div
              style={{
                background: "#e2e8f0",
                borderRadius: 8,
                height: 8,
                overflow: "hidden",
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  background: "#3b82f6",
                  height: "100%",
                  width: `${pct}%`,
                  transition: "width 0.2s",
                }}
              />
            </div>
            {status.total > 0 && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {formatBytes(status.progress)} / {formatBytes(status.total)} ({pct}%)
              </div>
            )}
          </div>
        )}

        {status.kind === "ready" && (
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontWeight: 800, color: "#22c55e", marginBottom: 12 }}>
              {t("update.ready")}
            </div>
            <button
              className="btn-primary"
              style={{ padding: "8px 20px" }}
              onClick={handleRelaunch}
            >
              {t("update.relaunch")}
            </button>
          </div>
        )}

        {status.kind === "error" && (
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ color: "#ef4444", fontWeight: 800, marginBottom: 4 }}>
              {t("update.error")}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{status.message}</div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <button
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 13 }}
            onClick={onRecheck}
            disabled={checking || status.kind === "downloading"}
          >
            {t("update.recheck")}
          </button>
          <button
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: 13 }}
            onClick={onClose}
          >
            {t("update.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateDialog;