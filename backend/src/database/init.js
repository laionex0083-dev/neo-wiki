import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/wiki.db');

// 데이터 디렉토리 생성
const dataDir = dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 전역 DB 인스턴스
let db = null;

export function initDatabase() {
  // better-sqlite3는 동기 API 사용
  db = new Database(DB_PATH);

  // WAL 모드 활성화 (성능 및 안정성 향상)
  db.pragma('journal_mode = WAL');

  // 문서 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      content TEXT DEFAULT '',
      namespace TEXT DEFAULT 'main',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      created_by INTEGER,
      updated_by INTEGER,
      is_redirect INTEGER DEFAULT 0,
      redirect_to TEXT,
      view_count INTEGER DEFAULT 0
    )
  `);

  // 문서 히스토리 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      edit_summary TEXT,
      edited_by INTEGER,
      edited_at TEXT DEFAULT (datetime('now')),
      bytes_changed INTEGER DEFAULT 0,
      ip_address TEXT
    )
  `);

  // 사용자 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT,
      edit_count INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      blocked_until TEXT,
      block_reason TEXT
    )
  `);

  // 파일/이미지 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type TEXT,
      size INTEGER,
      uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT (datetime('now')),
      description TEXT
    )
  `);

  // 분류(카테고리) 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      category_name TEXT NOT NULL,
      UNIQUE(page_id, category_name)
    )
  `);

  // 백링크 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS backlinks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_page_id INTEGER NOT NULL,
      to_page_title TEXT NOT NULL,
      link_type TEXT DEFAULT 'link'
    )
  `);

  // 스킨 설정 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS skin_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skin_name TEXT NOT NULL UNIQUE,
      display_name TEXT,
      is_active INTEGER DEFAULT 0,
      custom_css TEXT,
      custom_js TEXT,
      config TEXT
    )
  `);

  // 위키 설정 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS wiki_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 문서 보호(ACL) 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_acl (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER,
      page_title TEXT,
      protection_level TEXT DEFAULT 'none',
      edit_require TEXT DEFAULT 'all',
      move_require TEXT DEFAULT 'user',
      delete_require TEXT DEFAULT 'admin',
      protected_by INTEGER,
      protected_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      reason TEXT
    )
  `);

  // 사용자 차단 기록 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      blocked_by INTEGER NOT NULL,
      blocked_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      reason TEXT,
      is_active INTEGER DEFAULT 1
    )
  `);

  // 관리자 로그 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 코멘트 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_edited INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  // 인덱스 생성
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pages_title ON pages(title)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pages_namespace ON pages(namespace)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_history_page_id ON page_history(page_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_backlinks_to ON backlinks(to_page_title)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(category_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_page_id ON comments(page_id)`);

  // 기본 설정 삽입
  const defaultSettings = [
    ['wiki_name', 'Neo-Wiki'],
    ['wiki_description', 'NamuMark 기반 위키'],
    ['default_skin', 'default'],
    ['allow_anonymous_edit', 'true'],
    ['main_page', '대문']
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO wiki_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // 대문 페이지 생성
  const mainPage = db.prepare("SELECT id FROM pages WHERE title = '대문'").get();
  if (!mainPage) {
    db.prepare(`
      INSERT INTO pages (title, content, namespace) 
      VALUES (?, ?, 'main')
    `).run('대문', `= Neo-Wiki에 오신 것을 환영합니다! =

[[Neo-Wiki]]는 '''NamuMark''' 문법을 지원하는 위키 엔진입니다.

== 주요 기능 ==
 * [[문서 작성|새 문서 만들기]]
 * {{{코드 블록}}} 지원
 * ''이탤릭''과 '''굵은 글씨'''
 * ~~취소선~~

== 시작하기 ==
상단의 검색창에서 원하는 문서를 검색하거나, 새 문서를 만들어보세요!

[* 이것은 '''각주'''입니다.]

> 인용문도 지원합니다.

----
[[분류:메인]]`);
  }

  console.log('✅ 데이터베이스 초기화 완료');
  return db;
}

// DB 인스턴스 가져오기
export function getDb() {
  return db;
}

// better-sqlite3는 자동으로 디스크에 저장하므로 saveDatabase는 no-op
export function saveDatabase() {
  // WAL 모드에서는 자동 저장되므로 불필요
  // 하위 호환성을 위해 함수 유지
}

// better-sqlite3의 네이티브 API를 래핑하는 dbHelper
// 기존 코드와 호환성 유지를 위해 동일한 인터페이스 제공
export const dbHelper = {
  prepare(sql) {
    const stmt = db.prepare(sql);
    return {
      run(...params) {
        const result = stmt.run(...params);
        return {
          lastInsertRowid: result.lastInsertRowid,
          changes: result.changes
        };
      },
      get(...params) {
        return stmt.get(...params) || null;
      },
      all(...params) {
        return stmt.all(...params);
      }
    };
  },
  exec(sql) {
    db.exec(sql);
  }
};

// 정상 종료 시 DB 연결 닫기
process.on('exit', () => {
  if (db) {
    db.close();
  }
});

process.on('SIGINT', () => {
  if (db) {
    db.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (db) {
    db.close();
  }
  process.exit(0);
});

// 하위 호환성을 위한 export
export { db };
export default { initDatabase, getDb, saveDatabase, dbHelper };
