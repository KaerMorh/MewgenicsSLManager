# src-tauri/data/

Game data JSON databases used by the save editor.

## Directory Structure

```
data/
├── abilities/en/       # Ability JSON DB (passive, disorder, active per class)
├── furniture/          # Furniture JSON DB
├── mutations/          # Mutation JSON DB
├── fix_ability_db.py   # Script to sync ability DB with game unpack data
```

## Scripts

### fix_ability_db.py

Syncs the ability JSON DB with the game's authoritative `.gon` data files.

**Requires**: Game unpack files at `P:\SteamLibrary\MewUnpack\Output`

```bash
python fix_ability_db.py           # dry-run
python fix_ability_db.py --apply   # write changes
```

What it does:
- Reads `.gon` files from `data/passives/` in the game unpack
- Reads `passives.csv` localization for English descriptions
- Fixes case mismatches, adds missing skills, adds `key` field (localization key)

See the script's docstring for detailed methodology notes on how to adapt this approach for items/furniture.

## Other Test Scripts (in tests/)

- `tests/extract_skills.py` — Extracts all skill names from `.gon` and compares with DB
- `tests/patch_save.py` — Directly patches a save file's skill tier (for testing)
- `tests/SavesExamples/prd.txt` — Research report on save binary format and fix plan
