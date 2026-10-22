// SQLite 数据库：账号、班级、学生作品、平台设置（如 JWT 签名密钥）。
// 表结构用编号迁移：MIGRATIONS 只能在末尾追加，已执行过的不再改动。
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config'

const MIGRATIONS = [
  `
  CREATE TABLE classes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );
  -- 学生的密码由老师发放、老师可以查看，所以按原样保存（学生不能自己改）
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    class_id INTEGER REFERENCES classes (id),
    created_at INTEGER NOT NULL
  );
  CREATE INDEX users_class ON users (class_id);
  -- 只保存令牌的哈希，数据库泄露也拿不到可用的登录令牌
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  -- 学生在某个实验上的代码（自动保存），key 如 "sample:p2-t1-LED显示屏"
  CREATE TABLE works (
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    files TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, key)
  );
  `,
  // 登录改用 JWT：短期访问令牌（不存库）+ 长期刷新令牌（只存哈希，可以撤回）。
  // token_version 递增时该用户已签发的访问令牌全部失效（重置密码、删除学生）
  `
  DROP TABLE sessions;
  ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE refresh_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX refresh_tokens_user ON refresh_tokens (user_id);
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
]

/** 打开数据库并执行未执行过的迁移。path 为 ":memory:" 时用内存数据库（测试用） */
export function openDatabase(path = join(config.dataDir, 'iot-sim.db')) {
  if (path !== ':memory:') mkdirSync(config.dataDir, { recursive: true })
  const db = new Database(path, { create: true, strict: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run('PRAGMA foreign_keys = ON')
  db.run('PRAGMA busy_timeout = 5000')
  const version = db.query<{ user_version: number }, []>('PRAGMA user_version').get()!.user_version
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.run(MIGRATIONS[i])
      db.run(`PRAGMA user_version = ${i + 1}`)
    })()
  }
  return db
}
