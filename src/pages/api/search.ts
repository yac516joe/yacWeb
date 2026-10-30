import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';
import { searchProducts } from '../../lib/queries';

export const GET: APIRoute = async ({ url, locals }) => {
  const hits = await searchProducts(getDb(locals), {
    q: (url.searchParams.get('q') ?? '').slice(0, 80),
    model: (url.searchParams.get('model') ?? '').slice(0, 80),
    category: url.searchParams.get('cat') || undefined,
    limit: 50,
  });
  return Response.json({ count: hits.length, results: hits }, { headers: { 'Cache-Control': 'public, max-age=60' } });
};
