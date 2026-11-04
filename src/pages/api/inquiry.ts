import type { APIRoute } from 'astro';
import { first, getDb, getEnv } from '../../lib/db';
import { clientIp } from '../../lib/admin-crud';
import { parseInquiry, sendInquiryMail } from '../../lib/inquiry';

export const prerender = false;

const HOURLY_LIMIT = 5;

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: '資料格式錯誤' }, { status: 400 });
  }
  // 蜜罐欄位：真人看不到也不會填，機器人填了就假裝成功
  if (body && typeof body === 'object' && String((body as Record<string, unknown>).website ?? '').trim()) {
    return Response.json({ ok: true, emailed: false });
  }
  const parsed = parseInquiry(body);
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  const db = getDb(locals);
  const ip = clientIp(request);
  if (ip) {
    const recent = await first<{ n: number }>(
      db,
      "SELECT COUNT(*) AS n FROM inquiries WHERE ip_address = ? AND created_at > datetime('now', '-1 hour')",
      ip,
    );
    if ((recent?.n ?? 0) >= HOURLY_LIMIT) return Response.json({ error: '送出次數過多，請稍後再試或直接來電' }, { status: 429 });
  }

  const ins = await db
    .prepare('INSERT INTO inquiries (name, company, email, tel, note, items_json, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(input.name, input.company, input.email, input.tel, input.note, JSON.stringify(input.items), ip)
    .run();
  const id = ins.meta.last_row_id;

  const mail = await sendInquiryMail(getEnv(locals), input);
  try {
    await db
      .prepare('UPDATE inquiries SET email_status = ?, email_error = ? WHERE id = ?')
      .bind(mail.status, mail.status === 'failed' ? mail.error : null, id)
      .run();
  } catch (e) {
    console.error('inquiry status update failed', e);
  }
  // 已存入資料庫即視為成功；寄信失敗時後台仍看得到這筆詢價
  return Response.json({ ok: true, emailed: mail.status === 'sent' });
};
