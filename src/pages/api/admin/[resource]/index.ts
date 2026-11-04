import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db';
import { RESOURCES, parseValues } from '../../../../lib/admin-resources';
import { clientIp, createRow, listRows } from '../../../../lib/admin-crud';

export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals }) => {
  const def = RESOURCES[params.resource ?? ''];
  if (!def) return Response.json({ error: '找不到資源' }, { status: 404 });
  return Response.json(await listRows(getDb(locals), def, { q: url.searchParams.get('q') ?? '', page: Number(url.searchParams.get('page') ?? 1) }));
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const def = RESOURCES[params.resource ?? ''];
  if (!def || !def.canCreate) return Response.json({ error: '找不到資源' }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '資料格式錯誤' }, { status: 400 });
  }
  const parsed = parseValues(def, body, 'create');
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const res = await createRow(getDb(locals), def, parsed.values, locals.admin!.username, clientIp(request));
  return res.ok ? Response.json({ id: res.id }, { status: 201 }) : Response.json({ error: res.error }, { status: res.status });
};
