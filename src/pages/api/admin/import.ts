import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';
import { clientIp } from '../../../lib/admin-crud';
import { csvToProducts, exportRows, importProducts, parseCsv } from '../../../lib/admin-products';
import { headerZh } from '../../../lib/columns';
import { productsToCsv } from '../../../lib/table';

export const prerender = false;

/** 匯出整頁（含未公開產品）CSV。 */
export const GET: APIRoute = async ({ url, locals }) => {
  const pageId = Number(url.searchParams.get('page'));
  const data = Number.isInteger(pageId) ? await exportRows(getDb(locals), pageId) : null;
  if (!data) return Response.json({ error: '型錄頁不存在' }, { status: 404 });
  const csv = productsToCsv(data.products, data.columns, data.columns.map(headerZh));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yac-page-${pageId}.csv"`,
    },
  });
};

/** 匯入 CSV（dryRun=1 僅預覽筆數）。 */
export const POST: APIRoute = async ({ request, locals }) => {
  let body: { page_id?: number; csv?: string; dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '資料格式錯誤' }, { status: 400 });
  }
  const pageId = Number(body.page_id);
  if (!Number.isInteger(pageId) || pageId <= 0 || typeof body.csv !== 'string' || !body.csv.trim()) return Response.json({ error: '請選擇型錄頁並提供 CSV 內容' }, { status: 400 });
  if (body.csv.length > 2_000_000) return Response.json({ error: 'CSV 檔案過大' }, { status: 413 });
  const db = getDb(locals);
  const data = await exportRows(db, pageId);
  if (!data) return Response.json({ error: '型錄頁不存在' }, { status: 404 });

  const parsed = csvToProducts(parseCsv(body.csv), data.columns, pageId);
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });
  if (body.dryRun) {
    const existing = new Set(data.products.map((p) => p.yac_no));
    const updated = parsed.products.filter((p) => existing.has(p.yac_no)).length;
    return Response.json({ dryRun: true, total: parsed.products.length, created: parsed.products.length - updated, updated });
  }
  const res = await importProducts(db, pageId, parsed.products, locals.admin!.username, clientIp(request));
  return 'error' in res ? Response.json(res, { status: 400 }) : Response.json(res);
};
