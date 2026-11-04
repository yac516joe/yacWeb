import { all, first, audit } from './db';
import type { ResourceDef, Values } from './admin-resources';

export const PAGE_SIZE = 50;

export interface ListResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pages: number;
}

export async function listRows(db: D1Database, def: ResourceDef, opts: { q?: string; page?: number }): Promise<ListResult> {
  const where: string[] = [];
  const params: unknown[] = [];
  const q = (opts.q ?? '').trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, '')}%`;
    where.push(`(${def.search.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    params.push(...def.search.map(() => like));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${def.from} ${w}`, ...params))?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pages);
  const rows = await all(db, `SELECT ${def.select} FROM ${def.from} ${w} ORDER BY ${def.order} LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, ...params);
  return { rows, total, page, pages };
}

export function getRow(db: D1Database, def: ResourceDef, id: string | number) {
  return first<Record<string, any>>(db, `SELECT * FROM ${def.table} WHERE ${def.pk} = ?`, id);
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint/i.test(msg)) return '代碼已存在，請改用其他代碼';
  if (/FOREIGN KEY/i.test(msg)) return '關聯資料不存在或仍被使用';
  return '資料庫錯誤';
}

export type MutResult = { ok: true; id: string | number } | { ok: false; status: number; error: string };

export async function createRow(db: D1Database, def: ResourceDef, values: Values, actor: string, ip: string | null): Promise<MutResult> {
  const cols = Object.keys(values);
  try {
    const res = await db
      .prepare(`INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .bind(...cols.map((c) => values[c]))
      .run();
    const id = def.pk === 'id' ? (res.meta.last_row_id as number) : (values[def.pk] as string);
    await audit(db, actor, 'CREATE', def.table, id, values, ip);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, status: 409, error: friendlyError(e) };
  }
}

export async function updateRow(db: D1Database, def: ResourceDef, id: string | number, values: Values, actor: string, ip: string | null): Promise<MutResult> {
  const before = await getRow(db, def, id);
  if (!before) return { ok: false, status: 404, error: '資料不存在' };
  const cols = Object.keys(values);
  const sets = cols.map((c) => `${c} = ?`);
  if (def.updatedAt) sets.push("updated_at = datetime('now')");
  try {
    await db
      .prepare(`UPDATE ${def.table} SET ${sets.join(', ')} WHERE ${def.pk} = ?`)
      .bind(...cols.map((c) => values[c]), id)
      .run();
  } catch (e) {
    return { ok: false, status: 409, error: friendlyError(e) };
  }
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const c of cols) if (String(before[c] ?? '') !== String(values[c] ?? '')) diff[c] = { from: String(before[c] ?? '').slice(0, 200), to: String(values[c] ?? '').slice(0, 200) };
  await audit(db, actor, 'UPDATE', def.table, id, diff, ip);
  return { ok: true, id };
}

export async function deleteRow(db: D1Database, def: ResourceDef, id: string | number, actor: string, ip: string | null): Promise<MutResult> {
  const before = await getRow(db, def, id);
  if (!before) return { ok: false, status: 404, error: '資料不存在' };
  try {
    await db.prepare(`DELETE FROM ${def.table} WHERE ${def.pk} = ?`).bind(id).run();
  } catch (e) {
    return { ok: false, status: 409, error: friendlyError(e) };
  }
  await audit(db, actor, 'DELETE', def.table, id, before, ip);
  return { ok: true, id };
}

export function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}
