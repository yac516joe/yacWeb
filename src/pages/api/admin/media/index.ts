import type { APIRoute } from 'astro';
import { all, audit, getDb, getEnv } from '../../../../lib/db';
import { clientIp } from '../../../../lib/admin-crud';

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_BYTES_D1 = 1024 * 1024;

function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export const GET: APIRoute = async ({ locals }) => {
  const rows = await all(getDb(locals), 'SELECT id, public_url, file_name, mime_type, file_size, created_at FROM media_assets ORDER BY id DESC LIMIT 200');
  return Response.json({ items: rows, enabled: true, backend: getEnv(locals).MEDIA_BUCKET ? 'r2' : 'd1' });
};

export const POST: APIRoute = async (ctx) => {
  try {
    return await upload(ctx);
  } catch (e) {
    console.error('media upload error', e);
    return Response.json({ error: `上傳失敗：${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
};

const upload: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  const limit = env.MEDIA_BUCKET ? MAX_BYTES : MAX_BYTES_D1;
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: '請選擇圖片檔' }, { status: 400 });
  if (file.size > limit) return Response.json({ error: `圖片不可超過 ${limit / 1024 / 1024} MB` }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !TYPES[mime]) return Response.json({ error: '僅支援 JPG、PNG、WebP、GIF 圖片' }, { status: 415 });

  const now = new Date();
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID().slice(0, 8)}-${base}.${TYPES[mime]}`;
  const db = getDb(locals);
  try {
    if (env.MEDIA_BUCKET) await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
    else await db.prepare('INSERT INTO media_blobs (storage_key, mime_type, data_b64) VALUES (?, ?, ?)').bind(key, mime, toBase64(bytes)).run();
  } catch (e) {
    console.error('media upload failed', e);
    return Response.json({ error: `圖片儲存失敗：${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
  const publicUrl = env.MEDIA_BUCKET && env.PUBLIC_MEDIA_BASE_URL ? `${env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '')}/${key}` : `/media/${key}`;
  const res = await db
    .prepare('INSERT INTO media_assets (storage_key, public_url, file_name, mime_type, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(key, publicUrl, file.name.slice(0, 200), mime, bytes.length, locals.admin!.username)
    .run();
  await audit(db, locals.admin!.username, 'CREATE', 'media_assets', res.meta.last_row_id as number, { key, size: bytes.length }, clientIp(request));
  return Response.json({ id: res.meta.last_row_id, url: publicUrl }, { status: 201 });
};
