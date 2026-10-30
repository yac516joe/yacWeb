export function getEnv(locals: App.Locals): Env {
  return locals.runtime.env;
}

export function getDb(locals: App.Locals): D1Database {
  return locals.runtime.env.DB;
}

export async function all<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const res = await db.prepare(sql).bind(...params).all<T>();
  return res.results ?? [];
}

export async function first<T = Record<string, unknown>>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return (await db.prepare(sql).bind(...params).first<T>()) ?? null;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]) {
  return db.prepare(sql).bind(...params).run();
}

/** D1 一次最多綁定 100 個參數，批次 IN 查詢時需分段。 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function audit(
  db: D1Database,
  actor: string,
  action: string,
  table: string,
  targetId: string | number | null,
  diff: unknown,
  ip: string | null,
) {
  await db
    .prepare('INSERT INTO admin_audit_logs (actor, action, target_table, target_id, diff_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(actor, action, table, targetId == null ? null : String(targetId), diff == null ? null : JSON.stringify(diff).slice(0, 8000), ip)
    .run();
}
