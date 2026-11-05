/* إرسال بريد عبر SMTP مباشرة (بدون أي مكتبة خارجية).
   الإعداد عبر متغيرات البيئة: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE=true (للمنفذ 465)
   إذا لم يُضبط SMTP_HOST يعمل النظام بوضع التطوير: يطبع الرسالة في سجل الخادم ولا يرسل شيئاً. */
const net = require('net');
const tls = require('tls');
const os = require('os');

const configured = () => !!process.env.SMTP_HOST;

function b64(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function encodeHeader(s) { return /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`; }

function buildMessage({ from, to, subject, text, html }) {
  const boundary = '=_b' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const wrap = s => b64(s).replace(/(.{76})/g, '$1\r\n');
  const head = [
    `From: ${from}`, `To: ${to}`, `Subject: ${encodeHeader(subject)}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${os.hostname()}>`, 'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ].join('\r\n');
  const parts = [
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(text || '')}`,
    html ? `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap(html)}` : '',
    `--${boundary}--`
  ].filter(Boolean).join('\r\n');
  return head + '\r\n\r\n' + parts + '\r\n';
}

function smtpSend(opts) {
  const host = process.env.SMTP_HOST, port = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587));
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const fromAddr = (process.env.SMTP_FROM || user || 'no-reply@localhost');
  const bare = a => (String(a).match(/<([^>]+)>/) || [null, a])[1].trim();

  return new Promise((resolve, reject) => {
    let sock, buf = '', waiter = null, done = false;
    const fail = e => { if (done) return; done = true; try { sock && sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('SMTP timeout')), 20000);
    const finish = v => { if (done) return; done = true; clearTimeout(timer); try { sock.end(); } catch {} resolve(v); };

    const onData = d => {
      buf += d.toString('utf8');
      // رد كامل = سطر أخير يبدأ بـ "XYZ " (بدون شرطة)
      const lines = buf.split(/\r?\n/);
      if (lines.length > 1 && lines[lines.length - 1] === '') {
        const last = lines[lines.length - 2];
        if (/^\d{3} /.test(last) || /^\d{3}$/.test(last)) {
          const text = buf; buf = '';
          if (waiter) { const w = waiter; waiter = null; w(text); }
        }
      }
    };
    const read = () => new Promise(res => { waiter = res; });
    const code = r => Number(String(r).trim().slice(0, 3));
    const cmd = async (line, ok) => {
      sock.write(line + '\r\n');
      const r = await read();
      if (ok && !ok.includes(code(r))) throw new Error('SMTP: ' + r.trim().split('\n').pop());
      return r;
    };
    const attach = s => { sock = s; s.on('data', onData); s.on('error', fail); s.on('close', () => { if (!done) fail(new Error('SMTP closed')); }); };

    (async () => {
      const connect = () => new Promise((res, rej) => {
        const s = secure ? tls.connect({ host, port, servername: host }, () => res(s)) : net.connect({ host, port }, () => res(s));
        s.once('error', rej);
      });
      attach(await connect());
      let g = await read(); if (code(g) !== 220) throw new Error('SMTP greeting: ' + g.trim());
      const name = os.hostname() || 'localhost';
      let ehlo = await cmd(`EHLO ${name}`, [250]);
      if (!secure && /STARTTLS/i.test(ehlo)) {
        await cmd('STARTTLS', [220]);
        sock.removeAllListeners('data'); sock.removeAllListeners('close'); sock.removeAllListeners('error');
        const raw = sock;
        const up = await new Promise((res, rej) => { const s = tls.connect({ socket: raw, servername: host }, () => res(s)); s.once('error', rej); });
        attach(up);
        ehlo = await cmd(`EHLO ${name}`, [250]);
      }
      if (user) {
        if (/AUTH[^\n]*PLAIN/i.test(ehlo)) await cmd('AUTH PLAIN ' + b64(`\0${user}\0${pass}`), [235]);
        else { await cmd('AUTH LOGIN', [334]); await cmd(b64(user), [334]); await cmd(b64(pass), [235]); }
      }
      await cmd(`MAIL FROM:<${bare(fromAddr)}>`, [250]);
      await cmd(`RCPT TO:<${bare(opts.to)}>`, [250, 251]);
      await cmd('DATA', [354]);
      const msg = buildMessage({ ...opts, from: fromAddr }).replace(/^\./gm, '..');
      sock.write(msg + '\r\n.\r\n');
      const r = await read(); if (code(r) !== 250) throw new Error('SMTP data: ' + r.trim());
      try { sock.write('QUIT\r\n'); } catch {}
      finish({ sent: true });
    })().catch(fail);
  });
}

async function sendMail(opts) {
  if (!configured()) {
    console.log(`[mail:dev] إلى ${opts.to} | ${opts.subject}\n${opts.text}\n`);
    return { sent: false, dev: true };
  }
  try { return await smtpSend(opts); }
  catch (e) { console.error('[mail] فشل الإرسال:', e.message); return { sent: false, error: e.message }; }
}

module.exports = { sendMail, configured };
