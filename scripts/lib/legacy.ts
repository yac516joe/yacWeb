import path from 'node:path';

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 不同產品線對同一車廠的寫法不一致，統一成同一個 brand
const BRAND_ALIASES: Record<string, [string, string]> = {
  'volks-wagen': ['volkswagen', 'VOLKSWAGEN'],
  gm: ['general-motors', 'G.M.'],
  'g-m': ['general-motors', 'G.M.'],
  'general-motor': ['general-motors', 'G.M.'],
  'general-motors': ['general-motors', 'G.M.'],
  generalmotor: ['general-motors', 'G.M.'],
  mecury: ['mercury', 'MERCURY'],
  daiwoo: ['daewoo', 'DAEWOO'],
  benz: ['mercedes-benz', 'MERCEDES-BENZ'],
  greatwall: ['great-wall', 'GREAT WALL'],
  rongguang: ['rong-guang', 'RONG GUANG'],
  hongguang: ['hong-guang', 'HONG GUANG'],
  volkswagen: ['volkswagen', 'VOLKSWAGEN'],
};

export function brandOf(rawName: string): { slug: string; name: string } {
  const name = rawName.replace(/^\(/, '').replace(/\s+/g, ' ').trim();
  const slug = slugify(name);
  const alias = BRAND_ALIASES[slug];
  if (alias) return { slug: alias[0], name: alias[1] };
  return { slug, name: name.toUpperCase() };
}

/** 舊站檔名 → 型錄頁 slug（steering rack 的 “(” 前綴代表右駕） */
export function pageSlugOf(fileName: string): { slug: string; hand: 'LHD' | 'RHD' | null } {
  const base = path.basename(fileName).replace(/\.html?$/i, '');
  const rhd = base.startsWith('(');
  return { slug: slugify(base.replace(/^\(/, '')) + (rhd ? '-rhd' : ''), hand: rhd ? 'RHD' : null };
}

export function legacyKey(relPath: string): string {
  return '/' + relPath.replace(/\\/g, '/').toLowerCase();
}

export function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** D1 單一語句上限約 100KB，依長度切批 */
export function insertBatches(table: string, cols: string[], rows: unknown[][], maxChars = 60000): string[] {
  const out: string[] = [];
  const head = `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n`;
  let buf: string[] = [];
  let len = head.length;
  const flush = () => {
    if (buf.length) out.push(head + buf.join(',\n') + ';');
    buf = [];
    len = head.length;
  };
  for (const r of rows) {
    const t = '(' + r.map(sqlVal).join(', ') + ')';
    if (len + t.length + 2 > maxChars || buf.length >= 200) flush();
    buf.push(t);
    len += t.length + 2;
  }
  flush();
  return out;
}
