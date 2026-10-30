import { useRef, useState } from 'preact/hooks';

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 401) {
    location.href = `/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 回應 */
  }
  return { ok: res.ok, status: res.status, data };
}

export function ImageField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function upload(f: File) {
    setBusy(true);
    setMsg('');
    const fd = new FormData();
    fd.append('file', f);
    try {
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data: any = await res.json().catch(() => ({}));
      if (res.ok) onChange(data.url);
      else setMsg(data.error ?? '上傳失敗');
    } catch {
      setMsg('上傳失敗');
    }
    setBusy(false);
  }

  return (
    <div class="img-fld">
      <div class="prev">{value ? <img src={value} alt="" /> : <span>無圖</span>}</div>
      <div class="ctl">
        <input id={id} type="text" value={value} placeholder="/cvj/new/AA-02.jpg 或上傳新圖" onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
        <div class="row">
          <button type="button" class="btn ghost sm" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? '上傳中…' : '上傳圖片'}
          </button>
          {value && (
            <button type="button" class="btn ghost sm" onClick={() => onChange('')}>
              清除
            </button>
          )}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) upload(f);
            (e.target as HTMLInputElement).value = '';
          }} />
        </div>
        {msg && <div class="help" style="color:var(--red)">{msg}</div>}
      </div>
    </div>
  );
}
