use crate::backup_manager;
use crate::config::Config;
use crate::save_parser::{self, SaveSummary};
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<Config>,
}

// ---- Config commands ----

#[tauri::command]
pub fn get_config(state: State<AppState>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn save_config(state: State<AppState>, config: Config) -> Result<(), String> {
    let mut current = state.config.lock().unwrap();
    *current = config;
    current.save()
}

// ---- Save info ----

#[tauri::command]
pub fn get_save_summary(path: String) -> SaveSummary {
    save_parser::parse_save_summary(Path::new(&path))
}

// ---- Backup operations ----

#[tauri::command]
pub fn create_backup(save_path: String, backup_dir: String, slot: i32) -> Result<String, String> {
    backup_manager::create_backup(&save_path, &backup_dir, slot)
}

#[tauri::command]
pub fn load_backup(
    backup_path: String,
    save_path: String,
    backup_dir: String,
    slot: i32,
) -> Result<Option<String>, String> {
    backup_manager::load_backup(&backup_path, &save_path, &backup_dir, slot)
}

#[tauri::command]
pub fn copy_backup(src_path: String, backup_dir: String) -> Result<String, String> {
    backup_manager::copy_backup(&src_path, &backup_dir)
}

#[tauri::command]
pub fn delete_backup(path: String) -> Result<bool, String> {
    backup_manager::delete_backup(&path)
}

#[tauri::command]
pub fn list_backups(
    backup_dir: String,
    slot: i32,
) -> Vec<backup_manager::BackupEntry> {
    backup_manager::list_backups(&backup_dir, slot)
}

#[tauri::command]
pub fn list_game_backups(
    game_backup_dir: String,
    slot: i32,
) -> Vec<backup_manager::BackupEntry> {
    backup_manager::list_game_backups(&game_backup_dir, slot)
}

// ---- Notes ----

#[tauri::command]
pub fn save_note(backup_dir: String, filename: String, note: String) -> Result<(), String> {
    backup_manager::save_note_to_file(&backup_dir, &filename, &note)
}

// ---- Parse backup summary (for expanded view) ----

#[tauri::command]
pub fn parse_backup_summary(path: String) -> SaveSummary {
    save_parser::parse_save_summary(Path::new(&path))
}
