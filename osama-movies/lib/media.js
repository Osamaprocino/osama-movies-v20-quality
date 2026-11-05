/* معالجة الوسائط عبر ffmpeg (اختياري): جودات 360/720، صورة مصغّرة، شريط معاينة للتمرير، تحويل MOV/HEVC، استخراج الصوت.
   إذا لم يكن ffmpeg مثبتاً تعمل كل الدوال بشكل آمن وتُرجع null. */
const { execFile, spawnSync } = require('child_process');
const fs = require('fs');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
let available = null;
function isAvailable() {
  if (available === null) {
    try { available = spawnSync(FFMPEG, ['-version'], { timeout: 5000 }).status === 0 && spawnSync(FFPROBE, ['-version'], { timeout: 5000 }).status === 0; }
    catch { available = false; }
  }
  return available;
}

// طابور واحد في كل مرة حتى لا نستهلك المعالج
let chain = Promise.resolve();
const enqueue = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

function run(bin, args, timeout = 30 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => err ? reject(new Error((stderr || err.message).toString().split('\n').slice(-4).join(' '))) : resolve(stdout.toString()));
  });
}

async function probe(file) {
  if (!isAvailable()) return null;
  try {
    const out = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], 60000);
    const j = JSON.parse(out);
    const v = (j.streams || []).find(s => s.codec_type === 'video');
    const a = (j.streams || []).find(s => s.codec_type === 'audio');
    return {
      duration: Number(j.format && j.format.duration) || 0,
      container: String((j.format && j.format.format_name) || ''),
      vcodec: v ? v.codec_name : '', acodec: a ? a.codec_name : '', hasAudio: !!a,
      width: v ? v.width : 0, height: v ? v.height : 0
    };
  } catch { return null; }
}

// هل الملف يحتاج تحويلاً ليعمل في كل المتصفحات؟
function needsNormalize(info, file) {
  if (!info) return false;
  const okV = ['h264', 'vp8', 'vp9', 'av1'].includes(info.vcodec);
  const okA = !info.hasAudio || ['aac', 'mp3', 'opus', 'vorbis'].includes(info.acodec);
  const mp4ish = /mp4|webm|matroska/.test(info.container) && !/mov/.test(info.container.split(',')[0] || '');
  return !(okV && okA && (mp4ish || /\.webm$/i.test(file)));
}

function normalizeMp4(src, dst) {
  return enqueue(() => run(FFMPEG, ['-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', dst]));
}
function rendition(src, dst, height) {
  return enqueue(() => run(FFMPEG, ['-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0?', '-vf', `scale=-2:${height}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', dst]));
}
function posterFrame(src, dst, at = 1) {
  return enqueue(() => run(FFMPEG, ['-y', '-ss', String(at), '-i', src, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', dst], 120000));
}
/* شريط صور مصغّرة: كل `interval` ثانية صورة بعرض 160 داخل شبكة cols×rows */
async function sprite(src, dst, duration) {
  const interval = duration > 3600 ? 20 : duration > 900 ? 10 : 5;
  const frames = Math.max(1, Math.min(100, Math.ceil(duration / interval)));
  const cols = 10, rows = Math.ceil(frames / cols), w = 160;
  await enqueue(() => run(FFMPEG, ['-y', '-i', src, '-an', '-vf', `fps=1/${interval},scale=${w}:-2,tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '6', dst], 20 * 60 * 1000));
  const h = await (async () => { const i = await probe(dst); return i ? Math.round(i.height / rows) : Math.round(w * 9 / 16); })();
  return { cols, rows, w, h, interval, frames };
}
function extractAudio(src, dst) {
  return enqueue(() => run(FFMPEG, ['-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '32k', dst]));
}

module.exports = { isAvailable, probe, needsNormalize, normalizeMp4, rendition, posterFrame, sprite, extractAudio };
