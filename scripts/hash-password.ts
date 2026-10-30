// 產生後台管理員密碼雜湊：npm run auth:hash -- "你的密碼"
// 輸出的字串請放入 ADMIN_PASSWORD_HASH（.dev.vars 或 wrangler secret put ADMIN_PASSWORD_HASH）。
import { hashPassword } from '../src/lib/auth';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('用法：npm run auth:hash -- "<至少 8 字元的密碼>"');
  process.exit(1);
}
console.log(await hashPassword(pw));
