const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ADMIN_FILE = path.join(__dirname, 'admin.json');
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
async function main() {
  const [, , argUser, argPassword] = process.argv;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(resolve => rl.question(q, resolve));
  const username = (argUser || await ask('اسم مستخدم الأدمن: ')).trim();
  const password = argPassword || await ask('كلمة مرور الأدمن: ');
  rl.close();
  if (!username || !password || password.length < 8) {
    console.error('يجب إدخال اسم مستخدم وكلمة مرور من 8 أحرف على الأقل.');
    process.exit(1);
  }
  const { salt, hash } = hashPassword(password);
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({
    username, salt, hash, createdAt: new Date().toISOString()
  }, null, 2), { encoding: 'utf8', mode: 0o600 });
  console.log(`تم إعداد حساب الأدمن بنجاح: ${username}`);
  console.log('الآن شغّل: npm start');
}
main().catch(err => { console.error(err); process.exit(1); });
