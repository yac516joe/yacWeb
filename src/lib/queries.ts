import { all, first, chunk } from './db';
import { normalizeRef, type ColumnDef } from './columns';

export interface Category {
  id: number;
  parent_id: number | null;
  slug: string;
  name_zh: string;
  name_en: string;
  summary: string;
  cover_image: string | null;
  sort_order: number;
  is_published: number;
  page_count?: number;
  product_count?: number;
}

export interface CatalogPage {
  id: number;
  category_id: number;
  brand_id: number | null;
  slug: string;
  title: string;
  hand: string | null;
  columns_json: string;
  legacy_path: string | null;
  sort_order: number;
  is_published: number;
  product_count?: number;
  brand_name?: string | null;
}

export interface Product {
  id: number;
  page_id: number;
  category_id: number;
  brand_id: number | null;
  yac_no: string;
  yac_no_normalized: string;
  yac_no_left: string | null;
  car_series: string | null;
  specs_json: string;
  notes: string | null;
  primary_image_url: string | null;
  is_published: number;
  sort_order: number;
  legacy_source_file: string | null;
}

export interface Application {
  id: number;
  product_id: number;
  car_brand_text: string | null;
  car_model: string | null;
  engine: string | null;
  transmission: string | null;
  position: string | null;
  year_range: string | null;
  sort_order: number;
}

export interface CrossRef {
  id: number;
  product_id: number;
  ref_type: string;
  ref_no: string;
  sort_order: number;
}

export interface ProductDetail extends Product {
  specs: Record<string, string>;
  apps: Application[];
  refs: CrossRef[];
}

export interface NewsPost {
  id: number;
  slug: string;
  title_zh: string;
  title_en: string | null;
  summary: string;
  content_html: string;
  cover_image_url: string | null;
  is_pinned: number;
  is_published: number;
  published_at: string;
}

export function parseColumns(json: string): ColumnDef[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as ColumnDef[]) : [];
  } catch {
    return [];
  }
}

export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ---------- 分類 / 型錄頁 ----------

export function getCategories(db: D1Database, includeUnpublished = false): Promise<Category[]> {
  return all<Category>(
    db,
    `SELECT c.*,
       (SELECT COUNT(*) FROM catalog_pages p WHERE p.category_id = c.id AND p.is_published = 1) AS page_count,
       (SELECT COUNT(*) FROM products x WHERE x.category_id = c.id AND x.is_published = 1) AS product_count
     FROM categories c ${includeUnpublished ? '' : 'WHERE c.is_published = 1'}
     ORDER BY c.sort_order, c.id`,
  );
}

export function getCategory(db: D1Database, slug: string): Promise<Category | null> {
  return first<Category>(db, 'SELECT * FROM categories WHERE slug = ? AND is_published = 1', slug);
}

export function getCategoryPages(db: D1Database, categoryId: number, includeUnpublished = false): Promise<CatalogPage[]> {
  return all<CatalogPage>(
    db,
    `SELECT p.*, b.name AS brand_name,
       (SELECT COUNT(*) FROM products x WHERE x.page_id = p.id AND x.is_published = 1) AS product_count
     FROM catalog_pages p LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.category_id = ? ${includeUnpublished ? '' : 'AND p.is_published = 1'}
     ORDER BY p.sort_order, p.id`,
    categoryId,
  );
}

export function getPage(db: D1Database, categoryId: number, slug: string): Promise<CatalogPage | null> {
  return first<CatalogPage>(
    db,
    `SELECT p.*, b.name AS brand_name FROM catalog_pages p LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.category_id = ? AND p.slug = ? AND p.is_published = 1`,
    categoryId,
    slug,
  );
}

async function attachDetails(db: D1Database, products: Product[]): Promise<ProductDetail[]> {
  const ids = products.map((p) => p.id);
  const apps = new Map<number, Application[]>();
  const refs = new Map<number, CrossRef[]>();
  for (const part of chunk(ids, 80)) {
    const ph = part.map(() => '?').join(',');
    for (const a of await all<Application>(db, `SELECT * FROM product_applications WHERE product_id IN (${ph}) ORDER BY product_id, sort_order, id`, ...part)) {
      (apps.get(a.product_id) ?? apps.set(a.product_id, []).get(a.product_id)!).push(a);
    }
    for (const r of await all<CrossRef>(db, `SELECT * FROM product_cross_refs WHERE product_id IN (${ph}) ORDER BY product_id, sort_order, id`, ...part)) {
      (refs.get(r.product_id) ?? refs.set(r.product_id, []).get(r.product_id)!).push(r);
    }
  }
  return products.map((p) => ({
    ...p,
    specs: parseJson<Record<string, string>>(p.specs_json, {}),
    apps: apps.get(p.id) ?? [],
    refs: refs.get(p.id) ?? [],
  }));
}

/** 一張型錄頁的全部產品（含適用車款與對照料號）。以單一頁面為單位一次載入，避免 D1 參數上限。 */
export async function getPageProducts(db: D1Database, pageId: number, includeUnpublished = false): Promise<ProductDetail[]> {
  const products = await all<Product>(
    db,
    `SELECT * FROM products WHERE page_id = ? ${includeUnpublished ? '' : 'AND is_published = 1'} ORDER BY sort_order, id`,
    pageId,
  );
  if (!products.length) return [];
  const apps = await all<Application>(
    db,
    `SELECT a.* FROM product_applications a JOIN products p ON p.id = a.product_id WHERE p.page_id = ? ORDER BY a.product_id, a.sort_order, a.id`,
    pageId,
  );
  const refs = await all<CrossRef>(
    db,
    `SELECT r.* FROM product_cross_refs r JOIN products p ON p.id = r.product_id WHERE p.page_id = ? ORDER BY r.product_id, r.sort_order, r.id`,
    pageId,
  );
  const appMap = new Map<number, Application[]>();
  const refMap = new Map<number, CrossRef[]>();
  apps.forEach((a) => (appMap.get(a.product_id) ?? appMap.set(a.product_id, []).get(a.product_id)!).push(a));
  refs.forEach((r) => (refMap.get(r.product_id) ?? refMap.set(r.product_id, []).get(r.product_id)!).push(r));
  return products.map((p) => ({
    ...p,
    specs: parseJson<Record<string, string>>(p.specs_json, {}),
    apps: appMap.get(p.id) ?? [],
    refs: refMap.get(p.id) ?? [],
  }));
}

export async function getProductDetail(db: D1Database, id: number): Promise<ProductDetail | null> {
  const p = await first<Product>(db, 'SELECT * FROM products WHERE id = ?', id);
  if (!p) return null;
  return (await attachDetails(db, [p]))[0];
}

// ---------- 搜尋 ----------

export interface SearchHit {
  id: number;
  yac_no: string;
  yac_no_left: string | null;
  car_series: string | null;
  primary_image_url: string | null;
  page_slug: string;
  page_title: string;
  category_slug: string;
  category_name: string;
  summary: string;
}

export interface SearchOptions {
  q?: string;
  category?: string;
  model?: string;
  limit?: number;
}

export function searchTokens(q: string): string[] {
  return q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function searchProducts(db: D1Database, opts: SearchOptions): Promise<SearchHit[]> {
  const tokens = [...searchTokens(opts.q ?? ''), ...searchTokens(opts.model ?? '')];
  if (!tokens.length && !opts.category) return [];
  const where: string[] = ['p.is_published = 1', 'cp.is_published = 1'];
  const params: unknown[] = [];
  if (opts.category) {
    where.push('c.slug = ?');
    params.push(opts.category);
  }
  for (const t of tokens) {
    const norm = normalizeRef(t);
    const raw = `%${t.replace(/[%_]/g, '')}%`;
    const parts: string[] = [];
    if (norm.length >= 2) {
      const n = `%${norm}%`;
      parts.push('p.yac_no_normalized LIKE ?');
      params.push(n);
      parts.push("REPLACE(REPLACE(REPLACE(UPPER(IFNULL(p.yac_no_left,'')),'-',''),' ',''),'/','') LIKE ?");
      params.push(n);
      parts.push('EXISTS (SELECT 1 FROM product_cross_refs r WHERE r.product_id = p.id AND r.ref_no_normalized LIKE ?)');
      params.push(n);
    }
    parts.push('EXISTS (SELECT 1 FROM product_applications a WHERE a.product_id = p.id AND (a.car_model LIKE ? OR a.car_brand_text LIKE ? OR a.engine LIKE ?))');
    params.push(raw, raw, raw);
    parts.push('b.name LIKE ?', 'p.car_series LIKE ?', 'cp.title LIKE ?');
    params.push(raw, raw, raw);
    where.push(`(${parts.join(' OR ')})`);
  }
  const lead = tokens[0] ? normalizeRef(tokens[0]) : '';
  const limit = Math.min(opts.limit ?? 120, 300);
  const rows = await all<SearchHit>(
    db,
    `SELECT p.id, p.yac_no, p.yac_no_left, p.car_series, p.primary_image_url,
            cp.slug AS page_slug, cp.title AS page_title, c.slug AS category_slug, c.name_zh AS category_name,
            IFNULL((SELECT a.car_model FROM product_applications a WHERE a.product_id = p.id ORDER BY a.sort_order, a.id LIMIT 1), '') AS summary
     FROM products p
     JOIN catalog_pages cp ON cp.id = p.page_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE ${where.join(' AND ')}
     ORDER BY (p.yac_no_normalized = ?) DESC, (p.yac_no_normalized LIKE ?) DESC, c.sort_order, cp.sort_order, p.sort_order
     LIMIT ${limit}`,
    ...params,
    lead,
    `${lead}%`,
  );
  return rows;
}

// ---------- 消息 / 站內頁面 ----------

export function getNews(db: D1Database, limit = 50, includeUnpublished = false): Promise<NewsPost[]> {
  return all<NewsPost>(
    db,
    `SELECT * FROM news_posts ${includeUnpublished ? '' : 'WHERE is_published = 1'} ORDER BY is_pinned DESC, published_at DESC, id DESC LIMIT ?`,
    limit,
  );
}

export function getNewsPost(db: D1Database, slug: string): Promise<NewsPost | null> {
  return first<NewsPost>(db, 'SELECT * FROM news_posts WHERE slug = ? AND is_published = 1', slug);
}

export async function getSitePage<T = Record<string, any>>(db: D1Database, key: string): Promise<{ title: string; content: T } | null> {
  const row = await first<{ title: string; content_json: string }>(db, 'SELECT title, content_json FROM site_pages WHERE page_key = ?', key);
  return row ? { title: row.title, content: parseJson<T>(row.content_json, {} as T) } : null;
}

export async function getHomeStats(db: D1Database) {
  const row = await first<{ categories: number; brands: number; products: number; refs: number }>(
    db,
    `SELECT (SELECT COUNT(*) FROM categories WHERE is_published = 1) AS categories,
            (SELECT COUNT(*) FROM brands) AS brands,
            (SELECT COUNT(*) FROM products WHERE is_published = 1) AS products,
            (SELECT COUNT(*) FROM product_cross_refs) AS refs`,
  );
  return row ?? { categories: 0, brands: 0, products: 0, refs: 0 };
}

/** 各產品線代表圖（取第一個有圖的產品），供首頁磚塊使用。 */
export async function getCategoryCovers(db: D1Database): Promise<Record<string, string>> {
  const rows = await all<{ slug: string; img: string }>(
    db,
    `SELECT c.slug AS slug,
       IFNULL(c.cover_image, (SELECT p.primary_image_url FROM products p WHERE p.category_id = c.id AND p.primary_image_url IS NOT NULL AND p.is_published = 1 ORDER BY p.sort_order, p.id LIMIT 1)) AS img
     FROM categories c WHERE c.is_published = 1`,
  );
  return Object.fromEntries(rows.filter((r) => r.img).map((r) => [r.slug, r.img]));
}
