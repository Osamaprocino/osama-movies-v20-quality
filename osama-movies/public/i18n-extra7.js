(function(){
const K={
'look.nav':['المظهر','Appearance','Оформление'],'look.title':['استوديو المظهر','Appearance studio','Студия оформления'],
'look.accent':['لون التمييز','Accent colour','Акцентный цвет'],'look.custom':['لون مخصص','Custom colour','Свой цвет'],
'look.bg':['الخلفية','Background','Фон'],'look.bg_orbs':['كرات ناعمة','Soft orbs','Мягкие шары'],'look.bg_aurora':['شفق متحرك','Animated aurora','Анимированное сияние'],'look.bg_mesh':['تدرّج شبكي','Mesh gradient','Градиент'],'look.bg_plain':['سادة','Plain','Однотонный'],
'look.glass':['كثافة الزجاج','Glass density','Плотность стекла'],'look.glass_clear':['صافٍ','Clear','Прозрачное'],'look.glass_balanced':['متوازن','Balanced','Баланс'],'look.glass_rich':['كثيف','Rich','Плотное'],'look.glass_ios':['iOS زجاجي','iOS glass','Стекло iOS'],'look.glass_frost':['زجاج مصنفر','Frosted','Матовое'],'look.blur':['الضبابية (Blur)','Blur','Размытие'],'look.alpha':['شفافية الزجاج','Glass transparency','Прозрачность стекла'],'look.auto':['تلقائي','Auto','Авто'],
'look.motion':['الحركات والانتقالات','Animations & transitions','Анимации и переходы'],'look.reset':['استعادة الافتراضي','Reset to default','Сбросить'],
'studio.nav':['استوديو القناة','Channel studio','Студия канала'],'studio.title':['استوديو القناة','Channel studio','Студия канала'],
'studio.views':['المشاهدات','Views','Просмотры'],'studio.subs':['المشتركون','Subscribers','Подписчики'],'studio.movies':['الأفلام','Movies','Фильмы'],'studio.shorts':['المقاطع','Shorts','Шортсы'],
'studio.top':['الأكثر مشاهدة','Top movies','Самые просматриваемые'],'studio.empty':['انشر أول فيلم لتظهر إحصاءاتك هنا.','Publish your first movie to see stats here.','Опубликуйте первый фильм, чтобы увидеть статистику.'],
'studio.pending':['{n} فيلم بانتظار موافقة الإدارة','{n} movie(s) awaiting admin approval','Ожидают одобрения: {n}'],
'ver.badge':['حساب موثّق','Verified account','Подтверждённый аккаунт'],
'ver.nav':['توثيق الحساب','Get verified','Верификация'],'ver.title':['توثيق الحساب','Account verification','Верификация аккаунта'],
'ver.sub':['تظهر علامة ✓ بجانب اسمك وصورتك وقناتك بعد موافقة الإدارة.','A ✓ badge appears next to your name, picture and channel once approved by the admin.','Значок ✓ появится рядом с именем, фото и каналом после одобрения администратором.'],
'ver.is':['حسابك موثّق ✓','Your account is verified ✓','Ваш аккаунт подтверждён ✓'],
'ver.pending':['طلبك قيد المراجعة من الإدارة.','Your request is being reviewed.','Ваша заявка на рассмотрении.'],
'ver.needSub':['التوثيق متاح للمشتركين في إحدى الباقات. اشترك أولاً ثم قدّم الطلب.','Verification is for subscribers. Subscribe to a plan first, then apply.','Верификация доступна подписчикам. Сначала оформите подписку.'],
'ver.plans':['عرض الباقات','View plans','Смотреть тарифы'],'ver.rejected':['رُفض طلبك السابق، يمكنك التقديم من جديد.','Your previous request was declined; you can apply again.','Прошлая заявка отклонена, можно подать снова.'],
'ver.note':['لماذا تطلب التوثيق؟ (اختياري)','Why do you want to be verified? (optional)','Почему вы хотите верификацию? (необязательно)'],
'ver.payStep2':['بعد الدفع أدخل رقم الإيصال (من 6 إلى 14 رقماً) ثم اضغط تأكيد.','After paying, enter the receipt number (6–14 digits) and confirm.','После оплаты введите номер квитанции (6–14 цифр) и подтвердите.'],
'ver.paySend':['تأكيد الدفع','Confirm payment','Подтвердить оплату'],
'ver.payPending':['استلمنا الإيصال وهو قيد التحقق من الإدارة. ستصلك إشعار عند التوثيق.','Receipt received and awaiting admin check. You will be notified.','Квитанция получена и проверяется. Вы получите уведомление.'],
'ver.payDone':['تم الدفع والتوثيق ✓','Paid and verified ✓','Оплачено и подтверждено ✓'],
'ver.send':['إرسال الطلب','Send request','Отправить заявку'],'ver.sent':['أُرسل طلبك للإدارة','Request sent to admins','Заявка отправлена'],
'notif.verify_ok':['تمت الموافقة: حسابك موثّق الآن ✓','Approved: your account is now verified ✓','Одобрено: ваш аккаунт подтверждён ✓'],
'notif.verify_no':['تم تحديث حالة توثيق حسابك: غير موثّق.','Your verification status was updated: not verified.','Статус верификации изменён: не подтверждён.'],
'live.chatPh':['اكتب رسالة…','Write a message…','Напишите сообщение…'],'live.chatLogin':['سجّل الدخول للدردشة','Sign in to chat','Войдите, чтобы писать']
};
for(const [k,v] of Object.entries(K)){I18N.dict.ar[k]=v[0];I18N.dict.en[k]=v[1];I18N.dict.ru[k]=v[2]}
})();
