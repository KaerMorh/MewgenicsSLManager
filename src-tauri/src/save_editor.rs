use crate::lz4::{decompress_cat_with_variant, recompress_cat};
use crate::save_parser::{CatAbilities, CatStats, FurnitureItem, MUTATION_SLOTS};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

// ---- Change structures ----

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SaveChanges {
    #[serde(default)]
    pub basic: Option<BasicChanges>,
    #[serde(default)]
    pub cats: HashMap<String, CatChanges>,
    #[serde(default)]
    pub furniture: Option<FurnitureChanges>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BasicChanges {
    pub current_day: Option<i64>,
    pub house_gold: Option<i64>,
    pub house_food: Option<i64>,
    pub save_percent: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CatChanges {
    pub name: Option<String>,
    pub sex: Option<String>,
    pub age: Option<i64>,
    pub level: Option<i64>,
    pub retired: Option<bool>,
    pub stats: Option<CatStats>,
    pub abilities: Option<CatAbilities>,
    pub mutations: Option<HashMap<String, u32>>,
    // Internal offsets passed from frontend
    #[serde(rename = "_name_end")]
    pub name_end: Option<usize>,
    #[serde(rename = "_name_len")]
    pub name_len: Option<usize>,
    #[serde(rename = "_level_offset")]
    pub level_offset: Option<usize>,
    #[serde(rename = "_birth_day_offset")]
    pub birth_day_offset: Option<usize>,
    #[serde(rename = "_stats_offset")]
    pub stats_offset: Option<i64>,
    #[serde(rename = "_birth_day")]
    pub birth_day: Option<i64>,
    #[serde(rename = "_current_day")]
    pub current_day: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FurnitureChanges {
    #[serde(default)]
    pub added: Vec<FurnitureItem>,
    #[serde(default)]
    pub removed: Vec<i64>,
}

// ---- Binary helpers ----

fn u16_le(b: &[u8], off: usize) -> u16 {
    if off + 2 > b.len() {
        return 0;
    }
    u16::from_le_bytes([b[off], b[off + 1]])
}

fn u64_le(b: &[u8], off: usize) -> u64 {
    if off + 8 > b.len() {
        return 0;
    }
    u64::from_le_bytes([
        b[off],
        b[off + 1],
        b[off + 2],
        b[off + 3],
        b[off + 4],
        b[off + 5],
        b[off + 6],
        b[off + 7],
    ])
}

fn write_u16_le(b: &mut [u8], off: usize, val: u16) {
    if off + 2 <= b.len() {
        let bytes = val.to_le_bytes();
        b[off] = bytes[0];
        b[off + 1] = bytes[1];
    }
}

fn write_u32_le(b: &mut [u8], off: usize, val: u32) {
    if off + 4 <= b.len() {
        let bytes = val.to_le_bytes();
        b[off] = bytes[0];
        b[off + 1] = bytes[1];
        b[off + 2] = bytes[2];
        b[off + 3] = bytes[3];
    }
}

fn write_i32_le(b: &mut [u8], off: usize, val: i32) {
    if off + 4 <= b.len() {
        let bytes = val.to_le_bytes();
        b[off] = bytes[0];
        b[off + 1] = bytes[1];
        b[off + 2] = bytes[2];
        b[off + 3] = bytes[3];
    }
}

// ---- Ability writing ----

/// Rebuild abilities section in the cat blob.
/// Finds the u64-run starting with "DefaultMove" and replaces it in-place.
fn write_abilities_to_blob(dec: &mut Vec<u8>, abilities: &CatAbilities) -> bool {
    let n = dec.len();

    // Find u64-run starting with "DefaultMove"
    let mut run_start = None;
    for start in 0..n.saturating_sub(19) {
        if start + 8 > n {
            break;
        }
        let ln = u64_le(dec, start) as usize;
        if ln != 11 || start + 8 + ln > n {
            continue;
        }
        if &dec[start + 8..start + 8 + ln] == b"DefaultMove" {
            run_start = Some(start);
            break;
        }
    }

    let start = match run_start {
        Some(s) => s,
        None => return false,
    };

    // Parse existing u64-run items to find boundaries
    let mut items: Vec<(usize, usize, String)> = Vec::new(); // (offset, len, value)
    let mut i = start;
    for _ in 0..64 {
        if i + 8 > n {
            break;
        }
        let slen = u64_le(dec, i) as usize;
        if slen > 96 || i + 8 + slen > n {
            if i + 4 <= n
                && (dec[i..i + 4] == [1, 0, 0, 0] || dec[i..i + 4] == [2, 0, 0, 0])
            {
                break;
            }
            break;
        }
        if slen == 0 {
            items.push((i, 0, String::new()));
            i += 8;
            continue;
        }
        let sb = &dec[i + 8..i + 8 + slen];
        if sb.iter().any(|&c| c == 0 || c < 32 || c >= 127) {
            break;
        }
        match std::str::from_utf8(sb) {
            Ok(s) => {
                items.push((i, slen, s.to_string()));
                i += 8 + slen;
            }
            Err(_) => break,
        }
    }

    // Check for separator and secondary u64-run
    let mut o = i;
    let has_separator = o + 4 <= n && dec[o..o + 4] == [2, 0, 0, 0];
    if has_separator {
        o += 4;
        if o + 8 <= n {
            let slen = u64_le(dec, o) as usize;
            if slen > 0 && slen <= 96 && o + 8 + slen <= n {
                o += 8 + slen;
            }
        }
    }

    // Parse StringRec blocks
    let mut stringrec_count = 0usize;
    for _ in 0..4 {
        if o + 12 > n {
            break;
        }
        if dec[o..o + 4] != [1, 0, 0, 0] {
            break;
        }
        let slen = u64_le(dec, o + 4) as usize;
        if slen > 96 || o + 12 + slen > n {
            break;
        }
        stringrec_count += 1;
        o += 12 + slen;
    }
    let section_end = o;

    // Build new u64-run section
    let mut new_data: Vec<u8> = Vec::new();
    for idx in 0..items.len() {
        let new_val = if idx < 6 {
            abilities
                .active
                .get(idx)
                .and_then(|v| v.clone())
                .unwrap_or_else(|| items[idx].2.clone())
        } else if idx == 10 {
            abilities
                .passive
                .first()
                .and_then(|v| v.clone())
                .unwrap_or_else(|| items[idx].2.clone())
        } else if idx == 11 {
            abilities
                .passive
                .get(1)
                .and_then(|v| v.clone())
                .unwrap_or_else(|| items[idx].2.clone())
        } else {
            items[idx].2.clone()
        };

        let val_bytes = new_val.as_bytes();
        new_data.extend_from_slice(&(val_bytes.len() as u64).to_le_bytes());
        new_data.extend_from_slice(val_bytes);
    }

    // Re-add separator if it existed
    if has_separator {
        new_data.extend_from_slice(&[2, 0, 0, 0]);
        let passive2 = abilities
            .passive
            .get(1)
            .and_then(|v| v.clone())
            .unwrap_or_default();
        if !passive2.is_empty() {
            let val_bytes = passive2.as_bytes();
            new_data.extend_from_slice(&(val_bytes.len() as u64).to_le_bytes());
            new_data.extend_from_slice(val_bytes);
        }
    }

    // Re-add StringRec blocks for disorders
    for idx in 0..stringrec_count {
        new_data.extend_from_slice(&[1, 0, 0, 0]);
        let val = if has_separator {
            abilities
                .disorder
                .get(idx)
                .and_then(|v| v.clone())
                .unwrap_or_else(|| "None".to_string())
        } else if idx == 0 {
            abilities
                .passive
                .get(1)
                .and_then(|v| v.clone())
                .unwrap_or_else(|| "None".to_string())
        } else {
            abilities
                .disorder
                .get(idx - 1)
                .and_then(|v| v.clone())
                .unwrap_or_else(|| "None".to_string())
        };
        let val_str = if val.is_empty() { "None" } else { &val };
        let val_bytes = val_str.as_bytes();
        new_data.extend_from_slice(&(val_bytes.len() as u64).to_le_bytes());
        new_data.extend_from_slice(val_bytes);
    }

    // Replace the section in the blob
    let prefix = dec[..start].to_vec();
    let suffix = dec[section_end..].to_vec();
    dec.clear();
    dec.extend_from_slice(&prefix);
    dec.extend_from_slice(&new_data);
    dec.extend_from_slice(&suffix);

    true
}

/// Write T-array mutations to cat blob
fn write_t_array(dec: &mut [u8], name_end: usize, mutations: &HashMap<String, u32>) {
    let t_start = name_end + 0x74;
    for &(idx, field_name) in MUTATION_SLOTS {
        if let Some(&val) = mutations.get(field_name) {
            let offset = t_start + idx * 4;
            write_u32_le(dec, offset, val);
        }
    }
}

// ---- Main modification function ----

pub fn modify_save_file(path: &Path, changes: &SaveChanges) -> Result<(), String> {
    if !path.exists() {
        return Err("Save file not found".to_string());
    }

    // Create auto-backup before modifying
    let backup_path = path.with_extension("sav.editor_backup");
    std::fs::copy(path, &backup_path).map_err(|e| format!("Failed to create backup: {}", e))?;

    let conn = Connection::open(path).map_err(|e| format!("Cannot open save: {}", e))?;

    // Apply basic data changes
    if let Some(basic) = &changes.basic {
        if let Some(val) = basic.current_day {
            conn.execute(
                "UPDATE properties SET data = ? WHERE key = 'current_day'",
                [val.to_string().as_bytes()],
            )
            .map_err(|e| format!("Failed to update current_day: {}", e))?;
        }
        if let Some(val) = basic.house_gold {
            conn.execute(
                "UPDATE properties SET data = ? WHERE key = 'house_gold'",
                [val.to_string().as_bytes()],
            )
            .map_err(|e| format!("Failed to update house_gold: {}", e))?;
        }
        if let Some(val) = basic.house_food {
            conn.execute(
                "UPDATE properties SET data = ? WHERE key = 'house_food'",
                [val.to_string().as_bytes()],
            )
            .map_err(|e| format!("Failed to update house_food: {}", e))?;
        }
        if let Some(val) = basic.save_percent {
            conn.execute(
                "UPDATE properties SET data = ? WHERE key = 'save_file_percent'",
                [val.to_string().as_bytes()],
            )
            .map_err(|e| format!("Failed to update save_file_percent: {}", e))?;
        }
    }

    // Apply cat changes
    for (cat_key_str, cat_changes) in &changes.cats {
        let cat_key: i64 = cat_key_str
            .parse()
            .map_err(|_| format!("Invalid cat key: {}", cat_key_str))?;

        let blob: Vec<u8> = conn
            .query_row("SELECT data FROM cats WHERE key=?1", [cat_key], |row| {
                row.get(0)
            })
            .map_err(|e| format!("Cat {} not found: {}", cat_key, e))?;

        let (dec_data, variant) =
            decompress_cat_with_variant(&blob).map_err(|e| format!("Decompress failed: {}", e))?;
        let mut dec = dec_data;

        let name_end = cat_changes.name_end.unwrap_or(0x14);

        // Modify name
        if let Some(ref new_name) = cat_changes.name {
            let name_len_chars = cat_changes.name_len.unwrap_or(0);
            if name_end > 0x14 && name_len_chars > 0 {
                let truncated: String = new_name.chars().take(32).collect();
                let new_name_bytes: Vec<u8> = truncated
                    .encode_utf16()
                    .flat_map(|c| c.to_le_bytes())
                    .collect();
                let old_name_byte_len = name_len_chars * 2;
                let name_start = 0x14;
                for i in 0..old_name_byte_len {
                    if name_start + i < dec.len() {
                        dec[name_start + i] = if i < new_name_bytes.len() {
                            new_name_bytes[i]
                        } else {
                            0
                        };
                    }
                }
            }
        }

        // Modify sex
        if let Some(ref new_sex) = cat_changes.sex {
            let sex_val: u16 = match new_sex.as_str() {
                "Male" => 0,
                "Female" => 1,
                "Ditto" => 2,
                _ => 0,
            };
            let off_a = name_end + 8;
            let off_b = name_end + 12;
            if off_b + 2 <= dec.len() {
                write_u16_le(&mut dec, off_a, sex_val);
                write_u16_le(&mut dec, off_b, sex_val);
            }
        }

        // Modify retired status
        if let Some(retired) = cat_changes.retired {
            let flags_off = name_end + 0x10;
            if flags_off + 2 <= dec.len() {
                let mut flags = u16_le(&dec, flags_off);
                if retired {
                    flags |= 0x0002;
                } else {
                    flags &= !0x0002;
                }
                write_u16_le(&mut dec, flags_off, flags);
            }
        }

        // Modify age (via birth_day)
        if let Some(new_age) = cat_changes.age {
            if let Some(bd_offset) = cat_changes.birth_day_offset {
                let current_day = cat_changes.current_day.unwrap_or(0);
                let new_birth_day = (current_day - new_age).max(0) as u32;
                write_u32_le(&mut dec, bd_offset, new_birth_day);
            }
        }

        // Modify level
        if let Some(new_level) = cat_changes.level {
            if let Some(lv_offset) = cat_changes.level_offset {
                write_u32_le(&mut dec, lv_offset, new_level as u32);
            }
        }

        // Modify stats
        if let Some(ref new_stats) = cat_changes.stats {
            if let Some(stats_off) = cat_changes.stats_offset {
                if stats_off >= 0 {
                    let off = stats_off as usize;
                    write_i32_le(&mut dec, off, new_stats.str_val);
                    write_i32_le(&mut dec, off + 4, new_stats.dex);
                    write_i32_le(&mut dec, off + 8, new_stats.con);
                    write_i32_le(&mut dec, off + 12, new_stats.int_val);
                    write_i32_le(&mut dec, off + 16, new_stats.spd);
                    write_i32_le(&mut dec, off + 20, new_stats.cha);
                    write_i32_le(&mut dec, off + 24, new_stats.luck);
                }
            }
        }

        // Modify abilities
        if let Some(ref new_abilities) = cat_changes.abilities {
            write_abilities_to_blob(&mut dec, new_abilities);
        }

        // Modify mutations
        if let Some(ref new_mutations) = cat_changes.mutations {
            write_t_array(&mut dec, name_end, new_mutations);
        }

        // Re-compress and save
        let new_blob = recompress_cat(&dec, variant);
        conn.execute(
            "UPDATE cats SET data = ? WHERE key = ?",
            rusqlite::params![new_blob, cat_key],
        )
        .map_err(|e| format!("Failed to update cat {}: {}", cat_key, e))?;
    }

    // Apply furniture changes
    if let Some(furn_changes) = &changes.furniture {
        for key in &furn_changes.removed {
            conn.execute("DELETE FROM furniture WHERE key = ?", [key])
                .map_err(|e| format!("Failed to remove furniture: {}", e))?;
        }

        for furn in &furn_changes.added {
            // Delete if exists (replacement)
            let _ = conn.execute("DELETE FROM furniture WHERE key = ?", [furn.key]);

            let fid_bytes = furn.furniture_id.as_bytes();
            let x = furn.x.unwrap_or(256);
            let y = furn.y.unwrap_or(256);

            // Build furniture BLOB for backpack furniture
            let mut blob_data: Vec<u8> = Vec::new();
            blob_data.extend_from_slice(&1u32.to_le_bytes()); // uncomp_len = 1
            blob_data.extend_from_slice(&(fid_bytes.len() as u32).to_le_bytes()); // comp_len
            blob_data.extend_from_slice(&[0u8; 4]); // padding
            blob_data.extend_from_slice(fid_bytes); // furniture id
            blob_data.push(0); // null terminator
            blob_data.extend_from_slice(&[0u8; 28]); // padding
            blob_data.extend_from_slice(&x.to_le_bytes());
            blob_data.extend_from_slice(&y.to_le_bytes());
            blob_data.extend_from_slice(&1u32.to_le_bytes());
            blob_data.extend_from_slice(&1u32.to_le_bytes());

            conn.execute(
                "INSERT INTO furniture (key, data) VALUES (?, ?)",
                rusqlite::params![furn.key, blob_data],
            )
            .map_err(|e| format!("Failed to add furniture: {}", e))?;
        }
    }

    Ok(())
}
