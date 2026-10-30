/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  ADMIN_AUTH_MODE?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  PUBLIC_MEDIA_BASE_URL?: string;
}

declare namespace App {
  interface Locals extends Runtime {
    admin?: { username: string; via: 'session' | 'cf_access' };
  }
}
