// 後台驗證：PBKDF2 密碼雜湊、HMAC 簽章 Session Cookie、Cloudflare Access JWT。
// 所有金鑰與密碼雜湊只來自環境變數（見 .env.example）。

const enc = new TextEncoder();

export const SESSION_COOKIE = 'yac_admin';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers 上限

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === 'string' ? enc.encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, iterStr, saltHex, hashHex] = stored.split('$');
  const iterations = Number(iterStr);
  if (scheme !== 'pbkdf2_sha256' || !iterations || !/^[0-9a-f]+$/i.test(saltHex ?? '') || !/^[0-9a-f]+$/i.test(hashHex ?? '')) return false;
  const actual = await pbkdf2(password, fromHex(saltHex), iterations);
  return timingSafeEqual(actual, fromHex(hashHex));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(username: string, secret: string, ttl = SESSION_TTL_SECONDS, now = Date.now()): Promise<string> {
  const payload = b64url(JSON.stringify({ u: username, exp: Math.floor(now / 1000) + ttl }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | undefined, now = Date.now()): Promise<string | null> {
  if (!token || !secret || secret.length < 32) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(sig) as BufferSource, enc.encode(payload));
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as { u?: string; exp?: number };
    if (!data.u || !data.exp || data.exp * 1000 < now) return null;
    return data.u;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, secure: boolean, maxAge = SESSION_TTL_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

// ---- 登入頻率限制（D1 login_attempts） ----
const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES = 5;

export async function isLoginBlocked(db: D1Database, ip: string, now = Date.now()): Promise<boolean> {
  const since = Math.floor(now / 1000) - WINDOW_SECONDS;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip_address = ? AND attempted_at > ?').bind(ip, since).first<{ n: number }>();
  return (row?.n ?? 0) >= MAX_FAILURES;
}

export async function recordLoginFailure(db: D1Database, ip: string, now = Date.now()) {
  const ts = Math.floor(now / 1000);
  await db.batch([
    db.prepare('INSERT INTO login_attempts (ip_address, attempted_at) VALUES (?, ?)').bind(ip, ts),
    db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(ts - WINDOW_SECONDS * 4),
  ]);
}

export async function clearLoginFailures(db: D1Database, ip: string) {
  await db.prepare('DELETE FROM login_attempts WHERE ip_address = ?').bind(ip).run();
}

// ---- Cloudflare Access ----
interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}
let jwksCache: { at: number; domain: string; keys: Jwk[] } | null = null;

async function loadJwks(teamDomain: string): Promise<Jwk[]> {
  if (jwksCache && jwksCache.domain === teamDomain && Date.now() - jwksCache.at < 10 * 60_000) return jwksCache.keys;
  const res = await fetch(`${teamDomain.replace(/\/$/, '')}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`cf access certs ${res.status}`);
  const data = (await res.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), domain: teamDomain, keys: data.keys };
  return data.keys;
}

export async function verifyAccessJwt(jwt: string | null, env: Pick<Env, 'CF_ACCESS_TEAM_DOMAIN' | 'CF_ACCESS_AUD'>): Promise<string | null> {
  if (!jwt || !env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return null;
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(h))) as { kid?: string; alg?: string };
    if (header.alg !== 'RS256') return null;
    const jwk = (await loadJwks(env.CF_ACCESS_TEAM_DOMAIN)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk as JsonWebKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(s) as BufferSource, enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p))) as { aud?: string | string[]; exp?: number; email?: string; iss?: string };
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(env.CF_ACCESS_AUD)) return null;
    if (!claims.exp || claims.exp * 1000 < Date.now()) return null;
    if (claims.iss && claims.iss.replace(/\/$/, '') !== env.CF_ACCESS_TEAM_DOMAIN.replace(/\/$/, '')) return null;
    return claims.email ?? 'cf-access';
  } catch {
    return null;
  }
}

export type AuthMode = 'session' | 'cf_access' | 'both';
export function authMode(env: Pick<Env, 'ADMIN_AUTH_MODE'>): AuthMode {
  const m = env.ADMIN_AUTH_MODE;
  return m === 'cf_access' || m === 'both' ? m : 'session';
}

export async function resolveAdmin(request: Request, env: Env): Promise<{ username: string; via: 'session' | 'cf_access' } | null> {
  const mode = authMode(env);
  if (mode === 'session' || mode === 'both') {
    const user = await verifySessionToken(readCookie(request.headers.get('cookie'), SESSION_COOKIE), env.SESSION_SECRET);
    if (user) return { username: user, via: 'session' };
  }
  if (mode === 'cf_access' || mode === 'both') {
    const user = await verifyAccessJwt(request.headers.get('cf-access-jwt-assertion'), env);
    if (user) return { username: user, via: 'cf_access' };
  }
  return null;
}
