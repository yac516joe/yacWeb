import type { APIRoute } from 'astro';
import { getDb, first } from '../../lib/db';
import { getPageProducts, parseColumns } from '../../lib/queries';
import { headerZh } from '../../lib/columns';
import { productsToCsv } from '../../lib/table';

export const GET: APIRoute = async ({ url, locals }) => {
  const id = Number(url.searchParams.get('page'));
  if (!Number.isInteger(id) || id <= 0) return new Response('Bad request', { status: 400 });
  const db = getDb(locals);
  const page = await first<{ id: number; slug: string; title: string; columns_json: string }>(
    db,
    'SELECT id, slug, title, columns_json FROM catalog_pages WHERE id = ? AND is_published = 1',
    id,
  );
  if (!page) return new Response('Not found', { status: 404 });
  const columns = parseColumns(page.columns_json);
  const products = await getPageProducts(db, page.id);
  const csv = productsToCsv(products, columns, columns.map(headerZh));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yac-${page.slug.replace(/[^a-z0-9_-]/gi, '_')}.csv"`,
    },
  });
};
