import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { APP_FIELDS, type AppField, type ColumnDef } from '../../src/lib/columns';
import { expandTable, findDataTables, type Cell, type Grid } from './table';

export interface ParsedRef {
  type: string;
  no: string;
}
export interface ParsedProduct {
  yacNo: string;
  yacLeft: string | null;
  carSeries: string | null;
  specs: Record<string, string>;
  refs: ParsedRef[];
  apps: Partial<Record<AppField, string>>[];
  notes: string | null;
  image: string | null;
  rowCount: number;
}
export interface ParsedTable {
  title: string | null;
  columns: ColumnDef[];
  products: ParsedProduct[];
  stats: { dataRows: number; groupRows: number; headerRows: number; imageRows: number; skipped: number };
  warnings: string[];
}
export interface ParseContext {
  /** 以頁面所在資料夾為基準，將相對圖片路徑解析為站內絕對路徑；檔案不存在則回傳 null */
  resolveAsset: (src: string) => string | null;
}

const REF_TYPES: [RegExp, string][] = [
  [/o\.?e\.?m/i, 'OEM'],
  [/original/i, 'ORIGINAL'],
  [/spicer/i, 'SPICER'],
  [/gmb/i, 'GMB'],
  [/koyo/i, 'KOYO'],
  [/matsuba/i, 'MATSUBA'],
  [/lobro/i, 'LOBRO'],
  [/miper/i, 'MIPER'],
  [/glaenzer/i, 'GLAENZER'],
  [/\bb-?w\b/i, 'B-W'],
  [/gwb/i, 'GWB'],
  [/qhl/i, 'QHL'],
  [/part\s*no/i, 'PART'],
];

function slugKey(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'col';
}

function headerLines(grid: Grid, headerRows: number[], col: number): string[] {
  const out: string[] = [];
  for (const r of headerRows) {
    for (const l of grid[r]?.[col]?.lines ?? []) if (!out.includes(l)) out.push(l);
  }
  return out;
}

export function buildColumns(lines: string[][], hasYac: boolean): ColumnDef[] {
  const used = new Set<string>();
  const usedApp = new Set<AppField>();
  let yacSeen = false;
  let yacLeftSeen = false;
  let firstRefIdx = -1;
  const cols: ColumnDef[] = lines.map((ls, i) => {
    const label = ls.join(' ').trim() || `欄位${i + 1}`;
    const low = label.toLowerCase();
    let source: string;
    let outLabel = label;
    if (/yac/i.test(low) && !/photo|picture/.test(low)) {
      if (/\b(left|lh)\b/.test(low) && !yacLeftSeen) {
        source = 'yac_left';
        yacLeftSeen = true;
        outLabel = 'YAC No. (LEFT)';
      } else if (!yacSeen) {
        source = 'yac';
        yacSeen = true;
        outLabel = /\bright\b/.test(low) ? 'YAC No. (RIGHT)' : 'YAC No.';
      } else source = `spec.${slugKey(label)}`;
    } else if (/photo|picture|image|圖/.test(low)) source = 'photo';
    else if (/remark|note|備註/.test(low)) source = 'remark';
    else {
      const ref = REF_TYPES.find(([re]) => re.test(low));
      if (ref) {
        source = `ref.${ref[1]}`;
        if (firstRefIdx < 0) firstRefIdx = i;
      } else if (/engine/.test(low) && !usedApp.has('engine')) {
        source = 'app.engine';
        usedApp.add('engine');
      } else if (/(at\s*[/&]?\s*mt|trans)/.test(low) && !usedApp.has('transmission')) {
        source = 'app.transmission';
        usedApp.add('transmission');
      } else if (/year/.test(low) && !usedApp.has('year_range')) {
        source = 'app.year_range';
        usedApp.add('year_range');
      } else if (/^f\s*\/\s*r$/.test(low) && !usedApp.has('position')) {
        source = 'app.position';
        usedApp.add('position');
      } else if (/car\s*name/.test(low) && !usedApp.has('car_brand_text')) {
        source = 'app.car_brand_text';
        usedApp.add('car_brand_text');
      } else if (/\b(car|model|application|vehicle)\b/.test(low) && !usedApp.has('car_model')) {
        source = 'app.car_model';
        usedApp.add('car_model');
      } else source = `spec.${slugKey(label)}`;
    }
    let key = source.startsWith('spec.') ? source.slice(5) : source.replace('.', '_');
    // 規格欄位以「第一行」短代號（A、B、ABS…）作為 key，較易閱讀
    let short: string | undefined;
    if (source.startsWith('spec.') && ls[0] && ls[0].length <= 3 && ls.length > 1) {
      short = ls[0];
      key = slugKey(ls[0]);
    } else if (source.startsWith('spec.') && label.length <= 3) short = label;
    while (used.has(key)) key += '_2';
    used.add(key);
    if (source.startsWith('spec.')) source = `spec.${key}`;
    return { key, label: outLabel, ...(short ? { short } : {}), source };
  });
  if (!hasYac && !yacSeen && firstRefIdx >= 0) {
    const c = cols[firstRefIdx];
    c.source = 'yac';
    c.label = c.label.replace(/\s*no\.?$/i, '').trim() ? c.label : 'No.';
  }
  return cols;
}

function isFullWidthSame(row: Cell[]): boolean {
  return row.length > 1 && row.every((c) => c.text === row[0].text && c.html === row[0].html);
}

function splitList(text: string, lines: string[]): string[] {
  const parts = (lines.length > 1 ? lines : [text]).flatMap((l) => l.split('/')).map((s) => s.trim());
  return parts.filter(Boolean);
}

function splitYac(cell: Cell): string[] {
  const lines = cell.lines.length ? cell.lines : [cell.text];
  const out: string[] = [];
  for (const l of lines) {
    const parts = l.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => p.includes('-'))) out.push(...parts);
    else out.push(l.trim());
  }
  return out.filter(Boolean);
}

const IMG_SKIP = /transparent|spacer|blank|bg_|\/line|dot\./i;
const IMG_EXT = /\.(jpe?g|png|gif|webp)$/i;

function pickImage(cell: Cell | undefined, ctx: ParseContext): string | null {
  if (!cell) return null;
  const cand = [...cell.img.filter((s) => !IMG_SKIP.test(s)), ...cell.href.filter((h) => IMG_EXT.test(h))];
  for (const c of cand) {
    const r = ctx.resolveAsset(c);
    if (r) return r;
  }
  return null;
}

export function parseTable(grid: Grid, ctx: ParseContext): ParsedTable {
  const warnings: string[] = [];
  const stats = { dataRows: 0, groupRows: 0, headerRows: 0, imageRows: 0, skipped: 0 };
  let i = 0;
  let title: string | null = null;
  const r0 = grid[0];
  const filled = r0 ? r0.filter((c) => c.text) : [];
  if (r0 && r0.length > 1 && filled.length > 0 && filled.every((c) => c.text === filled[0].text) && filled.filter((c) => c.origin === 'own').length === 1) {
    title = filled[0].text;
    i = 1;
  }
  const headerRows: number[] = [];
  const thRatio = (r: Cell[]) => r.filter((c) => c.isHeader).length / Math.max(1, r.length);
  while (i < grid.length && thRatio(grid[i]) >= 0.5) headerRows.push(i++);
  if (!headerRows.length && i < grid.length) headerRows.push(i++);
  stats.headerRows = headerRows.length;
  const width = grid[headerRows[0] ?? 0]?.length ?? 0;
  const hdrLines = Array.from({ length: width }, (_, c) => headerLines(grid, headerRows, c));
  const noYacInHeader = !hdrLines.some((l) => /yac/i.test(l.join(' ')));
  const columns = buildColumns(hdrLines, !noYacInHeader);
  const colIdx = (pred: (c: ColumnDef) => boolean) => columns.map((c, k) => (pred(c) ? k : -1)).filter((k) => k >= 0);
  const yacCol = colIdx((c) => c.source === 'yac')[0] ?? -1;
  const yacLeftCol = colIdx((c) => c.source === 'yac_left')[0] ?? -1;
  const photoCol = colIdx((c) => c.source === 'photo')[0] ?? -1;
  if (yacCol < 0) warnings.push('找不到 YAC 料號欄位');

  const products: ParsedProduct[] = [];
  let cur: ParsedProduct | null = null;
  let carSeries: string | null = null;
  let pendingImage: string | null = null;

  const addRowData = (p: ParsedProduct, row: Cell[], first: boolean) => {
    const app: Partial<Record<AppField, string>> = {};
    columns.forEach((col, k) => {
      const cell = row[k];
      if (!cell) return;
      const [kind, name] = [col.source.split('.')[0], col.source.split('.').slice(1).join('.')];
      if (kind === 'app') {
        if (cell.text) app[name as AppField] = cell.text;
      } else if (kind === 'ref' || col.source === 'yac_left') {
        if (cell.origin === 'copy' && !first) return;
        if (col.source === 'yac_left') return;
        for (const no of splitList(cell.text, cell.lines)) {
          if (!p.refs.some((r) => r.type === name && r.no === no)) p.refs.push({ type: name, no });
        }
      } else if (kind === 'spec') {
        if (cell.origin === 'copy' && !first) return;
        if (!cell.text) return;
        const prev = p.specs[name];
        if (!prev) p.specs[name] = cell.text;
        else if (!prev.split(' / ').includes(cell.text)) p.specs[name] = `${prev} / ${cell.text}`;
      } else if (kind === 'remark') {
        if (cell.origin === 'copy' && !first) return;
        if (cell.text && !(p.notes ?? '').includes(cell.text)) p.notes = p.notes ? `${p.notes} / ${cell.text}` : cell.text;
      }
    });
    if (APP_FIELDS.some((f) => app[f])) p.apps.push(app);
    p.rowCount++;
  };

  for (; i < grid.length; i++) {
    const row = grid[i];
    if (row.every((c) => !c.text && !c.img.length)) {
      stats.skipped++;
      continue;
    }
    if (thRatio(row) >= 0.5 && row.some((c) => /yac/i.test(c.text))) {
      stats.skipped++;
      continue;
    }
    if (isFullWidthSame(row)) {
      if (row[0].text) {
        carSeries = row[0].text;
        stats.groupRows++;
      } else if (row[0].img.length) {
        pendingImage = pickImage(row[0], ctx) ?? pendingImage;
        stats.imageRows++;
      } else stats.skipped++;
      continue;
    }
    if (!row.some((c) => c.text) && row[0].img.length && row.slice(1).every((c) => !c.text)) {
      pendingImage = pickImage(row[0], ctx) ?? pendingImage;
      stats.imageRows++;
      continue;
    }
    stats.dataRows++;
    const yacCell = yacCol >= 0 ? row[yacCol] : undefined;
    let yacLines = yacCell && yacCell.origin === 'own' ? splitYac(yacCell) : [];
    let leftOnly = false;
    if (!yacLines.length) {
      const leftCell = yacLeftCol >= 0 ? row[yacLeftCol] : undefined;
      if (leftCell && leftCell.origin === 'own' && leftCell.text && leftCell.text !== cur?.yacLeft && yacCell && yacCell.origin === 'own') {
        yacLines = splitYac(leftCell);
        leftOnly = true;
      } else if (noYacInHeader) {
        const alt = columns.findIndex((c, k) => k !== yacCol && c.source.startsWith('ref.') && row[k]?.origin === 'own' && row[k].text);
        if (alt >= 0) yacLines = splitYac(row[alt]);
      }
    }
    const sameAsPrev = cur && yacLines[0] && yacLines[0].toUpperCase() === cur.yacNo.toUpperCase();
    if (yacLines.length && !sameAsPrev) {
      cur = {
        yacNo: yacLines[0],
        yacLeft: !leftOnly && yacLeftCol >= 0 && row[yacLeftCol]?.text ? row[yacLeftCol].text : null,
        carSeries,
        specs: {},
        refs: yacLines.slice(1).map((no) => ({ type: 'YAC', no })),
        apps: [],
        notes: null,
        image: pickImage(yacCell, ctx) ?? pickImage(photoCol >= 0 ? row[photoCol] : undefined, ctx) ?? pendingImage,
        rowCount: 0,
      };
      pendingImage = null;
      products.push(cur);
      addRowData(cur, row, true);
    } else if (cur) {
      if (!cur.image) cur.image = pickImage(photoCol >= 0 ? row[photoCol] : undefined, ctx);
      addRowData(cur, row, false);
    } else {
      warnings.push(`第 ${i} 列沒有料號且無前一筆產品，已略過`);
      stats.dataRows--;
      stats.skipped++;
    }
  }
  return { title, columns, products, stats, warnings };
}

export function parseHtml(html: string, ctx: ParseContext): ParsedTable[] {
  const $ = cheerio.load(html);
  $('script,style').remove();
  return findDataTables($).map((t) => parseTable(expandTable($, t as Element), ctx));
}
