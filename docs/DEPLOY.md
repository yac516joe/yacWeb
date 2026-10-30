# 上線手冊（Phase 5）

> 前置：已取得 Cloudflare 帳號權限，並在本機執行過 `npx wrangler login`（或使用 API Token）。以下指令在專案根目錄執行；Windows ARM64 請用 x64 Node。

## 1. 建立 Cloudflare 資源
```bash
npx wrangler d1 create yac-website-db        # 已建立；database_id 已寫入 wrangler.toml（非機密，可提交）
npx wrangler r2 bucket create yac-website-media
```
- **R2**：已啟用並建立 bucket `yac-website-media`，由 `wrangler.toml` 的 `[[r2_buckets]]` 綁定。若未綁定 R2，圖片會改存 D1 `media_blobs`（migration `0002`，單檔 ≤ 1 MB）。
- **D1 免費版每日寫入上限**：匯入 seed（約 2.8 萬列＋索引）會用掉當日額度，額度用盡時所有寫入（上傳、後台編輯）會失敗，UTC 午夜重置；登入的稽核 / 頻率紀錄為 best-effort，不會讓登入失敗。正式上線時應避免當日重複全量匯入。
- 使用 `wrangler.toml` 時，Pages 不讀取 Dashboard 的明文變數；`ADMIN_AUTH_MODE`、`ADMIN_USERNAME` 寫在 `wrangler.toml` 的 `[vars]`，機密（`ADMIN_PASSWORD_HASH`、`SESSION_SECRET`）才用 Secret 設定。

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
| `ADMIN_AUTH_MODE` | `session`（或 `both`；已在 `wrangler.toml [vars]`） |
| `ADMIN_USERNAME` | 管理員帳號（已在 `wrangler.toml [vars]`） |
| `ADMIN_PASSWORD_HASH` | `npm run auth:hash -- "密碼"` 的輸出 |
| `SESSION_SECRET` | `openssl rand -hex 32` |

GitHub repo Secrets（供 `deploy.yml`；先把 `docs/workflows/*.yml` 複製到 `.github/workflows/`）：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`（Pages / D1 / R2 編輯權限）。

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
