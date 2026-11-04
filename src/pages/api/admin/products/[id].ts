import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db';
import { clientIp } from '../../../../lib/admin-crud';
import { deleteProduct, parseProductInput, updateProduct } from '../../../../lib/admin-products';
import { getProductDetail } from '../../../../lib/queries';

export const prerender = false;

function idOf(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const id = idOf(params.id);
  const p = id ? await getProductDetail(getDb(locals), id) : null;
  return p ? Response.json(p) : Response.json({ error: '產品不存在' }, { status: 404 });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const id = idOf(params.id);
  if (!id) return Response.json({ error: '編號錯誤' }, { status: 400 });
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '資料格式錯誤' }, { status: 400 });
  }
  const parsed = parseProductInput(body);
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const res = await updateProduct(getDb(locals), id, parsed.value, locals.admin!.username, clientIp(request));
  return res.ok ? Response.json({ id }) : Response.json({ error: res.error }, { status: res.status });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const id = idOf(params.id);
  if (!id) return Response.json({ error: '編號錯誤' }, { status: 400 });
  const res = await deleteProduct(getDb(locals), id, locals.admin!.username, clientIp(request));
  return res.ok ? Response.json({ id }) : Response.json({ error: res.error }, { status: res.status });
};
