-- 詢價單：前台送出後先存入資料庫（不會因寄信失敗而遺失），再嘗試寄信通知。
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT NOT NULL,
  tel TEXT,
  note TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  ip_address TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed | skipped
  email_error TEXT,
  is_handled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_ip ON inquiries (ip_address, created_at);
