use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const APP_NAME: &str = "MeowLoader";

pub const SLOT_FILES: &[(&str, i32)] = &[
    ("steamcampaign01.sav", 1),
    ("steamcampaign02.sav", 2),
    ("steamcampaign03.sav", 3),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub save_dir: String,
    pub backup_dir: String,
    pub current_slot: i32,
    pub sort_key: String,
    pub sort_ascending: bool,
    #[serde(default = "default_refresh_interval")]
    pub auto_refresh_interval: u32,
    #[serde(default)]
    pub game_exe_path: String,
    #[serde(default = "default_true")]
    pub relaunch_after_kill: bool,
}

fn default_refresh_interval() -> u32 {
    30
}

fn default_true() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        let default_save_dir = default_save_dir();
        Self {
            save_dir: default_save_dir,
            backup_dir: String::new(),
            current_slot: 1,
            sort_key: "time".to_string(),
            sort_ascending: false,
            auto_refresh_interval: default_refresh_interval(),
            game_exe_path: String::new(),
            relaunch_after_kill: true,
        }
    }
}

fn default_save_dir() -> String {
    if let Some(appdata) = dirs::config_dir() {
        // On Windows: C:\Users\XXX\AppData\Roaming
        let mew_dir = appdata.join("Glaiel Games").join("Mewgenics");
        if mew_dir.exists() {
            // Try to find the first steam user subdirectory
            if let Ok(entries) = fs::read_dir(&mew_dir) {
                for entry in entries.flatten() {
                    let saves = entry.path().join("saves");
                    if saves.is_dir() {
                        return saves.to_string_lossy().to_string();
                    }
                }
            }
        }
    }
    String::new()
}

fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(APP_NAME)
}

fn config_file() -> PathBuf {
    config_dir().join("settings.json")
}

impl Config {
    pub fn load() -> Self {
        let path = config_file();
        if path.exists() {
            if let Ok(data) = fs::read_to_string(&path) {
                if let Ok(cfg) = serde_json::from_str::<Config>(&data) {
                    return cfg;
                }
            }
        }
        Config::default()
    }

    pub fn save(&self) -> Result<(), String> {
        let dir = config_dir();
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(config_file(), json).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn effective_backup_dir(&self) -> String {
        if self.backup_dir.is_empty() {
            Path::new(&self.save_dir)
                .join("LoaderBackups")
                .to_string_lossy()
                .to_string()
        } else {
            self.backup_dir.clone()
        }
    }

    pub fn slot_filename(slot: i32) -> &'static str {
        SLOT_FILES
            .iter()
            .find(|(_, s)| *s == slot)
            .map(|(f, _)| *f)
            .unwrap_or("steamcampaign01.sav")
    }

    pub fn slot_path(&self, slot: i32) -> PathBuf {
        Path::new(&self.save_dir).join(Self::slot_filename(slot))
    }

    pub fn game_backup_dir(&self) -> String {
        Path::new(&self.save_dir)
            .join("backups")
            .to_string_lossy()
            .to_string()
    }
}
