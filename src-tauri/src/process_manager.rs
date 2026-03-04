use std::path::Path;
use std::process::Command;
use sysinfo::System;

const GAME_PROCESS_NAME: &str = "Mewgenics.exe";

/// Find PIDs of the game process by name.
pub fn find_game_pids() -> Vec<u32> {
    let mut sys = System::new();
    sys.refresh_processes();
    sys.processes()
        .values()
        .filter(|p| p.name().eq_ignore_ascii_case(GAME_PROCESS_NAME))
        .map(|p| p.pid().as_u32())
        .collect()
}

/// Check if the game is currently running.
pub fn is_game_running() -> bool {
    !find_game_pids().is_empty()
}

/// Kill the entire process tree using `taskkill /F /T /PID`.
/// This bypasses any close-detection the game might have.
pub fn kill_process_tree(pid: u32) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| format!("Failed to execute taskkill: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("taskkill failed: {}", stderr.trim()))
    }
}

/// Kill all instances of the game process tree.
pub fn kill_game() -> Result<(), String> {
    let pids = find_game_pids();
    if pids.is_empty() {
        return Err("Game is not running".to_string());
    }
    for pid in pids {
        kill_process_tree(pid)?;
    }
    Ok(())
}

/// Launch the game executable (detached).
pub fn launch_game(exe_path: &str) -> Result<(), String> {
    let path = Path::new(exe_path);
    if !path.exists() {
        return Err(format!("Game executable not found: {}", exe_path));
    }

    let working_dir = path
        .parent()
        .ok_or_else(|| "Cannot determine game directory".to_string())?;

    Command::new(exe_path)
        .current_dir(working_dir)
        .spawn()
        .map_err(|e| format!("Failed to launch game: {}", e))?;

    Ok(())
}

/// Auto-detect game path by scanning common Steam library locations on all drives.
pub fn auto_detect_game_path() -> Option<String> {
    let candidates = [
        "SteamLibrary\\steamapps\\common\\Mewgenics\\Mewgenics.exe",
        "Steam\\steamapps\\common\\Mewgenics\\Mewgenics.exe",
        "Program Files (x86)\\Steam\\steamapps\\common\\Mewgenics\\Mewgenics.exe",
        "Program Files\\Steam\\steamapps\\common\\Mewgenics\\Mewgenics.exe",
    ];

    // Get all drive letters
    for letter in b'A'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        if !Path::new(&drive).exists() {
            continue;
        }
        for candidate in &candidates {
            let full_path = format!("{}{}", drive, candidate);
            // Case-insensitive check: just test if the path exists
            // On Windows, file system paths are case-insensitive by default
            if Path::new(&full_path).exists() {
                return Some(full_path);
            }
        }
    }

    None
}
