mod backup_manager;
mod commands;
mod config;
mod data_loader;
mod lz4;
mod save_editor;
mod save_parser;
mod watcher;

use commands::AppState;
use config::Config;
use std::sync::Mutex;
use watcher::SaveWatcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = Config::load();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            config: Mutex::new(cfg),
            watcher: SaveWatcher::new(),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::get_save_summary,
            commands::create_backup,
            commands::load_backup,
            commands::copy_backup,
            commands::delete_backup,
            commands::list_backups,
            commands::list_game_backups,
            commands::save_note,
            commands::parse_backup_summary,
            commands::open_in_explorer,
            commands::check_files_identical,
            commands::scan_duplicates,
            commands::dedup_backups,
            commands::start_watcher,
            commands::get_save_detail,
            commands::modify_save,
            commands::get_ability_db,
            commands::get_mutation_db,
            commands::get_furniture_db,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
