# MewgenicsSaveManager

[English](./README.md)

**Mewgenics**（Glaiel Games 开发）的存档备份与管理工具，基于 Tauri 2 + React + Rust 构建。

## 功能特性

- **存档编辑器** — 全功能的存档修改工具：
  - **基础数据：** 修改天数、金币、食物和完成度。
  - **猫咪编辑器：** 修改猫咪的名字、性别、年龄、等级、属性、主被动/紊乱技能和身体突变。
  - **家具管理：** 从支持搜索的家具数据库中添加或移除家具。
  - **猫咪列表功能：** 支持按名字搜索、按冒险状态排序和筛选，所有技能/突变下拉框支持关键字搜索过滤。
- **3 个存档槽位** — 独立管理 `steamcampaign01/02/03.sav`
- **存档解析** — 读取基于 SQLite 的 `.sav` 文件，展示游戏天数、金币、食物、完成度，以及猫咪详细信息（名字、性别、职业、等级、年龄、状态）
- **一键备份与恢复** — 创建带时间戳的备份，单击即可恢复任意历史存档（加载前自动备份当前存档）
- **备份备注** — 为任意备份添加自定义备注
- **复制与删除** — 便捷地复制或删除备份
- **游戏备份导入** — 导入游戏本身创建的 `.savbackup` 文件
- **重复检测** — 基于 SHA-256 的去重功能，保持备份目录整洁
- **文件监听** — 实时监控存档目录，文件变化时自动刷新
- **定时轮询** — 可配置的自动刷新间隔作为补充机制
- **Neo-brutalism UI** — 粗边框、硬阴影、暖色调配色，自定义标题栏

## 截图

> 即将添加

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 后端 | Rust |
| 存档解析 | rusqlite + 自定义 LZ4 解压 |
| 文件监听 | notify + notify-debouncer-mini |
| 通知 | Sonner |

## 环境要求

- [Node.js](https://nodejs.org/)（推荐 LTS 版本）
- [Rust](https://www.rust-lang.org/tools/install)（stable）
- Tauri 2 系统依赖 — Windows 上需要 WebView2（Windows 10/11 已预装）

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/YourUsername/MewgenicsSaveManager.git
cd MewgenicsSaveManager

# 安装前端依赖
npm install

# 开发模式运行
npm run tauri dev

# 生产环境构建
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录下。

## 默认路径

| 路径 | 位置 |
|------|------|
| 存档目录 | `%APPDATA%\Glaiel Games\Mewgenics\{Steam用户}\saves` |
| 备份目录 | `{存档目录}\LoaderBackups`（可在设置中修改） |
| 游戏备份 | `{存档目录}\backups`（`.savbackup` 文件） |
| 配置文件 | `%APPDATA%\MeowLoader\settings.json` |

## 项目结构

```
├── src/                    # React 前端
│   ├── App.tsx             # 主应用组件
│   ├── components/         # UI 组件
│   │   ├── TitleBar.tsx    # 自定义窗口标题栏
│   │   ├── TopNav.tsx      # 槽位选择与导航
│   │   ├── HeroSection.tsx # 当前存档概览
│   │   ├── BackupList.tsx  # 备份列表（支持排序）
│   │   ├── BackupItem.tsx  # 单个备份条目
│   │   ├── SaveInfoCard.tsx
│   │   ├── SettingsDialog.tsx
│   │   └── GameBackupDialog.tsx
│   ├── hooks/              # 自定义 React Hooks
│   ├── styles/             # 全局样式
│   └── types/              # TypeScript 类型定义
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # Tauri 应用入口
│   │   ├── commands.rs     # Tauri IPC 命令
│   │   ├── backup_manager.rs
│   │   ├── save_parser.rs  # SQLite 存档解析 + LZ4
│   │   ├── config.rs       # 应用配置管理
│   │   ├── watcher.rs      # 文件系统监听
│   │   └── lz4.rs          # LZ4 解压缩
│   └── tauri.conf.json     # Tauri 配置
├── package.json
└── vite.config.ts
```

## 许可证

MIT
