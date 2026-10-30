# AGENTS.md — YAC 網站動態化專案協作指南

> 本文件供所有參與 `yacWeb` / `yac-website`（`www.yac.com.tw`）專案的開發者與 AI 助理（Agents）共同遵守。每次完成階段性任務後，請同步更新底部的「目前進度與待辦清單」。

---

## 1. 專案背景與架構說明

- **網站名稱**：YAC 華佑科技 / 永源汽車零件公司官方網站（`www.yac.com.tw`）
- **改造目標**：將原本純靜態 HTML 網站（11 大汽車傳動與底盤零件產品線、547 個 `.html` 頁面、7,840+ 張產品圖）升級為具備資料庫與後台管理系統（CMS）的全站繁體中文動態網站。
- **核心技術棧（Cloudflare 免費方案優先）**：
  - **框架**：Astro 5（SSR Server Output + `@astrojs/cloudflare` Adapter）+ Tailwind CSS + Preact/React Islands（後台高互動介面）
  - **資料庫**：Cloudflare D1（SQLite）+ Drizzle ORM
  - **圖片與媒體儲存**：靜態歷史圖檔保留原路徑相容，新增/修改圖片儲存於 Cloudflare R2（或 Pages Assets）
  - **後台驗證**：支援 Cloudflare Access（Zero Trust）與內建環境變數帳密 + Signed Session Cookie（密碼雜湊存於環境變數/Secrets，絕不硬編碼於程式中）
- **目錄結構規範**：
  - `docs/PLAN.md`：系統架構、D1 資料表設計、UI 格式參考、資料匯入與上線計畫
  - `migrations/`：Cloudflare D1 SQL 結構遷移檔（依序命名如 `0001_initial_schema.sql`）
  - `scripts/`：舊版靜態 HTML 自動解析與匯入 D1 之腳本
  - `site/`（或根目錄既有靜態 HTML 資料夾）：**在新版正式切換上線前必須保持原狀不動，確保正式網站不中斷**

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
   - 新版正式上線前，不得刪除或破壞既有靜態 HTML 與圖片檔案。
   - 所有既有 `.html` 網址必須保留或設定 301 轉址（詳見 `docs/PLAN.md` 第七節），確保 Google SEO 收錄不失效。

---

## 3. 常用指令（Commands）

> *註：Phase 1 為純規劃階段，以下指令將於 Phase 2 初始化 Astro + Wrangler 專案結構後生效。*

```bash
# 1. 安裝相依套件
npm install

# 2. 套用本機 D1 資料庫 Migrations
npx wrangler d1 migrations apply yac-website-db --local

# 3. 執行舊版 HTML 解析並匯入本機 D1 資料庫
npm run db:seed:local

# 4. 啟動本機開發伺服器 (含 Cloudflare Pages / D1 / R2 本地模擬)
npm run dev

# 5. 執行型別檢查、單元測試與轉址連結檢查
npm run check
npm test

# 6. 建置生產環境版本
npm run build

# 7. 部署至 Cloudflare Pages (通常由 GitHub Actions 自動執行)
npx wrangler pages deploy dist --project-name=yac-website
```

---

## 4. 需要的環境變數（Environment Variables）

所有環境變數範本定義於 `.env.example`（本機開發請複製為 `.dev.vars`）：

| 變數名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| `CLOUDFLARE_ACCOUNT_ID` | CI/CD | Cloudflare 帳戶 ID（供 GitHub Actions 部署與 D1 Migration 使用） |
| `CLOUDFLARE_API_TOKEN` | CI/CD | Cloudflare API Token（需具備 Pages、D1、R2 權限） |
| `D1_DATABASE_ID` | 是 | Cloudflare D1 資料庫 UUID（亦對應 `wrangler.toml` binding `DB`） |
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

### 待辦事項 (Backlog / Next Steps)
- [ ] **Phase 2：專案初始化與資料庫建置**
  - [ ] 與環境設定 Agent 協同確認儲存庫目錄結構（`site/` vs 根目錄靜態檔）與 Cloudflare D1 / Pages 綁定。
  - [ ] 建立 Astro + Drizzle + Wrangler 專案結構與 `migrations/0001_initial_schema.sql`。
  - [ ] 撰寫並執行 `scripts/migrate-legacy-html.ts`，將舊 HTML 產品與規格匯入 D1 並產出筆數核對報告。
- [ ] **Phase 3：前台型錄與搜尋系統開發**
  - [ ] 實作全站繁體中文前台（首頁、11 大產品線、車廠規格表、圖片 Lightbox、最新產品、公司簡介）。
  - [ ] 實作跨類別智慧搜尋（YAC No. / OEM No. / Spicer·GMB 號 / 車型）與舊網址 301 轉址。
- [ ] **Phase 4：後台管理系統（CMS）開發**
  - [ ] 實作後台登入驗證、產品與規格 CRUD、R2 圖片上傳、CSV 批次匯入匯出與操作稽核紀錄。
- [ ] **Phase 5：整合測試與正式上線切換**
