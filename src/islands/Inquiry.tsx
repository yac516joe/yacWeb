import { useEffect, useState } from 'preact/hooks';

interface Item { id: number; yac: string; series?: string; url?: string }
declare global {
  interface Window {
    yacInquiry: { read(): Item[]; remove(id: number): void; clear(): void };
  }
}

const TO = 'yac106@yac.com.tw';

export default function Inquiry() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ name: '', company: '', email: '', tel: '', note: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => setItems(window.yacInquiry.read()), []);
  const set = (k: keyof typeof form) => (e: Event) => setForm({ ...form, [k]: (e.target as HTMLInputElement).value });
  const remove = (id: number) => {
    window.yacInquiry.remove(id);
    setItems(window.yacInquiry.read());
  };

  const body = () =>
    [
      `姓名：${form.name}`,
      `公司：${form.company}`,
      `Email：${form.email}`,
      `電話：${form.tel}`,
      '',
      '詢價料號：',
      ...items.map((i) => `- ${i.yac}${i.series ? `（${i.series}）` : ''}`),
      '',
      form.note ? `備註：${form.note}` : '',
    ].join('\n');

  const mailto = () => `mailto:${TO}?subject=${encodeURIComponent('YAC 產品詢價')}&body=${encodeURIComponent(body())}`;

  const send = async (e: Event) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items: items.map((i) => ({ yac: i.yac, series: i.series })) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState('error');
        setMsg(data.error ?? '送出失敗，請稍後再試。');
        return;
      }
      window.yacInquiry.clear();
      setItems([]);
      setState('done');
    } catch {
      setState('error');
      setMsg('網路連線失敗，您也可以改用 Email 軟體寄送。');
    }
  };

  if (state === 'done') {
    return (
      <section class="panel">
        <h2>詢價已送出</h2>
        <p class="empty">感謝您的詢價，我們會盡快以 Email 或電話與您聯絡（{TO}）。</p>
        <p style="padding:0 20px 20px"><a class="btn" href="/catalog">繼續瀏覽產品型錄</a></p>
      </section>
    );
  }

  return (
    <div class="inq">
      <section class="panel">
        <h2>詢價清單（{items.length}）</h2>
        {items.length === 0 && (
          <p class="empty">
            清單是空的。請至 <a href="/catalog" style="color:var(--yac)">產品型錄</a> 點選料號後按「加入詢價單」。
          </p>
        )}
        {items.map((i) => (
          <div class="inq-row" key={i.id}>
            <span class="pn">
              {i.yac}
              {i.series && <small>{i.series}</small>}
            </span>
            <button type="button" onClick={() => remove(i.id)} aria-label={`移除 ${i.yac}`}>移除</button>
          </div>
        ))}
      </section>
      <form class="panel" onSubmit={send}>
        <h2>聯絡資料</h2>
        <div class="field"><label for="n">姓名</label><input id="n" required value={form.name} onInput={set('name')} /></div>
        <div class="field"><label for="c">公司</label><input id="c" value={form.company} onInput={set('company')} /></div>
        <div class="field"><label for="e">Email</label><input id="e" type="email" required value={form.email} onInput={set('email')} /></div>
        <div class="field"><label for="t">電話</label><input id="t" value={form.tel} onInput={set('tel')} /></div>
        <div class="field"><label for="m">備註</label><textarea id="m" value={form.note} onInput={set('note')} /></div>
        <div style="position:absolute;left:-9999px" aria-hidden="true">
          <label for="w">網站</label><input id="w" tabIndex={-1} autoComplete="off" value={form.website} onInput={set('website')} />
        </div>
        {state === 'error' && (
          <p style="color:#a52a22;font-size:13px;margin-bottom:10px">
            {msg} <a href={mailto()} style="color:var(--yac)">改用 Email 軟體寄送</a>
          </p>
        )}
        <button class="btn" type="submit" disabled={items.length === 0 || state === 'sending'} style="width:100%;justify-content:space-between">
          {state === 'sending' ? '送出中…' : '送出詢價'} <span class="arr">→</span>
        </button>
        <p class="mono" style="font-size:11px;color:var(--mute);margin-top:10px">詢價內容將送至 {TO}</p>
      </form>
    </div>
  );
}
