import React, { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useI18n } from "../i18n";

interface UpdateDialogProps {
  onClose: () => void;
}

type UpdateStatus =
  | { kind: "checking" }
  | { kind: "available"; update: Update; version: string; body: string }
  | { kind: "downloading"; progress: number; total: number }
  | { kind: "ready" }
  | { kind: "up-to-date" }
  | { kind: "error"; message: string };

const UpdateDialog: React.FC<UpdateDialogProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>({ kind: "checking" });

  const checkForUpdate = useCallback(async () => {
    setStatus({ kind: "checking" });
    try {
      const update = await check();
      if (update) {
        setStatus({
          kind: "available",
          update,
          version: update.version,
          body: update.body || "",
        });
      } else {
        setStatus({ kind: "up-to-date" });
      }
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  const handleDownload = async () => {
    if (status.kind !== "available") return;
    const update = status.update;
    let downloaded = 0;
    let totalSize = 0;
    setStatus({ kind: "downloading", progress: 0, total: 0 });
    try {
      await update.downloadAndInstall((event) => {
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
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>
          {t("update.title")}
        </h2>

        {status.kind === "checking" && (
          <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontWeight: 800 }}>
            {t("update.checking")}
          </div>
        )}

        {status.kind === "up-to-date" && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontWeight: 800, color: "#22c55e" }}>{t("update.upToDate")}</div>
          </div>
        )}

        {status.kind === "error" && (
          <div style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, color: "#ef4444", marginBottom: 8 }}>
              {t("update.error")}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", wordBreak: "break-all" }}>
              {status.message}
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn-secondary"
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() =>
                  openUrl("https://github.com/KaerMorh/MewgenicsSLManager/releases/latest")
                }
              >
                {t("update.manualDownload")}
              </button>
            </div>
          </div>
        )}

        {status.kind === "available" && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontWeight: 800 }}>{t("update.newVersion")}: </span>
              <span style={{ fontWeight: 900, color: "#3b82f6" }}>v{status.version}</span>
            </div>
            {status.body && (
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
                {status.body}
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
          <div style={{ padding: 8 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("update.downloading")}</div>
            <div
              style={{
                background: "#e2e8f0",
                borderRadius: 8,
                height: 20,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  background: "#3b82f6",
                  height: "100%",
                  width: `${pct}%`,
                  transition: "width 0.2s",
                  borderRadius: 8,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              {formatBytes(status.progress)} / {formatBytes(status.total)} ({pct}%)
            </div>
          </div>
        )}

        {status.kind === "ready" && (
          <div style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontWeight: 800, marginBottom: 12, color: "#22c55e" }}>
              {t("update.ready")}
            </div>
            <button
              className="btn-primary"
              style={{ padding: "8px 24px", fontSize: 14 }}
              onClick={handleRelaunch}
            >
              {t("update.relaunch")}
            </button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button
            className="btn-secondary"
            style={{ padding: "6px 16px", fontSize: 13 }}
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
