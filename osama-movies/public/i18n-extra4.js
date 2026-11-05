/* نصوص الإصدار 12 (تتمة) بثلاث لغات [عربي، English، Русский] */
(function(){
const K={
'chap.title':['الفصول','Chapters','Главы'],
'picks.title':['اختيار المحرر','Editor’s picks','Выбор редакции'],
'seen.chip':['شوهد','Watched','Просмотрено'],
'kb.nav':['اختصارات لوحة المفاتيح','Keyboard shortcuts','Горячие клавиши'],
'kb.title':['اختصارات لوحة المفاتيح','Keyboard shortcuts','Горячие клавиши'],
'kb.play':['تشغيل / إيقاف','Play / pause','Пуск / пауза'],
'kb.skip10':['رجوع / تقديم 10 ثوانٍ','Back / forward 10 s','Назад / вперёд на 10 с'],
'kb.jump':['انتقال إلى نسبة من الفيلم','Jump to 0–90 % of the movie','Перейти к 0–90 % фильма'],
'kb.frame':['إطار بإطار (أثناء الإيقاف)','Frame by frame (paused)','Покадрово (на паузе)'],
'kb.volume':['رفع / خفض الصوت','Volume up / down','Громкость'],
'kb.mute':['كتم','Mute','Без звука'],
'kb.full':['ملء الشاشة','Fullscreen','Во весь экран'],
'kb.theater':['وضع المسرح','Theater mode','Режим кинотеатра'],
'kb.captions':['قائمة الترجمة','Captions menu','Меню субтитров'],
'kb.speed':['تغيير السرعة','Playback speed','Скорость'],
'kb.pip':['نافذة عائمة','Picture-in-picture','Картинка в картинке'],
'kb.next':['الحلقة التالية','Next episode','Следующая серия'],
'kb.help':['هذه القائمة','This help','Эта справка'],
'lead.nav':['متصدرو المبدعين','Top creators','Лучшие авторы'],
'lead.title':['متصدرو المبدعين','Top creators','Лучшие авторы'],
'lead.sub':['حسب المتابعين والإعجابات والتعليقات والمشاهدات','Ranked by followers, likes, comments and views','По подписчикам, лайкам, комментариям и просмотрам'],
'lead.stats':['{s} مقطع · {f} متابع · {l} إعجاب','{s} clips · {f} followers · {l} likes','{s} роликов · {f} подписчиков · {l} лайков'],
'lead.empty':['لا يوجد مبدعون بعد','No creators yet','Пока нет авторов']
};
for(const [k,v] of Object.entries(K)){I18N.dict.ar[k]=v[0];I18N.dict.en[k]=v[1];I18N.dict.ru[k]=v[2]}
})();
