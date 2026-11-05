/* لوحة الإدارة — إضافات الإصدار 11 (عربية): كتالوج متقدم • مسلسلات • إشراف وكلمات محظورة • مراجعات • تصدير CSV • تقرير أسبوعي • Push */
(function(){
const $$=s=>document.querySelector(s);
const E=s=>escapeHtml(String(s==null?'':s));
const dt=iso=>iso?new Date(iso).toLocaleString('ar'):'—';
const post=(url,body,method='POST')=>api(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
async function run(fn,after,msg='تم التنفيذ'){try{await fn();toast(msg);if(after)await after()}catch(e){toast(e.message,'error')}}
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const AGES=[['','غير محدد (يُخفى في وضع الأطفال)'],['0','للجميع'],['7','7+'],['10','10+'],['13','13+'],['16','16+'],['18','18+']];

const SECTION=`
<section class="admin-section hidden" id="section-moderation"><div class="page-title"><div><h1>الإشراف والتقارير</h1><p>كلمات محظورة، إشراف تلقائي، مراجعات المستخدمين، تصدير البيانات والتقرير الأسبوعي.</p></div></div>
 <div class="panel-grid">
  <section class="panel"><div class="panel-title"><h2>الكلمات المحظورة</h2></div>
   <p class="hint">تُرفض التعليقات والمراجعات ودردشة المشاهدة الجماعية التي تحتوي أيّاً منها، ويُخفى المقطع إن ظهرت في وصفه. كلمة في كل سطر.</p>
   <textarea id="bw-text" rows="6" style="width:100%" placeholder="كلمة أو عبارة في كل سطر"></textarea>
   <label class="check" style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="mod-on"> <span>تفعيل الإشراف التلقائي بالذكاء الاصطناعي (نص + لقطات من المقاطع)</span></label>
   <p class="hint" id="mod-hint"></p>
   <button class="primary-admin" id="mod-save" type="button">حفظ</button></section>
  <section class="panel"><div class="panel-title"><h2>التقرير الأسبوعي بالبريد</h2></div>
   <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rp-on"> <span>إرسال تقرير أسبوعي تلقائياً</span></label>
   <div class="mini-form"><input id="rp-to" type="email" dir="ltr" placeholder="البريد المستلم"><select id="rp-day">${DAYS.map((d,i)=>`<option value="${i}">${d}</option>`).join('')}</select><input id="rp-hour" type="number" min="0" max="23" placeholder="الساعة (0-23)"></div>
   <p class="hint" id="rp-hint"></p>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary-admin" id="rp-save" type="button">حفظ الجدول</button><button class="secondary-admin" id="rp-now" type="button">إرسال الآن</button><button class="secondary-admin" id="rp-prev" type="button">معاينة</button></div>
   <pre id="rp-box" class="hint" style="white-space:pre-wrap;margin-top:10px"></pre></section>
 </div>
 <div class="panel-grid">
  <section class="panel"><div class="panel-title"><h2>تصدير CSV</h2></div><p class="hint">ملفات UTF-8 تُفتح في Excel مباشرة، دون أي كلمات مرور أو رموز سرّية.</p>
   <div id="csv-btns" style="display:flex;gap:8px;flex-wrap:wrap"></div></section>
  <section class="panel"><div class="panel-title"><h2>الإشعارات وتسجيل الدخول</h2></div><div id="v11-status" class="movie-admin-list"></div>
   <label class="check" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="push-on"> <span>تفعيل إشعارات الدفع (Web Push)</span></label>
   <button class="secondary-admin" id="push-save" type="button" style="margin-top:8px">حفظ</button></section>
 </div>
 <section class="panel"><div class="panel-title"><h2>مراجعات الأفلام</h2></div><div id="reviews-list" class="movie-admin-list"></div></section>
</section>`;

function inject(){
  const main=document.querySelector('.admin-main')||document.querySelector('main')||document.body;
  main.insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');
  nav.insertAdjacentHTML('beforeend','<button data-section="moderation" type="button"><i data-lucide="shield-check"></i><span>الإشراف والتقارير</span></button>');
  nav.querySelector('[data-section="moderation"]').onclick=()=>showSection('moderation');
  // حقول الكتالوج في نموذج رفع الفيلم
  const anchor=document.querySelector('.paid-toggle');
  anchor.insertAdjacentHTML('beforebegin',`<fieldset class="full" style="border:1px solid var(--line,#ddd);border-radius:12px;padding:10px"><legend>الكتالوج (اختياري)</legend>
   <div class="mini-form"><input name="year" type="number" min="1888" max="2100" placeholder="السنة"><input name="director" maxlength="80" placeholder="المخرج"><input name="country" maxlength="60" placeholder="البلد"><input name="language" maxlength="40" placeholder="اللغة"></div>
   <input name="cast" placeholder="الممثلون (افصل بفاصلة)" style="width:100%;margin:6px 0"><input name="tags" placeholder="وسوم (افصل بفاصلة)" style="width:100%;margin:6px 0">
   <select name="ageRating" style="width:100%;margin:6px 0">${AGES.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
   <div class="mini-form"><input name="series" maxlength="100" placeholder="اسم المسلسل (اتركه فارغاً لفيلم)"><input name="season" type="number" min="1" max="99" placeholder="الموسم"><input name="episode" type="number" min="1" max="999" placeholder="الحلقة"></div></fieldset>`);
  // الحقول الفارغة لا تُرسل
  document.querySelector('#movie-form').addEventListener('formdata',e=>{for(const k of ['year','director','country','language','cast','tags','ageRating','series','season','episode']){const v=e.formData.get(k);if(v===''||v===null)e.formData.delete(k)}});
  icons();
}

async function loadMod(){
  try{
    const [s,reviews]=await Promise.all([api('/api/admin/v11-settings'),api('/api/admin/reviews')]);
    $$('#bw-text').value=s.bannedWords.join('\n');
    $$('#mod-on').checked=s.moderation.on;
    $$('#mod-hint').textContent=s.moderation.serviceConfigured?'خدمة الإشراف مُهيّأة (MODERATION_URL / OPENAI_API_KEY).':'خدمة الإشراف غير مُهيّأة: عيّن OPENAI_API_KEY (أو MODERATION_URL) ليعمل الفحص بالذكاء الاصطناعي. الكلمات المحظورة تعمل دائماً.';
    $$('#rp-on').checked=s.report.on;$$('#rp-to').value=s.report.to||'';$$('#rp-day').value=s.report.day;$$('#rp-hour').value=s.report.hour;
    $$('#rp-hint').textContent=(s.smtp?'SMTP مُهيّأ.':'SMTP غير مُهيّأ: سيُطبع التقرير في سجل الخادم فقط (SMTP_HOST).')+(s.report.lastSent?` آخر إرسال: ${s.report.lastSent}`:'');
    $$('#push-on').checked=s.push.enabled;
    $$('#v11-status').innerHTML=[['أجهزة مشتركة بالإشعارات',`<span>${s.push.devices}</span>`],['دخول Google',s.providers.google?'<span class="pay-approved">مفعّل</span>':'<span class="pay-rejected">GOOGLE_CLIENT_ID غير مضبوط</span>'],['دخول Telegram',s.providers.telegram?'<span class="pay-approved">مفعّل</span>':'<span class="pay-rejected">TELEGRAM_BOT_TOKEN/USERNAME غير مضبوط</span>']]
      .map(([k,v])=>`<article class="admin-movie"><div><h3>${k}</h3></div>${v}</article>`).join('');
    $$('#reviews-list').innerHTML=reviews.length?reviews.map(r=>`<article class="admin-movie"><div><h3>${E(r.movie)} — ${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</h3><p>${E(r.review)}</p><div class="movie-meta"><span>${E(r.username)}</span><span>${dt(r.updatedAt)}</span></div></div><button class="danger-btn" data-del-rv="${E(r.movieId)}|${E(r.userId)}" type="button">حذف النص</button></article>`).join(''):'<div class="empty-admin">لا توجد مراجعات.</div>';
    document.querySelectorAll('[data-del-rv]').forEach(b=>b.onclick=()=>{const [m,u]=b.dataset.delRv.split('|');run(()=>post(`/api/admin/reviews/${encodeURIComponent(m)}/${encodeURIComponent(u)}`,undefined,'DELETE'),loadMod,'تم حذف المراجعة')});
  }catch(e){toast(e.message,'error')}
}
function bind(){
  const names={users:'المستخدمون',movies:'الأفلام',shorts:'المقاطع',comments:'التعليقات',payments:'المدفوعات',reports:'البلاغات',ratings:'التقييمات'};
  $$('#csv-btns').innerHTML=Object.entries(names).map(([k,l])=>`<a class="secondary-admin" href="/api/admin/export/${k}.csv" download><i data-lucide="download"></i> ${l}</a>`).join('');
  $$('#mod-save').onclick=()=>run(()=>post('/api/admin/v11-settings',{bannedWords:$$('#bw-text').value.split('\n').map(x=>x.trim()).filter(Boolean),moderation:{on:$$('#mod-on').checked}},'PUT'),loadMod,'تم الحفظ');
  $$('#rp-save').onclick=()=>run(()=>post('/api/admin/v11-settings',{report:{on:$$('#rp-on').checked,to:$$('#rp-to').value,day:$$('#rp-day').value,hour:$$('#rp-hour').value}},'PUT'),loadMod,'تم حفظ الجدول');
  $$('#rp-now').onclick=async()=>{try{const r=await post('/api/admin/report/send-now',{to:$$('#rp-to').value});toast(r.sent?'أُرسل التقرير':r.dev?'SMTP غير مُهيّأ: طُبع في سجل الخادم':('تعذّر الإرسال'+(r.error?': '+r.error:'')),r.sent?'success':'error')}catch(e){toast(e.message,'error')}};
  $$('#rp-prev').onclick=async()=>{try{$$('#rp-box').textContent=(await api('/api/admin/report/preview')).text}catch(e){toast(e.message,'error')}};
  $$('#push-save').onclick=()=>run(()=>post('/api/admin/v11-settings',{push:{enabled:$$('#push-on').checked}},'PUT'),loadMod,'تم الحفظ');
}

/* ---------- حوار الكتالوج لكل فيلم ---------- */
const _render=window.renderMovies;
window.renderMovies=function(){
  _render.apply(this,arguments);
  document.querySelectorAll('#movies-list [data-adv]').forEach(btn=>{
    if(btn.parentElement.querySelector('[data-cat]'))return;
    btn.insertAdjacentHTML('afterend',`<button class="secondary-admin" data-cat="${E(btn.dataset.adv)}" type="button"><i data-lucide="tags"></i> كتالوج</button>`);
  });
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>catalogDialog(b.dataset.cat));icons();
};
async function catalogDialog(id){
  const m=movies.find(x=>x.id===id);if(!m)return;
  const v=k=>E(m[k]==null?'':Array.isArray(m[k])?m[k].join(', '):m[k]);
  const inp=(k,l,type='text')=>`<label>${l}<input id="cg-${k}" type="${type}" class="swal2-input" style="width:100%;margin:6px 0" value="${v(k)}"></label>`;
  const r=await Swal.fire({title:'الكتالوج: '+m.title,showCancelButton:true,confirmButtonText:'حفظ',cancelButtonText:'إغلاق',width:560,
    html:`<div style="display:grid;gap:6px;text-align:right">${inp('year','السنة','number')}${inp('director','المخرج')}${inp('cast','الممثلون (بفاصلة)')}${inp('tags','وسوم (بفاصلة)')}${inp('country','البلد')}${inp('language','اللغة')}
     <label>التصنيف العمري<select id="cg-ageRating" class="swal2-select" style="width:100%;margin:6px 0">${AGES.map(([a,l])=>`<option value="${a}" ${String(m.ageRating==null?'':m.ageRating)===a?'selected':''}>${l}</option>`).join('')}</select></label>
     ${inp('series','اسم المسلسل')}${inp('season','الموسم','number')}${inp('episode','الحلقة','number')}
     <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cg-featured" ${m.featured?'checked':''}> <span>اختيار المحرر (يظهر في الرئيسية ويُعرض كتريلر)</span></label>
     <label>الفصول (سطر لكل فصل: <span dir="ltr">0:00 المقدمة</span>)<textarea id="cg-chapters" class="swal2-textarea" style="width:100%;margin:6px 0" rows="4" dir="ltr">${E((m.chapters||[]).map(c=>`${Math.floor(c.t/60)}:${String(c.t%60).padStart(2,'0')} ${c.title}`).join('\n'))}</textarea></label></div>`,
    preConfirm:()=>({...Object.fromEntries(['year','director','cast','tags','country','language','ageRating','series','season','episode'].map(k=>[k,document.getElementById('cg-'+k).value.trim()])),featured:document.getElementById('cg-featured').checked?'true':'',chapters:document.getElementById('cg-chapters').value.trim()})});
  if(!r.isConfirmed)return;
  await run(()=>post(`/api/admin/movies/${encodeURIComponent(id)}/catalog`,r.value,'PATCH'),load,'تم حفظ بيانات الكتالوج');
}

const _show=window.showSection;
window.showSection=function(name){_show.apply(this,arguments);if(name==='moderation')loadMod()};
document.addEventListener('DOMContentLoaded',()=>{inject();bind();renderMovies()});
})();
