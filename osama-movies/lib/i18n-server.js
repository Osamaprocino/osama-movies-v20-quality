/* رسائل الخادم بثلاث لغات: ar / en / ru
   - الرسائل الجديدة تُطلب بالمفتاح: tr(req,'key')
   - الرسائل العربية القديمة في server.js تُترجم تلقائياً عبر translateArabicError */

const LANGS = ['ar', 'en', 'ru'];

function pickLang(req) {
  const h = String(req.headers['x-lang'] || '').toLowerCase().slice(0, 2);
  if (LANGS.includes(h)) return h;
  const al = String(req.headers['accept-language'] || '').toLowerCase();
  for (const part of al.split(',')) {
    const c = part.trim().slice(0, 2);
    if (LANGS.includes(c)) return c;
  }
  return 'ar';
}

const M = {
  // ---- رسائل قديمة (المفتاح هو النص العربي الأصلي حرفياً) ----
  'غير مصرح': { en: 'Not authorized.', ru: 'Нет доступа.' },
  'محاولات كثيرة، حاول لاحقاً.': { en: 'Too many attempts, try again later.', ru: 'Слишком много попыток, попробуйте позже.' },
  'محاولات كثيرة، حاول بعد 15 دقيقة.': { en: 'Too many attempts, try again in 15 minutes.', ru: 'Слишком много попыток, повторите через 15 минут.' },
  'محاولات كثيرة، حاول بعد قليل.': { en: 'Too many attempts, try again shortly.', ru: 'Слишком много попыток, повторите чуть позже.' },
  'اسم المستخدم أو كلمة المرور غير صحيحة.': { en: 'Incorrect username/email or password.', ru: 'Неверное имя пользователя/e-mail или пароль.' },
  'سجّل الدخول أولاً.': { en: 'Please sign in first.', ru: 'Сначала войдите в аккаунт.' },
  'طلب غير مسموح.': { en: 'Request not allowed.', ru: 'Запрос запрещён.' },
  'اسم المستخدم من 3 إلى 24 حرفاً (حروف وأرقام و _ . - فقط).': { en: 'Username must be 3–24 characters (letters, digits, _ . - only).', ru: 'Имя пользователя: 3–24 символа (буквы, цифры, _ . -).' },
  'اسم المستخدم مستخدم بالفعل.': { en: 'This username is already taken.', ru: 'Это имя пользователя уже занято.' },
  'أدخل اسم المستخدم وكلمة المرور.': { en: 'Enter your username and password.', ru: 'Введите имя пользователя и пароль.' },
  'كلمة المرور مطلوبة.': { en: 'Password is required.', ru: 'Введите пароль.' },
  'كلمة المرور يجب ألا تقل عن 10 أحرف.': { en: 'Password must be at least 10 characters.', ru: 'Пароль должен быть не короче 10 символов.' },
  'كلمة المرور طويلة جداً.': { en: 'Password is too long.', ru: 'Пароль слишком длинный.' },
  'أضف حرفاً إنجليزياً صغيراً (a-z) إلى كلمة المرور.': { en: 'Add a lowercase letter (a-z).', ru: 'Добавьте строчную латинскую букву (a-z).' },
  'أضف حرفاً إنجليزياً كبيراً (A-Z) إلى كلمة المرور.': { en: 'Add an uppercase letter (A-Z).', ru: 'Добавьте заглавную латинскую букву (A-Z).' },
  'أضف رقماً واحداً على الأقل إلى كلمة المرور.': { en: 'Add at least one digit.', ru: 'Добавьте хотя бы одну цифру.' },
  'أضف رمزاً خاصاً واحداً على الأقل مثل ! @ # $.': { en: 'Add at least one special character such as ! @ # $.', ru: 'Добавьте хотя бы один спецсимвол, например ! @ # $.' },
  'كلمة المرور شائعة وسهلة التخمين.': { en: 'This password is too common and easy to guess.', ru: 'Слишком простой и распространённый пароль.' },
  'يجب ألا تحتوي كلمة المرور على اسم المستخدم.': { en: 'The password must not contain your username.', ru: 'Пароль не должен содержать имя пользователя.' },
  'تجنب تكرار نفس الحرف أكثر من 3 مرات متتالية.': { en: 'Avoid repeating the same character more than 3 times in a row.', ru: 'Не повторяйте один и тот же символ более 3 раз подряд.' },
  'الفيلم غير موجود': { en: 'Movie not found.', ru: 'Фильм не найден.' },
  'الملف غير موجود': { en: 'File not found.', ru: 'Файл не найден.' },
  'يجب شراء الفيلم أولاً.': { en: 'You need to purchase this movie first.', ru: 'Сначала нужно приобрести этот фильм.' },
  'هذا الفيلم مجاني.': { en: 'This movie is free.', ru: 'Этот фильм бесплатный.' },
  'رقم الإيصال يجب أن يتكوّن من أرقام فقط (من 8 إلى 14 رقماً).': { en: 'The receipt number must be 8–14 digits.', ru: 'Номер квитанции должен состоять из 8–14 цифр.' },
  'رقم الإيصال هذا مستخدم من قبل.': { en: 'This receipt number has already been used.', ru: 'Этот номер квитанции уже использован.' },
  'لديك طلبات قيد المراجعة بالفعل. انتظر قرار الإدارة.': { en: 'You already have requests under review. Please wait for the admin decision.', ru: 'У вас уже есть заявки на проверке. Дождитесь решения администрации.' },
  'لم نعثر على عملية دفع بهذا الرقم. تأكد من الرقم والمبلغ والحساب.': { en: 'No payment found with this number. Check the number, amount and account.', ru: 'Платёж с таким номером не найден. Проверьте номер, сумму и счёт.' },
  'نوع الملف غير مسموح': { en: 'File type not allowed.', ru: 'Недопустимый тип файла.' },
  'حدث خطأ في الخادم': { en: 'Server error.', ru: 'Ошибка сервера.' },
  'تعذر تنفيذ العملية': { en: 'Could not complete the operation.', ru: 'Не удалось выполнить операцию.' },
  'File too large': { ar: 'حجم الملف كبير جداً.', en: 'File is too large.', ru: 'Файл слишком большой.' },

  'كوبون غير صالح.': { en: 'Invalid coupon.', ru: 'Недействительный купон.' },
  'انتهت صلاحية الكوبون.': { en: 'This coupon has expired.', ru: 'Срок действия купона истёк.' },
  'استُنفد هذا الكوبون.': { en: 'This coupon has been used up.', ru: 'Купон больше недоступен.' },
  'هذا الكوبون لا ينطبق هنا.': { en: 'This coupon does not apply here.', ru: 'Этот купон здесь не применяется.' },
  'سبق أن استخدمت هذا الكوبون.': { en: 'You have already used this coupon.', ru: 'Вы уже использовали этот купон.' },
  'الخطة غير موجودة': { en: 'Plan not found.', ru: 'Тариф не найден.' },

  // ---- رسائل جديدة (بالمفتاح) ----
  email_invalid: { ar: 'أدخل بريداً إلكترونياً صحيحاً.', en: 'Enter a valid email address.', ru: 'Введите корректный e-mail.' },
  email_taken: { ar: 'هذا البريد مستخدم بالفعل.', en: 'This email is already registered.', ru: 'Этот e-mail уже зарегистрирован.' },
  name_invalid: { ar: 'الاسم من 2 إلى 40 حرفاً.', en: 'Name must be 2–40 characters.', ru: 'Имя должно содержать 2–40 символов.' },
  age_invalid: { ar: 'العمر يجب أن يكون رقماً بين 5 و 120.', en: 'Age must be a number between 5 and 120.', ru: 'Возраст должен быть числом от 5 до 120.' },
  wrong_current_password: { ar: 'كلمة المرور الحالية غير صحيحة.', en: 'Current password is incorrect.', ru: 'Текущий пароль неверен.' },
  same_password: { ar: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.', en: 'The new password must differ from the current one.', ru: 'Новый пароль должен отличаться от текущего.' },
  image_invalid: { ar: 'الصورة غير صالحة (JPG أو PNG أو WebP حتى 3 ميغابايت).', en: 'Invalid image (JPG, PNG or WebP up to 3 MB).', ru: 'Неверное изображение (JPG, PNG или WebP до 3 МБ).' },
  video_invalid: { ar: 'ملف الفيديو غير صالح (MP4 أو WebM أو MOV).', en: 'Invalid video file (MP4, WebM or MOV).', ru: 'Неверный видеофайл (MP4, WebM или MOV).' },
  video_required: { ar: 'اختر ملف فيديو.', en: 'Choose a video file.', ru: 'Выберите видеофайл.' },
  short_not_found: { ar: 'المقطع غير موجود.', en: 'Short not found.', ru: 'Шортс не найден.' },
  forbidden: { ar: 'غير مسموح لك بهذا الإجراء.', en: 'You are not allowed to do this.', ru: 'У вас нет прав на это действие.' },
  comment_empty: { ar: 'اكتب تعليقاً أولاً.', en: 'Write a comment first.', ru: 'Сначала напишите комментарий.' },
  comment_not_found: { ar: 'التعليق غير موجود.', en: 'Comment not found.', ru: 'Комментарий не найден.' },
  target_not_found: { ar: 'المحتوى غير موجود.', en: 'Content not found.', ru: 'Контент не найден.' },
  subtitle_invalid: { ar: 'ملف الترجمة غير صالح (SRT أو VTT).', en: 'Invalid subtitle file (SRT or VTT).', ru: 'Неверный файл субтитров (SRT или VTT).' },
  subtitle_not_found: { ar: 'ملف الترجمة غير موجود.', en: 'Subtitle track not found.', ru: 'Дорожка субтитров не найдена.' },
  translate_failed: { ar: 'تعذرت الترجمة الآن. حاول لاحقاً.', en: 'Translation is unavailable right now. Try again later.', ru: 'Перевод сейчас недоступен. Повторите позже.' },
  name_required: { ar: 'اكتب اسماً.', en: 'Enter a name.', ru: 'Введите название.' },
  too_many: { ar: 'وصلت إلى الحد الأقصى.', en: 'You reached the limit.', ru: 'Достигнут лимит.' },
  token_invalid: { ar: 'الرابط غير صالح أو انتهت صلاحيته.', en: 'This link is invalid or has expired.', ru: 'Ссылка недействительна или устарела.' },
  file_too_large: { ar: 'حجم الملف أكبر من الحد المسموح.', en: 'The file exceeds the allowed size.', ru: 'Файл превышает допустимый размер.' },
  banned_word: { ar: 'تعليقك يحتوي كلمة غير مسموحة.', en: 'Your comment contains a word that is not allowed.', ru: 'В комментарии есть недопустимое слово.' },
  comments_off: { ar: 'التعليقات مغلقة على هذا المقطع.', en: 'Comments are turned off for this clip.', ru: 'Комментарии к этому ролику отключены.' },
  moderated: { ar: 'تعذّر نشر المحتوى لمخالفته القواعد.', en: 'This content could not be posted because it breaks the rules.', ru: 'Контент нельзя опубликовать: он нарушает правила.' },
  no_access: { ar: 'ليس لديك صلاحية مشاهدة هذا الفيلم.', en: 'You do not have access to this movie.', ru: 'У вас нет доступа к этому фильму.' },
  kids_pin_bad: { ar: 'الرمز غير صحيح.', en: 'Wrong PIN.', ru: 'Неверный PIN-код.' },
  kids_pin_needed: { ar: 'اختر رمز PIN من 4 إلى 6 أرقام.', en: 'Choose a 4–6 digit PIN.', ru: 'Задайте PIN-код из 4–6 цифр.' },
  party_not_found: { ar: 'غرفة المشاهدة غير موجودة أو انتهت.', en: 'Watch party not found or ended.', ru: 'Комната просмотра не найдена или закрыта.' },
  rate_invalid: { ar: 'اختر تقييماً من 1 إلى 5.', en: 'Choose a rating from 1 to 5.', ru: 'Выберите оценку от 1 до 5.' },
  oauth_failed: { ar: 'تعذّر تسجيل الدخول عبر هذه الخدمة.', en: 'Sign-in with this provider failed.', ru: 'Не удалось войти через этот сервис.' },
  movie_fields: { ar: 'أدخل عنواناً (حرفان على الأقل) وصورة غلاف وملف فيديو.', en: 'Enter a title (2+ characters), a cover image and a video file.', ru: 'Укажите название (от 2 символов), обложку и видеофайл.' },
  poster_invalid: { ar: 'صورة الغلاف غير صالحة (JPG/PNG/WebP بحجم حتى 5MB).', en: 'Invalid cover image (JPG/PNG/WebP up to 5 MB).', ru: 'Неверная обложка (JPG/PNG/WebP до 5 МБ).' },
  server_error: { ar: 'حدث خطأ في الخادم.', en: 'Server error.', ru: 'Ошибка сервера.' },
  translate_bad: { ar: 'طلب ترجمة غير صالح.', en: 'Invalid translation request.', ru: 'Недопустимый запрос на перевод.' }
};

const REV = {};
for (const [k, v] of Object.entries(M)) if (/[؀-ۿ]/.test(k)) REV[k] = v;

function tr(req, key) {
  const lang = (req && req.lang) || 'ar';
  const e = M[key];
  if (!e) return key;
  return e[lang] || e.ar || key;
}
function translateArabicError(text, lang) {
  const e = REV[text];
  return e && e[lang] ? e[lang] : null;
}

module.exports = { LANGS, pickLang, tr, translateArabicError };
