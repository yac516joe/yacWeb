import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db';
import { clientIp } from '../../../../lib/admin-crud';
import { createProduct, parseProductInput } from '../../../../lib/admin-products';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '資料格式錯誤' }, { status: 400 });
  }
  const parsed = parseProductInput(body);
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const res = await createProduct(getDb(locals), parsed.value, locals.admin!.username, clientIp(request));
  return res.ok ? Response.json({ id: res.id }, { status: 201 }) : Response.json({ error: res.error }, { status: res.status });
};
