import type { APIRoute } from 'astro';
import { audit, first, getDb, getEnv } from '../../../../lib/db';
import { clientIp } from '../../../../lib/admin-crud';

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const db = getDb(locals);
  const id = Number(params.id);
  const row = Number.isInteger(id) ? await first<{ storage_key: string; file_name: string }>(db, 'SELECT storage_key, file_name FROM media_assets WHERE id = ?', id) : null;
  if (!row) return Response.json({ error: '圖片不存在' }, { status: 404 });
  await getEnv(locals).MEDIA_BUCKET?.delete(row.storage_key);
  await db.prepare('DELETE FROM media_assets WHERE id = ?').bind(id).run();
  await audit(db, locals.admin!.username, 'DELETE', 'media_assets', id, row, clientIp(request));
  return Response.json({ id });
};
