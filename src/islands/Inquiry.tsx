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
  const [form, setForm] = useState({ name: '', company: '', email: '', tel: '', note: '' });

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

  const send = (e: Event) => {
    e.preventDefault();
    const href = `mailto:${TO}?subject=${encodeURIComponent('YAC 產品詢價')}&body=${encodeURIComponent(body())}`;
    window.location.href = href;
  };

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
        <button class="btn" type="submit" disabled={items.length === 0} style="width:100%;justify-content:space-between">
          以 Email 送出詢價 <span class="arr">→</span>
        </button>
        <p class="mono" style="font-size:11px;color:var(--mute);margin-top:10px">將開啟您的郵件軟體，寄至 {TO}</p>
      </form>
    </div>
  );
}
