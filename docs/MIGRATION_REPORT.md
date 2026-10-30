# 舊站資料匯入核對報告

> 由 `npm run db:import:legacy`（`scripts/migrate-legacy-html.ts`）自動產生。

- 舊站 `.html` 檔案總數：**547**
- 301 轉址對照筆數：**547**（✅ 與 .html 檔案數一致）
- 匯入品牌數：**99**，型錄頁：**395**

## 各產品線筆數核對

| 產品線 | 型錄頁 | 產品 | 適用車款列 | 對照料號 | 舊表資料列 | 解析後列數 | 核對 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| 等速接頭 (cvj) | 74 | 2190 | 2747 | 4 | 3179 | 3179 | ✅ |
| 傳動軸 (ds) | 46 | 883 | 783 | 572 | 907 | 907 | ✅ |
| 十字軸／萬向接頭 (universal-joint) | 53 | 728 | 315 | 2184 | 1128 | 1128 | ✅ |
| 轉向機 (steering-rack) | 61 | 622 | 587 | 1016 | 622 | 622 | ✅ |
| 零配件 (accessories) | 13 | 1721 | 958 | 0 | 1721 | 1721 | ✅ |
| 內側接頭 (inboard-joint) | 40 | 645 | 533 | 0 | 662 | 662 | ✅ |
| 輪轂 (hubs) | 43 | 1101 | 1096 | 4450 | 1101 | 1101 | ✅ |
| 四輪傳動鎖定輪轂 (locking-hub) | 6 | 30 | 30 | 34 | 30 | 30 | ✅ |
| 動力轉向泵 (steering-pump) | 33 | 510 | 461 | 1780 | 510 | 510 | ✅ |
| 水泵 (water-pump) | 7 | 55 | 55 | 109 | 55 | 55 | ✅ |
| 煞車碟盤 (brake-disc) | 19 | 194 | 194 | 825 | 194 | 194 | ✅ |
| **合計** | **395** | **8679** | **7759** | **10974** | | | |

「舊表資料列」為舊站表格中被判定為資料的列數（排除標題列、車系分隔列、圖片列、空列）；「解析後列數」為所有產品與其適用車款所涵蓋的列數，兩者應相等。

## 舊站為 404 / 無資料表的頁面（16）

- universal_joint/NISSAN01.html（無資料表）
- lockinghub/benz.html（舊站 404）
- lockinghub/chrysler.html（無資料表）
- lockinghub/daihatsu.html（無資料表）
- lockinghub/ford.html（無資料表）
- lockinghub/lincoln.html（舊站 404）
- lockinghub/mazda.html（無資料表）
- steeringpump/Scania.html（無資料表）
- steeringpump/Tata.html（無資料表）
- waterpump/opel.html（無資料表）
- waterpump/peugeot.html（無資料表）
- waterpump/skoda.html（無資料表）
- waterpump/volvo.html（無資料表）
- brakedisc/BYD.html（無資料表）
- brakedisc/Rover.html（無資料表）
- brakedisc/Volvo.html（無資料表）

## 找不到的圖片（8）

- `cvj/new/HONDA.html`：HA-92.jpg
- `steeringrack/(Toyota.html`：(TA-041-SNR.jpg
- `steeringrack/Haffi.html`：MI-012-SNL.jpg
- `accessories/Inboard_Joints/inboard-joints-list.html`：images/inboard/2007TJ/t-j2.jpg
- `hubs/Other.html`：Hubs/YC-002-WH.jpg、Hubs/YC-013-WH.jpg、Hubs/YC-014-WH.jpg、Hubs/YC-015-WH.jpg

## 圖片路徑大小寫已修正（452）

舊 HTML 引用的檔名大小寫與實際檔案不同（Windows 不分大小寫，Cloudflare 區分），匯入時已改為實際檔名。前 15 筆範例：

- accessories/absring.html → /accessories/images/abs/AB0146.jpg
- accessories/absring.html → /accessories/images/abs/AB0172.jpg
- accessories/absring.html → /accessories/images/abs/AB6002.jpg
- accessories/absring.html → /accessories/images/abs/AB0201.jpg
- accessories/absring.html → /accessories/images/abs/AB0156.jpg
- accessories/absring.html → /accessories/images/abs/AB0157.jpg
- accessories/absring.html → /accessories/images/abs/AB6001.jpg
- accessories/absring.html → /accessories/images/abs/AB0135.jpg
- accessories/absring.html → /accessories/images/abs/AB0186.jpg
- accessories/absring.html → /accessories/images/abs/AB0217.jpg
- accessories/absring.html → /accessories/images/abs/AB0131.jpg
- accessories/absring.html → /accessories/images/abs/AB0151.jpg
- accessories/absring.html → /accessories/images/abs/AB0152.jpg
- accessories/absring.html → /accessories/images/abs/AB0153.jpg
- accessories/absring.html → /accessories/images/abs/AB0165.jpg

## 解析警告（0）

