use crate::lz4::{decompress_cat, decompress_cat_with_variant};
use rusqlite::types::Value;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

// ---- Constants ----

const SEX_MAP: &[(i32, &str)] = &[(0, "Male"), (1, "Female"), (2, "Ditto")];

pub const CAT_CLASSES: &[&str] = &[
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

// T-array mutation slot mapping: index -> field name
pub const MUTATION_SLOTS: &[(usize, &str)] = &[
    (0, "body"),
    (1, "bodyFur"),
    (5, "head"),
    (6, "headFur"),
    (10, "tail"),
    (11, "tailFur"),
    (15, "legL"),
    (16, "legLFur"),
    (20, "legR"),
    (21, "legRFur"),
    (25, "armL"),
    (26, "armLFur"),
    (30, "armR"),
    (31, "armRFur"),
    (35, "eyeL"),
    (36, "eyeLFur"),
    (40, "eyeR"),
    (41, "eyeRFur"),
    (45, "eyebrowL"),
    (46, "eyebrowLFur"),
    (50, "eyebrowR"),
    (51, "eyebrowRFur"),
    (55, "earL"),
    (56, "earLFur"),
    (60, "earR"),
    (61, "earRFur"),
    (65, "mouth"),
    (66, "mouthFur"),
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

// ---- Extended data structures for the editor ----

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CatStats {
    #[serde(rename = "STR")]
    pub str_val: i32,
    #[serde(rename = "DEX")]
    pub dex: i32,
    #[serde(rename = "CON")]
    pub con: i32,
    #[serde(rename = "INT")]
    pub int_val: i32,
    #[serde(rename = "SPD")]
    pub spd: i32,
    #[serde(rename = "CHA")]
    pub cha: i32,
    #[serde(rename = "LUCK")]
    pub luck: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CatAbilities {
    pub active: Vec<Option<String>>,
    pub passive: Vec<Option<String>>,
    pub disorder: Vec<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CatDetail {
    pub key: i64,
    pub name: String,
    pub sex: String,
    pub cat_class: String,
    pub level: i64,
    pub age: i64,
    pub retired: bool,
    pub dead: bool,
    pub donated: bool,
    pub stats: CatStats,
    pub abilities: CatAbilities,
    pub mutations: HashMap<String, u32>,
    pub room: String,
    #[serde(rename = "_variant")]
    pub variant: String,
    #[serde(rename = "_name_end")]
    pub name_end: usize,
    #[serde(rename = "_name_len")]
    pub name_len: usize,
    #[serde(rename = "_level_offset")]
    pub level_offset: usize,
    #[serde(rename = "_birth_day_offset")]
    pub birth_day_offset: usize,
    #[serde(rename = "_stats_offset")]
    pub stats_offset: i64,
    #[serde(rename = "_birth_day")]
    pub birth_day: i64,
    #[serde(rename = "_current_day")]
    pub current_day: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BasicData {
    pub current_day: i64,
    pub house_gold: i64,
    pub house_food: i64,
    pub save_percent: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FurnitureItem {
    pub key: i64,
    pub furniture_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub room: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FurnitureData {
    pub backpack: Vec<FurnitureItem>,
    pub placed: Vec<FurnitureItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SaveDetail {
    pub basic: BasicData,
    pub cats: Vec<CatDetail>,
    pub furniture: FurnitureData,
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

/// Returns (class_name, level, birth_day, level_offset, birth_day_offset)
fn find_class_level_ext(dec: &[u8], name_end: usize) -> (String, i64, i64, usize, usize) {
    let mut cat_class = String::new();
    let mut class_end: Option<usize> = None;

    for &cls in CAT_CLASSES {
        if let Some(idx) = find_ascii(dec, cls.as_bytes(), name_end) {
            cat_class = cls.to_string();
            class_end = Some(idx + cls.len());
            break;
        }
    }

    let fb = dec.len().wrapping_sub(115);
    let fb_bd = dec.len().wrapping_sub(103);
    let fallback_level = if fb + 4 <= dec.len() {
        u32_le(dec, fb) as i64
    } else {
        0
    };
    let mut fallback_bd = if fb_bd + 4 <= dec.len() {
        u32_le(dec, fb_bd) as i64
    } else {
        0
    };
    if fallback_bd > 2_147_483_647 {
        fallback_bd = 0;
    }

    if (1..=100).contains(&fallback_level) {
        return (cat_class, fallback_level, fallback_bd, fb, fb_bd);
    }

    if let Some(ce) = class_end {
        if ce + 32 <= dec.len() {
            let level = u32_le(dec, ce) as i64;
            let mut birth_day = u32_le(dec, ce + 12) as i64;
            if birth_day > 2_147_483_647 {
                birth_day = 0;
            }
            if level <= 100 {
                return (cat_class, level, birth_day, ce, ce + 12);
            }
        }
    }

    let level = if (0..=100).contains(&fallback_level) {
        fallback_level
    } else {
        0
    };
    (cat_class, level, fallback_bd, fb, fb_bd)
}

fn find_class_level(dec: &[u8], name_end: usize) -> (String, i64, i64) {
    let (cls, lv, bd, _, _) = find_class_level_ext(dec, name_end);
    (cls, lv, bd)
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

// ---- Extended parsing for editor ----

fn find_stats(dec: &[u8]) -> Option<(usize, [i32; 7])> {
    let n = dec.len();
    if n < 28 {
        return None;
    }
    let expected: usize = 0x1CC;
    let window: usize = 0x140;
    let lo = expected.saturating_sub(window);
    let hi = (n - 28).min(expected + window);
    if lo > hi {
        return None;
    }

    let mut best_score = f64::NEG_INFINITY;
    let mut best: Option<(usize, [i32; 7])> = None;

    for off in lo..=hi {
        let vals = [
            i32::from_le_bytes([dec[off], dec[off + 1], dec[off + 2], dec[off + 3]]),
            i32::from_le_bytes([dec[off + 4], dec[off + 5], dec[off + 6], dec[off + 7]]),
            i32::from_le_bytes([dec[off + 8], dec[off + 9], dec[off + 10], dec[off + 11]]),
            i32::from_le_bytes([dec[off + 12], dec[off + 13], dec[off + 14], dec[off + 15]]),
            i32::from_le_bytes([dec[off + 16], dec[off + 17], dec[off + 18], dec[off + 19]]),
            i32::from_le_bytes([dec[off + 20], dec[off + 21], dec[off + 22], dec[off + 23]]),
            i32::from_le_bytes([dec[off + 24], dec[off + 25], dec[off + 26], dec[off + 27]]),
        ];
        if vals.iter().any(|&v| v < 1 || v > 7) {
            continue;
        }
        let dist = if off > expected {
            off - expected
        } else {
            expected - off
        } as f64;
        let s: f64 = vals.iter().map(|&v| v as f64).sum();
        let score = (1000.0 - dist) + s * 0.1;
        if score > best_score {
            best_score = score;
            best = Some((off, vals));
        }
    }

    best
}

fn read_t_array(dec: &[u8], name_end: usize) -> HashMap<String, u32> {
    let mut mutations = HashMap::new();
    let t_start = name_end + 0x74;
    for &(idx, field_name) in MUTATION_SLOTS {
        let offset = t_start + idx * 4;
        if offset + 4 > dec.len() {
            continue;
        }
        let val = u32_le(dec, offset);
        if val > 1 {
            mutations.insert(field_name.to_string(), val);
        }
    }
    mutations
}

fn parse_abilities_and_mutations(dec: &[u8], name_end: usize) -> (CatAbilities, HashMap<String, u32>) {
    let mut abilities = CatAbilities {
        active: vec![None; 6],
        passive: vec![None; 2],
        disorder: vec![None; 2],
    };
    let n = dec.len();

    // Search for u64-run starting with "DefaultMove"
    for start in 0..n.saturating_sub(16) {
        if start + 8 > n {
            break;
        }
        let ln = u64_le(dec, start) as usize;
        if ln != 11 || start + 8 + ln > n {
            continue;
        }
        if &dec[start + 8..start + 8 + ln] != b"DefaultMove" {
            continue;
        }

        // Parse u64-run items — skip embedded \x01/\x02 markers like the reference parser
        let mut items: Vec<String> = Vec::new();
        let mut i = start;
        for _ in 0..64 {
            if i + 8 > n {
                break;
            }
            let slen = u64_le(dec, i) as usize;
            let valid_len = slen <= 96 && i + 8 + slen <= n;
            if !valid_len {
                // Check for 4-byte marker — skip it and continue (not break)
                if i + 4 <= n
                    && (dec[i..i + 4] == [1, 0, 0, 0] || dec[i..i + 4] == [2, 0, 0, 0])
                {
                    i += 4;
                    continue;
                }
                break;
            }
            if slen == 0 {
                items.push(String::new());
                i += 8;
                continue;
            }
            let sb = &dec[i + 8..i + 8 + slen];
            if sb.iter().any(|&c| c == 0 || c < 32 || c >= 127) {
                // Also check for marker before breaking
                if i + 4 <= n
                    && (dec[i..i + 4] == [1, 0, 0, 0] || dec[i..i + 4] == [2, 0, 0, 0])
                {
                    i += 4;
                    continue;
                }
                break;
            }
            match std::str::from_utf8(sb) {
                Ok(s) => {
                    items.push(s.to_string());
                    i += 8 + slen;
                }
                Err(_) => break,
            }
        }

        // Active: items[0:6]
        for idx in 0..6 {
            if idx < items.len() {
                let val = &items[idx];
                abilities.active[idx] = if val.is_empty() || val == "None" {
                    None
                } else {
                    Some(val.clone())
                };
            }
        }

        // Passive: items[10] and items[11]
        if items.len() > 10 {
            let val = &items[10];
            abilities.passive[0] = if val.is_empty() || val == "None" {
                None
            } else {
                Some(val.clone())
            };
        }
        if items.len() > 11 {
            let val = &items[11];
            abilities.passive[1] = if val.is_empty() || val == "None" {
                None
            } else {
                Some(val.clone())
            };
        }

        // Check for separator and secondary u64-run (Passive2)
        let mut o = i;
        let has_separator = o + 4 <= n && dec[o..o + 4] == [2, 0, 0, 0];
        if has_separator {
            o += 4;
            if o + 8 <= n {
                let slen = u64_le(dec, o) as usize;
                if slen > 0 && slen <= 96 && o + 8 + slen <= n {
                    if let Ok(s) = std::str::from_utf8(&dec[o + 8..o + 8 + slen]) {
                        if !s.is_empty() && s != "None" {
                            abilities.passive[1] = Some(s.to_string());
                        }
                        o += 8 + slen;
                    }
                }
            }
        }

        // Parse StringRec blocks: [\x01\x00\x00\x00][u64 len][ASCII string]
        let mut stringrec_idx = 0usize;
        let mut disorder_idx = 0usize;
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
            match std::str::from_utf8(&dec[o + 12..o + 12 + slen]) {
                Ok(s) => {
                    let val = if s.is_empty() || s == "None" {
                        None
                    } else {
                        Some(s.to_string())
                    };
                    if has_separator {
                        if disorder_idx < 2 {
                            abilities.disorder[disorder_idx] = val;
                        }
                        disorder_idx += 1;
                    } else {
                        if stringrec_idx == 0 {
                            abilities.passive[1] = val;
                        } else if stringrec_idx <= 2 {
                            abilities.disorder[stringrec_idx - 1] = val;
                        }
                        stringrec_idx += 1;
                    }
                    o += 12 + slen;
                }
                Err(_) => break,
            }
        }

        let mutations = if name_end > 0 {
            read_t_array(dec, name_end)
        } else {
            HashMap::new()
        };
        return (abilities, mutations);
    }

    let mutations = if name_end > 0 {
        read_t_array(dec, name_end)
    } else {
        HashMap::new()
    };
    (abilities, mutations)
}

fn parse_house_state(blob: &[u8]) -> Vec<(i64, String)> {
    if blob.len() < 8 {
        return vec![];
    }
    let ver = u32_le(blob, 0);
    let cnt = u32_le(blob, 4) as usize;
    if ver != 0 || cnt > 512 {
        return vec![];
    }
    let mut off = 8usize;
    let mut cats = Vec::new();
    for _ in 0..cnt {
        if off + 16 > blob.len() {
            break;
        }
        let key = u32_le(blob, off) as i64;
        let room_len = u64_le(blob, off + 8) as usize;
        let name_off = off + 16;
        if name_off + room_len > blob.len() {
            break;
        }
        let room = String::from_utf8_lossy(&blob[name_off..name_off + room_len]).to_string();
        let d_off = name_off + room_len;
        if d_off + 24 > blob.len() {
            break;
        }
        cats.push((key, room));
        off = d_off + 24;
    }
    cats
}

fn parse_furniture_data(conn: &Connection) -> FurnitureData {
    let mut result = FurnitureData::default();

    let mut stmt = match conn.prepare("SELECT key, data FROM furniture") {
        Ok(s) => s,
        Err(_) => return result,
    };

    let rows = match stmt.query_map([], |row| {
        let key: i64 = row.get(0)?;
        let data: Vec<u8> = row.get(1)?;
        Ok((key, data))
    }) {
        Ok(r) => r,
        Err(_) => return result,
    };

    for row in rows.flatten() {
        let (key, data) = row;
        if data.len() < 16 {
            continue;
        }
        // Skip 8-byte header
        let mut offset = 8usize;
        // Skip zero padding
        while offset < data.len() && data[offset] == 0 {
            offset += 1;
        }
        // Read null-terminated furniture_id
        let id_start = offset;
        while offset < data.len() && data[offset] != 0 {
            offset += 1;
        }
        let furniture_id = if offset > id_start {
            String::from_utf8_lossy(&data[id_start..offset]).to_string()
        } else {
            "unknown".to_string()
        };
        offset += 1; // skip null terminator

        // Skip zero padding before room
        let mut check_offset = offset;
        while check_offset < data.len() && data[check_offset] == 0 {
            check_offset += 1;
        }

        // Try reading room name (u64 length + string)
        let mut room: Option<String> = None;
        if check_offset + 8 <= data.len() {
            let room_len = u64_le(&data, check_offset) as usize;
            if room_len > 0 && room_len < 64 && check_offset + 8 + room_len <= data.len() {
                room = Some(
                    String::from_utf8_lossy(&data[check_offset + 8..check_offset + 8 + room_len])
                        .to_string(),
                );
                offset = check_offset + 8 + room_len;
            }
        }

        // Try finding coordinates
        let (mut x, mut y) = (None, None);
        if room.is_none() {
            if check_offset + 8 <= data.len() {
                let vx = i32::from_le_bytes([
                    data[check_offset],
                    data[check_offset + 1],
                    data[check_offset + 2],
                    data[check_offset + 3],
                ]);
                let vy = i32::from_le_bytes([
                    data[check_offset + 4],
                    data[check_offset + 5],
                    data[check_offset + 6],
                    data[check_offset + 7],
                ]);
                if (-1000..=1000).contains(&vx) && (-1000..=1000).contains(&vy) {
                    x = Some(vx);
                    y = Some(vy);
                }
            }
        } else {
            let search_end = data.len().saturating_sub(8).min(offset + 100);
            let mut i = offset;
            while i <= search_end {
                if i % 4 != 0 {
                    i += 1;
                    continue;
                }
                let vx = i32::from_le_bytes([data[i], data[i + 1], data[i + 2], data[i + 3]]);
                let vy =
                    i32::from_le_bytes([data[i + 4], data[i + 5], data[i + 6], data[i + 7]]);
                if (-1000..=1000).contains(&vx) && (-1000..=1000).contains(&vy) {
                    x = Some(vx);
                    y = Some(vy);
                    break;
                }
                i += 4;
            }
        }

        let item = FurnitureItem {
            key,
            furniture_id,
            room: room.clone(),
            x,
            y,
        };

        if room.is_none() {
            result.backpack.push(item);
        } else {
            result.placed.push(item);
        }
    }

    result
}

fn parse_cat_detail(
    blob: &[u8],
    key: i64,
    current_day: i64,
    room: &str,
) -> Option<CatDetail> {
    let (dec, variant) = decompress_cat_with_variant(blob).ok()?;
    if dec.len() < 12 {
        return None;
    }

    let (name_len, name_end, name, sex) = detect_name_and_sex(&dec);
    let (retired, dead, donated) = read_status_flags(&dec, name_end);
    let (cat_class, level, birth_day, level_offset, birth_day_offset) =
        find_class_level_ext(&dec, name_end);
    let age = (current_day - birth_day).max(0);

    let stats = match find_stats(&dec) {
        Some((off, vals)) => (
            off as i64,
            CatStats {
                str_val: vals[0],
                dex: vals[1],
                con: vals[2],
                int_val: vals[3],
                spd: vals[4],
                cha: vals[5],
                luck: vals[6],
            },
        ),
        None => (
            -1i64,
            CatStats {
                str_val: 5,
                dex: 5,
                con: 5,
                int_val: 5,
                spd: 5,
                cha: 5,
                luck: 5,
            },
        ),
    };

    let (abilities, mutations) = parse_abilities_and_mutations(&dec, name_end);

    Some(CatDetail {
        key,
        name,
        sex,
        cat_class,
        level,
        age,
        retired,
        dead,
        donated,
        stats: stats.1,
        abilities,
        mutations,
        room: room.to_string(),
        variant: variant.to_string(),
        name_end,
        name_len,
        level_offset,
        birth_day_offset,
        stats_offset: stats.0,
        birth_day,
        current_day,
    })
}

// ---- Public API ----

pub fn parse_save_detail(path: &Path) -> SaveDetail {
    if !path.exists() {
        return SaveDetail {
            error: "file not found".to_string(),
            ..Default::default()
        };
    }

    let conn = match Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_URI,
    ) {
        Ok(c) => c,
        Err(e) => {
            return SaveDetail {
                error: format!("Cannot open: {}", e),
                ..Default::default()
            }
        }
    };

    let mut basic = BasicData::default();

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
                    "current_day" => basic.current_day = val,
                    "house_gold" => basic.house_gold = val,
                    "house_food" => basic.house_food = val,
                    "save_file_percent" => basic.save_percent = val,
                    _ => {}
                }
            }
        }
    }

    // Build room map from house_state
    let mut room_map: HashMap<i64, String> = HashMap::new();
    if let Ok(mut stmt) = conn.prepare("SELECT data FROM files WHERE key='house_state'") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let data: Vec<u8> = row.get(0)?;
            Ok(data)
        }) {
            for row in rows.flatten() {
                for (k, r) in parse_house_state(&row) {
                    room_map.insert(k, r);
                }
            }
        }
    }

    // Adventure state
    if let Ok(mut stmt) = conn.prepare("SELECT data FROM files WHERE key='adventure_state'") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let data: Vec<u8> = row.get(0)?;
            Ok(data)
        }) {
            for row in rows.flatten() {
                for k in parse_adventure_state(&row) {
                    room_map.entry(k).or_insert_with(|| "(ADVENTURE)".to_string());
                }
            }
        }
    }

    // Parse all cats
    let mut cats = Vec::new();
    if let Ok(mut stmt) = conn.prepare("SELECT key, data FROM cats") {
        if let Ok(rows) = stmt.query_map([], |row| {
            let key: i64 = row.get(0)?;
            let data: Vec<u8> = row.get(1)?;
            Ok((key, data))
        }) {
            for row in rows.flatten() {
                let (key, blob) = row;
                let room = room_map.get(&key).cloned().unwrap_or_default();
                if let Some(cd) = parse_cat_detail(&blob, key, basic.current_day, &room) {
                    cats.push(cd);
                }
            }
        }
    }

    let furniture = parse_furniture_data(&conn);

    SaveDetail {
        basic,
        cats,
        furniture,
        error: String::new(),
    }
}

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
