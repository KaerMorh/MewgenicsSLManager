use crate::lz4::decompress_cat;
use rusqlite::types::Value;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::Path;

// ---- Constants ----

const SEX_MAP: &[(i32, &str)] = &[(0, "Male"), (1, "Female"), (2, "Ditto")];

const CAT_CLASSES: &[&str] = &[
    "Colorless",
    "Mage",
    "Fighter",
    "Hunter",
    "Thief",
    "Tank",
    "Medic",
    "Monk",
    "Butcher",
    "Druid",
    "Tinkerer",
    "Necromancer",
    "Psychic",
    "Jester",
];

// ---- Data structures ----

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CatSummary {
    pub key: i64,
    pub name: String,
    pub sex: String,
    pub cat_class: String,
    pub level: i64,
    pub age: i64,
    pub retired: bool,
    pub dead: bool,
    pub donated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SaveSummary {
    pub current_day: i64,
    pub house_gold: i64,
    pub house_food: i64,
    pub save_percent: i64,
    pub cat_count: i64,
    pub cat_alive: i64,
    pub cat_dead: i64,
    pub in_adventure: bool,
    pub adventure_cats: Vec<CatSummary>,
    pub exists: bool,
    pub error: String,
}

// ---- Binary helpers ----

fn u16_le(b: &[u8], off: usize) -> u16 {
    if off + 2 > b.len() {
        return 0;
    }
    u16::from_le_bytes([b[off], b[off + 1]])
}

fn u32_le(b: &[u8], off: usize) -> u32 {
    if off + 4 > b.len() {
        return 0;
    }
    u32::from_le_bytes([b[off], b[off + 1], b[off + 2], b[off + 3]])
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

// ---- Property reader ----

fn read_prop_value(val: &Value) -> i64 {
    match val {
        Value::Integer(i) => *i,
        Value::Real(f) => *f as i64,
        Value::Text(s) => s.trim_end_matches('\0').parse::<i64>().unwrap_or(0),
        Value::Blob(raw) => read_prop_int(raw),
        Value::Null => 0,
    }
}

fn read_prop_int(raw: &[u8]) -> i64 {
    // Try ASCII integer first
    if let Ok(s) = std::str::from_utf8(raw) {
        if let Ok(v) = s.trim_end_matches('\0').parse::<i64>() {
            return v;
        }
    }
    // Try binary
    if raw.len() == 8 {
        return i64::from_le_bytes([
            raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[6], raw[7],
        ]);
    }
    if raw.len() == 4 {
        return i32::from_le_bytes([raw[0], raw[1], raw[2], raw[3]]) as i64;
    }
    0
}

// ---- Adventure state ----

fn parse_adventure_state(blob: &[u8]) -> Vec<i64> {
    if blob.len() < 8 {
        return vec![];
    }
    let cnt = u32_le(blob, 4) as usize;
    if cnt > 8 {
        return vec![];
    }
    let mut off = 8usize;
    let mut keys = Vec::new();
    for _ in 0..cnt {
        if off + 8 > blob.len() {
            break;
        }
        let v = u64_le(blob, off);
        off += 8;
        let hi = ((v >> 32) & 0xFFFFFFFF) as i64;
        let lo = (v & 0xFFFFFFFF) as i64;
        let k = if hi != 0 { hi } else { lo };
        if k > 0 && k <= 1_000_000 {
            keys.push(k);
        }
    }
    keys
}

// ---- Cat blob parsing ----

fn sex_name(id: i32) -> &'static str {
    SEX_MAP
        .iter()
        .find(|(i, _)| *i == id)
        .map(|(_, n)| *n)
        .unwrap_or("Unknown")
}

fn detect_name_and_sex(dec: &[u8]) -> (usize, usize, String, String) {
    // (name_len, name_end_offset, name, sex)
    let mut best: Option<(i32, usize, usize, String, String)> = None;

    for &off_len in &[0x0C_usize, 0x10_usize] {
        if off_len + 4 > dec.len() {
            continue;
        }
        let nl = u32_le(dec, off_len) as usize;
        if nl > 128 {
            continue;
        }
        let end = 0x14 + nl * 2;
        if end > dec.len() {
            continue;
        }

        // Decode UTF-16LE name
        let name_bytes = &dec[0x14..end];
        let name: String = name_bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect::<Vec<u16>>()
            .iter()
            .copied()
            .flat_map(|c| std::char::from_u32(c as u32))
            .collect::<String>()
            .trim_end_matches('\0')
            .to_string();

        let mut sex = "Unknown".to_string();
        let mut score: i32 = 0;

        if end + 14 <= dec.len() {
            let a = u16_le(dec, end + 8) as i32;
            let b = u16_le(dec, end + 12) as i32;
            if a == b && SEX_MAP.iter().any(|(i, _)| *i == a) {
                sex = sex_name(a).to_string();
                score += 4;
            } else if SEX_MAP.iter().any(|(i, _)| *i == a)
                || SEX_MAP.iter().any(|(i, _)| *i == b)
            {
                sex = if SEX_MAP.iter().any(|(i, _)| *i == a) {
                    sex_name(a)
                } else {
                    sex_name(b)
                }
                .to_string();
                score += 2;
            }
        }

        if !name.is_empty() {
            score += 1;
        }

        let cand = (score, nl, end, name, sex);
        if best.is_none() || cand.0 > best.as_ref().unwrap().0 {
            best = Some(cand);
        }
    }

    match best {
        Some((_, _nl, end, name, sex)) => (_nl, end, name, sex),
        None => (0, 0x14, String::new(), "Unknown".to_string()),
    }
}

fn find_class_level(dec: &[u8], name_end: usize) -> (String, i64, i64) {
    let mut cat_class = String::new();
    let mut class_end: Option<usize> = None;

    for &cls in CAT_CLASSES {
        if let Some(idx) = find_ascii(dec, cls.as_bytes(), name_end) {
            cat_class = cls.to_string();
            class_end = Some(idx + cls.len());
            break;
        }
    }

    let mut level: i64;
    let mut birth_day: i64;

    if let Some(ce) = class_end {
        if ce + 32 <= dec.len() {
            level = u32_le(dec, ce) as i64;
            birth_day = u32_le(dec, ce + 12) as i64;
            if birth_day > 2_147_483_647 {
                birth_day = 0;
            }
            if level > 100 {
                let fb = dec.len().wrapping_sub(115);
                let fb_bd = dec.len().wrapping_sub(103);
                let fl = if fb + 4 <= dec.len() {
                    u32_le(dec, fb) as i64
                } else {
                    0
                };
                let fbd = if fb_bd + 4 <= dec.len() {
                    u32_le(dec, fb_bd) as i64
                } else {
                    0
                };
                if (0..=100).contains(&fl) {
                    level = fl;
                    birth_day = if fbd <= 2_147_483_647 { fbd } else { 0 };
                } else {
                    level = 0;
                }
            }
        } else {
            let fb = dec.len().wrapping_sub(115);
            let fb_bd = dec.len().wrapping_sub(103);
            level = if fb + 4 <= dec.len() {
                u32_le(dec, fb) as i64
            } else {
                0
            };
            birth_day = if fb_bd + 4 <= dec.len() {
                u32_le(dec, fb_bd) as i64
            } else {
                0
            };
            if birth_day > 2_147_483_647 {
                birth_day = 0;
            }
            if level > 100 {
                level = 0;
            }
        }
    } else {
        let fb = dec.len().wrapping_sub(115);
        let fb_bd = dec.len().wrapping_sub(103);
        level = if fb + 4 <= dec.len() {
            u32_le(dec, fb) as i64
        } else {
            0
        };
        birth_day = if fb_bd + 4 <= dec.len() {
            u32_le(dec, fb_bd) as i64
        } else {
            0
        };
        if birth_day > 2_147_483_647 {
            birth_day = 0;
        }
        if level > 100 {
            level = 0;
        }
    }

    (cat_class, level, birth_day)
}

fn find_ascii(haystack: &[u8], needle: &[u8], start: usize) -> Option<usize> {
    if needle.is_empty() || start + needle.len() > haystack.len() {
        return None;
    }
    haystack[start..]
        .windows(needle.len())
        .position(|w| w == needle)
        .map(|p| p + start)
}

fn read_status_flags(dec: &[u8], name_end: usize) -> (bool, bool, bool) {
    let off = name_end + 0x10;
    if off + 2 > dec.len() {
        return (false, false, false);
    }
    let f = u16_le(dec, off);
    (f & 0x0002 != 0, f & 0x0020 != 0, f & 0x4000 != 0)
}

fn parse_cat_summary(blob: &[u8], current_day: i64) -> Option<CatSummary> {
    let dec = decompress_cat(blob).ok()?;
    if dec.len() < 12 {
        return None;
    }

    let (_, name_end, name, sex) = detect_name_and_sex(&dec);
    let (retired, dead, donated) = read_status_flags(&dec, name_end);
    let (cat_class, level, birth_day) = find_class_level(&dec, name_end);

    Some(CatSummary {
        key: 0,
        name,
        sex,
        cat_class,
        level,
        age: (current_day - birth_day).max(0),
        retired,
        dead,
        donated,
    })
}

// ---- Public API ----

pub fn parse_save_summary(path: &Path) -> SaveSummary {
    if !path.exists() {
        return SaveSummary {
            error: "file not found".to_string(),
            ..Default::default()
        };
    }

    let path_str = path.to_string_lossy();
    let conn = match Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
    ) {
        Ok(c) => c,
        Err(e) => {
            return SaveSummary {
                error: format!("Cannot open {}: {}", path_str, e),
                ..Default::default()
            }
        }
    };

    let mut s = SaveSummary {
        exists: true,
        ..Default::default()
    };

    // Read properties
    if let Ok(mut stmt) = conn.prepare(
        "SELECT key, data FROM properties WHERE key IN ('current_day','house_gold','house_food','save_file_percent')",
    ) {
        if let Ok(rows) = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let data: Value = row.get(1)?;
            Ok((key, data))
        }) {
            for row in rows.flatten() {
                let (key, data) = row;
                let val = read_prop_value(&data);
                match key.as_str() {
                    "current_day" => s.current_day = val,
                    "house_gold" => s.house_gold = val,
                    "house_food" => s.house_food = val,
                    "save_file_percent" => s.save_percent = val,
                    _ => {}
                }
            }
        }
    }

    // Count cats
    if let Ok(count) = conn.query_row("SELECT COUNT(*) FROM cats", [], |row| row.get::<_, i64>(0))
    {
        s.cat_count = count;
    }

    // Parse all cats for alive/dead count
    if let Ok(mut stmt) = conn.prepare("SELECT key, data FROM cats") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let key: i64 = row.get(0)?;
            let data: Vec<u8> = row.get(1)?;
            Ok((key, data))
        }) {
            for row in rows.flatten() {
                let (_key, blob) = row;
                if let Some(cs) = parse_cat_summary(&blob, s.current_day) {
                    if cs.dead {
                        s.cat_dead += 1;
                    } else {
                        s.cat_alive += 1;
                    }
                }
            }
        }
    }

    // Adventure state
    let mut adventure_keys: Vec<i64> = Vec::new();
    if let Ok(mut stmt) = conn.prepare("SELECT data FROM files WHERE key='adventure_state'") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let data: Vec<u8> = row.get(0)?;
            Ok(data)
        }) {
            for row in rows.flatten() {
                adventure_keys = parse_adventure_state(&row);
            }
        }
    }

    s.in_adventure = !adventure_keys.is_empty();

    // Parse adventure cats
    for k in &adventure_keys {
        if let Ok(mut stmt) = conn.prepare("SELECT data FROM cats WHERE key=?1") {
            if let Ok(rows) = stmt.query_map([k], |row| {
                let data: Vec<u8> = row.get(0)?;
                Ok(data)
            }) {
                for row in rows.flatten() {
                    if let Some(mut cs) = parse_cat_summary(&row, s.current_day) {
                        cs.key = *k;
                        s.adventure_cats.push(cs);
                    }
                }
            }
        }
    }

    s
}
