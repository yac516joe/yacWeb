import { all, first, audit, chunk } from './db';
import { APP_FIELDS, REF_LABELS, normalizeRef, type ColumnDef } from './columns';
import { parseColumns, getPageProducts, type ProductDetail } from './queries';
import type { Opt } from './admin-resources';
import type { MutResult } from './admin-crud';

export const PRODUCT_PAGE_SIZE = 50;

export interface ProductInput {
  page_id: number;
  yac_no: string;
  yac_no_left: string | null;
  car_series: string | null;
  notes: string | null;
  primary_image_url: string | null;
  is_published: number;
  sort_order: number;
  specs: Record<string, string>;
  apps: Partial<Record<(typeof APP_FIELDS)[number], string | null>>[];
  refs: { ref_type: string; ref_no: string }[];
}

const s = (v: unknown, max = 500): string => (v == null ? '' : String(v).trim().slice(0, max));
const n = (v: unknown): string | null => s(v) || null;

export function parseProductInput(body: Record<string, any>): { value: ProductInput } | { error: string } {
  const page_id = Number(body.page_id);
  if (!Number.isInteger(page_id) || page_id <= 0) return { error: '請選擇所屬型錄頁' };
  const yac_no = s(body.yac_no, 100);
  if (!yac_no) return { error: '請填寫 YAC 料號' };
  const sort = body.sort_order === '' || body.sort_order == null ? 0 : Number(body.sort_order);
  if (!Number.isInteger(sort)) return { error: '排序必須是整數' };

  const specs: Record<string, string> = {};
  if (body.specs && typeof body.specs === 'object') {
    for (const [k, v] of Object.entries(body.specs as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9_]+$/.test(k)) return { error: `規格代碼不合法：${k}` };
      const val = s(v, 200);
      if (val) specs[k] = val;
    }
  }

  const apps: ProductInput['apps'] = [];
  if (Array.isArray(body.apps)) {
    if (body.apps.length > 200) return { error: '適用車款最多 200 筆' };
    for (const a of body.apps as Record<string, unknown>[]) {
      const row: ProductInput['apps'][number] = {};
      let any = false;
      for (const f of APP_FIELDS) {
        const v = n(a?.[f]);
        row[f] = v;
        if (v) any = true;
      }
      if (any) apps.push(row);
    }
  }

  const refs: ProductInput['refs'] = [];
  if (Array.isArray(body.refs)) {
    if (body.refs.length > 200) return { error: '對照料號最多 200 筆' };
    for (const r of body.refs as Record<string, unknown>[]) {
      const ref_no = s(r?.ref_no, 100);
      const ref_type = s(r?.ref_type, 30).toUpperCase();
      if (!ref_no) continue;
      if (!ref_type || !/^[A-Z0-9-]+$/.test(ref_type)) return { error: `對照類型不合法：${ref_type}` };
      refs.push({ ref_type, ref_no });
    }
  }

  return {
    value: {
      page_id,
      yac_no,
      yac_no_left: n(body.yac_no_left),
      car_series: n(body.car_series),
      notes: n(body.notes),
      primary_image_url: n(body.primary_image_url),
      is_published: body.is_published === true || body.is_published === 1 || body.is_published === '1' ? 1 : 0,
      sort_order: sort,
      specs,
      apps,
      refs,
    },
  };
}

function childStatements(db: D1Database, productId: number | null, v: ProductInput) {
  const pid = productId;
  const stmts: D1PreparedStatement[] = [];
  v.apps.forEach((a, i) =>
    stmts.push(
      db
        .prepare(
          'INSERT INTO product_applications (product_id, car_brand_text, car_model, engine, transmission, position, year_range, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(pid, a.car_brand_text ?? null, a.car_model ?? null, a.engine ?? null, a.transmission ?? null, a.position ?? null, a.year_range ?? null, i),
    ),
  );
  v.refs.forEach((r, i) =>
    stmts.push(
      db
        .prepare('INSERT INTO product_cross_refs (product_id, ref_type, ref_no, ref_no_normalized, sort_order) VALUES (?, ?, ?, ?, ?)')
        .bind(pid, r.ref_type, r.ref_no, normalizeRef(r.ref_no), i),
    ),
  );
  return stmts;
}

async function pageInfo(db: D1Database, pageId: number) {
  return first<{ id: number; category_id: number; brand_id: number | null }>(db, 'SELECT id, category_id, brand_id FROM catalog_pages WHERE id = ?', pageId);
}

export async function createProduct(db: D1Database, v: ProductInput, actor: string, ip: string | null): Promise<MutResult> {
  const page = await pageInfo(db, v.page_id);
  if (!page) return { ok: false, status: 400, error: '所屬型錄頁不存在' };
  const res = await db
    .prepare(
      `INSERT INTO products (page_id, category_id, brand_id, yac_no, yac_no_normalized, yac_no_left, car_series, specs_json, notes, primary_image_url, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(page.id, page.category_id, page.brand_id, v.yac_no, normalizeRef(v.yac_no), v.yac_no_left, v.car_series, JSON.stringify(v.specs), v.notes, v.primary_image_url, v.is_published, v.sort_order)
    .run();
  const id = res.meta.last_row_id as number;
  const kids = childStatements(db, id, v);
  for (const part of chunk(kids, 80)) await db.batch(part);
  await audit(db, actor, 'CREATE', 'products', id, { yac_no: v.yac_no, page_id: v.page_id, apps: v.apps.length, refs: v.refs.length }, ip);
  return { ok: true, id };
}

export async function updateProduct(db: D1Database, id: number, v: ProductInput, actor: string, ip: string | null): Promise<MutResult> {
  const before = await first<Record<string, any>>(db, 'SELECT * FROM products WHERE id = ?', id);
  if (!before) return { ok: false, status: 404, error: '產品不存在' };
  const page = await pageInfo(db, v.page_id);
  if (!page) return { ok: false, status: 400, error: '所屬型錄頁不存在' };
  const stmts = [
    db
      .prepare(
        `UPDATE products SET page_id = ?, category_id = ?, brand_id = ?, yac_no = ?, yac_no_normalized = ?, yac_no_left = ?, car_series = ?, specs_json = ?, notes = ?,
         primary_image_url = ?, is_published = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .bind(page.id, page.category_id, page.brand_id, v.yac_no, normalizeRef(v.yac_no), v.yac_no_left, v.car_series, JSON.stringify(v.specs), v.notes, v.primary_image_url, v.is_published, v.sort_order, id),
    db.prepare('DELETE FROM product_applications WHERE product_id = ?').bind(id),
    db.prepare('DELETE FROM product_cross_refs WHERE product_id = ?').bind(id),
    ...childStatements(db, id, v),
  ];
  if (stmts.length > 90) return { ok: false, status: 400, error: '適用車款與對照料號合計過多，請拆分' };
  await db.batch(stmts);
  const diff: Record<string, unknown> = {};
  for (const k of ['yac_no', 'yac_no_left', 'car_series', 'notes', 'primary_image_url', 'is_published', 'sort_order', 'page_id'] as const) {
    if (String(before[k] ?? '') !== String((v as any)[k] ?? '')) diff[k] = { from: before[k], to: (v as any)[k] };
  }
  diff.apps = v.apps.length;
  diff.refs = v.refs.length;
  await audit(db, actor, 'UPDATE', 'products', id, diff, ip);
  return { ok: true, id };
}

export async function deleteProduct(db: D1Database, id: number, actor: string, ip: string | null): Promise<MutResult> {
  const before = await first<Record<string, any>>(db, 'SELECT id, yac_no, page_id FROM products WHERE id = ?', id);
  if (!before) return { ok: false, status: 404, error: '產品不存在' };
  await db.batch([
    db.prepare('DELETE FROM product_applications WHERE product_id = ?').bind(id),
    db.prepare('DELETE FROM product_cross_refs WHERE product_id = ?').bind(id),
    db.prepare('DELETE FROM products WHERE id = ?').bind(id),
  ]);
  await audit(db, actor, 'DELETE', 'products', id, before, ip);
  return { ok: true, id };
}

export interface ProductListRow {
  id: number;
  yac_no: string;
  car_series: string | null;
  page_title: string;
  category_name: string;
  is_published: number;
  primary_image_url: string | null;
}

export async function listProducts(db: D1Database, opts: { q?: string; pageId?: number; page?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = (opts.q ?? '').trim();
  if (q) {
    const norm = normalizeRef(q);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const parts = ['p.yac_no LIKE ?', 'p.car_series LIKE ?'];
    params.push(like, like);
    if (norm.length >= 2) {
      parts.push('p.yac_no_normalized LIKE ?', 'EXISTS (SELECT 1 FROM product_cross_refs r WHERE r.product_id = p.id AND r.ref_no_normalized LIKE ?)');
      params.push(`%${norm}%`, `%${norm}%`);
    }
    where.push(`(${parts.join(' OR ')})`);
  }
  if (opts.pageId) {
    where.push('p.page_id = ?');
    params.push(opts.pageId);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM products p ${w}`, ...params))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pages);
  const rows = await all<ProductListRow>(
    db,
    `SELECT p.id, p.yac_no, p.car_series, p.is_published, p.primary_image_url, cp.title AS page_title, c.name_zh AS category_name
     FROM products p JOIN catalog_pages cp ON cp.id = p.page_id JOIN categories c ON c.id = p.category_id
     ${w} ORDER BY c.sort_order, cp.sort_order, p.sort_order, p.id LIMIT ${PRODUCT_PAGE_SIZE} OFFSET ${(page - 1) * PRODUCT_PAGE_SIZE}`,
    ...params,
  );
  return { rows, total, page, pages };
}

export async function pageOptions(db: D1Database): Promise<Opt[]> {
  const rows = await all<{ id: number; title: string; cat: string }>(
    db,
    'SELECT p.id, p.title, c.name_zh AS cat FROM catalog_pages p JOIN categories c ON c.id = p.category_id ORDER BY c.sort_order, p.sort_order, p.id',
  );
  return rows.map((r) => ({ value: r.id, label: `${r.cat}／${r.title}` }));
}

export function refTypeOptions(): Opt[] {
  return Object.entries(REF_LABELS).map(([value, label]) => ({ value, label }));
}

// ---------- CSV 匯入（格式同「下載 CSV」） ----------

/** 簡易 RFC 4180 解析。 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export const IMPORT_MAX_PRODUCTS = 200;

/** 依型錄頁欄位定義，把 CSV 列組成產品（連續且 YAC 料號相同的列視為同一產品的多筆適用車款）。 */
export function csvToProducts(rows: string[][], columns: ColumnDef[], pageId: number): { products: ProductInput[]; error?: string } {
  if (rows.length < 2) return { products: [], error: 'CSV 沒有資料列' };
  if (rows[0].length !== columns.length) return { products: [], error: `欄位數不符：此型錄頁有 ${columns.length} 欄，CSV 有 ${rows[0].length} 欄（請使用「下載 CSV」的格式）` };
  const products: ProductInput[] = [];
  let curKey = '';
  let cur: ProductInput | null = null;
  for (const row of rows.slice(1)) {
    const get = (src: string) => {
      const i = columns.findIndex((c) => c.source === src);
      return i >= 0 ? (row[i] ?? '').trim() : '';
    };
    const yac = get('yac');
    if (!yac) continue;
    const appRow: ProductInput['apps'][number] = {};
    for (const f of APP_FIELDS) appRow[f] = get(`app.${f}`) || null;
    const hasApp = APP_FIELDS.some((f) => appRow[f]);
    if (cur && curKey === yac) {
      if (hasApp) cur.apps.push(appRow);
      continue;
    }
    const specs: Record<string, string> = {};
    const refs: ProductInput['refs'] = [];
    for (const c of columns) {
      const i = columns.indexOf(c);
      const val = (row[i] ?? '').trim();
      if (!val) continue;
      if (c.source.startsWith('spec.')) specs[c.source.slice(5)] = val;
      else if (c.source.startsWith('ref.')) for (const part of val.split(/\s*\/\s*/)) if (part) refs.push({ ref_type: c.source.slice(4), ref_no: part });
    }
    cur = {
      page_id: pageId,
      yac_no: yac,
      yac_no_left: get('yac_left') || null,
      car_series: null,
      notes: get('remark') || null,
      primary_image_url: get('photo') || null,
      is_published: 1,
      sort_order: products.length,
      specs,
      apps: hasApp ? [appRow] : [],
      refs,
    };
    curKey = yac;
    products.push(cur);
  }
  if (!products.length) return { products: [], error: '沒有可匯入的產品' };
  if (products.length > IMPORT_MAX_PRODUCTS) return { products: [], error: `單次最多匯入 ${IMPORT_MAX_PRODUCTS} 個產品（目前 ${products.length}），請拆檔` };
  return { products };
}

/** 以 (型錄頁, YAC 料號) 為鍵 upsert：已存在則覆寫規格／車款／對照，不存在則新增。 */
export async function importProducts(
  db: D1Database,
  pageId: number,
  products: ProductInput[],
  actor: string,
  ip: string | null,
): Promise<{ created: number; updated: number } | { error: string }> {
  const page = await pageInfo(db, pageId);
  if (!page) return { error: '所屬型錄頁不存在' };
  const existing = await all<{ id: number; yac_no: string; sort_order: number }>(db, 'SELECT id, yac_no, sort_order FROM products WHERE page_id = ?', pageId);
  const byNo = new Map(existing.map((e) => [e.yac_no, e]));
  const maxSort = existing.reduce((m, e) => Math.max(m, e.sort_order), 0);
  let created = 0;
  let updated = 0;
  let extra = 0;
  for (const p of products) {
    const hit = byNo.get(p.yac_no);
    if (hit) {
      const stmts = [
        db
          .prepare(
            `UPDATE products SET yac_no_left = ?, specs_json = ?, notes = ?, primary_image_url = COALESCE(?, primary_image_url), updated_at = datetime('now') WHERE id = ?`,
          )
          .bind(p.yac_no_left, JSON.stringify(p.specs), p.notes, p.primary_image_url, hit.id),
        db.prepare('DELETE FROM product_applications WHERE product_id = ?').bind(hit.id),
        db.prepare('DELETE FROM product_cross_refs WHERE product_id = ?').bind(hit.id),
        ...childStatements(db, hit.id, p),
      ];
      for (const part of chunk(stmts, 80)) await db.batch(part);
      updated++;
    } else {
      const res = await db
        .prepare(
          `INSERT INTO products (page_id, category_id, brand_id, yac_no, yac_no_normalized, yac_no_left, specs_json, notes, primary_image_url, is_published, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        )
        .bind(page.id, page.category_id, page.brand_id, p.yac_no, normalizeRef(p.yac_no), p.yac_no_left, JSON.stringify(p.specs), p.notes, p.primary_image_url, maxSort + 1 + extra++)
        .run();
      for (const part of chunk(childStatements(db, res.meta.last_row_id as number, p), 80)) await db.batch(part);
      created++;
    }
  }
  await audit(db, actor, 'IMPORT', 'products', pageId, { created, updated }, ip);
  return { created, updated };
}

/** 匯出（含未公開產品）。 */
export async function exportRows(db: D1Database, pageId: number): Promise<{ products: ProductDetail[]; columns: ColumnDef[]; title: string } | null> {
  const page = await first<{ title: string; columns_json: string }>(db, 'SELECT title, columns_json FROM catalog_pages WHERE id = ?', pageId);
  if (!page) return null;
  return { products: await getPageProducts(db, pageId, true), columns: parseColumns(page.columns_json), title: page.title };
}
