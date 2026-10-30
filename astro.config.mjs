import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import legacyAssets from './integrations/legacy-assets.mjs';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true, persist: { path: './.wrangler/state/v3' } },
  }),
  integrations: [preact({ compat: false }), legacyAssets()],
  vite: {
    // 開發伺服器預設會提供專案根目錄檔案；擋掉機密與設定檔
    server: { fs: { deny: ['.env', '.env.*', '.dev.vars', '*.{crt,pem}', 'wrangler.toml', '.git/**', '.wrangler/**', 'migrations/**'] } },
  },
  server: { port: 4321 },
  security: { checkOrigin: true },
});
