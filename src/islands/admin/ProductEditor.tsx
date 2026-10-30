import { useEffect, useState } from 'preact/hooks';
import type { Opt } from '../../lib/admin-resources';
import { ImageField, api } from './common';

interface Col {
  key: string;
  label: string;
  short?: string;
  source: string;
}
interface Initial {
  id: number;
  page_id: number;
  yac_no: string;
  yac_no_left: string;
  car_series: string;
  notes: string;
  primary_image_url: string;
  is_published: boolean;
  sort_order: number;
  specs: Record<string, string>;
  apps: Record<string, string>[];
  refs: { ref_type: string; ref_no: string }[];
}
interface Props {
  initial: Initial;
  isNew: boolean;
  pages: Opt[];
  refTypes: Opt[];
  columns: Col[];
}

const APP_COLS: [string, string][] = [
  ['car_brand_text', '車廠'],
  ['car_model', '車型'],
  ['engine', '引擎'],
  ['transmission', '變速箱'],
  ['position', '位置'],
  ['year_range', '年份'],
];
const emptyApp = () => Object.fromEntries(APP_COLS.map(([k]) => [k, '']));

export default function ProductEditor({ initial, isNew, pages, refTypes, columns: initialColumns }: Props) {
  const [f, setF] = useState(initial);
  const [columns, setColumns] = useState<Col[]>(initialColumns);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!f.page_id || f.page_id === initial.page_id) return;
    api('GET', `/api/admin/catalog-pages/${f.page_id}`).then((r) => {
      if (!r.ok) return;
      try {
        setColumns(JSON.parse(r.data.columns_json));
      } catch {
        setColumns([]);
      }
    });
  }, [f.page_id]);

  const specCols = columns.filter((c) => c.source.startsWith('spec.'));
  const specKeys = specCols.map((c) => c.source.slice(5));
  const extraSpecs = Object.keys(f.specs).filter((k) => !specKeys.includes(k));
  const setSpec = (k: string, v: string) => set('specs', { ...f.specs, [k]: v });

  const setApp = (i: number, k: string, v: string) => set('apps', f.apps.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const setRef = (i: number, k: 'ref_type' | 'ref_no', v: string) => set('refs', f.refs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function save(e: Event) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const body = { ...f, is_published: f.is_published ? 1 : 0 };
    const res = isNew ? await api('POST', '/api/admin/products', body) : await api('PUT', `/api/admin/products/${initial.id}`, body);
    if (res.ok) {
      location.href = `/admin/products/${isNew ? res.data.id : initial.id}?saved=1`;
      return;
    }
    setErr(res.data?.error ?? '儲存失敗');
    setBusy(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove() {
    if (!confirm(`確定刪除產品 ${f.yac_no}？\n其適用車款與對照料號也會一併刪除。`)) return;
    setBusy(true);
    const res = await api('DELETE', `/api/admin/products/${initial.id}`);
    if (res.ok) location.href = `/admin/products?page_id=${f.page_id}`;
    else {
      setErr(res.data?.error ?? '刪除失敗');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      {err && (
        <div class="flash err" role="alert">
          {err}
        </div>
      )}

      <div class="card">
        <div class="card-h">基本資料</div>
        <div class="card-b">
          <div class="form">
            <div class="fld full">
              <label for="p-page">
                所屬型錄頁<em>*</em>
              </label>
              <select id="p-page" value={String(f.page_id || '')} onChange={(e) => set('page_id', Number((e.target as HTMLSelectElement).value))}>
                <option value="">請選擇</option>
                {pages.map((o) => (
                  <option value={String(o.value)}>{o.label}</option>
                ))}
              </select>
              <div class="help">決定產品出現在哪個分類與表格，以及有哪些規格欄位。</div>
            </div>
            <div class="fld">
              <label for="p-yac">
                YAC 料號<em>*</em>
              </label>
              <input id="p-yac" type="text" value={f.yac_no} onInput={(e) => set('yac_no', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="fld">
              <label for="p-left">YAC 左側料號</label>
              <input id="p-left" type="text" value={f.yac_no_left} onInput={(e) => set('yac_no_left', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="fld">
              <label for="p-series">車系</label>
              <input id="p-series" type="text" value={f.car_series} onInput={(e) => set('car_series', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="fld">
              <label for="p-sort">排序</label>
              <input id="p-sort" type="number" step="1" value={f.sort_order} onInput={(e) => set('sort_order', Number((e.target as HTMLInputElement).value))} />
            </div>
            <div class="fld full">
              <label for="p-img">產品圖片</label>
              <ImageField id="p-img" value={f.primary_image_url} onChange={(v) => set('primary_image_url', v)} />
            </div>
            <div class="fld full">
              <label for="p-notes">備註</label>
              <textarea id="p-notes" rows={2} value={f.notes} onInput={(e) => set('notes', (e.target as HTMLTextAreaElement).value)} />
            </div>
            <div class="fld check">
              <label>
                <input type="checkbox" checked={f.is_published} onChange={(e) => set('is_published', (e.target as HTMLInputElement).checked)} />
                公開顯示於前台
              </label>
            </div>
          </div>
        </div>
      </div>

      {(specCols.length > 0 || extraSpecs.length > 0) && (
        <div class="card">
          <div class="card-h">規格尺寸</div>
          <div class="card-b">
            <div class="form cols-4">
              {specCols.map((c) => {
                const k = c.source.slice(5);
                return (
                  <div class="fld">
                    <label for={`s-${k}`}>
                      {c.short ? `${c.short}　` : ''}
                      {c.label}
                    </label>
                    <input id={`s-${k}`} type="text" value={f.specs[k] ?? ''} onInput={(e) => setSpec(k, (e.target as HTMLInputElement).value)} />
                  </div>
                );
              })}
              {extraSpecs.map((k) => (
                <div class="fld">
                  <label for={`s-${k}`}>{k}（此頁未定義）</label>
                  <input id={`s-${k}`} type="text" value={f.specs[k] ?? ''} onInput={(e) => setSpec(k, (e.target as HTMLInputElement).value)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div class="card">
        <div class="card-h">
          適用車款 <span class="mono">{f.apps.length}</span>
        </div>
        <div class="card-b">
          <div class="scroll-x">
            <table class="sub">
              <thead>
                <tr>
                  {APP_COLS.map(([, l]) => (
                    <th>{l}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {f.apps.map((a, i) => (
                  <tr>
                    {APP_COLS.map(([k, l]) => (
                      <td>
                        <input type="text" aria-label={l} value={a[k] ?? ''} onInput={(e) => setApp(i, k, (e.target as HTMLInputElement).value)} />
                      </td>
                    ))}
                    <td class="act">
                      <button type="button" class="btn ghost sm" onClick={() => set('apps', f.apps.filter((_, j) => j !== i))}>
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
                {!f.apps.length && (
                  <tr>
                    <td colspan={APP_COLS.length + 1} class="empty">
                      尚無適用車款
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button type="button" class="btn ghost sm" style="margin-top:10px" onClick={() => set('apps', [...f.apps, emptyApp()])}>
            ＋ 新增一列
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-h">
          對照料號 <span class="mono">{f.refs.length}</span>
        </div>
        <div class="card-b">
          <table class="sub">
            <thead>
              <tr>
                <th style="width:200px">類型</th>
                <th>料號</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {f.refs.map((r, i) => (
                <tr>
                  <td>
                    <select aria-label="類型" value={r.ref_type} onChange={(e) => setRef(i, 'ref_type', (e.target as HTMLSelectElement).value)}>
                      {!refTypes.some((o) => o.value === r.ref_type) && <option value={r.ref_type}>{r.ref_type}</option>}
                      {refTypes.map((o) => (
                        <option value={String(o.value)}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="text" aria-label="料號" value={r.ref_no} onInput={(e) => setRef(i, 'ref_no', (e.target as HTMLInputElement).value)} />
                  </td>
                  <td class="act">
                    <button type="button" class="btn ghost sm" onClick={() => set('refs', f.refs.filter((_, j) => j !== i))}>
                      移除
                    </button>
                  </td>
                </tr>
              ))}
              {!f.refs.length && (
                <tr>
                    <td colSpan={3} class="empty">
                    尚無對照料號
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <button type="button" class="btn ghost sm" style="margin-top:10px" onClick={() => set('refs', [...f.refs, { ref_type: String(refTypes[0]?.value ?? 'OEM'), ref_no: '' }])}>
            ＋ 新增一列
          </button>
        </div>
      </div>

      <div class="actions">
        <button class="btn" type="submit" disabled={busy}>
          {busy ? '處理中…' : isNew ? '建立' : '儲存'}
        </button>
        <a class="btn ghost" href={f.page_id ? `/admin/products?page_id=${f.page_id}` : '/admin/products'}>
          取消
        </a>
        <span class="sp" />
        {!isNew && (
          <button class="btn danger" type="button" disabled={busy} onClick={remove}>
            刪除
          </button>
        )}
      </div>
    </form>
  );
}
