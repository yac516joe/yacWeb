export interface LegacyHit {
  newPath: string;
  status: number;
}

export function isLegacyHtmlPath(pathname: string): boolean {
  return /\.html?$/i.test(pathname);
}

/** 舊靜態站的頂層資料夾；其中的圖片已搬到 /images/<原路徑>。 */
export const LEGACY_IMAGE_DIRS = [
  '2005', '2007', '2009', '2013', 'accessories', 'brakedisc', 'cv-joint', 'cvj', 'ds', 'flash', 'go',
  'hubs', 'img', 'Inboard_Joints', 'index', 'lockinghub', 'new-p', 'pics', 'steeringpump',
  'steeringrack', 'style', 'universal_joint', 'waterpump',
];
const LEGACY_IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;

/** 舊圖片網址（如 /cvj/new/AA-02.jpg）→ 新圖片網址（/images/cvj/new/AA-02.jpg）；非舊圖片回傳 null。 */
export function legacyImageRedirect(pathname: string): string | null {
  if (!LEGACY_IMAGE_EXT.test(pathname)) return null;
  const top = pathname.split('/')[1];
  return LEGACY_IMAGE_DIRS.includes(top) ? `/images${pathname}` : null;
}

/** 將請求路徑轉成 legacy_redirects.old_path 的鍵：解碼後小寫，補上 .html。 */
export function legacyKey(pathname: string): string {
  let p = pathname;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    /* 保留原字串 */
  }
  return p.toLowerCase().replace(/\.htm$/, '.html');
}

export async function lookupLegacyRedirect(db: D1Database, pathname: string): Promise<LegacyHit | null> {
  const row = await db
    .prepare('SELECT new_path, status_code FROM legacy_redirects WHERE old_path = ?')
    .bind(legacyKey(pathname))
    .first<{ new_path: string; status_code: number }>();
  return row ? { newPath: row.new_path, status: row.status_code || 301 } : null;
}
