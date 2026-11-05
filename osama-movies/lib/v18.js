/* ===================================================================
   الإصدار 18 — صفحة «عنّي والتواصل»: مقالة عن صاحب الموقع + أمان الموقع + أيقونات تواصل مع الدعم
   المحتوى قابل للتعديل من لوحة الإدارة (قسم «عنّي والتواصل»).
   =================================================================== */
const path = require('path');
module.exports = function registerV18(c) {
  const { app, readJSON, writeJSONAtomic, requireAdmin, sameOrigin, DATA_DIR } = c;
  const FILE = path.join(DATA_DIR, 'about.json');

  const DEFAULTS = {
    owner: 'أسامة',
    contacts: { whatsapp: '+963984215420', telegram: '+963984215420', tiktok: 'osama_200934', instagram: 'osama_yosif2' },
    texts: {
      ar: {
        aboutTitle: 'من أنا',
        about: `مرحباً، أنا أسامة، صاحب «سينما أسامة» والمشرف عليها.\n\nبدأت الفكرة من حبّي للسينما ورغبتي في مكان بسيط وجميل يجمع الأفلام بتجربة مريحة، ويخاطب الجميع بلغتهم: العربية والإنجليزية والروسية.\n\nأضفت للموقع خطوة بعد خطوة ما يحتاجه المشاهد وصاحب القناة معاً: قنوات للمبدعين، ونشر الأفلام، والبث المباشر، وتوثيق الحسابات، ومساعداً ذكياً يبحث عن الفيلم ويشغّله. وجعلت الدفع عبر «شام كاش» لأنه الأقرب لإمكانات أغلب الناس عندنا.\n\nأؤمن أن ثلاثة أشياء تصنع منصة جيدة: محتوى يستحق المشاهدة، وتجربة سهلة وجميلة، وأمان يحمي بيانات من يثق بنا. يسعدني سماع اقتراحاتك وملاحظاتك في أي وقت عبر أيقونات التواصل.\n\nشكراً لأنك هنا 🎬`,
        securityTitle: 'أمان الموقع',
        security: `أمانك أولويتنا. هذه أهم الإجراءات المطبّقة فعلاً في الموقع:\n\n🔐 كلمات المرور: لا تُحفظ نصاً أبداً، بل مشفّرة بخوارزمية scrypt القوية مع «ملح» خاص بكل حساب، فلا يمكن لأحد، حتى الإدارة، قراءتها.\n\n🍪 الجلسات: ملفات تعريف الارتباط محمية (HttpOnly وSameSite) فلا تستطيع سكربتات خبيثة سرقتها، وتُفعَّل خاصية Secure عند استخدام HTTPS.\n\n🛡️ الحماية من الإساءة: حدّ لعدد المحاولات في الدخول والتعليقات والبث والمدفوعات وغيرها، وفحص مصدر الطلبات لمنع الطلبات المزوَّرة.\n\n🧱 رؤوس أمان للمتصفح: منع تخمين نوع الملفات، ومنع تضمين الموقع في صفحات الآخرين، وضبط سياسة الإحالة.\n\n💳 المدفوعات: لا نجمع بطاقات ولا بيانات بنكية إطلاقاً. تتم عبر «شام كاش» خارج الموقع، ونحفظ رقم الإيصال فقط ليراجعه المشرف يدوياً.\n\n🎬 الأفلام المدفوعة: ملفاتها في مجلد خاص لا يُفتح إلا بعد التحقق من الدفع.\n\n📁 الرفع: حدود لحجم الملفات وأنواعها، ومراجعة اختيارية لما ينشره المستخدمون قبل ظهوره.\n\n👑 حساب الإدارة: جلسة منفصلة، وتغيير كلمة المرور يُنهي الجلسات الأخرى فوراً.\n\n💾 نسخ احتياطي تلقائي للبيانات.\n\n⚠️ بصراحة: لا يوجد نظام آمن 100%. نوصيك بكلمة مرور قوية وفريدة، وبعدم مشاركتها مع أحد، ولا تُدخل رقم الإيصال إلا في خانته داخل الموقع. وإن لاحظت أي شيء مريب فراسلنا فوراً عبر التواصل.`,
        contactTitle: 'تواصل مع الدعم',
        contactHint: 'اضغط على الأيقونة لتنتقل مباشرة إلى المحادثة أو الحساب.',
      },
      en: {
        aboutTitle: 'About me',
        about: `Hi, I'm Osama, the owner and manager of "Osama Cinema".\n\nThe idea started from my love of cinema and a wish for a simple, beautiful place that brings movies together in a comfortable experience, in the viewer's own language: Arabic, English and Russian.\n\nStep by step I added what both viewers and creators need: channels for creators, movie publishing, live streaming, account verification, and a smart assistant that finds a movie and plays it. Payments go through Sham Cash because it fits what most people here can use.\n\nI believe three things make a good platform: content worth watching, an easy and beautiful experience, and security that protects the people who trust us. I'm happy to hear your suggestions any time through the contact icons.\n\nThanks for being here 🎬`,
        securityTitle: 'Site security',
        security: `Your safety comes first. These are the protections actually in place:\n\n🔐 Passwords are never stored as text — they are hashed with the strong scrypt algorithm and a per-account salt, so nobody, not even the admin, can read them.\n\n🍪 Sessions use protected cookies (HttpOnly, SameSite) so malicious scripts can't steal them, and Secure is added over HTTPS.\n\n🛡️ Abuse protection: rate limits on login, comments, live, payments and more, plus same-origin checks against forged requests.\n\n🧱 Browser security headers: no content sniffing, no embedding in other sites, and a strict referrer policy.\n\n💳 Payments: we never collect cards or banking details. Payment happens outside the site via Sham Cash; we only keep the receipt number for the admin to check manually.\n\n🎬 Paid movies are stored in a private folder that opens only after payment is verified.\n\n📁 Uploads have size/type limits, with optional review of user posts before they appear.\n\n👑 Admin account: separate session; changing the password ends all other sessions at once.\n\n💾 Automatic data backups.\n\n⚠️ Honestly: no system is 100% secure. Use a strong unique password, never share it, and enter a receipt number only in its field on the site. If you notice anything suspicious, contact us right away.`,
        contactTitle: 'Contact support',
        contactHint: 'Tap an icon to jump straight to the chat or profile.',
      },
      ru: {
        aboutTitle: 'Обо мне',
        about: `Привет, я Осама, владелец и администратор «Osama Cinema».\n\nИдея родилась из любви к кино и желания создать простое и красивое место для фильмов — на языке зрителя: арабском, английском и русском.\n\nШаг за шагом я добавлял всё, что нужно и зрителям, и авторам: каналы, публикацию фильмов, прямые эфиры, верификацию аккаунтов и умного помощника, который находит и запускает фильм. Оплата идёт через Sham Cash — он доступен большинству людей у нас.\n\nХорошую платформу делают три вещи: достойный контент, удобный и красивый интерфейс и безопасность для тех, кто нам доверяет. Буду рад вашим предложениям — пишите через иконки ниже.\n\nСпасибо, что вы здесь 🎬`,
        securityTitle: 'Безопасность сайта',
        security: `Ваша безопасность — приоритет. Вот что реально реализовано:\n\n🔐 Пароли никогда не хранятся открытым текстом: используется надёжный алгоритм scrypt с индивидуальной солью — прочитать их не может никто, даже администратор.\n\n🍪 Сессии защищены cookie (HttpOnly, SameSite); при HTTPS добавляется Secure.\n\n🛡️ Защита от злоупотреблений: ограничения частоты запросов на вход, комментарии, эфиры, платежи и др., а также проверка источника запросов.\n\n🧱 Заголовки безопасности браузера: запрет угадывания типов файлов, запрет встраивания сайта в чужие страницы, строгая политика реферера.\n\n💳 Платежи: мы не собираем данные карт и банков. Оплата идёт вне сайта через Sham Cash; хранится только номер квитанции для ручной проверки.\n\n🎬 Платные фильмы лежат в закрытой папке и открываются только после проверки оплаты.\n\n📁 Загрузки ограничены по размеру и типу, возможна предварительная модерация публикаций пользователей.\n\n👑 Аккаунт администратора: отдельная сессия; смена пароля сразу завершает остальные сессии.\n\n💾 Автоматические резервные копии данных.\n\n⚠️ Честно: абсолютно безопасных систем нет. Используйте надёжный уникальный пароль, никому его не сообщайте и вводите номер квитанции только в предназначенное поле на сайте. Заметили подозрительное — сразу напишите нам.`,
        contactTitle: 'Связаться с поддержкой',
        contactHint: 'Нажмите на иконку, чтобы сразу перейти в чат или профиль.',
      },
    },
  };

  const digits = v => String(v || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const phoneOk = v => /^\+?\d{7,15}$/.test(v);
  const handle = v => String(v || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(tiktok|instagram)\.com\/@?/i, '').split(/[/?#]/)[0].slice(0, 40);
  const cfg = () => {
    const s = readJSON(FILE, {}); const out = JSON.parse(JSON.stringify(DEFAULTS));
    if (s.owner) out.owner = String(s.owner).slice(0, 60);
    Object.assign(out.contacts, s.contacts || {});
    for (const l of ['ar', 'en', 'ru']) for (const [f, v] of Object.entries((s.texts || {})[l] || {})) if (v) out.texts[l][f] = v;
    return out;
  };
  const links = k => {
    const L = [], c = k.contacts;
    const w = digits(c.whatsapp).replace(/^\+/, ''); if (phoneOk('+' + w)) L.push({ id: 'whatsapp', url: `https://wa.me/${w}`, label: 'WhatsApp' });
    const t = digits(c.telegram); if (phoneOk(t)) L.push({ id: 'telegram', url: `https://t.me/${t.startsWith('+') ? t : '+' + t}`, label: 'Telegram' });
    const tk = handle(c.tiktok); if (/^[\w.]{2,40}$/.test(tk)) L.push({ id: 'tiktok', url: `https://www.tiktok.com/@${tk}`, label: 'TikTok' });
    const ig = handle(c.instagram); if (/^[\w.]{2,40}$/.test(ig)) L.push({ id: 'instagram', url: `https://www.instagram.com/${ig}/`, label: 'Instagram' });
    return L;
  };
  app.get('/api/about', (req, res) => { const k = cfg(); res.json({ owner: k.owner, texts: k.texts, links: links(k) }); });
  app.get('/api/admin/about', requireAdmin, (req, res) => { const k = cfg(); res.json({ owner: k.owner, contacts: k.contacts, texts: k.texts }); });
  app.put('/api/admin/about', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}, cur = readJSON(FILE, {}); const next = { ...cur, contacts: { ...(cur.contacts || {}) }, texts: { ...(cur.texts || {}) } };
    if ('owner' in b) next.owner = String(b.owner || '').trim().slice(0, 60);
    if (b.contacts && typeof b.contacts === 'object') {
      for (const k of ['whatsapp', 'telegram']) if (k in b.contacts) { const raw = String(b.contacts[k] || '').trim(), v = digits(raw); if (raw && !phoneOk(v)) return res.status(400).json({ error: `رقم ${k} غير صالح — اكتبه بصيغة دولية مثل +963984215420.` }); next.contacts[k] = v; }
      for (const k of ['tiktok', 'instagram']) if (k in b.contacts) { const raw = String(b.contacts[k] || '').trim(), v = handle(raw); if (raw && !/^[\w.]{2,40}$/.test(v)) return res.status(400).json({ error: `اسم ${k} غير صالح.` }); next.contacts[k] = v; }
    }
    if (b.texts && typeof b.texts === 'object') for (const l of ['ar', 'en', 'ru']) if (b.texts[l] && typeof b.texts[l] === 'object') {
      next.texts[l] = { ...(next.texts[l] || {}) };
      for (const f of ['aboutTitle', 'about', 'securityTitle', 'security', 'contactTitle', 'contactHint']) if (f in b.texts[l]) next.texts[l][f] = String(b.texts[l][f] || '').replace(/\u0000/g, '').slice(0, f.endsWith('Title') || f === 'contactHint' ? 120 : 8000);
    }
    writeJSONAtomic(FILE, next); const k = cfg(); res.json({ ok: true, links: links(k) });
  });
};
