import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Config } from "../types";

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    invoke<Config>("get_config").then(setConfig);
  }, []);

  const updateConfig = useCallback(async (updates: Partial<Config>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    await invoke("save_config", { config: newConfig });
    setConfig(newConfig);
  }, [config]);

  return { config, setConfig, updateConfig };
}
