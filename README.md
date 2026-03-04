# MewgenicsSaveManager

[中文文档](./README_CN.md)

A save file backup & management tool for **Mewgenics** (by Glaiel Games), built with Tauri 2 + React + Rust.

## Features

- **Save Editor** — Full-featured save file modification:
  - **Basic Data:** Edit day, gold, food, and completion %.
  - **Cat Editor:** Modify cat names, gender, age, level, stats, abilities, and mutations.
  - **Furniture Inventory:** Add or remove furniture items from a searchable database.
  - **Cat List Features:** Search cats by name, sort by adventure status, filter by adventure, and searchable dropdowns for abilities/mutations.
- **3 Save Slots** — Manage `steamcampaign01/02/03.sav` independently
- **Save Parsing** — Reads the SQLite-based `.sav` files to display game day, gold, food, completion %, and detailed cat info (name, gender, class, level, age, status)
- **One-click Backup & Restore** — Create timestamped backups and restore any previous save with a single click (auto-backs-up current save before loading)
- **Backup Notes** — Annotate any backup with a custom memo
- **Copy & Delete** — Duplicate or remove backups easily
- **Game Backup Import** — Import `.savbackup` files created by the game itself
- **Duplicate Detection** — SHA-256 based deduplication to keep your backup folder clean
- **File Watcher** — Monitors the save directory in real-time and auto-refreshes when files change
- **Periodic Polling** — Configurable auto-refresh interval as a fallback
- **Neo-brutalism UI** — Bold borders, hard shadows, warm color palette with a custom title bar

## Screenshots

> Coming soon

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri 2 |
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Backend | Rust |
| Save Parsing | rusqlite + custom LZ4 decompression |
| File Watching | notify + notify-debouncer-mini |
| Notifications | Sonner |

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- Tauri 2 system dependencies — on Windows this means WebView2 (pre-installed on Windows 10/11)

## Getting Started

```bash
# Clone the repository
git clone https://github.com/YourUsername/MewgenicsSaveManager.git
cd MewgenicsSaveManager

# Install frontend dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

Build artifacts will be located in `src-tauri/target/release/bundle/`.

## Default Paths

| Path | Location |
|------|----------|
| Save Directory | `%APPDATA%\Glaiel Games\Mewgenics\{SteamUser}\saves` |
| Backups | `{SaveDir}\LoaderBackups` (configurable in Settings) |
| Game Backups | `{SaveDir}\backups` (`.savbackup` files) |
| Config | `%APPDATA%\MeowLoader\settings.json` |

## Project Structure

```
├── src/                    # React frontend
│   ├── App.tsx             # Main application component
│   ├── components/         # UI components
│   │   ├── TitleBar.tsx    # Custom window title bar
│   │   ├── TopNav.tsx      # Slot selector & navigation
│   │   ├── HeroSection.tsx # Current save overview
│   │   ├── BackupList.tsx  # Backup list with sorting
│   │   ├── BackupItem.tsx  # Individual backup entry
│   │   ├── SaveInfoCard.tsx
│   │   ├── SettingsDialog.tsx
│   │   └── GameBackupDialog.tsx
│   ├── hooks/              # Custom React hooks
│   ├── styles/             # Global CSS
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri app entry
│   │   ├── commands.rs     # Tauri IPC commands
│   │   ├── backup_manager.rs
│   │   ├── save_parser.rs  # SQLite save parsing + LZ4
│   │   ├── config.rs       # App configuration
│   │   ├── watcher.rs      # File system watcher
│   │   └── lz4.rs          # LZ4 decompression
│   └── tauri.conf.json     # Tauri configuration
├── package.json
└── vite.config.ts
```

## License

MIT
