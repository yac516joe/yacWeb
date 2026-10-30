/**
 * 將舊版靜態 HTML 型錄解析並匯出為 D1 seed：
 *   migrations/seed/seed.sql（不進版控）與 docs/MIGRATION_REPORT.md（核對報告）
 * 用法：npm run db:import:legacy
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { normalizeRef } from '../src/lib/columns';
import { parseHtml, type ParsedTable } from './lib/parse-page';
import { brandOf, insertBatches, legacyKey, pageSlugOf, sqlVal } from './lib/legacy';
import { NEWS_SEED, SITE_PAGES } from './lib/seed-content';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler', 'src', 'scripts', 'docs', 'migrations', 'tests', 'integrations']);

interface CatConf {
  slug: string;
  nameZh: string;
  nameEn: string;
  summary: string;
  index: string;
  dirs: string[];
  brandless?: boolean;
  indexFiles: string[];
}

const CATS: CatConf[] = [
  { slug: 'cvj', nameZh: '等速接頭', nameEn: 'C.V. Joint', summary: '外側等速接頭，涵蓋 70 餘個車廠規格與尺寸對照。', index: 'cvj/cvj.html', dirs: ['cvj/new'], indexFiles: [] },
  { slug: 'ds', nameZh: '傳動軸', nameEn: 'Drive Shaft', summary: '成品傳動軸總成，依車廠與車型列出左右軸料號與尺寸。', index: 'ds/ds.html', dirs: ['ds'], indexFiles: ['ds.html'] },
  { slug: 'universal-joint', nameZh: '十字軸／萬向接頭', nameEn: 'Universal Joint', summary: '十字軸、法蘭接頭、花鍵軸與傳動軸零組件。', index: 'universal_joint/universal_joint.html', dirs: ['universal_joint'], brandless: true, indexFiles: ['universal_joint.html'] },
  { slug: 'steering-rack', nameZh: '轉向機', nameEn: 'Steering Rack', summary: '左駕與右駕動力／機械轉向機型錄。', index: 'steeringrack/steeringrack.html', dirs: ['steeringrack'], indexFiles: ['steeringrack.html'] },
  { slug: 'accessories', nameZh: '零配件', nameEn: 'Accessories', summary: '防塵套、三叉、球籠、鋼珠、扣環、束環等等速接頭零配件。', index: 'accessories/accessories.html', dirs: ['accessories'], brandless: true, indexFiles: ['accessories.html', 'index.html', 'inboard-joints-list.html', 'absring-list.html'] },
  { slug: 'inboard-joint', nameZh: '內側接頭', nameEn: 'Inboard Joint', summary: '內側等速接頭（三叉／球籠式）規格對照。', index: 'accessories/inboard-joints-list.html', dirs: ['accessories/Inboard_Joints', 'Inboard_Joints'], indexFiles: [] },
  { slug: 'hubs', nameZh: '輪轂', nameEn: 'Hubs', summary: '輪轂軸承總成，含 OEM 對照與產品照片。', index: 'hubs/hubs.html', dirs: ['hubs'], indexFiles: ['hubs.html'] },
  { slug: 'locking-hub', nameZh: '四輪傳動鎖定輪轂', nameEn: '4WD Locking Hub', summary: '四輪傳動車款手動／自動鎖定輪轂。', index: 'lockinghub/locking.html', dirs: ['lockinghub'], indexFiles: ['locking.html'] },
  { slug: 'steering-pump', nameZh: '動力轉向泵', nameEn: 'Steering Pump', summary: '動力轉向油壓泵，依車廠列出 OEM 對照。', index: 'steeringpump/steeringpump.html', dirs: ['steeringpump'], indexFiles: ['steeringpump.html'] },
  { slug: 'water-pump', nameZh: '水泵', nameEn: 'Water Pump', summary: '引擎冷卻水泵，依車廠列出 OEM 對照。', index: 'waterpump/waterpump.html', dirs: ['waterpump'], indexFiles: ['waterpump.html'] },
  { slug: 'brake-disc', nameZh: '煞車碟盤', nameEn: 'Brake Disc', summary: '煞車碟盤，依車廠與型式列出 OEM 對照。', index: 'brakedisc/brakedisc.html', dirs: ['brakedisc'], indexFiles: ['brakedisc.html'] },
];

// ---------- 檔案工具 ----------
function readHtml(rel: string): string {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  const s = buf.toString('utf8');
  return s.includes('\uFFFD') ? new TextDecoder('big5').decode(buf) : s;
}

function* walk(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name) && dir === ROOT) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.html?$/i.test(e.name)) yield p;
  }
}

const dirCache = new Map<string, string[]>();
function listDir(abs: string): string[] {
  let l = dirCache.get(abs);
  if (!l) {
    l = fs.existsSync(abs) ? fs.readdirSync(abs) : [];
    dirCache.set(abs, l);
  }
  return l;
}

/** 回傳實際大小寫的站內絕對路徑（Cloudflare 靜態資源區分大小寫） */
function resolveExact(url: string): { path: string; caseFixed: boolean } | null {
  const segs = url.split('/').filter(Boolean);
  let cur = ROOT;
  const out: string[] = [];
  let fixed = false;
  for (const seg of segs) {
    const names = listDir(cur);
    let hit = names.find((n) => n === seg);
    if (!hit) {
      hit = names.find((n) => n.toLowerCase() === seg.toLowerCase());
      if (hit) fixed = true;
    }
    if (!hit) return null;
    out.push(hit);
    cur = path.join(cur, hit);
  }
  return fs.existsSync(cur) && fs.statSync(cur).isFile() ? { path: '/' + out.join('/'), caseFixed: fixed } : null;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ---------- 索引頁：檔名 → 顯示名稱 / 順序 ----------
function readIndex(rel: string): { text: Map<string, string>; order: Map<string, number> } {
  const text = new Map<string, string>();
  const order = new Map<string, number>();
  if (!fs.existsSync(path.join(ROOT, rel))) return { text, order };
  const $ = cheerio.load(readHtml(rel));
  let n = 0;
  $('a[href]').each((_, a) => {
    const href = safeDecode($(a).attr('href') ?? '');
    if (!/\.html?$/i.test(href) || /^(https?:|mailto:|\.\.\/|\/)/i.test(href)) return;
    const key = path.posix.basename(href).toLowerCase();
    const t = $(a).text().replace(/\s+/g, ' ').trim();
    if (t && !text.has(key)) text.set(key, t);
    if (!order.has(key)) order.set(key, n++);
  });
  return { text, order };
}

// ---------- 主流程 ----------
interface PageRec {
  id: number;
  catSlug: string;
  slug: string;
  title: string;
  brandKey: string | null;
  hand: string | null;
  columns: unknown[];
  legacyPath: string;
  sort: number;
  table: ParsedTable;
}

const allHtml = [...walk(ROOT)].map((p) => path.relative(ROOT, p).replace(/\\/g, '/'));
const redirects = new Map<string, { to: string; broken: number; note: string }>();
const warnings: string[] = [];
const missingImages = new Map<string, Set<string>>();
const caseFixedImages = new Set<string>();
const emptyPages: string[] = [];
const pages: PageRec[] = [];
const brands = new Map<string, { name: string; id: number }>();
const claimed = new Set<string>();
let pageId = 1;
let brandId = 1;

function addRedirect(rel: string, to: string, broken = 0, note = '') {
  redirects.set(legacyKey(rel), { to, broken, note });
  claimed.add(rel);
}

function getBrand(raw: string): string {
  const b = brandOf(raw);
  if (!brands.has(b.slug)) brands.set(b.slug, { name: b.name, id: brandId++ });
  return b.slug;
}

const catPageMap = new Map<string, PageRec[]>();

CATS.forEach((cat) => {
  const idx = readIndex(cat.index);
  const seenBase = new Set<string>();
  const slugsUsed = new Set<string>();
  const files: string[] = [];
  cat.dirs.forEach((d) => {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    for (const f of fs.readdirSync(abs).sort()) {
      if (!/\.html?$/i.test(f)) continue;
      if (cat.indexFiles.includes(f.toLowerCase()) || cat.indexFiles.includes(f)) continue;
      const k = f.toLowerCase();
      const rel = `${d}/${f}`;
      if (seenBase.has(k)) {
        files.push(`dup:${rel}`);
        continue;
      }
      seenBase.add(k);
      files.push(rel);
    }
  });
  const list: PageRec[] = [];
  catPageMap.set(cat.slug, list);
  let sortFallback = 1000;
  for (const entry of files) {
    if (entry.startsWith('dup:')) {
      const rel = entry.slice(4);
      const twin = list.find((p) => path.posix.basename(p.legacyPath).toLowerCase() === path.posix.basename(rel).toLowerCase());
      addRedirect(rel, twin ? `/catalog/${cat.slug}/${twin.slug}` : `/catalog/${cat.slug}`, 0, '與主要資料夾重複，沿用主要版本');
      continue;
    }
    const rel = entry;
    const base = path.posix.basename(rel);
    const html = readHtml(rel);
    if (/404 - File or directory not found/i.test(html)) {
      addRedirect(rel, `/catalog/${cat.slug}`, 1, '舊站即為 404 頁面');
      emptyPages.push(`${rel}（舊站 404）`);
      continue;
    }
    const resolveAsset = (src: string) => {
      if (/^(https?:|data:)/i.test(src)) return null;
      const clean = safeDecode(src.split(/[?#]/)[0]);
      const abs = clean.startsWith('/') ? clean : path.posix.join('/', path.posix.dirname(rel), clean);
      const hit = resolveExact(path.posix.normalize(abs));
      if (!hit) {
        if (!missingImages.has(rel)) missingImages.set(rel, new Set());
        missingImages.get(rel)!.add(src);
        return null;
      }
      if (hit.caseFixed) caseFixedImages.add(`${rel} → ${hit.path}`);
      return hit.path;
    };
    const tables = parseHtml(html, { resolveAsset }).filter((t) => t.products.length > 0 || t.stats.dataRows > 0);
    if (!tables.length) {
      addRedirect(rel, `/catalog/${cat.slug}`, 0, '無資料表');
      emptyPages.push(`${rel}（無資料表）`);
      continue;
    }
    const { slug: baseSlug, hand } = pageSlugOf(base);
    const linkText = idx.text.get(base.toLowerCase());
    const order = idx.order.get(base.toLowerCase()) ?? sortFallback++;
    let brandKey: string | null = null;
    if (!cat.brandless) brandKey = getBrand(linkText ?? base.replace(/\.html?$/i, '').replace(/_/g, ' '));
    tables.forEach((t, ti) => {
      let slug = ti === 0 ? baseSlug : `${baseSlug}-${ti + 1}`;
      while (slugsUsed.has(slug)) slug += '-x';
      slugsUsed.add(slug);
      const defaultTitle = cat.brandless ? (linkText ?? t.title ?? base.replace(/\.html?$/i, '')) : brands.get(brandKey!)!.name;
      let title = ti === 0 ? defaultTitle : `${defaultTitle}（${ti + 1}）`;
      if (cat.slug === 'universal-joint' && /(01|-1)\.html$/i.test(base) || (cat.slug === 'universal-joint' && /^mazda\.html$/i.test(base))) title += '（新開發）';
      const rec: PageRec = {
        id: pageId++,
        catSlug: cat.slug,
        slug,
        title,
        brandKey,
        hand: cat.slug === 'steering-rack' ? (hand ?? 'LHD') : null,
        columns: t.columns,
        legacyPath: rel,
        sort: order * 10 + (hand ? 1 : 0),
        table: t,
      };
      list.push(rec);
      pages.push(rec);
      t.warnings.forEach((w) => warnings.push(`${rel}: ${w}`));
    });
    addRedirect(rel, `/catalog/${cat.slug}/${list.find((p) => p.legacyPath === rel)!.slug}`);
  }
  // 分類索引頁
  if (allHtml.includes(cat.index)) addRedirect(cat.index, `/catalog/${cat.slug}`);
  cat.indexFiles.forEach((f) => {
    const dir = cat.dirs[0];
    const rel = `${dir}/${f}`;
    if (!claimed.has(rel) && allHtml.includes(rel)) addRedirect(rel, `/catalog/${cat.slug}`);
  });
});

// cvj/old：舊版版面（含 Big5 亂碼）→ 轉至對應車廠頁
const cvjBrandPages = catPageMap.get('cvj')!;
allHtml
  .filter((f) => f.startsWith('cvj/old/'))
  .forEach((rel) => {
    const base = path.posix.basename(rel).replace(/\.html?$/i, '').replace(/-\d+$/, '');
    const b = brandOf(base).slug;
    const hit = cvjBrandPages.find((p) => p.brandKey === b) ?? cvjBrandPages.find((p) => p.slug.startsWith(b));
    addRedirect(rel, hit ? `/catalog/cvj/${hit.slug}` : '/catalog/cvj', 0, '舊版 cvj/old 版面');
  });

// 其餘零散頁面
const misc: [string, string, number, string][] = [
  ['index.html', '/', 0, ''],
  ['profile.html', '/about', 0, ''],
  ['newproduct.html', '/news', 0, ''],
  ['cvj/company-1.html', '/about', 0, ''],
  ['cvj/newproduct.html', '/news', 0, ''],
  ['cvj/service.html', '/contact', 0, ''],
];
misc.filter(([rel]) => allHtml.includes(rel)).forEach(([rel, to, b, n]) => addRedirect(rel, to, b, n));
allHtml.forEach((rel) => {
  if (claimed.has(rel)) return;
  const html = readHtml(rel);
  const is404 = /404 - File or directory not found/i.test(html);
  if (/^(common|menu)\//.test(rel)) addRedirect(rel, '/', 0, '舊站共用版型片段');
  else addRedirect(rel, '/', is404 ? 1 : 0, is404 ? '舊站即為 404 頁面' : '未分類頁面');
});

// ---------- 組 SQL ----------
const sql: string[] = [
  '-- 由 scripts/migrate-legacy-html.ts 產生，請勿手動編輯',
  'DELETE FROM legacy_redirects;',
  'DELETE FROM product_cross_refs;',
  'DELETE FROM product_applications;',
  'DELETE FROM products;',
  'DELETE FROM catalog_pages;',
  'DELETE FROM brands;',
  'DELETE FROM categories;',
];
sql.push(
  ...insertBatches(
    'categories',
    ['id', 'slug', 'name_zh', 'name_en', 'summary', 'sort_order'],
    CATS.map((c, i) => [i + 1, c.slug, c.nameZh, c.nameEn, c.summary, (i + 1) * 10]),
  ),
);
const catId = new Map(CATS.map((c, i) => [c.slug, i + 1]));
const sortedBrands = [...brands.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
sql.push(...insertBatches('brands', ['id', 'slug', 'name', 'sort_order'], sortedBrands.map(([slug, b], i) => [b.id, slug, b.name, (i + 1) * 10])));
sql.push(
  ...insertBatches(
    'catalog_pages',
    ['id', 'category_id', 'brand_id', 'slug', 'title', 'hand', 'columns_json', 'legacy_path', 'sort_order'],
    pages.map((p) => [p.id, catId.get(p.catSlug)!, p.brandKey ? brands.get(p.brandKey)!.id : null, p.slug, p.title, p.hand, JSON.stringify(p.columns), p.legacyPath, p.sort]),
  ),
);

let productId = 1;
const prodRows: unknown[][] = [];
const appRows: unknown[][] = [];
const refRows: unknown[][] = [];
const perCat = new Map<string, { pages: number; products: number; apps: number; refs: number; dataRows: number; productRows: number }>();
for (const p of pages) {
  const st = perCat.get(p.catSlug) ?? { pages: 0, products: 0, apps: 0, refs: 0, dataRows: 0, productRows: 0 };
  st.pages++;
  st.dataRows += p.table.stats.dataRows;
  p.table.products.forEach((pr, i) => {
    const id = productId++;
    st.products++;
    st.productRows += pr.rowCount;
    prodRows.push([id, p.id, catId.get(p.catSlug)!, p.brandKey ? brands.get(p.brandKey)!.id : null, pr.yacNo, normalizeRef(pr.yacNo), pr.yacLeft, pr.carSeries, JSON.stringify(pr.specs), pr.notes, pr.image, i + 1, p.legacyPath]);
    pr.apps.forEach((a, k) => {
      st.apps++;
      appRows.push([id, a.car_brand_text ?? null, a.car_model ?? null, a.engine ?? null, a.transmission ?? null, a.position ?? null, a.year_range ?? null, k + 1]);
    });
    const seen = new Set<string>();
    if (pr.yacLeft) {
      refRows.push([id, 'YAC_LEFT', pr.yacLeft, normalizeRef(pr.yacLeft), 0]);
      st.refs++;
    }
    pr.refs.forEach((r, k) => {
      const key = `${r.type}|${r.no}`;
      if (seen.has(key)) return;
      seen.add(key);
      st.refs++;
      refRows.push([id, r.type, r.no, normalizeRef(r.no), k + 1]);
    });
  });
  perCat.set(p.catSlug, st);
}
sql.push(
  ...insertBatches('products', ['id', 'page_id', 'category_id', 'brand_id', 'yac_no', 'yac_no_normalized', 'yac_no_left', 'car_series', 'specs_json', 'notes', 'primary_image_url', 'sort_order', 'legacy_source_file'], prodRows),
);
sql.push(...insertBatches('product_applications', ['product_id', 'car_brand_text', 'car_model', 'engine', 'transmission', 'position', 'year_range', 'sort_order'], appRows));
sql.push(...insertBatches('product_cross_refs', ['product_id', 'ref_type', 'ref_no', 'ref_no_normalized', 'sort_order'], refRows.filter((r) => r[3] !== '')));
sql.push(
  ...insertBatches(
    'legacy_redirects',
    ['old_path', 'new_path', 'status_code', 'is_broken_404', 'note'],
    [...redirects.entries()].map(([k, v]) => [k, v.to, 301, v.broken, v.note || null]),
  ),
);
// 新聞與網站內容：僅在不存在時寫入，避免覆蓋後台已編輯的內容
NEWS_SEED.forEach((n, i) => {
  const html = `<p><img src="${n.cover}" alt="${n.title}"></p>`;
  sql.push(
    `INSERT OR IGNORE INTO news_posts (slug, title_zh, summary, content_html, cover_image_url, is_published, published_at) VALUES (${[n.slug, n.title, 'YAC 最新上市產品，歡迎來信詢價。', html, n.cover, 1, `2013-0${i + 1}-01 00:00:00`].map(sqlVal).join(', ')});`,
  );
});
SITE_PAGES.forEach((s) => {
  sql.push(`INSERT OR IGNORE INTO site_pages (page_key, title, content_json) VALUES (${[s.key, s.title, JSON.stringify(s.content)].map(sqlVal).join(', ')});`);
});

fs.mkdirSync(path.join(ROOT, 'migrations/seed'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'migrations/seed/seed.sql'), sql.join('\n') + '\n', 'utf8');

// ---------- 報告 ----------
const tot = { pages: 0, products: 0, apps: 0, refs: 0 };
const lines: string[] = ['# 舊站資料匯入核對報告', '', '> 由 `npm run db:import:legacy`（`scripts/migrate-legacy-html.ts`）自動產生。', ''];
lines.push(`- 舊站 \`.html\` 檔案總數：**${allHtml.length}**`);
lines.push(`- 301 轉址對照筆數：**${redirects.size}**（${redirects.size === allHtml.length ? '✅ 與 .html 檔案數一致' : '⚠️ 與 .html 檔案數不一致'}）`);
lines.push(`- 匯入品牌數：**${brands.size}**，型錄頁：**${pages.length}**`, '');
lines.push('## 各產品線筆數核對', '', '| 產品線 | 型錄頁 | 產品 | 適用車款列 | 對照料號 | 舊表資料列 | 解析後列數 | 核對 |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | :---: |');
for (const c of CATS) {
  const s = perCat.get(c.slug) ?? { pages: 0, products: 0, apps: 0, refs: 0, dataRows: 0, productRows: 0 };
  tot.pages += s.pages;
  tot.products += s.products;
  tot.apps += s.apps;
  tot.refs += s.refs;
  lines.push(`| ${c.nameZh} (${c.slug}) | ${s.pages} | ${s.products} | ${s.apps} | ${s.refs} | ${s.dataRows} | ${s.productRows} | ${s.dataRows === s.productRows ? '✅' : '⚠️'} |`);
}
lines.push(`| **合計** | **${tot.pages}** | **${tot.products}** | **${tot.apps}** | **${tot.refs}** | | | |`, '');
lines.push('「舊表資料列」為舊站表格中被判定為資料的列數（排除標題列、車系分隔列、圖片列、空列）；「解析後列數」為所有產品與其適用車款所涵蓋的列數，兩者應相等。', '');
lines.push(`## 舊站為 404 / 無資料表的頁面（${emptyPages.length}）`, '', ...emptyPages.map((e) => `- ${e}`), '');
lines.push(`## 找不到的圖片（${[...missingImages.values()].reduce((n, s) => n + s.size, 0)}）`, '', ...[...missingImages.entries()].map(([f, s]) => `- \`${f}\`：${[...s].join('、')}`), '');
lines.push(`## 圖片路徑大小寫已修正（${caseFixedImages.size}）`, '', '舊 HTML 引用的檔名大小寫與實際檔案不同（Windows 不分大小寫，Cloudflare 區分），匯入時已改為實際檔名。前 15 筆範例：', '', ...[...caseFixedImages].slice(0, 15).map((e) => `- ${e}`), '');
lines.push(`## 解析警告（${warnings.length}）`, '', ...warnings.map((w) => `- ${w}`), '');
const reportPath = path.join(ROOT, 'docs/MIGRATION_REPORT.md');
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');

console.log(`html=${allHtml.length} redirects=${redirects.size} brands=${brands.size} pages=${pages.length} products=${tot.products} apps=${tot.apps} refs=${tot.refs}`);
console.log(`seed.sql: ${(fs.statSync(path.join(ROOT, 'migrations/seed/seed.sql')).size / 1024).toFixed(0)} KB, warnings=${warnings.length}, missingImages=${missingImages.size}`);
