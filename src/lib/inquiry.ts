// 詢價單：驗證與寄信（Resend HTTP API）。未設定 RESEND_API_KEY 時只存入資料庫。

export const DEFAULT_INQUIRY_TO = 'yac106@yac.com.tw';

export interface InquiryItem {
  yac: string;
  series?: string;
}

export interface InquiryInput {
  name: string;
  company: string;
  email: string;
  tel: string;
  note: string;
  items: InquiryItem[];
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const MAX_ITEMS = 100;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function parseInquiry(body: unknown): { value: InquiryInput } | { error: string } {
  if (!body || typeof body !== 'object') return { error: '資料格式錯誤' };
  const b = body as Record<string, unknown>;
  const name = str(b.name, 100);
  const email = str(b.email, 200);
  if (!name) return { error: '請填寫姓名' };
  if (!EMAIL_RE.test(email)) return { error: 'Email 格式不正確' };
  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items: InquiryItem[] = [];
  for (const it of rawItems.slice(0, MAX_ITEMS)) {
    const yac = it && typeof it === 'object' ? str((it as Record<string, unknown>).yac, 60) : '';
    if (!yac) continue;
    const series = str((it as Record<string, unknown>).series, 100);
    items.push(series ? { yac, series } : { yac });
  }
  if (!items.length) return { error: '詢價清單是空的' };
  return {
    value: { name, company: str(b.company, 150), email, tel: str(b.tel, 50), note: str(b.note, 2000), items },
  };
}

export function inquiryText(i: InquiryInput): string {
  return [
    `姓名：${i.name}`,
    `公司：${i.company}`,
    `Email：${i.email}`,
    `電話：${i.tel}`,
    '',
    '詢價料號：',
    ...i.items.map((x) => `- ${x.yac}${x.series ? `（${x.series}）` : ''}`),
    '',
    i.note ? `備註：${i.note}` : '',
  ].join('\n');
}

export type MailResult = { status: 'sent' } | { status: 'skipped' } | { status: 'failed'; error: string };

/** 以 Resend 寄出通知信；Reply-To 設為客戶 Email，方便直接回覆。 */
export async function sendInquiryMail(env: Env, input: InquiryInput): Promise<MailResult> {
  if (!env.RESEND_API_KEY || !env.INQUIRY_FROM_EMAIL) return { status: 'skipped' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.INQUIRY_FROM_EMAIL,
        to: [env.INQUIRY_TO_EMAIL || DEFAULT_INQUIRY_TO],
        reply_to: input.email,
        subject: `[YAC 網站詢價] ${input.name}${input.company ? `（${input.company}）` : ''}`,
        text: inquiryText(input),
      }),
    });
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status} ${(await res.text()).slice(0, 200)}` };
    return { status: 'sent' };
  } catch (e) {
    return { status: 'failed', error: String((e as Error).message ?? e).slice(0, 200) };
  }
}
