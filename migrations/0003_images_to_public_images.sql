-- 動態網站圖片改由 public/images/ 提供（網址 /images/<原相對路徑>），不再讀取 legacy/。
-- 將資料庫中舊風格的圖片路徑（/cvj/...、/accessories/... 等）加上 /images 前綴。
-- 可重複執行：已是 /images/ 或 /media/ 的資料不會被改動。

UPDATE products
SET primary_image_url = '/images' || primary_image_url
WHERE primary_image_url LIKE '/%'
  AND substr(primary_image_url, 2, instr(substr(primary_image_url, 2), '/') - 1) IN (
    '2005','2007','2009','2013','accessories','brakedisc','cv-joint','cvj','ds','flash','go',
    'hubs','img','Inboard_Joints','index','lockinghub','new-p','pics','steeringpump',
    'steeringrack','style','universal_joint','waterpump'
  );

UPDATE categories
SET cover_image = '/images' || cover_image
WHERE cover_image LIKE '/%'
  AND substr(cover_image, 2, instr(substr(cover_image, 2), '/') - 1) IN (
    '2005','2007','2009','2013','accessories','brakedisc','cv-joint','cvj','ds','flash','go',
    'hubs','img','Inboard_Joints','index','lockinghub','new-p','pics','steeringpump',
    'steeringrack','style','universal_joint','waterpump'
  );

UPDATE news_posts
SET cover_image_url = '/images' || cover_image_url
WHERE cover_image_url LIKE '/%'
  AND substr(cover_image_url, 2, instr(substr(cover_image_url, 2), '/') - 1) IN (
    'new-p','pics','img','accessories','cvj','hubs'
  );

UPDATE news_posts
SET content_html = replace(content_html, 'src="/new-p/', 'src="/images/new-p/')
WHERE content_html LIKE '%src="/new-p/%';

UPDATE site_pages
SET content_json = replace(content_json, '"/pics/', '"/images/pics/')
WHERE content_json LIKE '%"/pics/%';
