# AGENTS.md — YAC 網站動態化專案協作指南

> 本文件供所有參與 `yacWeb` / `yac-website`（`www.yac.com.tw`）專案的開發者與 AI 助理（Agents）共同遵守。每次完成階段性任務後，請同步更新底部的「目前進度與待辦清單」。

---

## 1. 專案背景與架構說明

- **網站名稱**：YAC 華佑科技 / 永源汽車零件公司官方網站（`www.yac.com.tw`）
- **改造目標**：將原本純靜態 HTML 網站（11 大汽車傳動與底盤零件產品線、547 個 `.html` 頁面、7,840+ 張產品圖）升級為具備資料庫與後台管理系統（CMS）的全站繁體中文動態網站。
- **核心技術棧（Cloudflare 免費方案優先）**：
  - **框架**：Astro 5（SSR Server Output + `@astrojs/cloudflare` Adapter）+ 原生 CSS 設計系統 + Preact Islands（後台高互動介面）
  - **資料庫**：Cloudflare D1（SQLite），以原生 prepared statements + 薄型別查詢層存取（未使用 Drizzle）
  - **圖片與媒體儲存**：靜態歷史圖檔保留原路徑相容，新增/修改圖片儲存於 Cloudflare R2（或 Pages Assets）
  - **後台驗證**：支援 Cloudflare Access（Zero Trust）與內建環境變數帳密 + Signed Session Cookie（密碼雜湊存於環境變數/Secrets，絕不硬編碼於程式中）
- **目錄結構規範**：
  - `docs/PLAN.md`：系統架構、D1 資料表設計、UI 格式參考、資料匯入與上線計畫
  - `migrations/`：Cloudflare D1 SQL 結構遷移檔（依序命名如 `0001_initial_schema.sql`）
  - `scripts/`：舊版靜態 HTML 自動解析與匯入 D1 之腳本、密碼雜湊工具
  - `src/`、`public/`、`integrations/`、`tests/`：動態網站原始碼（Astro）、靜態資源、舊站資產整合、單元測試
  - `legacy/`：舊靜態網站封存（所有 `.html` 與圖片 / CAD / PDF，已用 `git mv` 保留歷史）。`scripts/migrate-legacy-html.ts` 只讀此資料夾來重新解析匯入；建置時 `integrations/legacy-assets.mjs` 僅把其中的非 HTML 資產複製回原網址路徑，舊 `.html` 由 301 轉址取代

---

## 2. 協作規則（Multi-Agent Collaboration Rules）

1. **禁止直接推送至 `main` 分支**：
   - 每個功能或階段必須建立獨立分支（例如 `docs/phase1-architecture-plan`、`feat/d1-schema-and-migration`、`feat/public-catalog`、`feat/admin-cms`）並發起 Pull Request (PR)。
   - PR 說明必須清楚記載：**改了什麼 (What Changed)**、**如何測試 (How to Test)**、**資料庫或環境變數變更**。
2. **金鑰與機密管理**：
   - 所有金鑰、密碼雜湊與 Session Secret 僅能透過環境變數（本機 `.dev.vars` / `.env`、雲端 GitHub Secrets / `wrangler secret`）注入。
   - 新增任何環境變數時，必須同步將變數名稱與說明列於根目錄 `.env.example`。
3. **資料庫變更規範**：
   - 所有 D1 資料表結構變更一律透過 `migrations/` 資料夾下的 SQL 遷移檔管理，嚴禁手動修改線上 D1 資料庫。
4. **舊站零中斷原則**：
   - 舊 `.html` 與圖片已封存於 `legacy/`，不得刪除；所有既有圖片網址須持續可用（由建置複製），既有 `.html` 網址須 301。正式站目前仍由 `main` 的舊靜態檔提供，切換前勿動 `main`。
   - 所有既有 `.html` 網址必須保留或設定 301 轉址（詳見 `docs/PLAN.md` 第七節），確保 Google SEO 收錄不失效。

---

## 3. 常用指令（Commands）

> 需要 Node 20+（建議 22 LTS）。**Windows ARM64 請改用 x64 版 Node**（workerd 沒有 ARM64 Windows 版本）。

```bash
# 1. 安裝相依套件
npm install

# 2. 建立本機機密：複製範本並產生密碼雜湊
cp .env.example .dev.vars          # PowerShell：Copy-Item .env.example .dev.vars
npm run auth:hash -- "你的密碼"     # 輸出 ADMIN_PASSWORD_HASH，貼入 .dev.vars

# 3. 建立本機 D1：套用 migrations → 解析舊 HTML → 匯入（約 1 分鐘）
npm run db:seed:local
#    （僅重新解析舊站：npm run db:import:legacy，輸出 docs/MIGRATION_REPORT.md）

# 4. 啟動本機開發伺服器（Astro dev + 本機 D1 / R2 模擬）
npm run dev                         # 前台 http://localhost:4321、後台 /admin

# 5. 型別檢查與單元測試
npm run check
npm test

# 6. 建置（同時把舊站圖片 / CAD / PDF 複製進 dist/，舊 .html 不會被部署）
npm run build
npm run preview                     # wrangler pages dev dist

# 7. 遠端 D1 migration 與部署（正式資源建立後；通常由 GitHub Actions 執行）
npm run db:migrate:remote
npm run deploy
```

### 架構摘要（Phase 2–4 實作結果）

- `src/pages/`：前台（`index`、`catalog/[category]/[slug]`、`search`、`news/*`、`about`、`contact`、`inquiry`）、後台（`admin/**`）、API（`api/search`、`api/csv`、`api/admin/**`）、R2 圖片出口（`media/[...key]`）。
- `src/middleware.ts`：舊 `.html` 網址 301（查 D1 `legacy_redirects`）、`/api/*` 非 GET 的 Origin（CSRF）檢查、`/admin/*` 與 `/api/admin/*` 驗證守衛（後台回應一律 `no-store` + `noindex`）。
- `src/lib/`：`db`（D1 輔助）、`queries`（讀取層）、`columns` / `table`（型錄表格欄位邏輯）、`auth`（PBKDF2 密碼、HMAC Session、Cloudflare Access JWT、登入限流）、`admin-*`（後台資源註冊、CRUD、產品 / CSV 匯入）。
- **核心抽象 `catalog_pages`**：一列＝舊站一張規格表；`columns_json` 定義欄位順序，每欄的 `source` 為 `yac | yac_left | photo | remark | app.<欄> | ref.<類型> | spec.<鍵>`。產品規格存於 `products.specs_json`（鍵為小寫），車款與 OEM / 對照號另存子表。新增型錄頁＝新增一列＋定義欄位，無需改程式。
- `src/islands/`：Preact islands（`Inquiry`；`admin/*` 的表單、產品編輯器、圖片庫、CSV 匯入）。
- 樣式：`src/styles/global.css`（前台）、`admin.css`（後台）；設計定案見 `docs/PLAN.md` §3.0（淺色工業藍、零圓角）。
- 與 PLAN 初稿的差異：以原生 D1 prepared statements + 薄型別層取代 Drizzle；Session 為無狀態簽章 Cookie（8 小時）；詢價採 localStorage 詢價單 + `mailto:`（不另存資料庫）。
- 後台 CSV：每筆適用車款一列，依 YAC 料號 upsert，不刪除；單次上限 200 個產品（免費方案 subrequest 限制）。
- `news_posts.content_html` 輸出前經 `src/lib/sanitize.ts` 白名單過濾（基本排版標籤、安全連結／圖片）。

---

## 4. 需要的環境變數（Environment Variables）

所有環境變數範本定義於 `.env.example`（本機開發請複製為 `.dev.vars`）：

| 變數名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| `CLOUDFLARE_ACCOUNT_ID` | CI/CD | Cloudflare 帳戶 ID（供 GitHub Actions 部署與 D1 Migration 使用） |
| `CLOUDFLARE_API_TOKEN` | CI/CD | Cloudflare API Token（需具備 Pages、D1、R2 權限） |
| `D1_DATABASE_ID` | 選填 | D1 UUID，僅供參考；實際值已寫入 `wrangler.toml` binding `DB`（非機密） |
| `R2_BUCKET_NAME` | 選填 | Cloudflare R2 Bucket 名稱（預設 `yac-website-media`，對應 binding `MEDIA_BUCKET`） |
| `PUBLIC_MEDIA_BASE_URL` | 選填 | 產品圖片公開 CDN / R2 基礎網址（未設定時預設使用站內相對路徑） |
| `ADMIN_AUTH_MODE` | 是 | 後台驗證模式：`session`（內建帳密 Session）、`cf_access`（Cloudflare Access）或 `both` |
| `ADMIN_USERNAME` | 是 | 後台預設管理員帳號名稱（不可寫死於程式碼） |
| `ADMIN_PASSWORD_HASH` | 是 | 後台管理員密碼之 PBKDF2 / SHA-256 雜湊值（不可存明文密碼） |
| `SESSION_SECRET` | 是 | 用於簽署後台 HttpOnly Session Cookie 之至少 32 字元隨機金鑰 |
| `CF_ACCESS_TEAM_DOMAIN` | 選填 | 若啟用 Cloudflare Access，填寫 Team Domain（如 `https://yac.cloudflareaccess.com`） |
| `CF_ACCESS_AUD` | 選填 | 若啟用 Cloudflare Access，填寫 Application Audience (AUD) Tag |

---

## 5. 目前進度與待辦清單（Progress & Todo）

### 已完成 (Completed)
- [x] **Phase 1：網站現況盤點與系統規劃**
  - [x] 完成現有 547 個 `.html` 靜態頁面、11 大產品線與 11 種零配件表格結構分析。
  - [x] 產出 `docs/PLAN.md`（含 Mermaid 架構圖、D1 ER 圖與資料表設計、前後台 UI 格式參考、舊資料自動匯入流程、547 個舊網址 301 轉址策略、分階段上線步驟）。
  - [x] 建立 `AGENTS.md` 與 `.env.example`。

- [x] **Phase 2：專案骨幹與資料庫**（Astro 5 + Wrangler、`migrations/0001_initial_schema.sql`、`scripts/migrate-legacy-html.ts`）
  - 匯入結果：547 個 HTML、99 車廠、395 型錄頁、8,679 產品、7,759 適用車款、10,974 對照號、547 筆 301 轉址，0 警告（`docs/MIGRATION_REPORT.md`）。
- [x] **Phase 3：前台**（首頁、11 大產品線型錄、規格表、搜尋、最新產品、公司簡介、聯絡、詢價單、404、舊網址 301）
- [x] **Phase 4：後台 CMS**（帳密 Session / Cloudflare Access、產品與規格 CRUD、型錄頁 / 產品線 / 車廠 / 消息 / 站內頁面管理、R2 圖片庫、CSV 匯入匯出、操作紀錄）
- [x] 型別檢查（`astro check`）0 錯誤；單元測試（`npm test`）通過；`npm run build` 成功。

### 待辦事項 (Backlog / Next Steps)
- [ ] **Phase 5：Staging 驗證與正式切換**（步驟見 `docs/DEPLOY.md`；工作流程範本在 `docs/workflows/{ci,deploy}.yml`，因推送權杖無 `workflow` 權限，需有權限者複製到 `.github/workflows/`）
  - [x] 建立遠端 D1 `yac-website-db`（UUID 已寫入 `wrangler.toml`），已設定 Preview 環境的 `ADMIN_PASSWORD_HASH` / `SESSION_SECRET` secrets。
  - [x] R2 已啟用、bucket `yac-website-media` 已建立並綁定（`wrangler.toml`）；未綁定 R2 時圖片改存 D1 `media_blobs`（migration `0002`，單檔 1 MB）。
  - [ ] 驗證圖片上傳 → 讀取 → 刪除完整流程（Preview 受 D1 免費版「每日寫入列數」上限阻擋，匯入 seed 已用完當日額度；UTC 午夜重置後再測）。
  - [ ] 設定 Production secrets（`ADMIN_PASSWORD_HASH`、`SESSION_SECRET`）。
  - [x] 套用遠端 migration 並匯入 seed（products 8679、applications 7759、cross_refs 10840、redirects 547、catalog_pages 395、news 3）。8 個缺圖（見遷移報告）仍待補齊或移除。
  - [x] 已手動部署 Preview：`https://preview.yac-website.pages.dev`（`--branch=preview`；首頁 / 型錄 / 搜尋 / 舊網址 301 / 舊圖片 / 後台登入皆通過）。
  - [ ] 把 `docs/workflows/*.yml` 複製到 `.github/workflows/`（需 `workflow` 權限），並比對舊站搜尋結果。
  - [ ] 驗證後切換正式網域；觀察 Search Console 的轉址與 404。舊靜態 `.html` 於穩定後再移除。
  - [ ] 視需要：詢價單寄信（Email Worker / 第三方）、Cloudflare Access 保護 `/admin`。
