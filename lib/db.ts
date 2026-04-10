import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 确保数据目录存在
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'genealogy.db');

// 创建数据库连接
const db = new Database(dbPath);

// 启用外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化表结构
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generation INTEGER,
      sibling_order INTEGER,
      father_id INTEGER,
      gender TEXT CHECK(gender IN ('男', '女')),
      official_position TEXT,
      is_alive BOOLEAN DEFAULT 1,
      spouse_id INTEGER,
      is_married_in BOOLEAN DEFAULT 0,
      remarks TEXT,
      birthday TEXT,
      death_date TEXT,
      residence_place TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (father_id) REFERENCES family_members(id) ON DELETE SET NULL,
      FOREIGN KEY (spouse_id) REFERENCES family_members(id) ON DELETE SET NULL
    );

    -- 博客文章表
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      cover_image TEXT,
      tags TEXT,
      status TEXT DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 创建索引优化查询
    CREATE INDEX IF NOT EXISTS idx_father_id ON family_members(father_id);
    CREATE INDEX IF NOT EXISTS idx_generation ON family_members(generation);
    CREATE INDEX IF NOT EXISTS idx_name ON family_members(name);
    CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts(slug);
    CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
    CREATE INDEX IF NOT EXISTS idx_blog_created ON blog_posts(created_at);
  `);

  console.log('✅ 数据库初始化完成:', dbPath);
}

// 导出数据库实例
export { db };

// 查询辅助函数
export function query(sql: string, params?: any[]) {
  return db.prepare(sql).all(params || []);
}

export function queryOne(sql: string, params?: any[]) {
  return db.prepare(sql).get(params || []);
}

export function run(sql: string, params?: any[]) {
  return db.prepare(sql).run(params || []);
}

export function insert(sql: string, params?: any[]) {
  return db.prepare(sql).run(params || []);
}

export function update(sql: string, params?: any[]) {
  return db.prepare(sql).run(params || []);
}

export function remove(sql: string, params?: any[]) {
  return db.prepare(sql).run(params || []);
}

// 事务辅助函数
export function transaction<T>(fn: () => T): T {
  const begin = db.prepare('BEGIN');
  const commit = db.prepare('COMMIT');
  const rollback = db.prepare('ROLLBACK');

  begin.run();
  try {
    const result = fn();
    commit.run();
    return result;
  } catch (error) {
    rollback.run();
    throw error;
  }
}

// 初始化数据库
initDatabase();
