/* قراءة ملفات الترجمة SRT / VTT وتحويلها إلى مقاطع زمنية منظّمة */

function decodeBuffer(buf) {
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) buf = buf.subarray(3);
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  let txt = new TextDecoder('utf-8').decode(buf);
  if (!txt.includes('�')) return txt;
  // ملفات الترجمة القديمة غالباً بترميز Windows-1256 (عربي) أو Windows-1251 (روسي)
  const score = (s, re) => (s.match(re) || []).length;
  let best = txt, bestScore = -1;
  for (const [enc, re] of [['windows-1256', /[ء-ي]/g], ['windows-1251', /[а-яА-Я]/g], ['windows-1252', /[A-Za-z]/g]]) {
    try {
      const s = new TextDecoder(enc).decode(buf);
      const sc = score(s, re);
      if (sc > bestScore) { bestScore = sc; best = s; }
    } catch { /* الترميز غير مدعوم */ }
  }
  return best;
}

function parseTime(str) {
  const m = String(str).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + ms / 1000;
}

function cleanText(t) {
  return t
    .replace(/\{\\[^}]*\}/g, '')          // وسوم ASS مثل {\an8}
    .replace(/<\/?(?:i|b|u|s|font|c|v|ruby|rt|lang)[^>]*>/gi, '')
    .replace(/<\d{1,2}:\d{2}[:.\d]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

const MAX_CUES = 20000;

function parseSubtitles(text) {
  text = String(text).replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const blocks = text.split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const [a, rest] = lines[i].split('-->');
    const b = String(rest || '').trim().split(/\s+/)[0];
    const s = parseTime(a), e = parseTime(b);
    if (s === null || e === null || e <= s) continue;
    const t = cleanText(lines.slice(i + 1).join('\n'));
    if (!t) continue;
    cues.push({ s: Math.round(s * 1000) / 1000, e: Math.round(e * 1000) / 1000, t });
    if (cues.length >= MAX_CUES) break;
  }
  cues.sort((x, y) => x.s - y.s);
  return cues;
}

module.exports = { decodeBuffer, parseSubtitles, parseTime, cleanText };
