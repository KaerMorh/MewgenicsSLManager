use crate::save_parser::{parse_save_summary, SaveSummary};
use chrono::DateTime;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

const NOTES_FILE: &str = "backup_notes.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupEntry {
    pub path: String,
    pub filename: String,
    pub slot: i32,
    pub backup_time: String, // ISO 8601
    pub day_in_name: i64,
    pub is_game_backup: bool,
    pub is_copy: bool,
    pub note: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<SaveSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub groups: usize,
    pub redundant_files: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct DedupResult {
    pub groups_found: usize,
    pub files_removed: usize,
    pub notes_merged: usize,
}

// ---- Copy suffix handling ----

fn strip_copy_suffix(stem: &str) -> (&str, bool) {
    if let Some(pos) = stem.rfind("_copy") {
        let after = &stem[pos + 5..];
        if after.is_empty() || after.chars().all(|c| c.is_ascii_digit()) {
            return (&stem[..pos], true);
        }
    }
    (stem, false)
}

// ---- Regex-like parsing (manual, no regex crate needed) ----

/// Parse: steamcampaign0{slot}_{YYYY-MM-DD}_{HH-MM-SS}_{day}d.sav
/// Also accepts legacy format without seconds, and _copy / _copyN suffixes
fn parse_backup_filename(filename: &str) -> Option<(i32, String, i64, bool)> {
    if !filename.starts_with("steamcampaign0") || !filename.ends_with(".sav") {
        return None;
    }
    let inner = &filename[14..filename.len() - 4];
    let (inner, is_copy) = strip_copy_suffix(inner);

    let parts: Vec<&str> = inner.splitn(2, '_').collect();
    if parts.len() != 2 {
        return None;
    }
    let slot: i32 = parts[0].parse().ok()?;
    let rest = parts[1];

    if !rest.ends_with('d') {
        return None;
    }
    let rest_no_d = &rest[..rest.len() - 1];
    let last_under = rest_no_d.rfind('_')?;
    let day_str = &rest_no_d[last_under + 1..];
    let day: i64 = day_str.parse().ok()?;

    let datetime_part = &rest_no_d[..last_under];
    if datetime_part.len() < 16 {
        return None;
    }

    let iso = format_backup_datetime(datetime_part)?;

    Some((slot, iso, day, is_copy))
}

fn format_backup_datetime(datetime_part: &str) -> Option<String> {
    let parts: Vec<&str> = datetime_part.split('_').collect();
    if parts.len() != 2 {
        return None;
    }
    let date = parts[0];
    let time_segments: Vec<&str> = parts[1].split('-').collect();
    match time_segments.len() {
        2 => Some(format!("{}T{}:{}:00", date, time_segments[0], time_segments[1])),
        3 => Some(format!("{}T{}:{}:{}", date, time_segments[0], time_segments[1], time_segments[2])),
        _ => None,
    }
}

/// Parse: steamcampaign0{slot}_{YYYY-MM-DD}_{HH-MM}.savbackup
fn parse_game_backup_filename(filename: &str) -> Option<(i32, String)> {
    if !filename.starts_with("steamcampaign0") || !filename.ends_with(".savbackup") {
        return None;
    }
    let inner = &filename[14..filename.len() - 10];
    let parts: Vec<&str> = inner.splitn(2, '_').collect();
    if parts.len() != 2 {
        return None;
    }
    let slot: i32 = parts[0].parse().ok()?;
    let datetime_part = parts[1];
    let iso = format_backup_datetime(datetime_part)?;
    Some((slot, iso))
}

// ---- Notes management ----

fn notes_path(backup_dir: &str) -> PathBuf {
    Path::new(backup_dir).join(NOTES_FILE)
}

pub fn load_notes(backup_dir: &str) -> HashMap<String, String> {
    let p = notes_path(backup_dir);
    if !p.is_file() {
        return HashMap::new();
    }
    match fs::read_to_string(&p) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

pub fn save_note_to_file(backup_dir: &str, filename: &str, note: &str) -> Result<(), String> {
    fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;
    let mut notes = load_notes(backup_dir);
    let trimmed = note.trim();
    if trimmed.is_empty() {
        notes.remove(filename);
    } else {
        notes.insert(filename.to_string(), trimmed.to_string());
    }
    let json = serde_json::to_string_pretty(&notes).map_err(|e| e.to_string())?;
    fs::write(notes_path(backup_dir), json).map_err(|e| e.to_string())?;
    Ok(())
}

// ---- Backup name generation ----

fn gen_backup_name(slot: i32, current_day: i64) -> String {
    let now = chrono::Local::now();
    format!(
        "steamcampaign{:02}_{}_{}d.sav",
        slot,
        now.format("%Y-%m-%d_%H-%M-%S"),
        current_day
    )
}

// ---- Avoid collision ----

fn avoid_collision(dir: &str, name: &str) -> PathBuf {
    let p = Path::new(dir).join(name);
    if !p.exists() {
        return p;
    }
    let stem = Path::new(name)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let ext = Path::new(name)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let mut n = 1;
    loop {
        let candidate = Path::new(dir).join(format!("{}_{}{}", stem, n, ext));
        if !candidate.exists() {
            return candidate;
        }
        n += 1;
    }
}

// ---- File hashing ----

pub fn compute_file_hash(path: &str) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

// ---- Public API ----

pub fn create_backup(save_path: &str, backup_dir: &str, slot: i32) -> Result<String, String> {
    if !Path::new(save_path).is_file() {
        return Err("Save file not found".to_string());
    }
    fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;

    let summary = parse_save_summary(Path::new(save_path));
    let name = gen_backup_name(slot, summary.current_day);
    let dst = avoid_collision(backup_dir, &name);

    fs::copy(save_path, &dst).map_err(|e| e.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

pub fn load_backup(
    backup_path: &str,
    save_path: &str,
    backup_dir: &str,
    slot: i32,
) -> Result<Option<String>, String> {
    let mut auto_backup = None;
    if Path::new(save_path).is_file() {
        auto_backup = Some(create_backup(save_path, backup_dir, slot)?);
    }
    fs::copy(backup_path, save_path).map_err(|e| e.to_string())?;
    Ok(auto_backup)
}

pub fn copy_backup(src_path: &str, backup_dir: &str) -> Result<String, String> {
    if !Path::new(src_path).is_file() {
        return Err("Source file not found".to_string());
    }
    fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;

    let name = Path::new(src_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let stem = Path::new(&name)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let ext = Path::new(&name)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let copy_name = format!("{}_copy{}", stem, ext);
    let mut dst = Path::new(backup_dir).join(&copy_name);
    let mut n = 1;
    while dst.exists() {
        dst = Path::new(backup_dir).join(format!("{}_copy{}{}", stem, n, ext));
        n += 1;
    }

    fs::copy(src_path, &dst).map_err(|e| e.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

pub fn delete_backup(path: &str) -> Result<bool, String> {
    match fs::remove_file(path) {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

pub fn list_backups(backup_dir: &str, slot: i32) -> Vec<BackupEntry> {
    let dir = Path::new(backup_dir);
    if !dir.is_dir() {
        return vec![];
    }
    let notes = load_notes(backup_dir);
    let mut entries = Vec::new();

    let read_dir = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let filename = match path.file_name() {
            Some(f) => f.to_string_lossy().to_string(),
            None => continue,
        };
        if !filename.ends_with(".sav") {
            continue;
        }

        if let Some((s, iso, day, is_copy)) = parse_backup_filename(&filename) {
            if s == slot {
                entries.push(BackupEntry {
                    path: path.to_string_lossy().to_string(),
                    filename: filename.clone(),
                    slot: s,
                    backup_time: iso,
                    day_in_name: day,
                    is_game_backup: false,
                    is_copy,
                    note: notes.get(&filename).cloned().unwrap_or_default(),
                    summary: None,
                });
            }
        } else {
            let prefix = format!("steamcampaign{:02}", slot);
            if filename.starts_with(&prefix) {
                let mtime = fs::metadata(&path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| {
                        let dur = t
                            .duration_since(std::time::UNIX_EPOCH)
                            .ok()?;
                        DateTime::from_timestamp(dur.as_secs() as i64, 0)
                    })
                    .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
                    .unwrap_or_default();

                entries.push(BackupEntry {
                    path: path.to_string_lossy().to_string(),
                    filename: filename.clone(),
                    slot,
                    backup_time: mtime,
                    day_in_name: 0,
                    is_game_backup: false,
                    is_copy: false,
                    note: notes.get(&filename).cloned().unwrap_or_default(),
                    summary: None,
                });
            }
        }
    }

    entries
}

pub fn list_game_backups(game_backup_dir: &str, slot: i32) -> Vec<BackupEntry> {
    let dir = Path::new(game_backup_dir);
    if !dir.is_dir() {
        return vec![];
    }
    let mut entries = Vec::new();

    let read_dir = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let filename = match path.file_name() {
            Some(f) => f.to_string_lossy().to_string(),
            None => continue,
        };
        if !filename.ends_with(".savbackup") {
            continue;
        }

        if let Some((s, iso)) = parse_game_backup_filename(&filename) {
            if s == slot {
                entries.push(BackupEntry {
                    path: path.to_string_lossy().to_string(),
                    filename,
                    slot: s,
                    backup_time: iso,
                    day_in_name: 0,
                    is_game_backup: true,
                    is_copy: false,
                    note: String::new(),
                    summary: None,
                });
            }
        }
    }

    entries
}

// ---- Duplicate detection ----

pub fn scan_duplicates(backup_dir: &str, slot: i32) -> Result<ScanResult, String> {
    let entries = list_backups(backup_dir, slot);
    let mut hash_groups: HashMap<String, usize> = HashMap::new();
    for entry in &entries {
        let hash = compute_file_hash(&entry.path)?;
        *hash_groups.entry(hash).or_insert(0) += 1;
    }
    let groups = hash_groups.values().filter(|&&c| c > 1).count();
    let redundant: usize = hash_groups.values().filter(|&&c| c > 1).map(|c| c - 1).sum();
    Ok(ScanResult {
        groups,
        redundant_files: redundant,
    })
}

pub fn dedup_backups(backup_dir: &str, slot: i32) -> Result<DedupResult, String> {
    let entries = list_backups(backup_dir, slot);

    let mut hash_groups: HashMap<String, Vec<BackupEntry>> = HashMap::new();
    for entry in entries {
        let hash = compute_file_hash(&entry.path)?;
        hash_groups.entry(hash).or_default().push(entry);
    }

    let mut groups_found = 0;
    let mut files_removed = 0;
    let mut notes_merged = 0;

    for (_hash, mut group) in hash_groups {
        if group.len() < 2 {
            continue;
        }
        groups_found += 1;

        group.sort_by(|a, b| a.backup_time.cmp(&b.backup_time));

        let mut unique_notes: Vec<String> = Vec::new();
        for e in &group {
            let trimmed = e.note.trim().to_string();
            if !trimmed.is_empty() && !unique_notes.contains(&trimmed) {
                unique_notes.push(trimmed);
            }
        }

        let keeper = group.last().unwrap().clone();
        let merged_note = unique_notes.join(" | ");

        if unique_notes.len() > 1 {
            notes_merged += 1;
        }

        save_note_to_file(backup_dir, &keeper.filename, &merged_note)?;

        let mut notes = load_notes(backup_dir);
        for entry in &group[..group.len() - 1] {
            fs::remove_file(&entry.path).map_err(|e| e.to_string())?;
            notes.remove(&entry.filename);
            files_removed += 1;
        }
        let json = serde_json::to_string_pretty(&notes).map_err(|e| e.to_string())?;
        fs::write(notes_path(backup_dir), json).map_err(|e| e.to_string())?;
    }

    Ok(DedupResult {
        groups_found,
        files_removed,
        notes_merged,
    })
}
