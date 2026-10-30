import type { APIRoute } from 'astro';
import { first, getDb, getEnv } from '../../lib/db';

export const prerender = false;

const HEADERS = { 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' };

export const GET: APIRoute = async ({ params, locals }) => {
  const key = params.key ?? '';
  if (!key.startsWith('uploads/') || key.includes('..')) return new Response('Not found', { status: 404 });

  const bucket = getEnv(locals).MEDIA_BUCKET;
  if (bucket) {
    const obj = await bucket.get(key);
    if (obj) {
      return new Response(obj.body, {
        headers: { ...HEADERS, 'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream', ETag: obj.httpEtag },
      });
    }
  }

  const row = await first<{ mime_type: string; data_b64: string }>(getDb(locals), 'SELECT mime_type, data_b64 FROM media_blobs WHERE storage_key = ?', key);
  if (!row) return new Response('Not found', { status: 404 });
  const bytes = Uint8Array.from(atob(row.data_b64), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { ...HEADERS, 'Content-Type': row.mime_type } });
};
