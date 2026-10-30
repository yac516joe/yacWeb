-- 未綁定 R2 時的圖片備援儲存（base64 文字；D1 單列上限約 2 MB，故上傳限制 1 MB）
CREATE TABLE media_blobs (
  storage_key TEXT PRIMARY KEY,
  mime_type   TEXT NOT NULL,
  data_b64    TEXT NOT NULL
);
