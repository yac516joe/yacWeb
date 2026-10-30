const ALLOWED = new Set(['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'blockquote', 'hr', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div']);
const VOID = new Set(['br', 'hr', 'img']);
const ATTRS: Record<string, string[]> = { a: ['href', 'title'], img: ['src', 'alt', 'title', 'width', 'height'] };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function safeUrl(v: string, kind: 'href' | 'src'): string | null {
  const u = v.replace(/[\u0000-\u0020]+/g, '');
  if (/^(https?:|mailto:|tel:)/i.test(u) && !(kind === 'src' && /^(mailto|tel):/i.test(u))) return v.trim();
  if (/^(\/|#|\.\.?\/)/.test(u) && !u.startsWith('//')) return v.trim();
  return null;
}

/** 以白名單過濾 HTML：只保留基本排版標籤與安全屬性，其餘標籤剝除、script/style 連同內容移除。 */
export function sanitizeHtml(input: string): string {
  const src = input.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const open: string[] = [];
  let out = '';
  let last = 0;
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    out += esc(src.slice(last, m.index)).replace(/&amp;(amp|lt|gt|quot|nbsp|#\d+);/g, '&$1;');
    last = tag.lastIndex;
    const name = m[2].toLowerCase();
    if (!ALLOWED.has(name)) continue;
    if (m[1]) {
      const i = open.lastIndexOf(name);
      if (i >= 0) {
        out += open.splice(i).reverse().map((t) => `</${t}>`).join('');
      }
      continue;
    }
    let attrs = '';
    const allow = ATTRS[name] ?? [];
    const re = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    for (let a = re.exec(m[3]); a; a = re.exec(m[3])) {
      const k = a[1].toLowerCase();
      if (!allow.includes(k)) continue;
      const raw = (a[2] ?? a[3] ?? a[4] ?? '').replace(/&amp;/g, '&');
      const v = k === 'href' || k === 'src' ? safeUrl(raw, k) : raw;
      if (v !== null) attrs += ` ${k}="${esc(v)}"`;
    }
    if (name === 'a' && attrs.includes('href=')) attrs += ' rel="noopener noreferrer"';
    out += `<${name}${attrs}>`;
    if (!VOID.has(name)) open.push(name);
  }
  out += esc(src.slice(last)).replace(/&amp;(amp|lt|gt|quot|nbsp|#\d+);/g, '&$1;');
  out += open.reverse().map((t) => `</${t}>`).join('');
  return out;
}
