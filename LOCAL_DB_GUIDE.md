# 本地数据库使用指南

本项目已迁移到本地 SQLite 数据库，数据完全存储在你的电脑上，无需依赖 Supabase 云服务。

## 📁 数据存储位置

```
项目目录/
├── data/
│   └── genealogy.db          # 主数据库文件
├── backups/
│   ├── genealogy-backup-*.db # 数据库备份
│   └── genealogy-backup-*.json # JSON 格式备份
└── ...
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
首次运行时会自动创建数据库文件和表结构。

### 3. 启动开发服务器
```bash
npm run dev
```

## 📦 数据迁移（从 Supabase）

如果你之前在 Supabase 中有数据，可以迁移到本地：

```bash
# 1. 确保 .env.local 中有 Supabase 配置
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

# 2. 运行迁移脚本
npm run db:migrate
```

## 💾 备份数据

### 手动备份
```bash
npm run db:backup
```

这会：
- 创建数据库的完整备份
- 导出 JSON 格式的数据
- 自动清理超过 30 天的旧备份
- 备份保存在 `backups/` 目录

### 自动备份（推荐）

#### macOS/Linux - 使用 cron
```bash
# 编辑 crontab
crontab -e

# 每天凌晨 2 点自动备份
0 2 * * * cd /path/to/pure-genealogy && npm run db:backup

# 或者每周一备份
0 2 * * 1 cd /path/to/pure-genealogy && npm run db:backup
```

#### Windows - 使用任务计划程序
1. 创建批处理文件 `backup.bat`：
```batch
@echo off
cd /d "C:\path\to\pure-genealogy"
npm run db:backup
```

2. 打开任务计划程序，创建基本任务
3. 设置触发器（每天/每周）
4. 操作选择启动程序，指向 `backup.bat`

## 🔄 恢复数据

```bash
npm run db:restore
```

按提示选择备份文件进行恢复。

**注意**：恢复会覆盖当前数据库，但会自动备份当前状态。

## 🔒 数据安全建议

1. **定期备份**
   - 设置自动备份任务
   - 重要修改后备份

2. **多重备份**
   - 本地备份 + 外部硬盘
   - 或者云存储（iCloud/OneDrive/Dropbox）

3. **版本控制**
   - 定期将备份复制到其他设备
   - 保留历史版本

## 📊 数据库结构

### family_members 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| name | TEXT | 姓名（必填）|
| generation | INTEGER | 世代 |
| sibling_order | INTEGER | 排行 |
| father_id | INTEGER | 父亲 ID（外键）|
| gender | TEXT | 性别（男/女）|
| official_position | TEXT | 官职 |
| is_alive | BOOLEAN | 是否在世 |
| spouse | TEXT | 配偶 |
| remarks | TEXT | 生平事迹 |
| birthday | TEXT | 出生日期 |
| death_date | TEXT | 去世日期 |
| residence_place | TEXT | 居住地 |
| updated_at | DATETIME | 更新时间 |

## 🛠️ 高级操作

### 直接访问数据库

使用任何 SQLite 客户端：
- [DB Browser for SQLite](https://sqlitebrowser.org/)（免费）
- [TablePlus](https://tableplus.com/)
- 命令行：`sqlite3 data/genealogy.db`

### 手动导出 SQL
```bash
sqlite3 data/genealogy.db ".dump" > export.sql
```

### 从 SQL 导入
```bash
sqlite3 data/genealogy.db < export.sql
```

## ⚠️ 注意事项

1. **不要删除 `data/` 目录**，否则数据会丢失
2. **定期备份**到安全位置
3. **不要同时运行多个实例**，避免数据库锁定
4. **Git 已忽略**数据库文件，不会被提交到代码仓库

## 🆘 故障排除

### 数据库被锁定
```bash
# 删除 WAL 文件
rm data/genealogy.db-wal data/genealogy.db-shm
```

### 数据损坏
1. 停止应用
2. 从备份恢复：`npm run db:restore`
3. 或复制备份文件覆盖 `data/genealogy.db`

### 迁移失败
检查 `.env.local` 中的 Supabase 配置是否正确。

---

如有问题，请查看备份目录中的历史备份！
