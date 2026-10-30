import type { ColumnDef } from './columns';
import type { ProductDetail } from './queries';

export interface Cell {
  col: ColumnDef;
  kind: 'yac' | 'photo' | 'text';
  value: string;
  left?: string | null;
  rowspan: number;
}

export function refsOfType(p: ProductDetail, type: string): string[] {
  return p.refs.filter((r) => r.ref_type === type).map((r) => r.ref_no);
}

/** 欄位值（純文字）。application 欄位依 row 取對應車款；其餘欄位與 row 無關。 */
export function cellText(p: ProductDetail, col: ColumnDef, row = 0): string {
  const src = col.source;
  if (src === 'yac') return p.yac_no;
  if (src === 'yac_left') return p.yac_no_left ?? '';
  if (src === 'photo') return p.primary_image_url ?? '';
  if (src === 'remark') return p.notes ?? '';
  if (src.startsWith('app.')) return (p.apps[row] as unknown as Record<string, string | null> | undefined)?.[src.slice(4)] ?? '';
  if (src.startsWith('ref.')) return refsOfType(p, src.slice(4)).join(' / ');
  if (src.startsWith('spec.')) return p.specs[src.slice(5)] ?? '';
  return '';
}

/**
 * 一個產品展開成多列（每個適用車款一列）。
 * 非車款欄位只在第一列輸出並以 rowspan 合併，其餘列只含車款欄位。
 */
export function expandProduct(p: ProductDetail, columns: ColumnDef[]): Cell[][] {
  const n = Math.max(p.apps.length, 1);
  const rows: Cell[][] = Array.from({ length: n }, () => []);
  for (const col of columns) {
    const isApp = col.source.startsWith('app.');
    const mk = (row: number): Cell => ({
      col,
      kind: col.source === 'yac' ? 'yac' : col.source === 'photo' ? 'photo' : 'text',
      value: cellText(p, col, row),
      left: col.source === 'yac' ? p.yac_no_left : undefined,
      rowspan: isApp ? 1 : n,
    });
    if (isApp) for (let i = 0; i < n; i++) rows[i].push(mk(i));
    else rows[0].push(mk(0));
  }
  return rows;
}

function csvEscape(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 匯出為 CSV（每個適用車款一列，欄位順序同型錄頁；UTF-8 BOM 讓 Excel 正確顯示中文）。 */
export function productsToCsv(products: ProductDetail[], columns: ColumnDef[], headers: string[]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const p of products) {
    const n = Math.max(p.apps.length, 1);
    for (let i = 0; i < n; i++) lines.push(columns.map((c) => csvEscape(cellText(p, c, i))).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
