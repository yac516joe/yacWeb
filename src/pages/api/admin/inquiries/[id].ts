import type { APIRoute } from 'astro';
import { audit, first, getDb } from '../../../../lib/db';
import { clientIp } from '../../../../lib/admin-crud';

export const prerender = false;

async function load(db: D1Database, idParam: string | undefined) {
  const id = Number(idParam);
  const row = Number.isInteger(id) ? await first<Record<string, unknown>>(db, 'SELECT * FROM inquiries WHERE id = ?', id) : null;
  return { id, row };
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const db = getDb(locals);
  const { id, row } = await load(db, params.id);
  if (!row) return Response.json({ error: '詢價不存在' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { handled?: unknown };
  const handled = body.handled ? 1 : 0;
  await db.prepare('UPDATE inquiries SET is_handled = ? WHERE id = ?').bind(handled, id).run();
  await audit(db, locals.admin!.username, 'UPDATE', 'inquiries', id, { is_handled: handled }, clientIp(request));
  return Response.json({ id, handled });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const db = getDb(locals);
  const { id, row } = await load(db, params.id);
  if (!row) return Response.json({ error: '詢價不存在' }, { status: 404 });
  await db.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();
  await audit(db, locals.admin!.username, 'DELETE', 'inquiries', id, { name: row.name, email: row.email }, clientIp(request));
  return Response.json({ id });
};
