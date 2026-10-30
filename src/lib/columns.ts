export const APP_FIELDS = [
  'car_brand_text',
  'car_model',
  'engine',
  'transmission',
  'position',
  'year_range',
] as const;
export type AppField = (typeof APP_FIELDS)[number];

/**
 * 欄位來源（catalog_pages.columns_json 的 source）：
 *  yac / yac_left / photo / remark / app.<AppField> / ref.<TYPE> / spec.<key>
 */
export interface ColumnDef {
  key: string;
  label: string;
  /** 規格欄位的簡短代號（如 A、B、C），供圖例使用 */
  short?: string;
  source: string;
}

export const REF_LABELS: Record<string, string> = {
  OEM: 'OEM',
  ORIGINAL: 'Original No.',
  YAC: 'YAC 別號',
  SPICER: 'Spicer',
  GMB: 'GMB',
  KOYO: 'Koyo',
  MATSUBA: 'Matsuba',
  LOBRO: 'Lobro',
  MIPER: 'Miper',
  GLAENZER: 'Glaenzer',
  'B-W': 'B-W',
  GWB: 'GWB',
  QHL: 'QHL',
  PART: 'Part No.',
};

export function normalizeRef(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const HEADER_ZH: [RegExp, string][] = [
  [/^yac\s*no\.?$/i, 'YAC 料號'],
  [/^(yac\s*)?(no\.?\s*)?right$/i, 'YAC 右'],
  [/^car\s*model$/i, '車型'],
  [/^application$/i, '適用車款'],
  [/^engine(\s*model)?$/i, '引擎'],
  [/^at\s*\/\s*mt$/i, 'AT / MT'],
  [/^year$/i, '年份'],
  [/^o\.?e\.?m\.?(\s*no\.?)?$/i, 'OEM 料號'],
  [/^original\s*no\.?$/i, '原廠料號'],
  [/^photo$/i, '圖片'],
  [/^remarks?$/i, '備註'],
  [/^position$/i, '位置'],
  [/^(f\s*\/\s*r|f\/r)$/i, '前 / 後'],
];

const SPEC_ZH: [RegExp, string][] = [
  [/no\.?\s*of\s*outer\s*teeth/i, '外齒數'],
  [/no\.?\s*of\s*inner\s*teeth/i, '內齒數'],
  [/abs\s*no\.?\s*of\s*teeth/i, 'ABS 齒數'],
  [/seal\s*dia/i, '油封外徑 mm'],
  [/thread/i, '螺紋'],
  [/internal\s*groove/i, '內溝槽'],
  [/overall\s*height/i, '全高'],
  [/length/i, '長度'],
  [/outer\s*dia/i, '外徑'],
  [/inner\s*dia/i, '內徑'],
];

/** 欄位標題的繁中顯示；找不到對照時保留原文。 */
export function headerZh(col: ColumnDef): string {
  for (const [re, zh] of HEADER_ZH) if (re.test(col.label.trim())) return zh;
  if (col.source.startsWith('ref.')) return REF_LABELS[col.source.slice(4)] ?? col.label;
  if (col.short) return col.short;
  return col.label;
}

/** 規格欄位圖例（A、B、C…）的繁中說明。 */
export function legendZh(col: ColumnDef): string {
  const rest = col.short ? col.label.replace(new RegExp(`^${col.short}\\s*`), '') : col.label;
  for (const [re, zh] of SPEC_ZH) if (re.test(col.label)) return zh;
  return rest || col.label;
}
