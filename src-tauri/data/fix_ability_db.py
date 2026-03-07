#!/usr/bin/env python3
"""
fix_ability_db.py - Auto-fix JSON ability database using game .gon files as authoritative source.

=== HOW TO USE ===
  python fix_ability_db.py           # dry-run, only prints changes
  python fix_ability_db.py --apply   # actually writes changes to JSON files

=== WHAT IT DOES ===
  1. Reads .gon files from game unpack (authoritative skill definitions)
  2. Reads passives.csv localization file (English display names & descriptions)
  3. Compares with our JSON ability DB files
  4. Fixes: case mismatches, missing skills, adds localization "key" field

=== ANALYSIS METHODOLOGY (for reuse with items/furniture) ===

Step 1: Find the game's data files
  - Game unpack path: P:\SteamLibrary\MewUnpack\Output
  - Passives/disorders: data/passives/*.gon
  - Localization: data/text/passives.csv
  - For items/furniture, look in data/items/, data/furniture/, data/text/items.csv etc.

Step 2: Understand .gon format
  - .gon is a custom format: top-level blocks are skill definitions
  - Format:
      SkillName {
        name "PASSIVE_SKILLNAME_NAME"    <- localization key
        desc "PASSIVE_SKILLNAME_DESC"    <- localization key for description
        1 {                              <- tier 1 (base) definition
          ...stats/effects...
        }
        2 {                              <- tier 2 (upgraded) definition, if exists
          ...stats/effects...
        }
      }
  - The top-level key (e.g. "ThrillOfTheHunt") is the GAME INTERNAL NAME
    used in save files. This is the authoritative name.

Step 3: Understand localization CSV
  - CSV columns: key, en, zh, ja, ko, ...
  - Keys follow pattern: PASSIVE_{UPPER}_NAME, PASSIVE_{UPPER}_DESC
  - For disorders: DISORDER_{UPPER}_NAME, DISORDER_{UPPER}_DESC
  - IMPORTANT: The localization key may NOT match the .gon key!
    Example: .gon key "HawkEye" has loc key "PASSIVE_BULLSEYE_NAME"
    (game renamed internally but kept old loc key)

Step 4: Match existing DB entries
  - Case-insensitive match by .gon key first
  - If not found, try matching by localization display name (spaces removed)
  - This catches entries like "Bullseye" in DB -> "HawkEye" in .gon
    (because loc says PASSIVE_BULLSEYE_NAME = "Bullseye", and our old DB
     used the display name)

Step 5: Verify with actual save files
  - Use a save file to confirm which names the game actually stores
  - Save files use the .gon internal key, NOT the localization display name
  - Example: save stores "BloodLust" (gon key), not "Frenzy" (display name)

=== KEY DISCOVERIES ===
  - Game save files store .gon internal keys for passive/disorder skills
  - Active skills encode upgrade in name ("ScatterShot2"), passive/disorder
    use separate u32 tier marker after the name
  - 11+ case mismatches between old DB and game (prepositions capitalized
    differently: "of" vs "Of", "the" vs "The", etc.)
  - Some skills were completely renamed internally but kept old loc keys
  - ~45 skills in saves had no DB entry at all

=== TO ADAPT FOR ITEMS/FURNITURE ===
  1. Find the .gon files for items/furniture in the unpack
  2. Find the corresponding localization CSV
  3. Copy this script, change GON_DIR, JSON_DIR, LOC_CSV, GON_TO_JSON
  4. Adjust parse_gon_skill_names() if the .gon format differs
  5. Adjust localization key prefix (ITEM_ instead of PASSIVE_)
  6. Run dry-run first, verify with save file, then --apply

=== DEPENDENCIES ===
  - Python 3.10+
  - No external packages needed (only stdlib: csv, json, re, pathlib)
  - Requires game unpack files at the configured path
"""

import argparse
import csv
import json
import re
from pathlib import Path

# === Paths (adjust these for your environment) ===
GON_DIR = Path(r"P:\SteamLibrary\MewUnpack\Output\data\passives")
JSON_DIR = Path(__file__).parent / "abilities" / "en"
LOC_CSV = Path(r"P:\SteamLibrary\MewUnpack\Output\data\text\passives.csv")

# Mapping: .gon filename -> JSON filename
GON_TO_JSON = {
    "hunter_passives.gon": "hunter_passive.json",
    "fighter_passives.gon": "fighter_passive.json",
    "mage_passives.gon": "mage_passive.json",
    "medic_passives.gon": "medic_passive.json",
    "thief_passives.gon": "thief_passive.json",
    "tank_passives.gon": "tank_passive.json",
    "druid_passives.gon": "druid_passive.json",
    "necromancer_passives.gon": "necromancer_passive.json",
    "jester_passives.gon": "jester_passive.json",
    "monk_passives.gon": "monk_passive.json",
    "psychic_passives.gon": "psychic_passive.json",
    "tinkerer_passives.gon": "tinkerer_passive.json",
    "butcher_passives.gon": "butcher_passive.json",
    "colorless_passives.gon": "colorless_passive.json",
    "disorders.gon": "disorder.json",
}


def parse_localization_csv(csv_path: Path) -> dict:
    """Parse passives.csv. Returns { "PASSIVE_TAKEAIM_NAME": "Take Aim", ... }"""
    loc = {}
    if not csv_path.exists():
        print(f"  [WARN] Localization CSV not found: {csv_path}")
        return loc
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            return loc
        try:
            en_idx = header.index("en")
        except ValueError:
            en_idx = 1
        for row in reader:
            if len(row) > en_idx:
                key = row[0].strip()
                value = row[en_idx].strip()
                if key:
                    loc[key] = value
    return loc


def parse_gon_skill_names(gon_path: Path) -> list[str]:
    """Extract top-level skill names from a .gon file."""
    if not gon_path.exists():
        return []
    text = gon_path.read_text(encoding="utf-8")
    lines = text.split("\n")
    skills = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r'^(\w[\w]*)\s*\{', line)
        if m:
            skills.append(m.group(1))
            i += 1
            continue
        m2 = re.match(r'^(\w[\w]*)\s*$', line)
        if m2 and i + 1 < len(lines) and lines[i + 1].strip().startswith("{"):
            skills.append(m2.group(1))
            i += 2
            continue
        i += 1
    return skills


def parse_gon_loc_keys(gon_path: Path) -> dict:
    """Extract localization name key for each skill.
    Returns { "ThrillOfTheHunt": "PASSIVE_THRILLOFTHEHUNT_NAME", ... }
    """
    if not gon_path.exists():
        return {}
    text = gon_path.read_text(encoding="utf-8")
    result = {}
    lines = text.split("\n")
    current_skill = None
    depth = 0
    for line in lines:
        stripped = line.strip()
        open_count = stripped.count("{")
        close_count = stripped.count("}")
        if depth == 0:
            m = re.match(r'^(\w+)\s*\{', line)
            if m:
                current_skill = m.group(1)
                depth = 1 + open_count - 1 - close_count
                continue
            m2 = re.match(r'^(\w+)\s*$', line)
            if m2:
                current_skill = m2.group(1)
                continue
            if stripped == "{" and current_skill:
                depth = 1
                continue
        if depth == 1 and current_skill:
            nm = re.match(r'\s*name\s+"([^"]+)"', line)
            if nm:
                result[current_skill] = nm.group(1)
        depth += open_count - close_count
        if depth <= 0:
            depth = 0
            current_skill = None
    return result


def check_has_level2(gon_path: Path, skill_name: str) -> bool:
    """Check if a skill has a level 2 sub-block in the .gon file."""
    text = gon_path.read_text(encoding="utf-8")
    pattern = re.compile(r'^' + re.escape(skill_name) + r'\s*\{', re.MULTILINE)
    match = pattern.search(text)
    if not match:
        return False
    start = match.end()
    depth = 1
    pos = start
    while pos < len(text) and depth > 0:
        if text[pos] == '{':
            depth += 1
        elif text[pos] == '}':
            depth -= 1
        pos += 1
    block_text = text[start:pos]
    for im in re.finditer(r'(\d+)\s*\{', block_text):
        prefix = block_text[:im.start()]
        inner_depth = prefix.count('{') - prefix.count('}')
        if inner_depth == 0 and im.group(1) == '2':
            return True
    return False


def derive_json_name_from_loc(display_name: str) -> str:
    """Convert display name to JSON name: remove spaces."""
    return display_name.replace(" ", "")


def process_one_file(gon_filename: str, json_filename: str, loc: dict,
                     apply: bool) -> dict:
    """Process one .gon/.json pair. Returns a summary dict."""
    gon_path = GON_DIR / gon_filename
    json_path = JSON_DIR / json_filename

    summary = {"gon_file": gon_filename, "json_file": json_filename,
               "case_fixes": [], "added_skills": [], "errors": []}

    if not gon_path.exists():
        summary["errors"].append(f".gon not found: {gon_path}")
        return summary
    if not json_path.exists():
        summary["errors"].append(f".json not found: {json_path}")
        return summary

    gon_loc_keys = parse_gon_loc_keys(gon_path)
    gon_skills = parse_gon_skill_names(gon_path)

    with open(json_path, "r", encoding="utf-8") as f:
        json_data = json.load(f)

    json_name_lower_map = {}
    for i, entry in enumerate(json_data):
        json_name_lower_map[entry["name"].lower()] = i

    modified = False

    for gon_key in gon_skills:
        loc_name_key = gon_loc_keys.get(gon_key, "")
        if not loc_name_key:
            prefix = "DISORDER_" if gon_filename == "disorders.gon" else "PASSIVE_"
            loc_name_key = f"{prefix}{gon_key.upper()}_NAME"

        display_name = loc.get(loc_name_key, "")
        loc_derived_name = derive_json_name_from_loc(display_name) if display_name else ""
        canonical_name = gon_key
        has_lv2 = check_has_level2(gon_path, gon_key)

        existing_idx = json_name_lower_map.get(canonical_name.lower())
        if existing_idx is None and loc_derived_name:
            existing_idx = json_name_lower_map.get(loc_derived_name.lower())

        loc_key_stem = loc_name_key.replace("_NAME", "")

        if existing_idx is not None:
            old_name = json_data[existing_idx]["name"]
            if old_name != canonical_name:
                summary["case_fixes"].append((old_name, canonical_name, "base"))
                json_data[existing_idx]["name"] = canonical_name
                modified = True
            if json_data[existing_idx].get("key") != loc_key_stem:
                json_data[existing_idx]["key"] = loc_key_stem
                modified = True
        else:
            desc_key = loc_name_key.replace("_NAME", "_DESC")
            desc = loc.get(desc_key, "") or desc_key
            summary["added_skills"].append((canonical_name, "base"))
            json_data.append({"name": canonical_name, "key": loc_key_stem, "desc": desc})
            json_name_lower_map[canonical_name.lower()] = len(json_data) - 1
            modified = True

        if has_lv2:
            name2 = canonical_name + "2"
            loc_name2 = loc_derived_name + "2" if loc_derived_name else ""
            loc_key_stem2 = loc_key_stem + "2"
            existing_idx2 = json_name_lower_map.get(name2.lower())
            if existing_idx2 is None and loc_name2:
                existing_idx2 = json_name_lower_map.get(loc_name2.lower())

            if existing_idx2 is not None:
                old_name2 = json_data[existing_idx2]["name"]
                if old_name2 != name2:
                    summary["case_fixes"].append((old_name2, name2, "lv2"))
                    json_data[existing_idx2]["name"] = name2
                    modified = True
                if json_data[existing_idx2].get("key") != loc_key_stem2:
                    json_data[existing_idx2]["key"] = loc_key_stem2
                    modified = True
            else:
                desc2_key = f"{loc_key_stem}2_DESC"
                desc2 = loc.get(desc2_key, "") or desc2_key
                summary["added_skills"].append((name2, "lv2"))
                json_data.append({"name": name2, "key": loc_key_stem2, "desc": desc2})
                json_name_lower_map[name2.lower()] = len(json_data) - 1
                modified = True

    if modified and apply:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Fix JSON ability DB using .gon files as authoritative source.")
    parser.add_argument("--apply", action="store_true",
                        help="Actually write changes (default is dry-run)")
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY RUN"
    print(f"=== fix_ability_db.py [{mode}] ===\n")

    print(f"Loading localization from: {LOC_CSV}")
    loc = parse_localization_csv(LOC_CSV)
    print(f"  Loaded {len(loc)} entries.\n")

    total_fixes, total_added, total_errors = 0, 0, 0

    for gon_file, json_file in sorted(GON_TO_JSON.items()):
        print(f"--- {gon_file} -> {json_file} ---")
        s = process_one_file(gon_file, json_file, loc, args.apply)
        for err in s["errors"]:
            print(f"  ERROR: {err}")
            total_errors += 1
        for old, new, var in s["case_fixes"]:
            print(f"  CASE FIX [{var}]: {old!r} -> {new!r}")
            total_fixes += 1
        for name, var in s["added_skills"]:
            print(f"  ADDED [{var}]: {name!r}")
            total_added += 1
        if not s["case_fixes"] and not s["added_skills"] and not s["errors"]:
            print("  (no changes)")
        print()

    print("=" * 50)
    print(f"SUMMARY: {total_fixes} case fixes, {total_added} added, {total_errors} errors")
    if not args.apply:
        print("(DRY RUN - no files modified. Use --apply to write.)")


if __name__ == "__main__":
    main()
