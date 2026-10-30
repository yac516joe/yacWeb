import { defineMiddleware } from 'astro:middleware';
import { resolveAdmin } from './lib/auth';
import { lookupLegacyRedirect, isLegacyHtmlPath } from './lib/redirects';

const PUBLIC_ADMIN = new Set(['/admin/login', '/api/admin/login']);

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // 非瀏覽器或同源 GET 以外的簡單請求（SameSite=Lax 另有保護）
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, locals } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const env = locals.runtime?.env;

  if (env?.DB && isLegacyHtmlPath(path)) {
    const hit = await lookupLegacyRedirect(env.DB, path);
    if (hit) return Response.redirect(new URL(hit.newPath + url.search, url).toString(), hit.status);
  }

  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin/');
  const isMutation = request.method !== 'GET' && request.method !== 'HEAD';

  if (path.startsWith('/api/') && isMutation && !sameOrigin(request)) {
    return Response.json({ error: '來源不符' }, { status: 403 });
  }

  if ((isAdminPage || isAdminApi) && !PUBLIC_ADMIN.has(path.replace(/\/$/, ''))) {
    const admin = env ? await resolveAdmin(request, env) : null;
    if (!admin) {
      if (isAdminApi) return Response.json({ error: '尚未登入或登入已逾時' }, { status: 401 });
      return Response.redirect(new URL(`/admin/login?next=${encodeURIComponent(path + url.search)}`, url).toString(), 302);
    }
    locals.admin = admin;
  }

  const response = await next();
  if (isAdminPage || isAdminApi) {
    const res = new Response(response.body, response);
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }
  return response;
});
