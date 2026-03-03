export interface CatSummary {
  key: number;
  name: string;
  sex: string;
  cat_class: string;
  level: number;
  age: number;
  retired: boolean;
  dead: boolean;
  donated: boolean;
}

export interface SaveSummary {
  current_day: number;
  house_gold: number;
  house_food: number;
  save_percent: number;
  cat_count: number;
  cat_alive: number;
  cat_dead: number;
  in_adventure: boolean;
  adventure_cats: CatSummary[];
  exists: boolean;
  error: string;
}

export interface BackupEntry {
  path: string;
  filename: string;
  slot: number;
  backup_time: string;
  day_in_name: number;
  is_game_backup: boolean;
  is_copy: boolean;
  note: string;
  summary?: SaveSummary;
}

export interface Config {
  save_dir: string;
  backup_dir: string;
  current_slot: number;
  sort_key: string;
  sort_ascending: boolean;
  auto_refresh_interval: number;
}

export interface ScanResult {
  groups: number;
  redundant_files: number;
}

export interface DedupResult {
  groups_found: number;
  files_removed: number;
  notes_merged: number;
}
