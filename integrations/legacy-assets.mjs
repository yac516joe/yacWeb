import fs from 'node:fs';
import path from 'node:path';

// 舊版靜態站的資料夾。其中 .html 已匯入資料庫（由 legacy_redirects 轉址），
// 其餘圖片 / CAD / PDF 等檔案維持原路徑，確保 Google 收錄的舊圖片網址不失效。
const LEGACY_DIRS = [
  '2005', '2007', '2009', '2013', 'accessories', 'brakedisc', 'cv-joint', 'cvj', 'ds', 'flash', 'go',
  'hubs', 'img', 'Inboard_Joints', 'index', 'lockinghub', 'new-p', 'pics', 'steeringpump',
  'steeringrack', 'style', 'universal_joint', 'waterpump',
];
const SKIP_EXT = new Set(['.html', '.htm', '.db', '.tmp']);
const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
  '.css': 'text/css', '.js': 'text/javascript', '.swf': 'application/x-shockwave-flash',
};

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (!SKIP_EXT.has(path.extname(e.name).toLowerCase())) yield p;
  }
}

export default function legacyAssets() {
  const root = process.cwd();
  return {
    name: 'yac-legacy-assets',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = decodeURIComponent((req.url || '').split('?')[0]);
          const top = url.split('/')[1];
          if (!LEGACY_DIRS.includes(top)) return next();
          const ext = path.extname(url).toLowerCase();
          if (SKIP_EXT.has(ext) || !ext) return next();
          const file = path.join(root, url);
          if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
          res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
          fs.createReadStream(file).pipe(res);
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        const out = new URL(dir).pathname.replace(/^\/([A-Za-z]:)/, '$1');
        let n = 0;
        for (const d of LEGACY_DIRS) {
          const src = path.join(root, d);
          if (!fs.existsSync(src)) continue;
          for (const f of walk(src)) {
            const dest = path.join(out, path.relative(root, f));
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(f, dest);
            n++;
          }
        }
        logger.info(`已複製 ${n} 個舊版靜態資源（圖片 / CAD / PDF）至輸出目錄`);
      },
    },
  };
}
