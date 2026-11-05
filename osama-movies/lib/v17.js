/* ===================================================================
   الإصدار 17 — «مساعد أسامة»: مساعد ذكي محلي بلا API ولا خدمة خارجية
   • للزوار: بحث واقتراح أفلام حسب الاسم/التصنيف/الممثل/المزاج + أسئلة شائعة عن الموقع (عربي/English/Русский)
   • للإدارة: ملخص الموقع، ما يحتاج مراجعة، جودة المحتوى، توليد وصف ووسوم مقترحة
   يعتمد على قواعد ومطابقة نصوص (ليس نموذجاً لغوياً)، يعمل دون إنترنت ودون أي تكلفة.
   =================================================================== */
const path = require('path');

module.exports = function registerV17(c) {
  const { app, ext, readJSON, writeJSONAtomic, requireAdmin, sameOrigin, hit, getMovies, getUsers, getPayments, getAnalytics, publicMovie, DATA_DIR } = c;
  const F = n => path.join(DATA_DIR, n);

  /* ---------- تطبيع النص (عربي/لاتيني/كيريلي) ---------- */
  const norm = s => String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(('في من على الى عن مع هل ما ماذا اريد ابي بدي اطلب اعطني اعطيني اقترح لي لو سمحت شو كم فيلم افلام فلم أفلام the a an of for me show find movie movies film films please want some i to and or с в на и по для мне хочу фильм фильмы покажи найди').split(' ').map(norm));
  const toks = s => norm(s).split(' ').map(w => (w.length > 4 && w.startsWith('ال')) ? w.slice(2) : w).filter(w => w.length > 1 && !STOP.has(w));
  const lang = (q, hint) => /[Ѐ-ӿ]/.test(q) ? 'ru' : /[؀-ۿ]/.test(q) ? 'ar' : (/^(en|ru|ar)$/.test(hint) ? hint : 'en');
  const L = (l, ar, en, ru) => l === 'ru' ? ru : l === 'en' ? en : ar;

  /* ---------- مزاج → كلمات مفتاحية (تصنيفات/وسوم) ---------- */
  const MOODS = [
    { k: 'funny', w: ['مضحك', 'كوميدي', 'كوميديا', 'ضحك', 'تسلي', 'funny', 'comedy', 'смешн', 'комеди'], match: ['كوميد', 'comed', 'комед', 'ضحك'] },
    { k: 'scary', w: ['مخيف', 'رعب', 'خوف', 'scary', 'horror', 'ужас', 'страшн'], match: ['رعب', 'horror', 'ужас', 'مخيف'] },
    { k: 'action', w: ['اكشن', 'قتال', 'حركه', 'مغامر', 'action', 'боевик', 'экшн'], match: ['اكشن', 'action', 'боевик', 'مغامر', 'حركه'] },
    { k: 'sad', w: ['حزين', 'دراما', 'مؤثر', 'تبكي', 'drama', 'sad', 'драма', 'грустн'], match: ['دراما', 'drama', 'драма', 'حزين'] },
    { k: 'romance', w: ['رومانسي', 'حب', 'عاطفي', 'romance', 'love', 'романт', 'любов'], match: ['رومانس', 'romance', 'романт', 'حب'] },
    { k: 'kids', w: ['اطفال', 'كرتون', 'رسوم', 'kids', 'cartoon', 'anime', 'мульт', 'детск'], match: ['اطفال', 'كرتون', 'kids', 'animation', 'мульт', 'رسوم', 'انمي'] },
    { k: 'doc', w: ['وثائقي', 'وثائقيات', 'documentary', 'документал'], match: ['وثائق', 'documentary', 'документал'] },
    { k: 'scifi', w: ['خيال', 'علمي', 'فضاء', 'scifi', 'sci-fi', 'fantasy', 'фантаст'], match: ['خيال', 'sci', 'fantasy', 'фантаст'] },
    { k: 'crime', w: ['جريمه', 'غموض', 'تشويق', 'اثاره', 'thriller', 'crime', 'mystery', 'триллер', 'детектив'], match: ['جريم', 'غموض', 'تشويق', 'thriller', 'crime', 'триллер', 'детектив'] },
    { k: 'series', w: ['مسلسل', 'مسلسلات', 'حلقات', 'series', 'show', 'сериал'], match: ['مسلسل', 'series', 'сериал'] },
  ];
  const SHORTQ = ['قصير', 'قصيره', 'short', 'quick', 'коротк'];
  const NEWQ = ['جديد', 'احدث', 'اخر', 'new', 'latest', 'recent', 'нов', 'свеж'];
  const TOPQ = ['اشهر', 'مشاهده', 'مشهور', 'افضل', 'الاكثر', 'popular', 'top', 'best', 'trending', 'популярн', 'лучш', 'топ'];
  const RANDQ = ['اي', 'عشوايي', 'فاجيني', 'random', 'surprise', 'любой', 'случайн'];
  const has = (n, list) => list.some(w => n.includes(norm(w)));

  const movieText = m => norm([m.title, m.category, m.director, (m.cast || []).join(' '), (m.tags || []).join(' '), m.country, m.year, m.description].join(' '));
  const card = m => { const p = publicMovie(m); return { id: p.id, title: p.title, posterUrl: p.posterUrl, category: p.category, year: p.year || '', views: Number(p.views || 0), isPaid: !!p.isPaid }; };
  const catalog = req => {
    const base = ext.filterMovies ? ext.filterMovies(getMovies(), req) : getMovies();
    return base.filter(m => !(ext.isScheduled && ext.isScheduled(m)) && !m.pending);
  };
  const pick = (arr, n) => arr.slice(0, n);

  /* ---------- أسئلة شائعة عن الموقع (مفتاح كلمات → جواب) ---------- */
  const FAQ = [
    { w: ['شام كاش', 'شامكاش', 'دفع', 'ادفع', 'سعر', 'اشتراك', 'اشترك', 'باقه', 'باقات', 'ايصال', 'اشعار', 'pay', 'payment', 'subscribe', 'subscription', 'price', 'plan', 'receipt', 'sham', 'оплат', 'подписк', 'цена', 'чек'],
      a: [`الدفع عبر شام كاش: افتح بطاقة الفيلم أو الباقة، انسخ رقم الحساب المثبّت عليها وحوّل المبلغ، ثم أدخل رقم الإيصال (أرقام فقط، من 6 إلى 14 رقماً) واضغط إرسال. تراجع الإدارة الدفعة يدوياً ويُفتح لك المحتوى عند الموافقة.`,
        `Pay with Sham Cash: open the movie/plan card, copy the pinned account number, transfer the amount, then enter the receipt number (digits only, 6–14) and send. The admin reviews it manually and unlocks your access once approved.`,
        `Оплата через Sham Cash: откройте карточку фильма/тарифа, скопируйте номер счёта, переведите сумму и введите номер квитанции (только цифры, 6–14). Администратор проверит вручную и откроет доступ.`] },
    { w: ['توثيق', 'موثق', 'علامه زرقاء', 'شاره', 'verify', 'verified', 'badge', 'верификац', 'галочк'],
      a: [`التوثيق: من قائمة حسابك اختر «طلب التوثيق» (وقد يتطلب دفع رسوم عبر شام كاش حسب إعدادات الإدارة). بعد موافقة الإدارة تظهر علامة ✓ زرقاء بجانب اسمك وقناتك.`,
        `Verification: open your account menu and choose "Request verification" (it may require a Sham Cash fee). After admin approval a blue ✓ appears next to your name and channel.`,
        `Верификация: в меню аккаунта выберите «Запрос верификации» (может потребоваться оплата через Sham Cash). После одобрения рядом с именем появится синяя ✓.`] },
    { w: ['انشر', 'نشر', 'ارفع', 'رفع', 'قناتي', 'قناه', 'استوديو', 'publish', 'upload', 'channel', 'studio', 'опубликов', 'загруз', 'канал'],
      a: [`النشر: سجّل الدخول ثم من القائمة الجانبية اختر «انشر فيلماً» (أو استوديو القناة). قد تُراجَع أفلامك من الإدارة قبل ظهورها. من «تخصيص القناة» تغيّر الاسم والرابط والصورة والبانر.`,
        `Publishing: sign in, then choose "Publish a movie" (or Channel studio) from the side menu. Your uploads may be reviewed by the admin first. Use "Customize channel" to change name, link, avatar and banner.`,
        `Публикация: войдите и выберите «Опубликовать фильм» (или Студия канала) в боковом меню. Админ может проверить загрузку. В «Настройках канала» меняются имя, ссылка, аватар и баннер.`] },
    { w: ['بث', 'مباشر', 'لايف', 'live', 'stream', 'streaming', 'прямой', 'эфир', 'трансляц'],
      a: [`البث المباشر: أصحاب القنوات يبدؤون البث من استوديو القناة (كاميرا أو شاشة)، ويشاهده الجميع من قسم «مباشر» مع دردشة وتفاعلات. يتطلب متصفح Chrome/Edge/Firefox.`,
        `Live: channel owners start a broadcast from Channel studio (camera or screen); everyone watches from the "Live" section with chat and reactions. Needs Chrome/Edge/Firefox.`,
        `Прямой эфир: владельцы каналов запускают трансляцию из Студии (камера или экран); зрители смотрят в разделе «Прямой эфир» с чатом и реакциями. Нужен Chrome/Edge/Firefox.`] },
    { w: ['ترجمه', 'ترجمات', 'subtitle', 'subtitles', 'captions', 'субтитр'],
      a: [`الترجمة: داخل المشغّل اضغط ⚙ الإعدادات ثم «الترجمة» واختر اللغة إن توفرت لهذا الفيلم.`,
        `Subtitles: in the player press the ⚙ settings button, then "Subtitles" and pick a language if the movie has one.`,
        `Субтитры: в плеере нажмите ⚙ → «Субтитры» и выберите язык, если он есть у фильма.`] },
    { w: ['مظهر', 'لون', 'ثيم', 'وضع', 'داكن', 'فاتح', 'زجاج', 'ضبابيه', 'theme', 'dark', 'light', 'appearance', 'color', 'тема', 'оформлен', 'цвет'],
      a: [`المظهر: افتح «المظهر» من القائمة الجانبية لاختيار ثيم جاهز أو تخصيص اللون والخلفية ودرجة الزجاجية والضبابية.`,
        `Appearance: open "Appearance" in the side menu to pick a ready theme or customize colour, background, glass level and blur.`,
        `Оформление: откройте «Оформление» в боковом меню — готовые темы, цвет, фон, прозрачность и размытие.`] },
    { w: ['كلمه المرور', 'نسيت', 'حسابي', 'تسجيل', 'password', 'forgot', 'login', 'sign in', 'register', 'пароль', 'вход', 'регистрац'],
      a: [`الحساب: من زر الدخول يمكنك إنشاء حساب أو تسجيل الدخول. إن نسيت كلمة المرور استخدم «نسيت كلمة المرور» في نافذة الدخول.`,
        `Account: use the sign-in button to register or log in. If you forgot your password use "Forgot password" in the login window.`,
        `Аккаунт: кнопка входа — регистрация или авторизация. Если забыли пароль — «Забыли пароль» в окне входа.`] },
    { w: ['اطفال', 'وضع الاطفال', 'اهلي', 'kids mode', 'parental', 'детский режим'],
      a: [`وضع الأطفال: يخفي المحتوى غير المناسب للعمر. فعّله من إعدادات حسابك.`, `Kids mode hides age-inappropriate content. Enable it in your account settings.`, `Детский режим скрывает неподходящий контент. Включается в настройках аккаунта.`] },
  ];
  const HELLO = ['مرحبا', 'اهلا', 'هلا', 'سلام', 'hello', 'hi', 'hey', 'привет', 'здравствуй'];
  const THANKS = ['شكرا', 'مشكور', 'thanks', 'thank', 'спасибо'];


  /* ---------- معرفة يعلّمها المدير + أسئلة عن الأفلام + أوامر التشغيل (v17.4) ---------- */
  const PLAYV = /(^|\s)(شغل|شغلي|شغلها|شغله|شغلو|play|watch|включи|запусти|شاهد|اريد مشاهده|ابي اشوف|بدي اشوف|بدي شاهد|خلني اشوف|خليني اشوف)(\s|$)/;
  const SEARCHV = /(ابحث|دور|فتش|search|find|найди)/;
  const stripVerbs = n => n.replace(/(^|\s)(ابحث|دور|فتش|search|find|найди|عن|لي|على|شغل|شغلي|شغلها|شغله|شغلو|play|watch|включи|запусти|افتح|اعرض|عرض|شاهد|اريد مشاهده|ابي اشوف|بدي اشوف|بدي شاهد|خلني اشوف|خليني اشوف|و|ثم|بعدين|وبعدين|الان|فورا|فيلم|فلم|film|movie|مسلسل)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  function movieByName(n, all) { // أطول عنوان مذكور داخل الجملة
    let best = null; for (const m of all) { const t = norm(m.title); if (t.length > 2 && (' ' + n + ' ').includes(' ' + t + ' ') && (!best || t.length > norm(best.title).length)) best = m; } return best;
  }
  const FACTS = [
    { k: 'cast', re: /(بطول|بطل|يمثل|ممثل|الممثلين|من فيه|who stars|cast|starring|актер|в ролях)/, f: (m, l) => (m.cast || []).length ? L(l, `بطولة ${m.cast.join('، ')}.`, `Starring ${m.cast.join(', ')}.`, `В ролях: ${m.cast.join(', ')}.`) : L(l, 'لا توجد معلومات عن الممثلين لهذا الفيلم.', 'No cast info for this movie.', 'Нет данных об актёрах.') },
    { k: 'dir', re: /(مخرج|اخراج|اخرج|director|directed|режисс)/, f: (m, l) => m.director ? L(l, `من إخراج ${m.director}.`, `Directed by ${m.director}.`, `Режиссёр: ${m.director}.`) : L(l, 'لا توجد معلومات عن المخرج.', 'No director info.', 'Нет данных о режиссёре.') },
    { k: 'year', re: /(سنه|عام|متي صدر|متي نزل|year|when|released|год|когда)/, f: (m, l) => m.year ? L(l, `صدر عام ${m.year}.`, `Released in ${m.year}.`, `Вышел в ${m.year} году.`) : L(l, 'سنة الإصدار غير مسجلة.', 'Release year not listed.', 'Год выхода не указан.') },
    { k: 'price', re: /(سعر|كم يكلف|بكم|مجاني|مدفوع|price|cost|free|paid|цена|стоит|бесплатн)/, f: (m, l) => m.isPaid ? L(l, `مدفوع: ${m.price} ${m.currency === 'USD' ? '$' : 'ل.س'} — الدفع عبر شام كاش.`, `Paid: ${m.price} ${m.currency === 'USD' ? 'USD' : 'SYP'} via Sham Cash.`, `Платный: ${m.price} ${m.currency === 'USD' ? 'USD' : 'SYP'} (Sham Cash).`) : L(l, 'الفيلم مجاني 🎉', 'This movie is free 🎉', 'Фильм бесплатный 🎉') },
    { k: 'cat', re: /(تصنيف|نوع|نوعه|category|genre|жанр)/, f: (m, l) => L(l, `التصنيف: ${m.category || 'عام'}.`, `Category: ${m.category || 'General'}.`, `Жанр: ${m.category || 'Общее'}.`) },
    { k: 'story', re: /(قصه|عن ماذا|عن ايش|عن شو|ملخص|حكايه|وصف|story|plot|about|summary|сюжет|о чем|описание)/, f: (m, l) => m.description ? m.description.slice(0, 400) : L(l, 'لا يوجد وصف لهذا الفيلم بعد.', 'No description yet.', 'Описания пока нет.') },
    { k: 'len', re: /(مده|طول|كم ساعه|duration|how long|длительност)/, f: (m, l) => m.duration ? L(l, `المدة ${Math.round(m.duration / 60)} دقيقة.`, `${Math.round(m.duration / 60)} min.`, `${Math.round(m.duration / 60)} мин.`) : L(l, 'المدة غير مسجّلة.', 'Duration not listed.', 'Длительность не указана.') },
  ];
  const CAP = /(ماذا تستطيع|ماذا تعرف|ماذا تفعل|شو بتعمل|شو بتقدر|من انت|مين انت|what can you do|who are you|кто ты|что ты умеешь|help|مساعده|ساعدني)/;
  function answerSmart(q, req, hint) {
    const l = lang(q, hint), n = norm(q); if (!n) return null;
    const out = { lang: l, text: '', movies: [], chips: [] };
    if (ext.kbMatch && ext.kbMatch(q)) return null; // معرفة المدير لها الأولوية
    if (CAP.test(n)) { out.text = L(l, 'أنا مساعد أسامة 🎬 أبحث لك عن الأفلام وأشغّلها بأمر واحد («شغّل فيلم X»)، أقترح حسب المزاج، أجيب عن قصة الفيلم وبطله ومخرجه وسعره، وعن الدفع والنشر والتوثيق والبث. وأتعلّم أشياء جديدة من إدارة الموقع.', "I'm Osama's assistant 🎬 I search and play movies on command (\"play X\"), suggest by mood, answer about a movie's story, cast, director and price, and about payments, publishing, verification and live. I keep learning from the site admin.", 'Я помощник Осамы 🎬 Ищу и запускаю фильмы по команде («включи X»), советую по настроению, отвечаю о сюжете, актёрах, режиссёре и цене, об оплате, публикации и эфирах.'); return out; }
    const all = ext.filterMovies ? ext.filterMovies(getMovies(), req).filter(m => !m.pending && !(ext.isScheduled && ext.isScheduled(m))) : getMovies();
    // أسئلة عن فيلم محدد
    const named = movieByName(n, all);
    if (named) { const fact = FACTS.find(x => x.re.test(n)); if (fact && !PLAYV.test(n)) { out.text = `🎬 «${named.title}»: ` + fact.f(named, l); out.movies = [{ id: named.id, title: named.title, posterUrl: named.posterUrl, category: named.category, year: named.year || '', isPaid: !!named.isPaid, views: named.views || 0 }]; out.chips = [L(l, `شغّل ${named.title}`, `Play ${named.title}`, `Включи ${named.title}`)]; return out; } }
    return null;
  }
  ext.answerSmart = answerSmart;

  /* ---------- محرك الإجابة العام ---------- */
  function answerPublic(q, req, hint) {
    const l = lang(q, hint), n = norm(q), words = toks(q), all = catalog(req);
    const out = { lang: l, text: '', movies: [], chips: [] };
    { const sm = answerSmart(q, req, hint); if (sm) { sm.chips = sm.chips && sm.chips.length ? sm.chips : [L(l, 'اقترح لي فيلماً', 'Suggest a movie', 'Посоветуй фильм'), L(l, 'الأكثر مشاهدة', 'Most watched', 'Самые популярные')]; return sm; } }
    const chips = () => [L(l, 'اقترح لي فيلماً', 'Suggest a movie', 'Посоветуй фильм'), L(l, 'أحدث الأفلام', 'Latest movies', 'Новинки'), L(l, 'الأكثر مشاهدة', 'Most watched', 'Самые популярные'), L(l, 'كيف أدفع؟', 'How do I pay?', 'Как оплатить?')];
    if (!n) { out.text = L(l, 'اكتب ما تبحث عنه، مثل: «فيلم كوميدي» أو اسم فيلم أو ممثل.', 'Type what you are looking for, e.g. "a comedy" or a title or actor.', 'Напишите, что ищете: «комедия», название или актёра.'); out.chips = chips(); return out; }
    if (has(n, THANKS) && words.length < 2) { out.text = L(l, 'العفو! أنا هنا لأي شيء تحتاجه 🎬', "You're welcome! 🎬", 'Пожалуйста! 🎬'); out.chips = chips(); return out; }
    if (has(n, HELLO) && words.length < 2) { out.text = L(l, 'أهلاً بك في سينما أسامة 👋 أبحث لك عن فيلم أو أجيب عن أسئلتك عن الموقع.', 'Welcome to Osama Cinema 👋 I can find a movie or answer questions about the site.', 'Добро пожаловать 👋 Помогу найти фильм или отвечу на вопросы о сайте.'); out.chips = chips(); return out; }

    // 0) معرفة علّمها المدير (أولوية على الأجوبة الجاهزة)
    const kb = ext.kbMatch && ext.kbMatch(q);
    const PLAY = /(^|\s)و?(شغل|شغلي|شغلها|شغله|شغلو|افتح|اعرض|عرض لي|شاهد|اريد مشاهده|ابي اشوف|بدي شوف|play|watch|open|stream|запусти|включи|смотреть|покажи фильм)(\s|$)/;
    if (kb && !PLAY.test(n)) { if (ext.kbHit) ext.kbHit(kb.id); out.text = kb.answer; out.chips = chips(); return out; }

    // 0.5) أمر تشغيل: «شغّل فيلم X» ← يبحث ويفتح الفيلم مباشرة
    if (PLAY.test(n) && ext.smartSearch) {
      const rest = q.replace(/(?:^|\s)و?(شغّل|شغله|شغل|شغلي|شغلها|افتح|اعرض لي|اعرض|شاهد|اريد مشاهدة|أريد مشاهدة|ابي اشوف|بدي شوف|play|watch|open|stream|запусти|включи|смотреть)/gi, ' ').replace(/(لي|فيلم|الفيلم|مسلسل|movie|film|the)/gi, ' ').replace(/\s+/g, ' ').trim();
      const ss = ext.smartSearch(rest || q, req, 6);
      if (!rest && ss.items.length === 0) { const top = (ext.filterMovies ? ext.filterMovies(getMovies(), req) : getMovies()).filter(m => !m.pending && !(ext.isScheduled && ext.isScheduled(m))).sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0]; if (top) ss.items = [card(top)]; }
      const it = ss.items;
      const sure = it.length && (it.length === 1 || it[0].score >= (it[1].score || 0) * 1.35 || norm(it[0].title) === norm(rest));
      if (sure) { out.action = { type: 'play', id: it[0].id, title: it[0].title }; out.movies = [it[0]]; out.q = rest || q; out.text = L(l, `▶️ جارٍ تشغيل «${it[0].title}»…`, `▶️ Playing "${it[0].title}"…`, `▶️ Запускаю «${it[0].title}»…`); return out; }
      if (it.length) { out.movies = it; out.q = rest || q; out.text = L(l, 'وجدت أكثر من فيلم قريب — أيّها تقصد؟ اضغط على الفيلم لتشغيله.', 'Several close matches — which one? Tap to play.', 'Несколько вариантов — какой запустить?'); out.chips = []; return out; }
      if (ss.didYouMean) { out.text = L(l, `لم أجد هذا الفيلم. هل تقصد «${ss.didYouMean}»؟`, `Not found. Did you mean "${ss.didYouMean}"?`, `Не найдено. Возможно, «${ss.didYouMean}»?`); out.chips = [L(l, 'شغّل ', 'Play ', 'Запусти ') + ss.didYouMean]; return out; }
    }

    // 1) أسئلة الموقع
    let best = null, bs = 0;
    for (const f of FAQ) { let s = 0; for (const w of f.w) if (n.includes(norm(w))) s += norm(w).length > 4 ? 2 : 1; if (s > bs) { bs = s; best = f; } }
    const movieIntent = words.some(w => all.some(m => movieText(m).includes(w)));
    if (best && bs >= 2 && !(movieIntent && bs < 3)) { out.text = best.a[l === 'ru' ? 2 : l === 'en' ? 1 : 0]; out.chips = chips(); return out; }

    // 1.5) البحث الذكي (v17.3): مرادفات + تسامح إملائي + مرشّحات + تعلّم
    if (ext.smartSearch && words.length) {
      const ss = ext.smartSearch(q, req, 6);
      if (ss.items.length) {
        out.movies = ss.items; out.q = q;
        out.text = (ss.notes.length ? L(l, `فهمتُ: ${ss.notes.join(' • ')}\n`, `Understood: ${ss.notes.join(' • ')}\n`, `Понял: ${ss.notes.join(' • ')}\n`) : '') + L(l, 'هذه أنسب النتائج:', 'Best matches:', 'Лучшие совпадения:');
        out.chips = chips().slice(0, 3); return out;
      }
      if (ss.didYouMean) { out.text = L(l, `لم أجد تطابقاً. هل تقصد «${ss.didYouMean}»؟`, `No match. Did you mean "${ss.didYouMean}"?`, `Нет совпадений. Возможно, «${ss.didYouMean}»?`); out.chips = [ss.didYouMean, ...chips().slice(0, 2)]; return out; }
    }

    // 2) مزاج / قوائم خاصة
    const mood = MOODS.find(m => has(n, m.w));
    const wantShort = has(n, SHORTQ), wantNew = has(n, NEWQ), wantTop = has(n, TOPQ), wantRand = has(n, RANDQ) && !mood;
    let pool = all.slice();
    if (mood) { const sub = pool.filter(m => { const t = norm([m.category, (m.tags || []).join(' ')].join(' ')); return mood.match.some(k => t.includes(norm(k))); }); pool = sub.length ? sub : pool.filter(m => movieText(m).includes(norm(mood.match[0]))); }
    const rest = words.filter(w => !(mood && mood.w.map(norm).some(x => x.includes(w) || w.includes(x))) && !has(w, [...SHORTQ, ...NEWQ, ...TOPQ, ...RANDQ]));

    // 3) مطابقة نصية
    let scored = pool.map(m => {
      const t = movieText(m), title = norm(m.title); let s = 0;
      for (const w of rest) { if (title.includes(w)) s += 5; else if (t.includes(w)) s += 2; }
      if (norm(q).length > 2 && title === norm(q)) s += 10;
      return [m, s];
    });
    if (rest.length) scored = scored.filter(([, s]) => s > 0);
    if (wantTop) scored.sort((a, b) => b[1] - a[1] || Number(b[0].views || 0) - Number(a[0].views || 0));
    else if (wantNew) scored.sort((a, b) => b[1] - a[1] || String(b[0].createdAt).localeCompare(String(a[0].createdAt)));
    else scored.sort((a, b) => b[1] - a[1] || Number(b[0].views || 0) - Number(a[0].views || 0));
    let list = scored.map(([m]) => m);
    if (wantRand) list = list.slice().sort(() => Math.random() - 0.5);
    if (wantShort) list = list.filter(m => m.duration ? Number(m.duration) <= 3600 : true);

    if (list.length) {
      out.movies = pick(list, 6).map(card);
      out.text = wantTop ? L(l, 'هذه الأكثر مشاهدة:', 'Most watched right now:', 'Самые популярные:')
        : wantNew ? L(l, 'أحدث ما أُضيف:', 'Latest additions:', 'Недавно добавленные:')
        : mood || wantRand ? L(l, 'أقترح عليك:', 'I suggest:', 'Рекомендую:')
        : L(l, `وجدت ${list.length > 6 ? 'أكثر من 6' : list.length} نتيجة:`, `Found ${list.length > 6 ? 'more than 6' : list.length} result(s):`, `Найдено: ${list.length > 6 ? 'более 6' : list.length}`);
      out.chips = chips().slice(0, 3); return out;
    }
    if (ext.logUnanswered) ext.logUnanswered(q);
    out.text = L(l, 'لم أجد شيئاً مطابقاً. جرّب اسماً آخر، أو اكتب نوعاً مثل «كوميدي» أو «رعب»، أو اسأل عن الدفع والنشر والتوثيق.', "I couldn't find a match. Try another title, a genre like \"comedy\" or \"horror\", or ask about payments, publishing or verification.", 'Ничего не найдено. Попробуйте другое название, жанр («комедия», «ужасы») или спросите об оплате, публикации, верификации.');
    out.chips = chips(); return out;
  }

  app.post('/api/assist', sameOrigin, (req, res) => {
    if (hit(`assist:${req.ip}`, 40, 60 * 1000)) return res.status(429).json({ error: 'too many requests' });
    const q = String((req.body && req.body.q) || '').slice(0, 300);
    res.json(answerPublic(q, req, req.headers['x-lang']));
  });

  /* ---------- مساعد الإدارة ---------- */
  const R = () => readJSON(F('verify-requests.json'), []);
  function stats() {
    const movies = getMovies(), users = getUsers(), pays = getPayments(), a = getAnalytics() || {};
    const day = new Date().toISOString().slice(0, 10);
    return {
      movies: movies.length, users: users.length,
      pendingPayments: pays.filter(p => p.status === 'pending').length,
      pendingVerify: R().filter(r => r.status === 'pending').length,
      pendingUserMovies: movies.filter(m => m.pending).length,
      totalViews: Number(a.totalViews || 0), today: Number((a.dailyViews || {})[day] || 0),
      paidMovies: movies.filter(m => m.isPaid).length,
    };
  }
  const quality = () => {
    const ms = getMovies().filter(m => !m.pending);
    const noDesc = ms.filter(m => String(m.description || '').trim().length < 30);
    const noCat = ms.filter(m => !m.category || m.category === 'عام');
    const noTags = ms.filter(m => !(m.tags || []).length);
    const dupTitles = Object.values(ms.reduce((o, m) => { const k = norm(m.title); (o[k] = o[k] || []).push(m); return o; }, {})).filter(g => g.length > 1);
    const cold = ms.filter(m => Number(m.views || 0) === 0 && Date.now() - new Date(m.createdAt).getTime() > 14 * 864e5);
    const li = arr => arr.slice(0, 8).map(m => ({ id: m.id, title: m.title }));
    return { total: ms.length, noDesc: li(noDesc), noDescN: noDesc.length, noCat: li(noCat), noCatN: noCat.length, noTags: li(noTags), noTagsN: noTags.length,
      dups: dupTitles.slice(0, 5).map(g => g.map(m => m.title)[0]), dupsN: dupTitles.length, cold: li(cold), coldN: cold.length };
  };

  const WORDS = new Set(['الذي', 'التي', 'هذا', 'هذه', 'ذلك', 'عندما', 'بعد', 'قبل', 'خلال', 'حيث', 'كان', 'كانت', 'يكون', 'لكن', 'ايضا', 'كما', 'منذ', 'الى', 'على', 'عن', 'مع', 'التى', 'الذى', 'فيه', 'فيها', 'the', 'and', 'with', 'that', 'this', 'from', 'for', 'his', 'her', 'они', 'это', 'как', 'что', 'для', 'при'].map(norm));
  const suggestTags = text => {
    const f = {}; for (const w of toks(text)) if (w.length > 3 && !WORDS.has(w)) f[w] = (f[w] || 0) + 1;
    return Object.entries(f).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 6).map(x => x[0]);
  };
  const genDescription = b => {
    const t = String(b.title || '').trim(), cat = String(b.category || '').trim(), y = b.year ? ` (${b.year})` : '', dir = b.director ? ` من إخراج ${b.director}` : '', cast = (b.cast || []).length ? ` بطولة ${(Array.isArray(b.cast) ? b.cast : String(b.cast).split(/[,،]/)).map(x => x.trim()).filter(Boolean).slice(0, 4).join('، ')}` : '';
    if (!t) return '';
    const base = `${cat && cat !== 'عام' ? 'عمل ' + cat + 'ي' : 'عمل سينمائي'} بعنوان «${t}»${y}${dir}${cast}.`;
    return `${base} شاهده الآن بجودة عالية على سينما أسامة، مع ترجمة وخيارات تشغيل متعددة.`.slice(0, 600);
  };
  const BAD = ['شتم', 'قذر', 'كلب', 'حقير', 'fuck', 'shit', 'bitch', 'сука', 'блять'].map(norm);

  function answerAdmin(q) {
    const n = norm(q), s = stats(), out = { text: '', stats: null, links: [], items: [] };
    const link = (label, section) => out.links.push({ label, section });
    if (has(n, ['ملخص', 'نظره', 'احصاء', 'وضع الموقع', 'summary', 'overview', 'status', 'как дела', 'сводк']) || !n) {
      out.text = `📊 ملخص الموقع:\n• ${s.movies} فيلم (${s.paidMovies} مدفوع) و${s.users} مستخدم\n• المشاهدات: ${s.totalViews} إجمالاً، ${s.today} اليوم\n• بانتظار المراجعة: ${s.pendingPayments} دفعة، ${s.pendingVerify} طلب توثيق، ${s.pendingUserMovies} فيلم مستخدم`;
      out.stats = s; if (s.pendingPayments) link('المدفوعات', 'payments'); if (s.pendingVerify) link('التوثيق', 'verify'); if (s.pendingUserMovies) link('أفلام المستخدمين', 'usermovies'); return out;
    }
    if (has(n, ['مراجعه', 'ينتظر', 'معلق', 'pending', 'review', 'todo', 'ожидает'])) {
      const tot = s.pendingPayments + s.pendingVerify + s.pendingUserMovies;
      out.text = tot ? `⏳ يحتاج منك قراراً:\n• ${s.pendingPayments} دفعة\n• ${s.pendingVerify} طلب توثيق\n• ${s.pendingUserMovies} فيلم نشره مستخدم` : '✅ لا شيء معلّق الآن.';
      if (s.pendingPayments) link('المدفوعات', 'payments'); if (s.pendingVerify) link('التوثيق', 'verify'); if (s.pendingUserMovies) link('أفلام المستخدمين', 'usermovies'); return out;
    }
    if (has(n, ['جوده', 'ناقص', 'مشاكل', 'تدقيق', 'صحه المحتوى', 'quality', 'audit', 'missing', 'проверк', 'качеств'])) {
      const k = quality();
      out.text = `🔎 تدقيق المحتوى (${k.total} فيلم):\n• بلا وصف كافٍ: ${k.noDescN}\n• تصنيف «عام»/فارغ: ${k.noCatN}\n• بلا وسوم: ${k.noTagsN}\n• عناوين مكررة: ${k.dupsN}\n• بلا أي مشاهدة منذ أسبوعين: ${k.coldN}`;
      out.items = [...k.noDesc.map(x => ({ ...x, note: 'بلا وصف كافٍ' })), ...k.noCat.map(x => ({ ...x, note: 'تصنيف عام' }))].slice(0, 10);
      link('إدارة الأفلام', 'movies'); return out;
    }
    if (has(n, ['اشهر', 'اكثر مشاهده', 'الاكثر', 'top', 'popular', 'топ'])) {
      const top = getMovies().filter(m => !m.pending).sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 5);
      out.text = top.length ? '🏆 الأكثر مشاهدة:\n' + top.map((m, i) => `${i + 1}. ${m.title} — ${Number(m.views || 0)}`).join('\n') : 'لا توجد أفلام بعد.'; link('الإحصائيات', 'analytics'); return out;
    }
    if (has(n, ['وصف', 'اكتب', 'ولد', 'describe', 'description', 'описани'])) {
      out.text = 'لتوليد وصف ووسوم مقترحة اكتب عنوان الفيلم وتصنيفه في خانة «توليد وصف» أسفل المساعد. للأفلام الموجودة: نفّذ «تدقيق المحتوى» لأعرض لك التي بلا وصف.'; return out;
    }
    if (has(n, ['كلمه المرور', 'امان', 'حمايه', 'password', 'security', 'пароль'])) {
      out.text = '🔐 نصائح أمان: غيّر كلمة مرور الإدارة دورياً (10 أحرف فأكثر)، لا تشاركها، واستخدم HTTPS دائماً. التغيير من قسم «الأمان».'; link('الأمان', 'security'); return out;
    }
    if (has(n, ['دفع', 'شام', 'حساب', 'payment', 'sham', 'оплат'])) {
      out.text = `💳 المدفوعات: ${s.pendingPayments} بانتظار المراجعة. تحقق من رقم الإيصال في تطبيق شام كاش قبل الموافقة. تضبط الحساب وسعر التوثيق من «التوثيق».`; link('المدفوعات', 'payments'); link('التوثيق', 'verify'); return out;
    }
    if (has(n, ['بث', 'مباشر', 'live', 'эфир'])) { out.text = '📡 تدير البث والسماح لأصحاب القنوات وحدّ المشاهدين من قسم «بث مباشر».'; link('بث مباشر', 'live'); return out; }
    out.text = 'أستطيع: «ملخص الموقع»، «ما يحتاج مراجعة»، «تدقيق المحتوى»، «الأكثر مشاهدة»، نصائح الأمان والدفع والبث. وأسفلي أداة توليد وصف ووسوم، وفاحص نصوص للكلمات غير اللائقة. 🎓 ويمكنك تعليمي أوامرك: «تعلّم: «نظّف الموقع» = ولّد وصفاً للأفلام الناقصة».';
    return out;
  }
  app.post('/api/admin/assist', sameOrigin, requireAdmin, (req, res) => res.json(answerAdmin(String((req.body && req.body.q) || '').slice(0, 300))));
  app.post('/api/admin/assist/describe', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}; if (!String(b.title || '').trim()) return res.status(400).json({ error: 'أدخل عنوان الفيلم.' });
    const description = genDescription(b);
    res.json({ description, tags: suggestTags(`${b.title} ${b.category || ''} ${b.description || ''}`) });
  });
  app.post('/api/admin/assist/check', sameOrigin, requireAdmin, (req, res) => {
    const t = norm(String((req.body && req.body.text) || '').slice(0, 5000)); const hits = BAD.filter(w => w && t.includes(w));
    const letters = String((req.body && req.body.text) || '').replace(/[^A-Za-z]/g, ''), up = letters.replace(/[^A-Z]/g, '');
    const warn = []; if (hits.length) warn.push('يحتوي كلمات غير لائقة: ' + hits.join('، '));
    if (/(https?:\/\/|www\.|\.(com|net|org|ru|sy)\b)/i.test(String((req.body && req.body.text) || ''))) warn.push('يحتوي روابط خارجية');
    if (letters.length > 20 && up.length / letters.length > 0.6) warn.push('أحرف كبيرة كثيرة (صراخ)');
    if (/(.)\1{6,}/.test(t)) warn.push('تكرار حروف مبالغ فيه');
    res.json({ ok: !warn.length, warnings: warn });
  });

  /* ===================================================================
     منفّذ الأوامر: يحوّل أمراً مكتوباً («وافق على كل أفلام المستخدمين») إلى خطة خطوات،
     تُعرض للمشرف للتأكيد ثم تُنفَّذ عبر نقاط API الإدارية الموجودة نفسها (بكل تحققاتها).
     لا يُنفَّذ شيء دون ضغط «تنفيذ». كل عملية تُسجَّل في سجل المساعد.
     =================================================================== */
  const A2E = t => String(t || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const LOG = () => readJSON(F('assist-log.json'), []);
  const uById = id => (getUsers().find(u => u.id === id) || {}).username || '—';
  const V1 = ['وافق', 'اقبل', 'اعتمد', 'فعل', 'approve', 'accept'], REJ = ['ارفض', 'reject', 'decline'];
  const DEL = ['احذف', 'امسح', 'delete', 'remove', 'удали'];
  const ALL = ['كل', 'جميع', 'all', 'все'];
  function findMovies(name) {
    const t = norm(name); if (!t) return [];
    const ms = getMovies(), exact = ms.filter(m => norm(m.title) === t); if (exact.length) return exact;
    return ms.filter(m => norm(m.title).includes(t) || t.includes(norm(m.title)) && norm(m.title).length > 2);
  }
  function parseCommand(q) {
    const raw = A2E(q), n = norm(raw), step = (method, url, body, label) => ({ method, url, body, label });
    const plan = (summary, steps, danger) => ({ plan: { summary, steps, danger: !!danger } });
    const user = (/(?:المستخدم|حساب|user|@|пользовател\S*)\s*@?([^\s،,]{2,40})/i.exec(raw) || [])[1];
    const num = (/\b(\d{1,6})\b/.exec(raw.replace(/\b\d{6,14}\b/, '')) || [])[1];
    const receipt = (/\b(\d{6,14})\b/.exec(raw) || [])[1];
    const hasV = has(n, V1), hasR = has(n, REJ), isAll = has(n, ALL);

    if (has(n, ['اخر العمليات', 'سجل العمليات', 'سجل المساعد', 'history log'])) {
      const l = LOG().slice(-8).reverse(); return { text: l.length ? '🧾 آخر العمليات:\n' + l.map(x => `• ${x.at.slice(5, 16).replace('T', ' ')} — ${x.summary} (${x.ok} نجح${x.fail ? ' / ' + x.fail + ' فشل' : ''})`).join('\n') : 'لا عمليات مسجلة بعد.' };
    }
    // نسخة احتياطية
    if (has(n, ['نسخه احتياطيه', 'نسخة احتياطية', 'backup']) && has(n, ['خذ', 'انشئ', 'اعمل', 'اصنع', 'create', 'make', 'take']))
      return plan('أخذ نسخة احتياطية الآن', [step('POST', '/api/admin/backups', {}, 'نسخة احتياطية')]);
    // كوبون
    if (has(n, ['كوبون', 'coupon', 'خصم']) && has(n, ['انشئ', 'اضف', 'اعمل', 'ولد', 'create', 'add'])) {
      const code = (/\b([A-Za-z0-9_-]{3,24})\b/.exec(raw.replace(/\d+\s*%/, '')) || [])[1], pct = (/(\d{1,3})\s*(%|بالمئه|بالمائه|percent)/.exec(norm(raw).replace(/٪/g, '%')) || /خصم\s*(\d{1,3})/.exec(raw) || [])[1];
      if (!code || !pct) return { text: 'لإنشاء كوبون اكتب مثلاً: «أنشئ كوبون SAVE20 خصم 20%».' };
      return plan(`إنشاء كوبون ${code.toUpperCase()} بخصم ${pct}%`, [step('POST', '/api/admin/coupons', { code, percent: Number(pct) }, `كوبون ${code.toUpperCase()}`)]);
    }
    // اشتراك
    if (has(n, ['اشتراك', 'subscription']) && has(n, ['امنح', 'اعط', 'اضف', 'grant', 'give'])) {
      if (!user || !num) return { text: 'اكتب مثلاً: «امنح المستخدم ahmad اشتراك 30 يوم».' };
      return plan(`منح ${user} اشتراكاً لمدة ${num} يوماً`, [step('POST', '/api/admin/subs/grant', { username: user, days: Number(num) }, `اشتراك ${user}`)]);
    }
    // منع/السماح بالبث
    if (has(n, ['البث', 'live']) && (has(n, ['امنع', 'احظر', 'block']) || has(n, ['اسمح', 'unblock', 'ارفع المنع'])) && user) {
      const block = has(n, ['امنع', 'احظر', 'block']) && !has(n, ['unblock']);
      return plan(`${block ? 'منع' : 'السماح لـ'} ${user} ${block ? 'من' : 'بـ'}البث`, [step('POST', '/api/admin/live/block', { username: user, blocked: block }, user)], block);
    }
    // توثيق مستخدم محدد
    if (user && has(n, ['توثيق', 'وثق', 'verify']) && !has(n, ['طلبات'])) {
      const revoke = has(n, ['الغ', 'ازل', 'اسحب', 'revoke', 'remove']);
      return plan(`${revoke ? 'سحب توثيق' : 'توثيق'} ${user}`, [step('POST', '/api/admin/verification-user', { username: user, verified: !revoke }, user)], revoke);
    }
    // حذف فيلم
    if (has(n, DEL) && has(n, ['فيلم', 'movie', 'фильм'])) {
      const name = raw.replace(/.*?(?:فيلم|movie|фильм)\s*/i, '').trim();
      const found = findMovies(name);
      if (!name) return { text: 'اكتب اسم الفيلم: «احذف فيلم ليلة الرعب».' };
      if (!found.length) return { text: `لم أجد فيلماً باسم «${name}».` };
      if (found.length > 1) return { text: 'وجدت عدة أفلام، حدّد الاسم كاملاً:\n' + found.slice(0, 6).map(m => '• ' + m.title).join('\n') };
      return plan(`حذف الفيلم «${found[0].title}» نهائياً (مع ملفاته)`, [step('DELETE', `/api/movies/${found[0].id}`, undefined, found[0].title)], true);
    }
    // إعدادات
    const on = has(n, ['فعل', 'شغل', 'اسمح', 'افتح', 'enable', 'turn on']) && !has(n, ['اوقف']), off = has(n, ['اوقف', 'عطل', 'اغلق', 'disable', 'turn off', 'stop']);
    if (on || off) {
      if (has(n, ['مراجعه']) && has(n, ['افلام المستخدمين', 'افلام الاعضاء', 'النشر']))
        return plan(`${on ? 'تفعيل' : 'إيقاف'} المراجعة المسبقة لأفلام المستخدمين`, [step('PUT', '/api/admin/user-movies/settings', { approveUserMovies: on }, 'المراجعة المسبقة')]);
      if (has(n, ['نشر المستخدمين', 'نشر الاعضاء', 'النشر', 'publish']))
        return plan(`${on ? 'السماح' : 'منع'} المستخدمين بنشر الأفلام`, [step('PUT', '/api/admin/site-settings', { userPublish: on }, 'نشر المستخدمين')], off);
      if (has(n, ['البث', 'live']))
        return plan(`${on ? 'السماح' : 'منع'} أصحاب القنوات بالبث المباشر`, [step('PUT', '/api/admin/site-settings', { userLive: on }, 'بث المستخدمين')], off);
    }
    // موافقة/رفض مدفوعات
    if ((hasV || hasR) && has(n, ['دفع', 'مدفوع', 'ايصال', 'payment', 'receipt', 'оплат'])) {
      const act = hasR ? 'reject' : 'approve', pend = getPayments().filter(p => p.status === 'pending');
      let list = receipt ? pend.filter(p => String(p.receipt) === receipt) : isAll ? pend : null;
      if (!list) return { text: 'حدّد الدفعة: «وافق على الإيصال 123456» أو «وافق على كل المدفوعات المعلّقة».' };
      if (!list.length) return { text: receipt ? 'لا دفعة معلّقة بهذا الإيصال.' : 'لا مدفوعات معلّقة.' };
      return plan(`${act === 'approve' ? 'الموافقة على' : 'رفض'} ${list.length} دفعة:\n` + list.slice(0, 15).map(p => `• إيصال ${p.receipt} — ${uById(p.userId)}`).join('\n') + (act === 'approve' ? '\n⚠️ تأكّد من وصول المبالغ في شام كاش قبل التنفيذ.' : ''),
        list.map(p => step('POST', `/api/admin/payments/${p.id}/${act}`, {}, `إيصال ${p.receipt}`)), true);
    }
    // موافقة/رفض أفلام المستخدمين
    if ((hasV || hasR) && has(n, ['افلام المستخدمين', 'افلام الاعضاء', 'فيلم المستخدم', 'user movies', 'افلام المعلقه', 'افلام معلقه'])) {
      const act = hasR ? 'reject' : 'approve', list = getMovies().filter(m => m.pending);
      if (!list.length) return { text: 'لا أفلام مستخدمين معلّقة.' };
      return plan(`${act === 'approve' ? 'نشر' : 'رفض'} ${list.length} فيلم مستخدم:\n` + list.slice(0, 15).map(m => `• ${m.title} — ${uById(m.userId)}`).join('\n'), list.map(m => step('POST', `/api/admin/user-movies/${m.id}/${act}`, {}, m.title)), hasR);
    }
    // موافقة/رفض طلبات التوثيق
    if ((hasV || hasR) && has(n, ['طلبات التوثيق', 'طلب التوثيق', 'التوثيق', 'verification'])) {
      const act = hasR ? 'reject' : 'approve', list = R().filter(r => r.status === 'pending');
      if (!list.length) return { text: 'لا طلبات توثيق معلّقة.' };
      return plan(`${act === 'approve' ? 'قبول' : 'رفض'} ${list.length} طلب توثيق:\n` + list.slice(0, 15).map(r => `• ${uById(r.userId)}`).join('\n'), list.map(r => step('POST', `/api/admin/verification/${r.id}/${act}`, {}, uById(r.userId))));
    }
    return null;
  }
  app.post('/api/admin/assist/command', sameOrigin, requireAdmin, (req, res) => {
    const q = String((req.body && req.body.q) || '').slice(0, 300), r = parseCommand(q);
    res.json(r || { none: true });
  });
  app.post('/api/admin/assist/log', sameOrigin, requireAdmin, (c2req, res) => {
    const b = c2req.body || {}, l = LOG(); l.push({ at: new Date().toISOString(), summary: String(b.summary || '').slice(0, 200), ok: Number(b.ok) || 0, fail: Number(b.fail) || 0 });
    require('fs'); c.writeJSONAtomic(F('assist-log.json'), l.slice(-200)); res.json({ success: true });
  });
};
