const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pickLang, tr, translateArabicError } = require('./lib/i18n-server');
const { decodeBuffer, parseSubtitles } = require('./lib/subtitles');
const translator = require('./lib/translate');

const app = express();
const ext = {}; // خطافات الإضافات (lib/v10.js) — تبقى فارغة الأثر إن لم تُسجَّل
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const UPLOADS = path.join(ROOT, 'uploads');
const DATA_DIR = path.join(ROOT, 'data');
const MOVIES_FILE = path.join(DATA_DIR, 'movies.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
const ADMIN_FILE = path.join(ROOT, 'admin.json');
const PRIVATE_DIR = path.join(DATA_DIR, 'private');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const USER_SESSIONS_FILE = path.join(DATA_DIR, 'user-sessions.json');
const SHORTS_FILE = path.join(DATA_DIR, 'shorts.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');
const SOCIAL_FILE = path.join(DATA_DIR, 'social.json');
const SUBS_DIR = path.join(DATA_DIR, 'subtitles');
const SHORTS_DIR = path.join(UPLOADS, 'shorts');
const AVATARS_DIR = path.join(UPLOADS, 'avatars');

fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });
fs.mkdirSync(SUBS_DIR, { recursive: true });
fs.mkdirSync(SHORTS_DIR, { recursive: true });
fs.mkdirSync(AVATARS_DIR, { recursive: true });
translator.initCache(path.join(DATA_DIR, 'translate-cache.json'));

app.disable('x-powered-by');
const sec = require('./lib/sec'); // v19: طبقة الأمان
sec.early(app);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
/* اللغة المطلوبة (ar/en/ru) + ترجمة رسائل الأخطاء تلقائياً */
app.use((req, res, next) => {
  req.lang = pickLang(req);
  const origJson = res.json.bind(res);
  res.json = body => {
    if (req.lang !== 'ar' && body && typeof body.error === 'string') {
      const t = translateArabicError(body.error, req.lang);
      if (t) body = { ...body, error: t };
    }
    return origJson(body);
  };
  next();
});
app.use(express.json({ limit: '200kb' }));
sec.init({ app, DATA_DIR, ROOT, ADMIN_FILE, mailer: require('./lib/mailer'), getSession: req => getSession(req) });
app.use(express.urlencoded({ extended: true }));

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
}
function getMovies() { return readJSON(MOVIES_FILE, []); }
function saveMovies(movies) { writeJSON(MOVIES_FILE, movies); }
function dayKey(date = new Date()) { return date.toISOString().slice(0, 10); }

function defaultAnalytics() {
  return {
    startedAt: new Date().toISOString(),
    totalViews: 0,
    totalSaves: 0,
    activeDevices: {},
    dailyViews: {},
    dailySaves: {},
    events: [],
    uploads: 0,
    deletes: 0
  };
}
function getAnalytics() {
  const current = readJSON(ANALYTICS_FILE, null);
  if (!current) {
    const fresh = defaultAnalytics();
    writeJSON(ANALYTICS_FILE, fresh);
    return fresh;
  }
  current.activeDevices ||= {};
  current.dailyViews ||= {};
  current.dailySaves ||= {};
  current.events ||= [];
  return current;
}
function saveAnalytics(a) { a.events = (a.events || []).slice(-500); writeJSON(ANALYTICS_FILE, a); }
function recordEvent(type, payload = {}) {
  const a = getAnalytics();
  a.events.push({ type, at: new Date().toISOString(), ...payload });
  saveAnalytics(a);
}
function markUniqueDevice(req, a) {
  const key = crypto.createHash('sha256').update(`${req.ip || ''}|${req.headers['user-agent'] || ''}`).digest('hex').slice(0, 20);
  a.activeDevices[key] = a.activeDevices[key] || { firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() };
  a.activeDevices[key].lastSeen = new Date().toISOString();
  return key;
}
function summarizeAnalytics() {
  const a = getAnalytics();
  const movies = getMovies();
  const today = dayKey();
  const devices = Object.values(a.activeDevices);
  const active24h = devices.filter(d => Date.now() - Date.parse(d.lastSeen) <= 24*60*60*1000).length;
  const last14 = Array.from({length:14}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (13-i)); const k=dayKey(d);
    return { date:k, views:Number(a.dailyViews[k]||0), saves:Number(a.dailySaves[k]||0) };
  });
  const categories = {};
  for (const m of movies) categories[m.category || 'عام'] = (categories[m.category || 'عام'] || 0) + 1;
  const topMovies = [...movies].sort((x,y)=>Number(y.views||0)-Number(x.views||0)).slice(0,8)
    .map(m=>({id:m.id,title:m.title,category:m.category||'عام',views:Number(m.views||0),createdAt:m.createdAt}));
  return {
    totals: {
      movies: movies.length,
      views: Number(a.totalViews || 0),
      saves: Number(a.totalSaves || 0),
      devices: devices.length,
      active24h,
      uploads: Number(a.uploads || 0),
      deletes: Number(a.deletes || 0),
      storageBytes: movies.reduce((sum,m)=>sum+Number(m.fileSize||0),0)
    },
    today: { views:Number(a.dailyViews[today]||0), saves:Number(a.dailySaves[today]||0) },
    daily:last14,
    categories:Object.entries(categories).map(([name,count])=>({name,count})).sort((x,y)=>y.count-x.count),
    topMovies,
    recentEvents:a.events.slice(-20).reverse(),
    startedAt:a.startedAt
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, record) {
  try {
    const candidate = crypto.scryptSync(password, record.salt, 64);
    return crypto.timingSafeEqual(candidate, Buffer.from(record.hash, 'hex'));
  } catch { return false; }
}

const sessions = new Map();
const loginAttempts = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000;
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function setSessionCookie(res, token) {
  const sc = res.req && (res.req.secure || res.req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `admin_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL/1000}${sc}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}
function getSession(req) {
  const token = parseCookies(req).admin_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  if (session.ua && session.ua !== String(req.headers['user-agent'] || '').slice(0, 200)) { // مؤشر سرقة جلسة: تغيّر المتصفح
    sessions.delete(token);
    sec.record({ type: 'session_hijack', severity: 'HIGH', action: 'blocked', ip: req.ip, method: req.method, url: req.originalUrl, ua: req.headers['user-agent'], user: session.username, rule: 'session-ua-mismatch', details: 'تغيّر المتصفح داخل نفس الجلسة؛ أُنهيت الجلسة' });
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL;
  return session;
}
function requireAdmin(req,res,next) {
  const s=getSession(req);
  if (!s) return res.status(401).json({error:'غير مصرح'});
  req.admin=s; next();
}
function tooManyAttempts(ip) {
  const now=Date.now();
  let x=loginAttempts.get(ip);
  if (!x || x.resetAt < now) x={count:0,resetAt:now+15*60*1000};
  x.count++; loginAttempts.set(ip,x);
  return x.count > 8;
}

app.get('/api/auth/status',(req,res)=>{
  const s=getSession(req);
  res.json({authenticated:!!s,username:s?.username||null});
});
app.post('/api/auth/login',(req,res)=>{
  const ip=req.ip||req.socket.remoteAddress||'unknown';
  if(tooManyAttempts(ip)) return res.status(429).json({error:'محاولات كثيرة، حاول لاحقاً.'});
  const admin=readJSON(ADMIN_FILE,null);
  const {username,password,otp}=req.body||{};
  if(!admin) return res.status(503).json({error:'حساب الأدمن غير مُعد. نفّذ npm run admin:create.'});
  const lock=sec.loginGate(req,username);
  if(lock) return res.status(429).json({error:`الدخول مقفل مؤقتاً لأسباب أمنية. حاول بعد ${Math.ceil(lock/60)} دقيقة.`});
  if(typeof username!=='string'||typeof password!=='string'||username!==admin.username||!verifyPassword(password,admin)){
    sec.loginFail(req,username);
    return res.status(401).json({error:'اسم المستخدم أو كلمة المرور غير صحيحة.'});
  }
  const o=sec.checkOtp(otp);   // المصادقة الثنائية (اختيارية، تُفعَّل من لوحة الأمان)
  if(o==='required') return res.status(401).json({error:'أدخل رمز التحقق الثنائي.',need_otp:true});
  if(o==='bad'){ sec.loginFail(req,username,'otp'); return res.status(401).json({error:'رمز التحقق غير صحيح.',need_otp:true}); }
  loginAttempts.delete(ip);
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,{username:admin.username,createdAt:Date.now(),expiresAt:Date.now()+SESSION_TTL,ua:String(req.headers['user-agent']||'').slice(0,200)});
  setSessionCookie(res,token);
  recordEvent('admin_login',{username:admin.username});
  sec.loginOk(req,admin.username);
  res.json({success:true,username:admin.username});
});
app.post('/api/admin/password',sameOrigin,requireAdmin,(req,res)=>{
  if(hit(`admin-pw:${req.ip}`,8,15*60*1000)) return res.status(429).json({error:'محاولات كثيرة، حاول لاحقاً.'});
  const {current,next}=req.body||{};
  const admin=readJSON(ADMIN_FILE,null);
  if(!admin||typeof current!=='string'||!verifyPassword(current,admin)) return res.status(403).json({error:'كلمة المرور الحالية غير صحيحة.'});
  if(typeof next!=='string'||next.length<10||next.length>200) return res.status(400).json({error:'كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.'});
  if(next===current) return res.status(400).json({error:'اختر كلمة مرور مختلفة عن الحالية.'});
  const rec={...admin,...hashPassword(next),changedAt:new Date().toISOString()};
  fs.writeFileSync(ADMIN_FILE,JSON.stringify(rec,null,2),{encoding:'utf8',mode:0o600});
  const mine=parseCookies(req).admin_session;
  for(const k of [...sessions.keys()]) if(k!==mine) sessions.delete(k); // إنهاء كل الجلسات الأخرى
  recordEvent('admin_password',{username:admin.username});
  res.json({success:true});
});
app.post('/api/auth/logout',(req,res)=>{
  const token=parseCookies(req).admin_session;
  if(token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({success:true});
});

/* =====================================================================
   حسابات المستخدمين + الأفلام المدفوعة (شام كاش)
   ===================================================================== */
const scryptAsync = require('util').promisify(crypto.scrypt);
const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const USER_COOKIE = 'user_session';
const USER_TTL = 7 * 24 * 60 * 60 * 1000;

function writeJSONAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}
const getUsers = () => readJSON(USERS_FILE, []);
const saveUsers = v => writeJSONAtomic(USERS_FILE, v);
const getPayments = () => readJSON(PAYMENTS_FILE, []);
const savePayments = v => writeJSONAtomic(PAYMENTS_FILE, v);

/* محدد معدل الطلبات */
const buckets = new Map();
function hit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt < now) { b = { count: 0, resetAt: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return b.count > max;
}
function isBlocked(key, max) {
  const b = buckets.get(key);
  return !!b && b.resetAt > Date.now() && b.count >= max;
}
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.resetAt < n) buckets.delete(k); }, 10 * 60 * 1000).unref();

/* حماية CSRF: السماح فقط بطلبات من نفس الموقع */
function sameOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (origin) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    try { if (new URL(origin).host !== host) return res.status(403).json({ error: 'طلب غير مسموح.' }); }
    catch { return res.status(403).json({ error: 'طلب غير مسموح.' }); }
  }
  next();
}

/* جلسات المستخدمين (تُحفظ مُجزّأة بـ SHA-256 ولا يُخزّن الرمز الأصلي) */
const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');
let userSessions = readJSON(USER_SESSIONS_FILE, {});
function persistSessions() {
  const now = Date.now();
  for (const k of Object.keys(userSessions)) if (userSessions[k].expiresAt < now) delete userSessions[k];
  writeJSONAtomic(USER_SESSIONS_FILE, userSessions);
}
function userCookie(req, token, maxAgeSec) {
  return `${USER_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${req.secure ? '; Secure' : ''}`;
}
function startUserSession(req, res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  userSessions[hashToken(token)] = { userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + USER_TTL };
  persistSessions();
  res.setHeader('Set-Cookie', userCookie(req, token, USER_TTL / 1000));
}
function getUser(req) {
  let token; try { token = parseCookies(req)[USER_COOKIE]; } catch { return null; }
  if (!token) return null;
  const key = hashToken(token);
  const s = userSessions[key];
  if (!s) return null;
  if (s.expiresAt < Date.now()) { delete userSessions[key]; persistSessions(); return null; }
  const user = getUsers().find(u => u.id === s.userId);
  if (!user) return null;
  if (s.expiresAt - Date.now() < USER_TTL - 60 * 60 * 1000) { s.expiresAt = Date.now() + USER_TTL; persistSessions(); }
  return user;
}
function requireUser(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'سجّل الدخول أولاً.', code: 'login_required' });
  req.user = u; next();
}

/* سياسة كلمة المرور القوية */
const COMMON_PASSWORDS = ['password', 'passw0rd', '12345678', '123456789', '1234567890', 'qwertyuiop', 'iloveyou', 'admin123', '11111111', 'abc12345', 'letmein', 'welcome1'];
function passwordProblem(password, username) {
  if (typeof password !== 'string') return 'كلمة المرور مطلوبة.';
  if (password.length < 10) return 'كلمة المرور يجب ألا تقل عن 10 أحرف.';
  if (password.length > 128) return 'كلمة المرور طويلة جداً.';
  if (!/[a-z]/.test(password)) return 'أضف حرفاً إنجليزياً صغيراً (a-z) إلى كلمة المرور.';
  if (!/[A-Z]/.test(password)) return 'أضف حرفاً إنجليزياً كبيراً (A-Z) إلى كلمة المرور.';
  if (!/\d/.test(password)) return 'أضف رقماً واحداً على الأقل إلى كلمة المرور.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'أضف رمزاً خاصاً واحداً على الأقل مثل ! @ # $.';
  const low = password.toLowerCase();
  if (COMMON_PASSWORDS.some(c => low.includes(c))) return 'كلمة المرور شائعة وسهلة التخمين.';
  if (username && low.includes(String(username).toLowerCase())) return 'يجب ألا تحتوي كلمة المرور على اسم المستخدم.';
  if (/(.)\1{3,}/.test(password)) return 'تجنب تكرار نفس الحرف أكثر من 3 مرات متتالية.';
  return null;
}
const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,24}$/u;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/;
const normEmail = v => String(v || '').trim().toLowerCase();
function publicUser(u) {
  return {
    id: u.id, username: u.username, displayName: u.displayName || u.username,
    email: u.email || '', avatarUrl: u.avatarUrl || '', age: u.age || null, createdAt: u.createdAt,
    emailVerified: !!u.emailVerified, verified: !!(ext.isVerified && ext.isVerified(u.id)), sub: ext.subInfo ? ext.subInfo(u) : null,
    kids: u.kids && u.kids.on ? { on: true, maxAge: u.kids.maxAge } : null, hasKidsPin: !!(u.kids && u.kids.hash), oauth: !!(u.googleId || u.telegramId)
  };
}

app.post('/api/user/register', sameOrigin, async (req, res) => {
  const ip = req.ip || 'unknown';
  if (hit(`reg:${ip}`, 10, 60 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim()))
    return res.status(400).json({ error: 'اسم المستخدم من 3 إلى 24 حرفاً (حروف وأرقام و _ . - فقط).' });
  const name = username.trim();
  const email = normEmail(req.body.email);
  if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: tr(req, 'email_invalid'), code: 'email_invalid' });
  const problem = passwordProblem(password, name);
  if (problem) return res.status(400).json({ error: problem });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64, SCRYPT_OPTS)).toString('hex');
  const users = getUsers();
  if (users.some(u => u.usernameLower === name.toLowerCase())) return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل.' });
  if (users.some(u => u.email === email)) return res.status(409).json({ error: tr(req, 'email_taken'), code: 'email_taken' });
  const user = { id: crypto.randomUUID(), username: name, usernameLower: name.toLowerCase(), displayName: name, email, avatarUrl: '', age: null, salt, hash, createdAt: new Date().toISOString() };
  users.push(user); saveUsers(users);
  startUserSession(req, res, user);
  recordEvent('user_register', { username: name });
  res.status(201).json({ success: true, username: name, user: publicUser(user) });
});

app.post('/api/user/login', sameOrigin, async (req, res) => {
  const ip = req.ip || 'unknown';
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 128)
    return res.status(400).json({ error: 'أدخل اسم المستخدم وكلمة المرور.' });
  const ident = username.trim().toLowerCase();
  const key = `login:${ip}:${ident}`;
  if (isBlocked(key, 6) || hit(`login-ip:${ip}`, 40, 15 * 60 * 1000))
    return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد 15 دقيقة.' });
  const rec = getUsers().find(u => u.usernameLower === ident || (u.email && u.email === ident));
  const candidate = await scryptAsync(password, rec ? rec.salt : DUMMY_SALT, 64, SCRYPT_OPTS);
  const ok = !!rec && crypto.timingSafeEqual(candidate, Buffer.from(rec.hash, 'hex'));
  if (!ok) { hit(key, 6, 15 * 60 * 1000); return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }); }
  buckets.delete(key);
  startUserSession(req, res, rec);
  res.json({ success: true, username: rec.username, user: publicUser(rec) });
});

app.post('/api/user/logout', sameOrigin, (req, res) => {
  try {
    const t = parseCookies(req)[USER_COOKIE];
    if (t) { delete userSessions[hashToken(t)]; persistSessions(); }
  } catch {}
  res.setHeader('Set-Cookie', userCookie(req, '', 0));
  res.json({ success: true });
});

app.get('/api/user/me', (req, res) => {
  const u = getUser(req);
  res.json({ authenticated: !!u, username: u ? u.username : null, user: u ? publicUser(u) : null });
});

/* الأفلام المدفوعة */
function publicMovie(m) {
  const subtitles = (m.subtitles || []).map(x => ({ id: x.id, lang: x.lang, label: x.label }));
  const { renditions, sprite, transcribe, processing, ...clean } = m;
  const extra = ext.movieExtras ? ext.movieExtras(m) : {};
  const soon = !!extra.comingSoon;
  if (!m.isPaid) return { ...clean, ...extra, subtitles, ...(soon ? { videoUrl: '' } : {}) };
  const { videoUrl, videoFile, ...rest } = clean;
  return { ...rest, ...extra, videoUrl: '', locked: true, subtitles };
}
function paymentStatusFor(user, movieId) {
  if (!user) return 'none';
  const list = getPayments().filter(p => p.userId === user.id && p.movieId === movieId);
  if (list.some(p => p.status === 'approved')) return 'approved';
  if (list.some(p => p.status === 'pending')) return 'pending';
  if (list.some(p => p.status === 'rejected')) return 'rejected';
  return 'none';
}
function hasAccess(req, movie) {
  if (ext.isScheduled && ext.isScheduled(movie)) return false; // لم يحن موعد النشر بعد
  if (ext.ageBlocked && ext.ageBlocked(getUser(req), movie)) return false; // قفل عمري / وضع الأطفال
  if (!movie.isPaid) return true;
  // لا استثناء للأدمن في الموقع العام: يجب أن يكون الحساب قد دفع فعلاً (أو لديه اشتراك فعّال)
  const u = getUser(req);
  if (u && ext.hasSub && ext.hasSub(u)) return true;
  return !!u && paymentStatusFor(u, movie.id) === 'approved';
}
function normalizeReceipt(v) {
  return String(v || '')
    .replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, c => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[\s\-]/g, '');
}
/* تحقق تلقائي اختياري: إذا وُفّرت واجهة تحقق من شام كاش (SHAMCASH_VERIFY_URL) تُستخدم، وإلا تذهب العملية للمراجعة من الأدمن */
async function autoVerifyReceipt(receipt, movie) {
  const url = process.env.SHAMCASH_VERIFY_URL;
  if (!url || typeof fetch !== 'function') return { mode: 'manual' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SHAMCASH_API_KEY || ''}` },
      body: JSON.stringify({ receipt, amount: movie.price, currency: movie.currency, account: movie.shamcashAccount }),
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    if (r.ok && d && d.paid === true) return { mode: 'auto', paid: true };
    if (r.ok && d && d.paid === false) return { mode: 'auto', paid: false };
  } catch {}
  return { mode: 'manual' };
}

app.get('/api/movies/:id/access', (req, res) => {
  const movie = getMovies().find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  const user = getUser(req);
  res.json({
    locked: !!movie.isPaid,
    hasAccess: hasAccess(req, movie),
    authenticated: !!user,
    status: movie.isPaid ? paymentStatusFor(user, movie.id) : 'none'
  });
});

function sendMovieFile(req, res, movie) {
  let file;
  if (movie.isPaid) {
    if (!movie.videoFile) return res.status(404).json({ error: 'الملف غير موجود' });
    file = path.join(PRIVATE_DIR, path.basename(movie.videoFile));
  } else {
    file = path.join(ROOT, String(movie.videoUrl || '').replace(/^\/+/, ''));
    if (!file.startsWith(UPLOADS + path.sep)) return res.status(404).json({ error: 'الملف غير موجود' });
  }
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'الملف غير موجود' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(file);
}
app.get('/api/movies/:id/stream', (req, res) => {
  const movie = getMovies().find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  if (!hasAccess(req, movie)) return res.status(403).json({ error: 'يجب شراء الفيلم أولاً.' });
  sendMovieFile(req, res, movie);
});
/* معاينة الأدمن فقط (من لوحة الإدارة) — منفصلة عن الموقع العام */
app.get('/api/admin/movies/:id/stream', requireAdmin, (req, res) => {
  const movie = getMovies().find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  sendMovieFile(req, res, movie);
});

app.post('/api/movies/:id/verify-payment', sameOrigin, requireUser, async (req, res) => {
  const user = req.user;
  const movie = getMovies().find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  if (!movie.isPaid) return res.status(400).json({ error: 'هذا الفيلم مجاني.' });
  if (hit(`pay:${user.id}`, 8, 10 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
  const receipt = normalizeReceipt(req.body && req.body.receipt);
  if (!/^\d{6,14}$/.test(receipt)) return res.status(400).json({ error: 'رقم الإيصال يجب أن يتكوّن من أرقام فقط (من 6 إلى 14 رقماً).' });

  let payments = getPayments();
  if (payments.some(p => p.userId === user.id && p.movieId === movie.id && p.status === 'approved')) return res.json({ status: 'approved' });
  const dup = payments.find(p => p.receipt === receipt);
  if (dup) {
    if (dup.userId === user.id && dup.movieId === movie.id && dup.status === 'pending') return res.status(202).json({ status: 'pending' });
    return res.status(409).json({ error: 'رقم الإيصال هذا مستخدم من قبل.' });
  }
  if (payments.filter(p => p.userId === user.id && p.movieId === movie.id && p.status === 'pending').length >= 3)
    return res.status(429).json({ error: 'لديك طلبات قيد المراجعة بالفعل. انتظر قرار الإدارة.' });

  let quote = { ok: true, price: movie.price, code: '' };
  if (ext.quote && req.body && req.body.coupon) {
    quote = ext.quote(movie.price, req.body.coupon, 'movie', user, movie.currency);
    if (!quote.ok) return res.status(400).json({ error: ext.couponError(quote), code: quote.error });
  }
  const auto = await autoVerifyReceipt(receipt, { ...movie, price: quote.price });
  if (auto.mode === 'auto' && !auto.paid) return res.status(402).json({ error: 'لم نعثر على عملية دفع بهذا الرقم. تأكد من الرقم والمبلغ والحساب.' });

  payments = getPayments(); // إعادة قراءة بعد الانتظار لتفادي التكرار المتزامن
  if (payments.some(p => p.receipt === receipt)) return res.status(409).json({ error: 'رقم الإيصال هذا مستخدم من قبل.' });
  const status = auto.mode === 'auto' && auto.paid ? 'approved' : 'pending';
  const payment = {
    id: crypto.randomUUID(), userId: user.id, username: user.username, movieId: movie.id, movieTitle: movie.title,
    receipt, amount: quote.price, currency: movie.currency, status,
    method: status === 'approved' ? 'auto' : 'manual', createdAt: new Date().toISOString(),
    decidedAt: status === 'approved' ? new Date().toISOString() : null, coupon: quote.code || ''
  };
  payments.unshift(payment); savePayments(payments);
  if (status === 'approved' && ext.onPaymentDecided) ext.onPaymentDecided(payment, 'approved');
  recordEvent(status === 'approved' ? 'payment_approved' : 'payment_submitted', { movieId: movie.id, title: movie.title, username: user.username });
  res.status(status === 'approved' ? 200 : 202).json({ status });
});

app.get('/api/admin/payments', requireAdmin, (req, res) => res.json(getPayments()));
function decidePayment(status) {
  return (req, res) => {
    const payments = getPayments();
    const p = payments.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'الطلب غير موجود' });
    p.status = status; p.decidedAt = new Date().toISOString(); p.decidedBy = req.admin.username;
    savePayments(payments);
    recordEvent(status === 'approved' ? 'payment_approved' : 'payment_rejected', { movieId: p.movieId, title: p.movieTitle, username: p.username });
    if (ext.onPaymentDecided) ext.onPaymentDecided(p, status);
    res.json(p);
  };
}
app.post('/api/admin/payments/:id/approve', requireAdmin, decidePayment('approved'));
app.post('/api/admin/payments/:id/reject', requireAdmin, decidePayment('rejected'));
/* ===================================================================== */


/* =====================================================================
   v9: الملف الشخصي + Shorts + التعليقات والتفاعلات + التحميل والمشاركة
       + ملفات الترجمة والترجمة الفورية
   ===================================================================== */
const getShorts = () => readJSON(SHORTS_FILE, []);
const saveShorts = v => writeJSONAtomic(SHORTS_FILE, v);
const getComments = () => readJSON(COMMENTS_FILE, []);
const saveComments = v => writeJSONAtomic(COMMENTS_FILE, v);
const getSocial = () => readJSON(SOCIAL_FILE, {});
const saveSocial = v => writeJSONAtomic(SOCIAL_FILE, v);

const cleanLine = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanBlock = (v, max) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

/* التعرف على نوع الملف من أول بايتات (لا نثق بنوع الملف الذي يرسله المتصفح) */
function sniffBuffer(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'png';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'webm';
  return null;
}
function sniffFile(file) {
  try {
    const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd);
    return sniffBuffer(b);
  } catch { return null; }
}
const unlinkQuiet = f => { try { if (f) fs.unlinkSync(f); } catch { /* تجاهل */ } };

const memUpload = limit => multer({ storage: multer.memoryStorage(), limits: { fileSize: limit, files: 1 } });
const uploadAvatar = memUpload(3 * 1024 * 1024);
const uploadSub = memUpload(3 * 1024 * 1024);
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/ogg': '.ogv' };
const uploadShort = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SHORTS_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${file.fieldname === 'poster' ? '.jpg' : (VIDEO_EXT[file.mimetype] || '.mp4')}`)
  }),
  limits: { fileSize: 1024 * 1024 * 1024, files: 2 }, // الحد الفعلي يُضبط من الإعدادات عبر ext.cap
  fileFilter: (req, file, cb) => {
    const ok = file.fieldname === 'poster' ? /^image\/(jpeg|png|webp)$/.test(file.mimetype) : file.fieldname === 'video' && /^video\/(mp4|webm|quicktime)$/.test(file.mimetype);
    cb(ok ? null : new Error('نوع الملف غير مسموح'), ok);
  }
});

/* ---------- الأسماء والصور ---------- */
function authorOf(u) {
  if (!u) return { name: '—', avatarUrl: '', initial: '?' };
  const name = u.displayName || u.username;
  return { name, avatarUrl: u.avatarUrl || '', initial: Array.from(name)[0] || '?', verified: !!(ext.isVerified && ext.isVerified(u.id)) };
}
function userMap() { const m = new Map(); for (const u of getUsers()) m.set(u.id, u); return m; }

/* ---------- الملف الشخصي ---------- */
app.patch('/api/user/profile', sameOrigin, requireUser, (req, res) => {
  const users = getUsers();
  const u = users.find(x => x.id === req.user.id);
  const b = req.body || {};
  if (b.displayName !== undefined) {
    const n = cleanLine(b.displayName, 40);
    if (Array.from(n).length < 2) return res.status(400).json({ error: tr(req, 'name_invalid'), code: 'name_invalid' });
    u.displayName = n;
  }
  if (b.age !== undefined) {
    if (b.age === null || b.age === '') u.age = null;
    else {
      const a = Number(b.age);
      if (!Number.isInteger(a) || a < 5 || a > 120) return res.status(400).json({ error: tr(req, 'age_invalid'), code: 'age_invalid' });
      u.age = a;
    }
  }
  if (b.email !== undefined && !u.email) {      // البريد يُضاف مرة واحدة للحسابات القديمة فقط
    const em = normEmail(b.email);
    if (em.length > 254 || !EMAIL_RE.test(em)) return res.status(400).json({ error: tr(req, 'email_invalid'), code: 'email_invalid' });
    if (users.some(x => x.email === em)) return res.status(409).json({ error: tr(req, 'email_taken'), code: 'email_taken' });
    u.email = em;
  }
  saveUsers(users);
  res.json({ success: true, user: publicUser(u) });
});

app.post('/api/user/avatar', sameOrigin, requireUser, uploadAvatar.single('avatar'), (req, res) => {
  const f = req.file;
  const kind = f && sniffBuffer(f.buffer);
  if (!f || !['jpeg', 'png', 'webp'].includes(kind)) return res.status(400).json({ error: tr(req, 'image_invalid'), code: 'image_invalid' });
  const users = getUsers();
  const u = users.find(x => x.id === req.user.id);
  const name = `${u.id}-${crypto.randomBytes(6).toString('hex')}.${kind === 'jpeg' ? 'jpg' : kind}`;
  fs.writeFileSync(path.join(AVATARS_DIR, name), f.buffer);
  if (u.avatarUrl && u.avatarUrl.startsWith('/uploads/avatars/')) unlinkQuiet(path.join(AVATARS_DIR, path.basename(u.avatarUrl)));
  u.avatarUrl = `/uploads/avatars/${name}`;
  saveUsers(users);
  res.json({ success: true, user: publicUser(u) });
});
app.delete('/api/user/avatar', sameOrigin, requireUser, (req, res) => {
  const users = getUsers();
  const u = users.find(x => x.id === req.user.id);
  if (u.avatarUrl && u.avatarUrl.startsWith('/uploads/avatars/')) unlinkQuiet(path.join(AVATARS_DIR, path.basename(u.avatarUrl)));
  u.avatarUrl = '';
  saveUsers(users);
  res.json({ success: true, user: publicUser(u) });
});

app.post('/api/user/password', sameOrigin, requireUser, async (req, res) => {
  const u0 = req.user;
  if (hit(`pw-change:${u0.id}`, 6, 15 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
  const { current, next } = req.body || {};
  if (typeof current !== 'string' || typeof next !== 'string' || current.length > 128) return res.status(400).json({ error: 'كلمة المرور مطلوبة.' });
  const cand = await scryptAsync(current, u0.salt, 64, SCRYPT_OPTS);
  if (!crypto.timingSafeEqual(cand, Buffer.from(u0.hash, 'hex'))) return res.status(401).json({ error: tr(req, 'wrong_current_password'), code: 'wrong_current_password' });
  if (current === next) return res.status(400).json({ error: tr(req, 'same_password'), code: 'same_password' });
  const problem = passwordProblem(next, u0.username);
  if (problem) return res.status(400).json({ error: problem });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scryptAsync(next, salt, 64, SCRYPT_OPTS)).toString('hex');
  const users = getUsers();
  const u = users.find(x => x.id === u0.id);
  u.salt = salt; u.hash = hash;
  saveUsers(users);
  // إنهاء بقية الجلسات على الأجهزة الأخرى مع إبقاء الجلسة الحالية
  const keep = hashToken(parseCookies(req)[USER_COOKIE] || '');
  for (const k of Object.keys(userSessions)) if (userSessions[k].userId === u.id && k !== keep) delete userSessions[k];
  persistSessions();
  res.json({ success: true });
});

/* ---------- التفاعلات (إعجاب / عدم إعجاب / مشاركة / تحميل) ---------- */
const TYPES = { movies: 'movie', shorts: 'short' };
function findTarget(type, id) {
  return type === 'movie' ? getMovies().find(m => m.id === id) : getShorts().find(s => s.id === id);
}
function summaryFrom(social, commentCount, type, id, user) {
  const s = social[`${type}:${id}`] || {};
  const likes = s.likes || [], dis = s.dislikes || [];
  return {
    likes: likes.length, dislikes: dis.length, shares: s.shares || 0, downloads: s.downloads || 0, comments: commentCount,
    myReaction: user ? (likes.includes(user.id) ? 'like' : dis.includes(user.id) ? 'dislike' : null) : null
  };
}
function commentCountOf(type, id) { return getComments().filter(c => c.type === type && c.targetId === id).length; }
function bump(type, id, field) {
  const social = getSocial();
  const e = social[`${type}:${id}`] ||= { likes: [], dislikes: [], shares: 0, downloads: 0 };
  e[field] = (e[field] || 0) + 1;
  saveSocial(social);
}

for (const [route, type] of Object.entries(TYPES)) {
  app.get(`/api/${route}/:id/social`, (req, res) => {
    if (!findTarget(type, req.params.id)) return res.status(404).json({ error: type === 'movie' ? 'الفيلم غير موجود' : tr(req, 'short_not_found') });
    res.json(summaryFrom(getSocial(), commentCountOf(type, req.params.id), type, req.params.id, getUser(req)));
  });

  app.post(`/api/${route}/:id/react`, sameOrigin, requireUser, (req, res) => {
    const id = req.params.id;
    if (!findTarget(type, id)) return res.status(404).json({ error: type === 'movie' ? 'الفيلم غير موجود' : tr(req, 'short_not_found') });
    if (hit(`react:${req.user.id}`, 120, 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
    const v = req.body && req.body.value;
    if (!['like', 'dislike', null].includes(v)) return res.status(400).json({ error: tr(req, 'target_not_found') });
    const social = getSocial();
    const e = social[`${type}:${id}`] ||= { likes: [], dislikes: [], shares: 0, downloads: 0 };
    e.likes = (e.likes || []).filter(x => x !== req.user.id);
    e.dislikes = (e.dislikes || []).filter(x => x !== req.user.id);
    if (v === 'like') e.likes.push(req.user.id);
    if (v === 'dislike') e.dislikes.push(req.user.id);
    saveSocial(social);
    res.json(summaryFrom(social, commentCountOf(type, id), type, id, req.user));
  });

  app.post(`/api/${route}/:id/share`, sameOrigin, (req, res) => {
    const id = req.params.id;
    if (!findTarget(type, id)) return res.status(404).json({ error: type === 'movie' ? 'الفيلم غير موجود' : tr(req, 'short_not_found') });
    if (!hit(`share:${req.ip}:${id}`, 5, 60 * 60 * 1000)) bump(type, id, 'shares');
    res.json(summaryFrom(getSocial(), commentCountOf(type, id), type, id, getUser(req)));
  });
}

/* ---------- التحميل الحقيقي ---------- */
function downloadName(title, file) {
  const base = cleanLine(title, 80).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'video';
  return base + (path.extname(file) || '.mp4');
}
function movieFileOf(movie) {
  if (movie.isPaid) return movie.videoFile ? path.join(PRIVATE_DIR, path.basename(movie.videoFile)) : null;
  const f = path.join(ROOT, String(movie.videoUrl || '').replace(/^\/+/, ''));
  return f.startsWith(UPLOADS + path.sep) ? f : null;
}
app.get('/api/movies/:id/download', (req, res) => {
  const movie = getMovies().find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  if (!hasAccess(req, movie)) return res.status(403).json({ error: 'يجب شراء الفيلم أولاً.' });
  const file = movieFileOf(movie);
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'الملف غير موجود' });
  bump('movie', movie.id, 'downloads');
  recordEvent('download', { movieId: movie.id, title: movie.title });
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(file, downloadName(movie.title, file));
});
app.get('/api/shorts/:id/download', (req, res) => {
  const s = getShorts().find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: tr(req, 'short_not_found') });
  const file = path.join(SHORTS_DIR, path.basename(s.videoUrl));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'الملف غير موجود' });
  bump('short', s.id, 'downloads');
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(file, downloadName(s.caption || 'short', file));
});

/* ---------- التعليقات ---------- */
function shapeComment(c, ctx) {
  const au = ctx.users.get(c.userId), a = { ...authorOf(au), username: au ? au.username : '' };
  return {
    id: c.id, text: c.text, createdAt: c.createdAt, author: a,
    likes: (c.likes || []).length, liked: !!ctx.user && (c.likes || []).includes(ctx.user.id),
    mine: !!ctx.user && c.userId === ctx.user.id, canDelete: ctx.admin || (!!ctx.user && c.userId === ctx.user.id),
    pinned: !!c.pinned, canPin: ext.canPin ? ext.canPin(ctx, c) : false
  };
}
app.get('/api/comments/:type/:id', (req, res) => {
  const type = req.params.type === 'movies' ? 'movie' : req.params.type === 'shorts' ? 'short' : null;
  if (!type || !findTarget(type, req.params.id)) return res.status(404).json({ error: tr(req, 'target_not_found') });
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
  let all = getComments().filter(c => c.type === type && c.targetId === req.params.id);
  const ctx = { users: userMap(), user: getUser(req), admin: !!getSession(req) };
  if (ext.filterComments) all = ext.filterComments(all, ctx.user);
  const tops = all.filter(c => !c.parentId);
  if (req.query.sort === 'new') tops.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else tops.sort((a, b) => (b.likes || []).length - (a.likes || []).length || b.createdAt.localeCompare(a.createdAt));
  tops.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // المثبّت أولاً (الترتيب مستقر)
  const page = tops.slice(offset, offset + limit).map(c => ({
    ...shapeComment(c, ctx),
    replies: all.filter(r => r.parentId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(r => shapeComment(r, ctx))
  }));
  res.json({ total: all.length, items: page, hasMore: offset + limit < tops.length });
});
app.post('/api/comments/:type/:id', sameOrigin, requireUser, async (req, res) => {
  const type = req.params.type === 'movies' ? 'movie' : req.params.type === 'shorts' ? 'short' : null;
  if (!type || !findTarget(type, req.params.id)) return res.status(404).json({ error: tr(req, 'target_not_found') });
  if (hit(`cm:${req.user.id}`, 12, 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
  const text = cleanBlock(req.body && req.body.text, 1000);
  if (!text) return res.status(400).json({ error: tr(req, 'comment_empty'), code: 'comment_empty' });
  if (ext.commentGuard) { const g = await ext.commentGuard(req, type, req.params.id, text); if (g) return res.status(g.status).json({ error: g.error, code: g.code }); }
  const comments = getComments();
  let parentId = null;
  if (req.body && req.body.parentId) {
    const p = comments.find(c => c.id === req.body.parentId && c.type === type && c.targetId === req.params.id);
    if (!p) return res.status(404).json({ error: tr(req, 'comment_not_found') });
    parentId = p.parentId || p.id;          // الردود بمستوى واحد
  }
  const c = { id: crypto.randomUUID(), type, targetId: req.params.id, userId: req.user.id, parentId, text, likes: [], createdAt: new Date().toISOString() };
  comments.push(c); saveComments(comments);
  if (ext.afterComment) ext.afterComment(c, req);
  if (ext.notify) {
    const t = findTarget(type, req.params.id), title = t ? (t.title || t.caption || '') : '';
    const info = { fromId: req.user.id, name: req.user.displayName || req.user.username, targetType: type, targetId: req.params.id, title: String(title).slice(0, 80) };
    if (parentId) { const par = comments.find(x => x.id === parentId); if (par && par.userId !== req.user.id) ext.notify(par.userId, 'reply', info); }
    else if (type === 'short' && t && t.userId !== req.user.id) ext.notify(t.userId, 'short_comment', info);
  }
  const ctx = { users: userMap(), user: req.user, admin: !!getSession(req) };
  res.status(201).json({ comment: { ...shapeComment(c, ctx), replies: [] }, total: comments.filter(x => x.type === type && x.targetId === req.params.id).length });
});
app.post('/api/comment/:cid/like', sameOrigin, requireUser, (req, res) => {
  const comments = getComments();
  const c = comments.find(x => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: tr(req, 'comment_not_found') });
  c.likes ||= [];
  const i = c.likes.indexOf(req.user.id);
  if (i >= 0) c.likes.splice(i, 1); else c.likes.push(req.user.id);
  saveComments(comments);
  if (i < 0 && ext.notify && c.userId !== req.user.id) ext.notify(c.userId, 'comment_like', { fromId: req.user.id, name: req.user.displayName || req.user.username, targetType: c.type, targetId: c.targetId });
  res.json({ likes: c.likes.length, liked: i < 0 });
});
app.delete('/api/comment/:cid', sameOrigin, (req, res) => {
  const user = getUser(req), admin = !!getSession(req);
  const comments = getComments();
  const c = comments.find(x => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: tr(req, 'comment_not_found') });
  if (!admin && !(user && user.id === c.userId)) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
  const left = comments.filter(x => x.id !== c.id && x.parentId !== c.id);
  saveComments(left);
  res.json({ success: true, total: left.filter(x => x.type === c.type && x.targetId === c.targetId).length });
});

/* ---------- Shorts ---------- */
function shapeShort(s, ctx) {
  return {
    id: s.id, caption: s.caption, videoUrl: s.videoUrl, posterUrl: s.posterUrl || '', views: s.views || 0, createdAt: s.createdAt,
    author: { ...authorOf(ctx.users.get(s.userId)), username: (ctx.users.get(s.userId) || {}).username || '' },
    tags: ext.tagsOf ? ext.tagsOf(s) : [], ...(ext.shortExtras ? ext.shortExtras(s, ctx) : {}), mine: !!ctx.user && s.userId === ctx.user.id,
    ...summaryFrom(ctx.social, ctx.counts[`short:${s.id}`] || 0, 'short', s.id, ctx.user)
  };
}
function shortsCtx(req) {
  const counts = {};
  for (const c of getComments()) if (c.type === 'short') counts[`short:${c.targetId}`] = (counts[`short:${c.targetId}`] || 0) + 1;
  return { users: userMap(), user: getUser(req), social: getSocial(), counts };
}
app.get('/api/shorts', (req, res) => {
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
  let list = getShorts().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (ext.filterShorts) list = ext.filterShorts(list, req);
  if (ext.kidsBlocked && ext.kidsBlocked(getUser(req))) list = [];
  const first = typeof req.query.first === 'string' ? req.query.first : '';
  if (first && offset === 0) { const f = list.find(s => s.id === first); if (f) list = [f, ...list.filter(s => s.id !== first)]; }
  const ctx = shortsCtx(req);
  res.json({ total: list.length, items: list.slice(offset, offset + limit).map(s => shapeShort(s, ctx)), hasMore: offset + limit < list.length });
});
app.get('/api/shorts/:id', (req, res) => {
  const s = getShorts().find(x => x.id === req.params.id);
  const _u = getUser(req);
  if (!s || (s.hidden && !(_u && _u.id === s.userId)) || (ext.isBlockedBy && _u && ext.isBlockedBy(s.userId, _u.id) && false)) return res.status(404).json({ error: tr(req, 'short_not_found') });
  res.json(shapeShort(s, shortsCtx(req)));
});
app.post('/api/shorts', sameOrigin, requireUser, (req, res, next) => ext.cap ? ext.cap('short')(req, res, next) : next(), (req, res, next) => {
  if (hit(`short-up:${req.user.id}`, 10, 60 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
  next();
}, uploadShort.fields([{ name: 'video', maxCount: 1 }, { name: 'poster', maxCount: 1 }]), (req, res) => {
  const v = req.files && req.files.video && req.files.video[0];
  const p = req.files && req.files.poster && req.files.poster[0];
  const cleanup = () => { unlinkQuiet(v && v.path); unlinkQuiet(p && p.path); };
  if (!v) { cleanup(); return res.status(400).json({ error: tr(req, 'video_required'), code: 'video_required' }); }
  if (!['mp4', 'webm'].includes(sniffFile(v.path))) { cleanup(); return res.status(400).json({ error: tr(req, 'video_invalid'), code: 'video_invalid' }); }
  let posterUrl = '';
  if (p) {
    if (p.size <= 2 * 1024 * 1024 && ['jpeg', 'png', 'webp'].includes(sniffFile(p.path))) posterUrl = `/uploads/shorts/${p.filename}`;
    else unlinkQuiet(p.path);
  }
  if (ext.kidsBlocked && ext.kidsBlocked(req.user)) { cleanup(); return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' }); }
  const s = {
    id: crypto.randomUUID(), userId: req.user.id, caption: cleanBlock(req.body && req.body.caption, 200),
    videoUrl: `/uploads/shorts/${v.filename}`, posterUrl, size: v.size || 0, views: 0, createdAt: new Date().toISOString()
  };
  const list = getShorts(); list.unshift(s); saveShorts(list);
  recordEvent('short_upload', { shortId: s.id, username: req.user.username });
  if (ext.processShort) ext.processShort(s.id);
  if (ext.moderateShort) ext.moderateShort(s.id);
  res.status(201).json(shapeShort(s, shortsCtx(req)));
});
function removeShort(s) {
  unlinkQuiet(path.join(SHORTS_DIR, path.basename(s.videoUrl)));
  if (s.posterUrl) unlinkQuiet(path.join(SHORTS_DIR, path.basename(s.posterUrl)));
  saveShorts(getShorts().filter(x => x.id !== s.id));
  purgeTargetExtras('short', s.id);
  if (ext.purgeShort) ext.purgeShort(s);
}
function purgeTargetExtras(type, id) {
  saveComments(getComments().filter(c => !(c.type === type && c.targetId === id)));
  const social = getSocial(); delete social[`${type}:${id}`]; saveSocial(social);
}
app.delete('/api/shorts/:id', sameOrigin, requireUser, (req, res) => {
  const s = getShorts().find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: tr(req, 'short_not_found') });
  if (s.userId !== req.user.id) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
  removeShort(s);
  res.json({ success: true });
});
app.post('/api/shorts/:id/view', sameOrigin, (req, res) => {
  const list = getShorts();
  const s = list.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: tr(req, 'short_not_found') });
  // مشاهدة واحدة لكل جهاز/عنوان في الساعة لمنع التضخيم
  if (!hit(`short-view:${req.ip}:${s.id}`, 1, 60 * 60 * 1000)) {
    s.views = (s.views || 0) + 1; saveShorts(list);
    const a = getAnalytics(); const k = dayKey(); a.totalViews = Number(a.totalViews || 0) + 1; a.dailyViews[k] = Number(a.dailyViews[k] || 0) + 1; saveAnalytics(a);
  }
  res.json({ views: s.views || 0 });
});

/* ---------- ملفات الترجمة (SRT/VTT) ---------- */
const SUB_LANGS = { ar: 'العربية', en: 'English', ru: 'Русский', tr: 'Türkçe', fr: 'Français', de: 'Deutsch', es: 'Español', fa: 'فارسی', it: 'Italiano', 'zh-CN': '中文', und: '—' };
app.get('/api/movies/:id/subtitles/:sid', (req, res) => {
  const movie = getMovies().find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  if (!hasAccess(req, movie)) return res.status(403).json({ error: 'يجب شراء الفيلم أولاً.' });
  const meta = (movie.subtitles || []).find(x => x.id === req.params.sid);
  if (!meta) return res.status(404).json({ error: tr(req, 'subtitle_not_found') });
  const data = readJSON(path.join(SUBS_DIR, path.basename(meta.id) + '.json'), null);
  if (!data) return res.status(404).json({ error: tr(req, 'subtitle_not_found') });
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json({ id: meta.id, lang: meta.lang, label: meta.label, cues: data.cues });
});
app.post('/api/admin/movies/:id/subtitles', requireAdmin, uploadSub.single('subtitle'), (req, res) => {
  const movies = getMovies();
  const movie = movies.find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  if (!req.file) return res.status(400).json({ error: tr(req, 'subtitle_invalid') });
  const cues = parseSubtitles(decodeBuffer(req.file.buffer));
  if (!cues.length) return res.status(400).json({ error: tr(req, 'subtitle_invalid') });
  const lang = SUB_LANGS[req.body.lang] ? req.body.lang : 'und';
  const label = cleanLine(req.body.label, 40) || SUB_LANGS[lang];
  const id = crypto.randomBytes(8).toString('hex');
  writeJSONAtomic(path.join(SUBS_DIR, id + '.json'), { cues });
  (movie.subtitles ||= []).push({ id, lang, label, count: cues.length, createdAt: new Date().toISOString() });
  saveMovies(movies);
  res.status(201).json(publicMovie(movie));
});
app.delete('/api/admin/movies/:id/subtitles/:sid', requireAdmin, (req, res) => {
  const movies = getMovies();
  const movie = movies.find(m => m.id === req.params.id);
  if (!movie) return res.status(404).json({ error: 'الفيلم غير موجود' });
  const i = (movie.subtitles || []).findIndex(x => x.id === req.params.sid);
  if (i < 0) return res.status(404).json({ error: tr(req, 'subtitle_not_found') });
  unlinkQuiet(path.join(SUBS_DIR, path.basename(movie.subtitles[i].id) + '.json'));
  movie.subtitles.splice(i, 1);
  saveMovies(movies);
  res.json({ success: true });
});

/* ---------- الترجمة الفورية ---------- */
app.post('/api/translate', sameOrigin, async (req, res) => {
  const ip = req.ip || 'unknown';
  if (hit(`tr:${ip}`, 90, 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
  const { texts, to } = req.body || {};
  const from = typeof req.body.from === 'string' && /^[a-zA-Z-]{2,8}$/.test(req.body.from) ? req.body.from : 'auto';
  if (!Array.isArray(texts) || !texts.length || texts.length > 60 || typeof to !== 'string' || !translator.TARGETS.has(to)
    || texts.some(t => typeof t !== 'string' || t.length > 500) || texts.reduce((n, t) => n + t.length, 0) > 12000)
    return res.status(400).json({ error: tr(req, 'translate_bad'), code: 'translate_bad' });
  try {
    const r = await translator.translateMany(texts, to, from);
    res.json({ translations: r.translations, provider: r.provider });
  } catch (e) {
    res.status(502).json({ error: tr(req, 'translate_failed'), code: 'translate_failed' });
  }
});

/* ---------- إدارة المحتوى من لوحة الأدمن ---------- */
app.get('/api/admin/shorts', requireAdmin, (req, res) => {
  const ctx = shortsCtx({ headers: {} });
  res.json(getShorts().map(s => ({ ...shapeShort(s, { ...ctx, user: null }), username: (ctx.users.get(s.userId) || {}).username || '—', size: s.size || 0 })));
});
app.delete('/api/admin/shorts/:id', requireAdmin, (req, res) => {
  const s = getShorts().find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: tr(req, 'short_not_found') });
  removeShort(s);
  recordEvent('short_delete', { shortId: s.id });
  res.json({ success: true });
});
app.get('/api/admin/comments', requireAdmin, (req, res) => {
  const users = userMap(), movies = getMovies(), shorts = getShorts();
  const items = getComments().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200).map(c => {
    const t = c.type === 'movie' ? movies.find(m => m.id === c.targetId) : shorts.find(s => s.id === c.targetId);
    return { id: c.id, type: c.type, text: c.text, createdAt: c.createdAt, user: (users.get(c.userId) || {}).username || '—', target: t ? (t.title || t.caption || t.id) : '—' };
  });
  res.json(items);
});
app.delete('/api/admin/comments/:id', requireAdmin, (req, res) => {
  const comments = getComments();
  const c = comments.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: tr(req, 'comment_not_found') });
  saveComments(comments.filter(x => x.id !== c.id && x.parentId !== c.id));
  res.json({ success: true });
});

/* ---------- روابط المشاركة مع معاينة (Open Graph) ---------- */
const escAttr = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
app.get('/', (req, res, next) => {
  const mid = typeof req.query.movie === 'string' ? req.query.movie : '';
  const sid = typeof req.query.short === 'string' ? req.query.short : '';
  if (!mid && !sid) return next();
  let html;
  try { html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8'); } catch { return next(); }
  const base = `${req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  let title = '', desc = '', image = '', url = '';
  if (mid) { const m = getMovies().find(x => x.id === mid); if (m) { title = m.title; desc = m.description || ''; image = m.posterUrl; url = `${base}/?movie=${encodeURIComponent(m.id)}`; } }
  else { const s = getShorts().find(x => x.id === sid); if (s) { title = s.caption || 'Short'; desc = s.caption || ''; image = s.posterUrl; url = `${base}/?short=${encodeURIComponent(s.id)}`; } }
  if (!title) return next();
  const abs = u => (u && u.startsWith('/') ? base + u : u);
  const tags = `<meta property="og:site_name" content="سينما أسامة"><meta property="og:type" content="${mid ? 'video.movie' : 'video.other'}"><meta property="og:title" content="${escAttr(title)}"><meta property="og:description" content="${escAttr(desc.slice(0, 200))}"><meta property="og:url" content="${escAttr(url)}">${image ? `<meta property="og:image" content="${escAttr(abs(image))}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${escAttr(abs(image))}">` : ''}`;
  res.type('html').send(html.replace('</head>', tags + '</head>'));
});

/* حذف ما يتبع الفيلم (ترجمات + تعليقات + تفاعلات) */
function cleanupMovieExtras(movie) {
  for (const s of movie.subtitles || []) unlinkQuiet(path.join(SUBS_DIR, path.basename(s.id) + '.json'));
  purgeTargetExtras('movie', movie.id);
  if (ext.purgeMovie) ext.purgeMovie(movie);
}
/* ===================================================================== */

const v10ctx = {
  app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr, cleanLine, cleanBlock,
  getMovies, saveMovies, getShorts, saveShorts, getUsers, saveUsers, getComments, saveComments, getPayments, savePayments, getSocial,
  getAnalytics, saveAnalytics, recordEvent, publicUser, publicMovie, hasAccess, movieFileOf, shapeShort, shortsCtx, removeShort,
  passwordProblem, scryptAsync, SCRYPT_OPTS, hashToken, userSessions, persistSessions, getSession,
  autoVerifyReceipt, normalizeReceipt, paymentStatusFor, DATA_DIR, UPLOADS, ROOT, PRIVATE_DIR, SHORTS_DIR, SUBS_DIR, unlinkQuiet
};
sec.routes({ app, requireAdmin, sameOrigin, sessions, hit, ROOT, DATA_DIR, ADMIN_FILE, mailer: require('./lib/mailer'), adminName: () => { const a = readJSON(ADMIN_FILE, null); return a && a.username; } });
require('./lib/siteui')({ app, requireAdmin, sameOrigin, readJSON, writeJSONAtomic, DATA_DIR });
require('./lib/v10')(v10ctx);
require('./lib/v11')({ ...v10ctx, startUserSession, authorOf, userMap, findTarget, USERNAME_RE, summaryFrom, shapeComment, upload: { fields: (...a) => (rq, rs, nx) => upload.fields(...a)(rq, rs, nx), single: (...a) => (rq, rs, nx) => upload.single(...a)(rq, rs, nx) }, sniffFile, cleanupMovieExtras });

app.get('/admin',(req,res)=> getSession(req) ? res.sendFile(path.join(PUBLIC,'admin.html')) : res.redirect('/admin-login.html'));
app.get('/admin.html',(req,res)=> getSession(req) ? res.sendFile(path.join(PUBLIC,'admin.html')) : res.redirect('/admin-login.html'));
app.use(express.static(PUBLIC));
app.use('/uploads', express.static(UPLOADS, { maxAge:'1h', fallthrough:false }));

const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,UPLOADS),
  filename:(req,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase().slice(0,10);
    cb(null,`${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload=multer({
  storage,
  limits:{fileSize:20*1024*1024*1024}, // الحد الفعلي من الإعدادات (ext.cap)
  fileFilter:(req,file,cb)=>{
    const poster=file.fieldname==='poster';
    const ok=poster ? /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) : /^video\/(mp4|webm|ogg|quicktime)$/.test(file.mimetype);
    cb(ok?null:new Error('نوع الملف غير مسموح'),ok);
  }
});

app.get('/api/movies',(req,res)=>{
  const movies=getMovies();
  const a=getAnalytics(); markUniqueDevice(req,a); saveAnalytics(a);
  res.json((ext.filterMovies?ext.filterMovies(movies,req):movies).map(publicMovie));
});

app.get('/api/categories',(req,res)=>{
  const categories=[...new Set(getMovies().map(m=>m.category||'عام'))].sort((a,b)=>a.localeCompare(b,'ar'));
  res.json(categories);
});

app.post('/api/movies/:id/view',(req,res)=>{
  const movies=getMovies(); const movie=movies.find(m=>m.id===req.params.id);
  if(!movie) return res.status(404).json({error:'الفيلم غير موجود'});
  if(!hasAccess(req,movie)) return res.status(403).json({error:'يجب شراء الفيلم أولاً.'});
  movie.views=Number(movie.views||0)+1; saveMovies(movies);
  const a=getAnalytics(); const k=dayKey(); a.totalViews=Number(a.totalViews||0)+1; a.dailyViews[k]=Number(a.dailyViews[k]||0)+1; markUniqueDevice(req,a); saveAnalytics(a);
  recordEvent('view',{movieId:movie.id,title:movie.title});
  res.json({views:movie.views});
});

app.post('/api/movies/:id/save-event',(req,res)=>{
  const movie=getMovies().find(m=>m.id===req.params.id);
  if(!movie) return res.status(404).json({error:'الفيلم غير موجود'});
  const a=getAnalytics(); const k=dayKey();
  a.totalSaves=Number(a.totalSaves||0)+1; a.dailySaves[k]=Number(a.dailySaves[k]||0)+1; markUniqueDevice(req,a); saveAnalytics(a);
  recordEvent('save',{movieId:movie.id,title:movie.title});
  res.json({success:true});
});

app.get('/api/admin/analytics',requireAdmin,(req,res)=>res.json(summarizeAnalytics()));

app.post('/api/movies',requireAdmin,(req,res,next)=>ext.cap?ext.cap('movie')(req,res,next):next(),upload.fields([{name:'poster',maxCount:1},{name:'video',maxCount:1}]),(req,res)=>{
  const cleanup=()=>{for(const f of [...(req.files?.poster||[]),...(req.files?.video||[])]){try{fs.unlinkSync(f.path)}catch{}}};
  try{
    const {title,category,description}=req.body;
    const posterFile=req.files?.poster?.[0]; const videoFile=req.files?.video?.[0];
    if(!String(title||'').trim()||!posterFile||!videoFile){cleanup();return res.status(400).json({error:'العنوان والبوستر والفيديو مطلوبة.'});}
    const isPaid=['true','on','1'].includes(String(req.body.isPaid||'').toLowerCase());
    let price=0,currency='',shamcashAccount='';
    if(isPaid){
      price=Number(String(req.body.price||'').replace(',','.'));
      currency=['SYP','USD'].includes(String(req.body.currency))?String(req.body.currency):'SYP';
      shamcashAccount=String(req.body.shamcashAccount||'').trim().slice(0,120);
      if(!Number.isFinite(price)||price<=0||price>1e9){cleanup();return res.status(400).json({error:'أدخل سعراً صحيحاً للفيلم المدفوع.'});}
      if(!shamcashAccount&&ext.defaultAccount)shamcashAccount=ext.defaultAccount();
      if(!shamcashAccount){cleanup();return res.status(400).json({error:'أدخل حساب شام كاش الذي سيستلم الدفع.'});}
    }
    const movies=getMovies();
    const movie={
      id:crypto.randomUUID(),
      title:String(title).trim().slice(0,160),
      category:String(category||'عام').trim().slice(0,60)||'عام',
      description:String(description||'').trim().slice(0,4000),
      posterUrl:`/uploads/${posterFile.filename}`,
      videoUrl:`/uploads/${videoFile.filename}`,
      posterSize:posterFile.size||0,
      fileSize:videoFile.size||0,
      views:0,
      createdAt:new Date().toISOString()
    };
    if(ext.catalogFrom)Object.assign(movie,ext.catalogFrom(req.body));
    if(req.body.publishAt){const d=new Date(req.body.publishAt);if(!isNaN(d)&&d.getTime()>Date.now())movie.publishAt=d.toISOString();}
    if(isPaid){
      // الفيديو المدفوع يُنقل إلى مجلد خاص لا يمكن الوصول له إلا بعد التحقق من الدفع
      fs.renameSync(videoFile.path,path.join(PRIVATE_DIR,videoFile.filename));
      Object.assign(movie,{isPaid:true,price,currency,shamcashAccount,videoFile:videoFile.filename,videoUrl:''});
    }
    movies.unshift(movie); saveMovies(movies);
    const a=getAnalytics(); a.uploads=Number(a.uploads||0)+1; saveAnalytics(a);
    recordEvent('upload',{movieId:movie.id,title:movie.title});
    if(ext.processMovie)ext.processMovie(movie.id);
    res.status(201).json(publicMovie(movie));
  }catch(e){cleanup();res.status(500).json({error:'حدث خطأ في الخادم'});}
});

app.delete('/api/movies/:id',requireAdmin,(req,res)=>{
  const movies=getMovies(); const movie=movies.find(m=>m.id===req.params.id);
  if(!movie) return res.status(404).json({error:'الفيلم غير موجود'});
  for(const url of [movie.posterUrl,movie.videoUrl]){
    if(typeof url==='string'&&url.startsWith('/uploads/')){
      const file=path.join(ROOT,url.replace(/^\/+/,''));
      if(fs.existsSync(file)) try{fs.unlinkSync(file);}catch{}
    }
  }
  if(movie.videoFile){const pf=path.join(PRIVATE_DIR,path.basename(movie.videoFile));if(fs.existsSync(pf)) try{fs.unlinkSync(pf);}catch{}}
  saveMovies(movies.filter(m=>m.id!==req.params.id));
  cleanupMovieExtras(movie);
  const a=getAnalytics(); a.deletes=Number(a.deletes||0)+1; saveAnalytics(a);
  recordEvent('delete',{movieId:movie.id,title:movie.title});
  res.json({success:true});
});

app.get('/api/admin/health',requireAdmin,(req,res)=>{
  const movies=getMovies(); const storageBytes=movies.reduce((s,m)=>s+Number(m.fileSize||0)+Number(m.posterSize||0),0);
  res.json({status:'ok',uptime:process.uptime(),storageBytes,movies:movies.length,node:process.version,memory:process.memoryUsage().rss});
});

app.use((err,req,res,next)=>{
  if(err instanceof multer.MulterError || err) return res.status(400).json({error:err.message||'تعذر تنفيذ العملية'});
  next();
});

const srv = app.listen(PORT,()=>console.log(`Cinema server listening on http://localhost:${PORT}`));
sec.server(srv);
