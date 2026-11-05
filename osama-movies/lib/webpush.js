/* Web Push بدون مكتبات: مفاتيح VAPID (ES256) + تشفير الحمولة RFC 8291 (aes128gcm). */
const crypto = require('crypto');
const fs = require('fs');

const b64u = b => Buffer.from(b).toString('base64url');
const fromB64u = s => Buffer.from(String(s), 'base64url');

function loadVapid(file) {
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); if (j.publicKey && j.privateJwk) return j; } catch {}
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const pub = Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]);
  const v = { publicKey: b64u(pub), privateJwk: privateKey.export({ format: 'jwk' }) };
  fs.writeFileSync(file, JSON.stringify(v), { mode: 0o600 });
  return v;
}

function vapidJwt(vapid, audience, subject) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: vapid.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64u(sig)}`;
}

const hkdf = (ikm, salt, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

function encrypt(sub, payload) {
  const uaPub = fromB64u(sub.keys.p256dh), auth = fromB64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPub);
  const ikm = hkdf(secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, data]);
}

/* للاختبار: فك التشفير من جهة المتلقي */
function decrypt(body, uaPrivateEcdh, uaPub, auth) {
  const salt = body.subarray(0, 16), idlen = body[20], asPub = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const secret = uaPrivateEcdh.computeSecret(asPub);
  const ikm = hkdf(secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  d.setAuthTag(data.subarray(data.length - 16));
  const out = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  return out.subarray(0, out.lastIndexOf(2)).toString('utf8');
}

async function send(vapid, sub, payload, { subject = 'mailto:admin@localhost', ttl = 86400 } = {}) {
  const url = new URL(sub.endpoint);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal',
      Authorization: `vapid t=${vapidJwt(vapid, url.origin, subject)}, k=${vapid.publicKey}`
    },
    body: encrypt(sub, JSON.stringify(payload)), signal: AbortSignal.timeout(15000)
  });
  return { status: r.status, gone: r.status === 404 || r.status === 410 };
}

module.exports = { loadVapid, send, encrypt, decrypt, vapidJwt };
