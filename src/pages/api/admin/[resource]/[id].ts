import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db';
import { RESOURCES, parseValues } from '../../../../lib/admin-resources';
import { clientIp, deleteRow, getRow, updateRow } from '../../../../lib/admin-crud';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const def = RESOURCES[params.resource ?? ''];
  if (!def) return Response.json({ error: '找不到資源' }, { status: 404 });
  const row = await getRow(getDb(locals), def, params.id ?? '');
  return row ? Response.json(row) : Response.json({ error: '資料不存在' }, { status: 404 });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const def = RESOURCES[params.resource ?? ''];
  if (!def) return Response.json({ error: '找不到資源' }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '資料格式錯誤' }, { status: 400 });
  }
  const parsed = parseValues(def, body, 'update');
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const res = await updateRow(getDb(locals), def, params.id ?? '', parsed.values, locals.admin!.username, clientIp(request));
  return res.ok ? Response.json({ id: res.id }) : Response.json({ error: res.error }, { status: res.status });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const def = RESOURCES[params.resource ?? ''];
  if (!def || !def.canDelete) return Response.json({ error: '不可刪除' }, { status: 404 });
  const res = await deleteRow(getDb(locals), def, params.id ?? '', locals.admin!.username, clientIp(request));
  return res.ok ? Response.json({ id: res.id }) : Response.json({ error: res.error }, { status: res.status });
};
