export interface LegacyHit {
  newPath: string;
  status: number;
}

export function isLegacyHtmlPath(pathname: string): boolean {
  return /\.html?$/i.test(pathname);
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
