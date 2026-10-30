# 上線手冊（Phase 5）

> 前置：已取得 Cloudflare 帳號權限，並在本機執行過 `npx wrangler login`（或使用 API Token）。以下指令在專案根目錄執行；Windows ARM64 請用 x64 Node。

## 1. 建立 Cloudflare 資源
```bash
npx wrangler d1 create yac-website-db        # 記下輸出的 database_id
npx wrangler r2 bucket create yac-website-media
```
- 本機測試遠端綁定時，暫時把 `wrangler.toml` 的 `database_id` 換成實際 UUID（**不要提交**；CI 會以 `D1_DATABASE_ID` secret 注入）。

## 2. 套用 migration 並匯入資料
```bash
npx wrangler d1 migrations apply yac-website-db --remote
npm run db:import:legacy                      # 產生 migrations/seed/seed.sql 與 docs/MIGRATION_REPORT.md
npx wrangler d1 execute yac-website-db --remote --file=migrations/seed/seed.sql
```
驗證：`npx wrangler d1 execute yac-website-db --remote --command "SELECT count(*) FROM products"` 應為 8679。

## 3. 設定 Secrets
Pages 專案 `yac-website`（Settings → Environment variables，或 `wrangler pages secret put`）：

| 名稱 | 值 |
| :--- | :--- |
| `ADMIN_AUTH_MODE` | `session`（或 `both`） |
| `ADMIN_USERNAME` | 管理員帳號 |
| `ADMIN_PASSWORD_HASH` | `npm run auth:hash -- "密碼"` 的輸出 |
| `SESSION_SECRET` | `openssl rand -hex 32` |

GitHub repo Secrets（供 `deploy.yml`；先把 `docs/workflows/*.yml` 複製到 `.github/workflows/`）：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`（Pages / D1 / R2 編輯權限）、`D1_DATABASE_ID`。

## 4. Preview 雙軌驗證
GitHub → Actions → **Deploy to Cloudflare Pages** → Run workflow（branch 預設 `preview`）。檢查：
- 首頁、各產品線型錄、搜尋（YAC / OEM / 車型）、最新產品。
- 舊網址 301：例如 `/cvj/toyota.html` → 新型錄頁（可抽查 `legacy_redirects` 內數十筆）。
- 舊圖片路徑（`/img/...`、`/pics/...`）仍可存取。
- `/admin` 登入、新增／修改／刪除產品、上傳圖片、CSV 匯出再匯入。
- 手機版版面。

## 5. 正式切換
1. 以 `branch=main` 執行部署（Pages 正式環境）；既有網域綁定於同一個 Pages 專案。
2. 注意：原本由其他 repo / workflow 部署的靜態站會被新部署取代，切換前請停用舊 workflow，避免互相覆蓋。
3. 觀察 Google Search Console 的轉址與 404；穩定後再移除 repo 內舊 `.html`。

## 6. 回滾
Cloudflare Pages → Deployments → 對上一個成功部署選「Rollback」。D1 資料變更以 `wrangler d1 export` 先備份：
`npx wrangler d1 export yac-website-db --remote --output=backup.sql`
