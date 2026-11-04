import { useState } from 'preact/hooks';
import type { Opt } from '../../lib/admin-resources';
import { api } from './common';

interface Result {
  dryRun?: boolean;
  total?: number;
  created?: number;
  updated?: number;
  error?: string;
  [k: string]: any;
}

export default function CsvImport({ pages, initialPage }: { pages: Opt[]; initialPage: number }) {
  const [pageId, setPageId] = useState(initialPage || 0);
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);
  const [err, setErr] = useState('');

  async function pick(f?: File) {
    setPreview(null);
    setDone(null);
    setErr('');
    if (!f) return;
    setName(f.name);
    // 去除 UTF-8 BOM（Excel 另存 CSV 會帶 BOM）
    setCsv((await f.text()).replace(/^\uFEFF/, ''));
  }

  async function run(dryRun: boolean) {
    if (!pageId) return setErr('請先選擇型錄頁');
    if (!csv.trim()) return setErr('請選擇 CSV 檔案');
    setBusy(true);
    setErr('');
    const res = await api<Result>('POST', '/api/admin/import', { page_id: pageId, csv, dryRun });
    if (!res.ok) setErr(res.data?.error ?? '匯入失敗');
    else if (dryRun) setPreview(res.data);
    else {
      setDone(res.data);
      setPreview(null);
    }
    setBusy(false);
  }

  return (
    <div class="card">
      <div class="card-b">
        {err && (
          <div class="flash err" role="alert">
            {err}
          </div>
        )}
        {done && (
          <div class="flash ok">
            匯入完成：新增 {done.created ?? 0}、更新 {done.updated ?? 0} 個產品。
            <a href={`/admin/products?page_id=${pageId}`}> 查看產品 →</a>
          </div>
        )}
        <div class="form">
          <div class="fld full">
            <label for="i-page">
              1. 選擇型錄頁<em>*</em>
            </label>
            <select id="i-page" value={String(pageId || '')} onChange={(e) => { setPageId(Number((e.target as HTMLSelectElement).value)); setPreview(null); setDone(null); }}>
              <option value="">請選擇</option>
              {pages.map((o) => (
                <option value={String(o.value)}>{o.label}</option>
              ))}
            </select>
            <div class="help">
              欄位格式以該頁為準，建議先
              {pageId ? <a href={`/api/admin/import?page=${pageId}`}> 下載此頁現有 CSV </a> : '下載此頁現有 CSV '}
              當範本，修改後再上傳。
            </div>
          </div>
          <div class="fld full">
            <label for="i-file">2. 選擇 CSV 檔案</label>
            <input id="i-file" type="file" accept=".csv,text/csv" onChange={(e) => pick((e.target as HTMLInputElement).files?.[0])} />
            {name && <div class="help">{name}（{csv.length.toLocaleString()} 字元）</div>}
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px">
          <button class="btn ghost" type="button" disabled={busy} onClick={() => run(true)}>
            3. 預覽（不寫入）
          </button>
          <button class="btn" type="button" disabled={busy || !preview} onClick={() => run(false)}>
            4. 確認匯入
          </button>
        </div>
        {preview && (
          <div class="flash warn" style="margin-top:16px">
            預覽：共 {preview.total} 個產品，新增 {preview.created}、更新 {preview.updated}。確認無誤後按「確認匯入」。
          </div>
        )}
        <div class="help" style="margin-top:16px">
          匯入以「型錄頁＋YAC 料號」比對：已存在則覆蓋其規格、適用車款與對照料號，不存在則新增；不會刪除任何產品。單次上限 200 個產品。
        </div>
      </div>
    </div>
  );
}
