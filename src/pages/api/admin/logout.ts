import type { APIRoute } from 'astro';
import { sessionCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ url }) =>
  new Response(null, {
    status: 303,
    headers: { Location: '/admin/login', 'Set-Cookie': sessionCookie('', url.protocol === 'https:', 0) },
  });
