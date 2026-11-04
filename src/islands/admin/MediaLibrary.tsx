import { useRef, useState } from 'preact/hooks';
import { api } from './common';

interface Item {
  id: number;
  public_url: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export default function MediaLibrary({ items: initial, enabled }: { items: Item[]; enabled: boolean }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setBusy(true);
    setMsg(null);
    let okCount = 0;
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) {
        okCount++;
        setItems((s) => [{ id: data.id, public_url: data.url, file_name: f.name, mime_type: f.type, file_size: f.size, created_at: '剛剛' }, ...s]);
      } else {
        setMsg({ ok: false, text: `${f.name}：${data.error ?? '上傳失敗'}` });
        break;
      }
    }
    if (okCount) setMsg({ ok: true, text: `已上傳 ${okCount} 張圖片` });
    setBusy(false);
  }

  async function remove(it: Item) {
    if (!confirm(`確定刪除 ${it.file_name}？已使用此圖片的產品將顯示不到圖。`)) return;
    const res = await api('DELETE', `/api/admin/media/${it.id}`);
    if (res.ok) setItems((s) => s.filter((x) => x.id !== it.id));
    else setMsg({ ok: false, text: res.data?.error ?? '刪除失敗' });
  }

  return (
    <div>
      {msg && <div class={`flash ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div class="card">
        <div class="toolbar">
          <button class="btn" type="button" disabled={busy || !enabled} onClick={() => file.current?.click()}>
            {busy ? '上傳中…' : '＋ 上傳圖片'}
          </button>
          <input ref={file} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => {
            const el = e.target as HTMLInputElement;
            if (el.files?.length) upload(el.files);
            el.value = '';
          }} />
          <span class="grow" />
          <span class="mono" style="font-size:12px;color:var(--mute)">JPG / PNG / WebP / GIF，單檔 5 MB 以內</span>
        </div>
        <div class="media-grid">
          {items.map((it) => (
            <div class="media-item">
              <a class="pic" href={it.public_url} target="_blank" rel="noopener">
                <img src={it.public_url} alt={it.file_name} loading="lazy" />
              </a>
              <div class="meta">
                <div class="name" title={it.file_name}>{it.file_name}</div>
                <div class="mono">{(it.file_size / 1024).toFixed(0)} KB</div>
                <div class="row">
                  <button type="button" class="btn ghost sm" onClick={() => navigator.clipboard?.writeText(location.origin + it.public_url).then(() => setMsg({ ok: true, text: '已複製圖片網址' }))}>
                    複製網址
                  </button>
                  <button type="button" class="btn danger sm" onClick={() => remove(it)}>
                    刪除
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!items.length && <div class="empty" style="grid-column:1/-1">尚未上傳任何圖片</div>}
        </div>
      </div>
    </div>
  );
}
