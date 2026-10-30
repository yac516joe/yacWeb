import type { APIRoute } from 'astro';
import { getEnv } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const key = params.key ?? '';
  const bucket = getEnv(locals).MEDIA_BUCKET;
  if (!bucket || !key.startsWith('uploads/') || key.includes('..')) return new Response('Not found', { status: 404 });
  const obj = await bucket.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      ETag: obj.httpEtag,
    },
  });
};
