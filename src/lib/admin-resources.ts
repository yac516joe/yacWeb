// 後台資源設定：表單欄位、列表欄位與驗證規則。
// 通用 CRUD（/api/admin/[resource]）與後台頁面皆由此設定驅動；產品另有專用邏輯（admin-products.ts）。

export type FieldType = 'text' | 'textarea' | 'number' | 'bool' | 'select' | 'image' | 'datetime' | 'json' | 'slug';
export type OptionSource = 'categories' | 'brands' | 'hand';

export interface Opt {
  value: string | number;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  nullable?: boolean;
  help?: string;
  options?: OptionSource;
  rows?: number;
  /** 僅新增時可填（主鍵代碼） */
  createOnly?: boolean;
  /** json 欄位的額外驗證 */
  jsonKind?: 'columns';
}

export interface ListCol {
  name: string;
  label: string;
  kind?: 'bool' | 'mono' | 'img';
}

export interface ResourceDef {
  key: string;
  label: string;
  table: string;
  pk: string;
  titleField: string;
  fields: FieldDef[];
  select: string;
  from: string;
  search: string[];
  order: string;
  listCols: ListCol[];
  canCreate: boolean;
  canDelete: boolean;
  updatedAt?: boolean;
  deleteWarn?: string;
  slugHelp?: string;
}

const SLUG_HELP = '網址代碼：英數字與 - . _；變更後舊連結會失效。';

export const RESOURCES: Record<string, ResourceDef> = {
  categories: {
    key: 'categories',
    label: '產品線',
    table: 'categories',
    pk: 'id',
    titleField: 'name_zh',
    fields: [
      { name: 'name_zh', label: '中文名稱', type: 'text', required: true },
      { name: 'name_en', label: '英文名稱', type: 'text', required: true },
      { name: 'slug', label: '網址代碼', type: 'slug', required: true, help: SLUG_HELP },
      { name: 'summary', label: '簡介', type: 'textarea', rows: 3 },
      { name: 'cover_image', label: '封面圖', type: 'image', nullable: true, help: '留空時前台自動使用第一個產品圖。' },
      { name: 'sort_order', label: '排序', type: 'number' },
      { name: 'is_published', label: '公開顯示', type: 'bool' },
    ],
    select: 'c.id, c.name_zh, c.name_en, c.slug, c.sort_order, c.is_published, (SELECT COUNT(*) FROM catalog_pages p WHERE p.category_id = c.id) AS pages',
    from: 'categories c',
    search: ['c.name_zh', 'c.name_en', 'c.slug'],
    order: 'c.sort_order, c.id',
    listCols: [
      { name: 'sort_order', label: '排序', kind: 'mono' },
      { name: 'name_zh', label: '名稱' },
      { name: 'slug', label: '代碼', kind: 'mono' },
      { name: 'pages', label: '型錄頁', kind: 'mono' },
      { name: 'is_published', label: '公開', kind: 'bool' },
    ],
    canCreate: true,
    canDelete: true,
    deleteWarn: '刪除產品線會同時刪除底下所有型錄頁與產品，且無法復原。',
  },
  brands: {
    key: 'brands',
    label: '車廠',
    table: 'brands',
    pk: 'id',
    titleField: 'name',
    fields: [
      { name: 'name', label: '名稱（英文）', type: 'text', required: true },
      { name: 'name_zh', label: '中文名稱', type: 'text', nullable: true },
      { name: 'slug', label: '網址代碼', type: 'slug', required: true, help: SLUG_HELP },
      { name: 'sort_order', label: '排序', type: 'number' },
    ],
    select: 'b.id, b.name, b.name_zh, b.slug, b.sort_order, (SELECT COUNT(*) FROM catalog_pages p WHERE p.brand_id = b.id) AS pages',
    from: 'brands b',
    search: ['b.name', 'b.name_zh', 'b.slug'],
    order: 'b.sort_order, b.name',
    listCols: [
      { name: 'name', label: '名稱' },
      { name: 'name_zh', label: '中文' },
      { name: 'slug', label: '代碼', kind: 'mono' },
      { name: 'pages', label: '型錄頁', kind: 'mono' },
    ],
    canCreate: true,
    canDelete: true,
    deleteWarn: '刪除車廠後，相關型錄頁與產品會變成「未指定車廠」。',
  },
  'catalog-pages': {
    key: 'catalog-pages',
    label: '型錄頁',
    table: 'catalog_pages',
    pk: 'id',
    titleField: 'title',
    fields: [
      { name: 'category_id', label: '產品線', type: 'select', options: 'categories', required: true },
      { name: 'brand_id', label: '車廠', type: 'select', options: 'brands', nullable: true },
      { name: 'title', label: '頁面標題', type: 'text', required: true },
      { name: 'slug', label: '網址代碼', type: 'slug', required: true, help: SLUG_HELP },
      { name: 'hand', label: '駕駛座', type: 'select', options: 'hand', nullable: true, help: '轉向機等有左 / 右駕之分時使用。' },
      {
        name: 'columns_json',
        label: '欄位定義 (JSON)',
        type: 'json',
        jsonKind: 'columns',
        rows: 14,
        help: '陣列，每項 {"key","label","short"?,"source"}。source：yac、yac_left、photo、remark、app.<欄位>、ref.<類型>、spec.<代碼>。',
      },
      { name: 'sort_order', label: '排序', type: 'number' },
      { name: 'is_published', label: '公開顯示', type: 'bool' },
    ],
    select:
      'p.id, p.title, p.slug, p.sort_order, p.is_published, c.name_zh AS category, b.name AS brand, (SELECT COUNT(*) FROM products x WHERE x.page_id = p.id) AS products',
    from: 'catalog_pages p JOIN categories c ON c.id = p.category_id LEFT JOIN brands b ON b.id = p.brand_id',
    search: ['p.title', 'p.slug', 'b.name', 'c.name_zh'],
    order: 'c.sort_order, p.sort_order, p.id',
    listCols: [
      { name: 'category', label: '產品線' },
      { name: 'title', label: '標題' },
      { name: 'slug', label: '代碼', kind: 'mono' },
      { name: 'products', label: '產品數', kind: 'mono' },
      { name: 'is_published', label: '公開', kind: 'bool' },
    ],
    canCreate: true,
    canDelete: true,
    deleteWarn: '刪除型錄頁會同時刪除頁面內所有產品，且無法復原。',
  },
  news: {
    key: 'news',
    label: '最新產品／消息',
    table: 'news_posts',
    pk: 'id',
    titleField: 'title_zh',
    fields: [
      { name: 'title_zh', label: '標題', type: 'text', required: true },
      { name: 'title_en', label: '英文標題', type: 'text', nullable: true },
      { name: 'slug', label: '網址代碼', type: 'slug', required: true, help: SLUG_HELP },
      { name: 'summary', label: '摘要', type: 'textarea', rows: 3 },
      { name: 'cover_image_url', label: '封面圖', type: 'image', nullable: true },
      { name: 'content_html', label: '內文 (HTML)', type: 'textarea', rows: 14, help: '可使用基本 HTML 標籤（p、h2、ul、a、img…）。' },
      { name: 'published_at', label: '發布時間', type: 'datetime' },
      { name: 'is_pinned', label: '置頂', type: 'bool' },
      { name: 'is_published', label: '公開顯示', type: 'bool' },
    ],
    select: 'n.id, n.title_zh, n.slug, n.published_at, n.is_pinned, n.is_published',
    from: 'news_posts n',
    search: ['n.title_zh', 'n.title_en', 'n.slug'],
    order: 'n.is_pinned DESC, n.published_at DESC, n.id DESC',
    listCols: [
      { name: 'published_at', label: '發布', kind: 'mono' },
      { name: 'title_zh', label: '標題' },
      { name: 'is_pinned', label: '置頂', kind: 'bool' },
      { name: 'is_published', label: '公開', kind: 'bool' },
    ],
    canCreate: true,
    canDelete: true,
    updatedAt: true,
  },
  'site-pages': {
    key: 'site-pages',
    label: '站內頁面',
    table: 'site_pages',
    pk: 'page_key',
    titleField: 'title',
    fields: [
      { name: 'page_key', label: '頁面代碼', type: 'slug', required: true, createOnly: true, help: '首頁 home、關於 about、聯絡 contact 等；建立後不可更改。' },
      { name: 'title', label: '標題', type: 'text', required: true },
      { name: 'content_json', label: '內容 (JSON)', type: 'json', rows: 22, help: '頁面區塊內容；請保留原有欄位名稱，只修改文字。' },
    ],
    select: 's.page_key, s.title, s.updated_at',
    from: 'site_pages s',
    search: ['s.page_key', 's.title'],
    order: 's.page_key',
    listCols: [
      { name: 'page_key', label: '代碼', kind: 'mono' },
      { name: 'title', label: '標題' },
      { name: 'updated_at', label: '更新', kind: 'mono' },
    ],
    canCreate: true,
    canDelete: false,
    updatedAt: true,
  },
};

export const RESOURCE_KEYS = Object.keys(RESOURCES);

export const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const HAND_OPTIONS: Opt[] = [
  { value: 'LHD', label: 'LHD（左駕）' },
  { value: 'RHD', label: 'RHD（右駕）' },
];

const SOURCE_RE = /^(yac|yac_left|photo|remark|app\.[a-z_]+|ref\.[A-Za-z0-9-]+|spec\.[A-Za-z0-9_]+)$/;

export function validateColumns(v: unknown): string | null {
  if (!Array.isArray(v) || !v.length) return '欄位定義必須是非空陣列';
  const keys = new Set<string>();
  for (const [i, c] of v.entries()) {
    if (!c || typeof c !== 'object') return `第 ${i + 1} 項格式錯誤`;
    const { key, label, source, short } = c as Record<string, unknown>;
    if (typeof key !== 'string' || !key) return `第 ${i + 1} 項缺少 key`;
    if (keys.has(key)) return `key「${key}」重複`;
    keys.add(key);
    if (typeof label !== 'string' || !label) return `第 ${i + 1} 項缺少 label`;
    if (typeof source !== 'string' || !SOURCE_RE.test(source)) return `第 ${i + 1} 項 source 不合法：${String(source)}`;
    if (short !== undefined && typeof short !== 'string') return `第 ${i + 1} 項 short 必須是文字`;
  }
  return null;
}

export type Values = Record<string, string | number | null>;

/** 依欄位定義驗證並正規化表單內容。 */
export function parseValues(def: ResourceDef, body: Record<string, unknown>, mode: 'create' | 'update'): { values: Values } | { error: string } {
  const values: Values = {};
  for (const f of def.fields) {
    if (f.createOnly && mode === 'update') continue;
    const raw = body[f.name];
    const str = raw == null ? '' : String(raw).trim();
    switch (f.type) {
      case 'bool':
        values[f.name] = raw === true || raw === 1 || raw === '1' || raw === 'on' || raw === 'true' ? 1 : 0;
        break;
      case 'number': {
        if (str === '') {
          values[f.name] = 0;
          break;
        }
        const n = Number(str);
        if (!Number.isInteger(n)) return { error: `「${f.label}」必須是整數` };
        values[f.name] = n;
        break;
      }
      case 'select': {
        if (str === '') {
          if (f.required) return { error: `請選擇「${f.label}」` };
          values[f.name] = null;
        } else if (f.options === 'hand') {
          if (str !== 'LHD' && str !== 'RHD') return { error: `「${f.label}」只能是 LHD 或 RHD` };
          values[f.name] = str;
        } else {
          const n = Number(str);
          if (!Number.isInteger(n) || n <= 0) return { error: `「${f.label}」選項不合法` };
          values[f.name] = n;
        }
        break;
      }
      case 'json': {
        if (!str) {
          if (f.required) return { error: `請填寫「${f.label}」` };
          values[f.name] = '{}';
          break;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(str);
        } catch (e) {
          return { error: `「${f.label}」不是合法的 JSON：${(e as Error).message}` };
        }
        if (f.jsonKind === 'columns') {
          const msg = validateColumns(parsed);
          if (msg) return { error: `「${f.label}」${msg}` };
        }
        values[f.name] = JSON.stringify(parsed);
        break;
      }
      case 'datetime':
        values[f.name] = str || new Date().toISOString().slice(0, 19).replace('T', ' ');
        break;
      case 'slug':
        if (!str) return { error: `請填寫「${f.label}」` };
        if (!SLUG_RE.test(str)) return { error: `「${f.label}」只能包含英數字與 - . _，且以英數字開頭` };
        values[f.name] = str;
        break;
      default: {
        if (!str && f.required) return { error: `請填寫「${f.label}」` };
        if (str.length > 100_000) return { error: `「${f.label}」內容過長` };
        values[f.name] = !str && f.nullable ? null : str;
      }
    }
  }
  return { values };
}
