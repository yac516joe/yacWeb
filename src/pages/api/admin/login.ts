import type { APIRoute } from 'astro';
import { getDb, getEnv, audit } from '../../../lib/db';
import { authMode, clearLoginFailures, createSessionToken, isLoginBlocked, recordLoginFailure, sessionCookie, timingSafeEqual, verifyPassword } from '../../../lib/auth';
import { clientIp } from '../../../lib/admin-crud';

export const prerender = false;

const enc = new TextEncoder();

function safeNext(next: string | null): string {
  return next && next.startsWith('/admin') && !next.startsWith('//') && !next.includes('\\') ? next : '/admin';
}

function back(url: URL, err: string, next: string) {
  const to = new URL('/admin/login', url);
  to.searchParams.set('err', err);
  if (next !== '/admin') to.searchParams.set('next', next);
  return new Response(null, { status: 303, headers: { Location: to.pathname + to.search } });
}

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = getEnv(locals);
  const db = getDb(locals);
  const form = await request.formData();
  const next = safeNext(String(form.get('next') ?? ''));
  const ip = clientIp(request) ?? 'unknown';

  if (authMode(env) === 'cf_access') return back(url, 'mode', next);
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return back(url, 'config', next);
  if (await isLoginBlocked(db, ip)) return back(url, 'blocked', next);

  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');
  const userOk = timingSafeEqual(enc.encode(username), enc.encode(env.ADMIN_USERNAME));
  const passOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!userOk || !passOk) {
    await recordLoginFailure(db, ip);
    await audit(db, username.slice(0, 50) || '(空白)', 'LOGIN_FAIL', 'admin', null, null, ip);
    return back(url, 'bad', next);
  }

  await clearLoginFailures(db, ip);
  await audit(db, username, 'LOGIN', 'admin', null, null, ip);
  const token = await createSessionToken(username, env.SESSION_SECRET);
  return new Response(null, {
    status: 303,
    headers: { Location: next, 'Set-Cookie': sessionCookie(token, url.protocol === 'https:') },
  });
};
