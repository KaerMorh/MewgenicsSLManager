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

export interface TrashEntry {
  path: string;
  filename: string;
  deleted_time: string;
}

export interface Config {
  save_dir: string;
  backup_dir: string;
  current_slot: number;
  sort_key: string;
  sort_ascending: boolean;
  auto_refresh_interval: number;
  game_exe_path: string;
  relaunch_after_kill: boolean;
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

// ---- Save Editor types ----

export interface CatStats {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  SPD: number;
  CHA: number;
  LUCK: number;
}

export interface CatAbilities {
  active: (string | null)[];
  passive: (string | null)[];
  disorder: (string | null)[];
}

export interface CatDetail {
  key: number;
  name: string;
  sex: string;
  cat_class: string;
  level: number;
  age: number;
  retired: boolean;
  dead: boolean;
  donated: boolean;
  stats: CatStats;
  abilities: CatAbilities;
  mutations: Record<string, number>;
  room: string;
  _variant: string;
  _name_end: number;
  _name_len: number;
  _level_offset: number;
  _birth_day_offset: number;
  _stats_offset: number;
  _birth_day: number;
  _current_day: number;
}

export interface BasicData {
  current_day: number;
  house_gold: number;
  house_food: number;
  save_percent: number;
}

export interface FurnitureItem {
  key: number;
  furniture_id: string;
  room?: string | null;
  x?: number;
  y?: number;
}

export interface FurnitureData {
  backpack: FurnitureItem[];
  placed: FurnitureItem[];
}

export interface SaveDetail {
  basic: BasicData;
  cats: CatDetail[];
  furniture: FurnitureData;
  error: string;
}

export interface CatChanges {
  name?: string;
  sex?: string;
  age?: number;
  level?: number;
  retired?: boolean;
  stats?: CatStats;
  abilities?: CatAbilities;
  mutations?: Record<string, number>;
  _name_end?: number;
  _name_len?: number;
  _level_offset?: number;
  _birth_day_offset?: number;
  _stats_offset?: number;
  _birth_day?: number;
  _current_day?: number;
}

export interface FurnitureChanges {
  added: FurnitureItem[];
  removed: number[];
}

export interface SaveChanges {
  basic?: {
    current_day?: number;
    house_gold?: number;
    house_food?: number;
    save_percent?: number;
  };
  cats: Record<string, CatChanges>;
  furniture?: FurnitureChanges;
}

export interface AbilityEntry {
  name: string;
  desc: string;
}

export type AbilityDB = Record<string, AbilityEntry[]>;

export type MutationCategory = Record<
  string,
  {
    name: string;
    stats?: Record<string, number>;
    passives?: string[];
    desc?: string;
  }
>;

export type MutationDB = Record<string, MutationCategory>;

export type FurnitureDBEntry = {
  id: string;
  name: string;
  desc?: string;
  effects?: Record<string, number>;
  special?: boolean;
  removed?: boolean;
  can_be_rare?: boolean;
};

export type FurnitureDB = Record<string, FurnitureDBEntry>;
