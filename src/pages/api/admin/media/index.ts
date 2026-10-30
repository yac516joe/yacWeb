import type { APIRoute } from 'astro';
import { all, audit, getDb, getEnv } from '../../../../lib/db';
import { clientIp } from '../../../../lib/admin-crud';

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
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
  return Response.json({ items: rows, enabled: !!getEnv(locals).MEDIA_BUCKET });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = getEnv(locals);
  if (!env.MEDIA_BUCKET) return Response.json({ error: '尚未綁定 R2 Bucket（MEDIA_BUCKET），無法上傳圖片' }, { status: 501 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: '請選擇圖片檔' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: '圖片不可超過 5 MB' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime || !TYPES[mime]) return Response.json({ error: '僅支援 JPG、PNG、WebP、GIF 圖片' }, { status: 415 });

  const now = new Date();
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID().slice(0, 8)}-${base}.${TYPES[mime]}`;
  await env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
  const publicUrl = env.PUBLIC_MEDIA_BASE_URL ? `${env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, '')}/${key}` : `/media/${key}`;
  const db = getDb(locals);
  const res = await db
    .prepare('INSERT INTO media_assets (storage_key, public_url, file_name, mime_type, file_size, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(key, publicUrl, file.name.slice(0, 200), mime, bytes.length, locals.admin!.username)
    .run();
  await audit(db, locals.admin!.username, 'CREATE', 'media_assets', res.meta.last_row_id as number, { key, size: bytes.length }, clientIp(request));
  return Response.json({ id: res.meta.last_row_id, url: publicUrl }, { status: 201 });
};
