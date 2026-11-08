/* lib/pwhash.js — v20: تجزئة كلمات المرور بـ Argon2id مع تراجع آمن إلى scrypt.
   • إن كانت مكتبة @node-rs/argon2 مثبّتة (optionalDependencies، يثبّتها npm install تلقائياً) تُنشأ كل التجزئات الجديدة بـ Argon2id
     (OWASP: m=19MiB, t=2, p=1) ويُخزَّن الحقل alg:'argon2id' والتجزئة بصيغة PHC.
   • إن لم تتوفر المكتبة يبقى السلوك كما كان تماماً (scrypt). السجلات القديمة (scrypt) تبقى صالحة وتُرقّى إلى Argon2id عند أول دخول ناجح.
   • لا يُسجَّل أي كلمة مرور أو تجزئة في السجلات. */
'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const scryptA = promisify(crypto.scrypt);
const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
let mod = null;
if (process.env.PWHASH_DISABLE_ARGON2 !== '1') { try { mod = require('@node-rs/argon2'); } catch { mod = null; } }
const OPTS = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };
const isArgon = rec => !!rec && (rec.alg === 'argon2id' || (typeof rec.hash === 'string' && rec.hash.startsWith('$argon2id$')));

const available = () => !!mod;
async function make(password) {
  if (mod) return { alg: 'argon2id', salt: '', hash: await mod.hash(password, OPTS) };
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: (await scryptA(password, salt, 64, SCRYPT_OPTS)).toString('hex') };
}
function makeSync(password) {
  if (mod) return { alg: 'argon2id', salt: '', hash: mod.hashSync(password, OPTS) };
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
async function check(password, rec) {
  try {
    if (!rec || typeof rec.hash !== 'string' || typeof password !== 'string') return false;
    if (isArgon(rec)) return mod ? !!(await mod.verify(rec.hash, password)) : false;
    const cand = await scryptA(password, rec.salt, 64, SCRYPT_OPTS);
    const want = Buffer.from(rec.hash, 'hex');
    return want.length === cand.length && crypto.timingSafeEqual(cand, want);
  } catch { return false; }
}
function checkSync(password, rec) {
  try {
    if (!rec || typeof rec.hash !== 'string' || typeof password !== 'string') return false;
    if (isArgon(rec)) return mod ? !!mod.verifySync(rec.hash, password) : false;
    const cand = crypto.scryptSync(password, rec.salt, 64);
    const want = Buffer.from(rec.hash, 'hex');
    return want.length === cand.length && crypto.timingSafeEqual(cand, want);
  } catch { return false; }
}
/* يكتب نتيجة make() على سجل مستخدم (ويحذف alg عند scrypt) */
function apply(rec, h) { rec.salt = h.salt; rec.hash = h.hash; if (h.alg) rec.alg = h.alg; else delete rec.alg; return rec; }
const needsUpgrade = rec => !!mod && !isArgon(rec);
let dummy = null;
async function dummyCheck(password) { if (!dummy) dummy = await make(crypto.randomBytes(24).toString('hex')); return check(password, dummy); }
const info = () => ({ argon2: !!mod, algorithm: mod ? 'argon2id' : 'scrypt' });
module.exports = { available, make, makeSync, check, checkSync, apply, needsUpgrade, dummyCheck, info, isArgon };
