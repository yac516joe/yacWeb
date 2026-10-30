-- 0001_initial_schema.sql
-- YAC 網站動態化：核心資料表（Cloudflare D1 / SQLite）

PRAGMA foreign_keys = ON;

-- 產品類別（含零配件子類別，以 parent_id 表示階層）
CREATE TABLE categories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  slug          TEXT NOT NULL UNIQUE,
  name_zh       TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  cover_image   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 1
);

-- 車廠 / 品牌
CREATE TABLE brands (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  name_zh     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 型錄頁（對應舊站一張規格表；columns_json 描述欄位與來源）
CREATE TABLE catalog_pages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  brand_id      INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  hand          TEXT,                       -- LHD / RHD / NULL
  columns_json  TEXT NOT NULL DEFAULT '[]', -- [{key,label,source}]
  legacy_path   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 1,
  UNIQUE (category_id, slug)
);
CREATE INDEX idx_catalog_pages_brand ON catalog_pages(brand_id);

-- 產品主檔（規格表一列或一組 rowspan）
CREATE TABLE products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id             INTEGER NOT NULL REFERENCES catalog_pages(id) ON DELETE CASCADE,
  category_id         INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  brand_id            INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  yac_no              TEXT NOT NULL,
  yac_no_normalized   TEXT NOT NULL,
  yac_no_left         TEXT,
  car_series          TEXT,
  specs_json          TEXT NOT NULL DEFAULT '{}',
  notes               TEXT,
  primary_image_url   TEXT,
  is_published        INTEGER NOT NULL DEFAULT 1,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  legacy_source_file  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_page ON products(page_id, sort_order);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_yac_norm ON products(yac_no_normalized);

-- 適用車款（解決舊站 rowspan：1 個料號對多筆車款）
CREATE TABLE product_applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  car_brand_text  TEXT,
  car_model       TEXT,
  engine          TEXT,
  transmission    TEXT,
  position        TEXT,
  year_range      TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_app_product ON product_applications(product_id, sort_order);
CREATE INDEX idx_app_model ON product_applications(car_model);

-- OEM / 通用 YAC / 跨品牌對照料號
CREATE TABLE product_cross_refs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ref_type          TEXT NOT NULL,
  ref_no            TEXT NOT NULL,
  ref_no_normalized TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ref_product ON product_cross_refs(product_id);
CREATE INDEX idx_ref_norm ON product_cross_refs(ref_no_normalized);

-- 最新產品 / 消息
CREATE TABLE news_posts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title_zh         TEXT NOT NULL,
  title_en         TEXT,
  summary          TEXT NOT NULL DEFAULT '',
  content_html     TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT,
  is_pinned        INTEGER NOT NULL DEFAULT 0,
  is_published     INTEGER NOT NULL DEFAULT 1,
  published_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 站內頁面與區塊內容（公司簡介、聯絡資訊…）
CREATE TABLE site_pages (
  page_key     TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- R2 / 靜態媒體庫
CREATE TABLE media_assets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  storage_key   TEXT NOT NULL UNIQUE,
  public_url    TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  file_size     INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 舊站網址對照（301 轉址）
CREATE TABLE legacy_redirects (
  old_path        TEXT PRIMARY KEY,        -- 小寫、已解碼
  new_path        TEXT NOT NULL,
  status_code     INTEGER NOT NULL DEFAULT 301,
  is_broken_404   INTEGER NOT NULL DEFAULT 0,
  note            TEXT
);

-- 後台操作稽核
CREATE TABLE admin_audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,             -- CREATE / UPDATE / DELETE / IMPORT / LOGIN
  target_table  TEXT NOT NULL,
  target_id     TEXT,
  diff_json     TEXT,
  ip_address    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_created ON admin_audit_logs(created_at DESC);

-- 登入失敗次數（簡易頻率限制）
CREATE TABLE login_attempts (
  ip_address  TEXT NOT NULL,
  attempted_at INTEGER NOT NULL           -- unix seconds
);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
