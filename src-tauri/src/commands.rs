use crate::backup_manager;
use crate::config::Config;
use crate::data_loader;
use crate::process_manager;
use crate::save_editor::{self, SaveChanges};
use crate::save_parser::{self, SaveDetail, SaveSummary};
use crate::watcher::SaveWatcher;
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct AppState {
    pub config: Mutex<Config>,
    pub watcher: SaveWatcher,
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
pub fn delete_backup(path: String, backup_dir: String) -> Result<bool, String> {
    backup_manager::delete_backup(&path, &backup_dir)
}

#[tauri::command]
pub fn list_trash(backup_dir: String) -> Vec<backup_manager::TrashEntry> {
    backup_manager::list_trash(&backup_dir)
}

#[tauri::command]
pub fn restore_from_trash(trash_path: String, backup_dir: String) -> Result<String, String> {
    backup_manager::restore_from_trash(&trash_path, &backup_dir)
}

#[tauri::command]
pub fn clear_trash(backup_dir: String) -> Result<usize, String> {
    backup_manager::clear_trash(&backup_dir)
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

// ---- Explorer ----

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("路径不存在".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---- File comparison ----

#[tauri::command]
pub fn check_files_identical(path_a: String, path_b: String) -> Result<bool, String> {
    let hash_a = backup_manager::compute_file_hash(&path_a)?;
    let hash_b = backup_manager::compute_file_hash(&path_b)?;
    Ok(hash_a == hash_b)
}

// ---- File watcher ----

#[tauri::command]
pub fn start_watcher(save_dir: String, state: State<AppState>, app: AppHandle) {
    state.watcher.start(&save_dir, app);
}

// ---- Save editor ----

#[tauri::command]
pub fn get_save_detail(path: String) -> SaveDetail {
    save_parser::parse_save_detail(Path::new(&path))
}

#[tauri::command]
pub fn modify_save(path: String, changes: SaveChanges) -> Result<(), String> {
    save_editor::modify_save_file(Path::new(&path), &changes)
}

#[tauri::command]
pub fn get_ability_db() -> Value {
    data_loader::get_ability_db()
}

#[tauri::command]
pub fn get_mutation_db() -> Value {
    data_loader::get_mutation_db()
}

#[tauri::command]
pub fn get_furniture_db() -> Value {
    data_loader::get_furniture_db()
}

// ---- Process management ----

#[tauri::command]
pub fn is_game_running() -> bool {
    process_manager::is_game_running()
}

#[tauri::command]
pub fn kill_and_relaunch_game(game_path: String, relaunch: bool) -> Result<String, String> {
    // Kill the game process tree
    process_manager::kill_game()?;

    // Wait briefly for process cleanup
    std::thread::sleep(std::time::Duration::from_millis(500));

    if relaunch && !game_path.is_empty() {
        process_manager::launch_game(&game_path)?;
        Ok("killed_and_relaunched".to_string())
    } else {
        Ok("killed".to_string())
    }
}

#[tauri::command]
pub fn detect_game_path() -> Option<String> {
    process_manager::auto_detect_game_path()
}

// ---- Duplicate detection ----

#[tauri::command]
pub fn scan_duplicates(
    backup_dir: String,
    game_backup_dir: String,
    slot: i32,
) -> Result<backup_manager::ScanResult, String> {
    backup_manager::scan_duplicates(&backup_dir, &game_backup_dir, slot)
}

#[tauri::command]
pub fn dedup_backups(
    backup_dir: String,
    game_backup_dir: String,
    slot: i32,
) -> Result<backup_manager::DedupResult, String> {
    backup_manager::dedup_backups(&backup_dir, &game_backup_dir, slot)
}
