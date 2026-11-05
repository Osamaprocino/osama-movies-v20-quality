/* لوحة الإدارة — إضافات الإصدار 10 (عربية): اشتراكات وكوبونات • بلاغات • تحليلات المشاهدة • أدوات (نسخ احتياطي/حدود/حالة الخدمات) • جدولة وتفريغ صوتي */
(function(){
const $$=s=>document.querySelector(s);
const E=s=>escapeHtml(String(s==null?'':s));
const dt=iso=>iso?new Date(iso).toLocaleString('ar'):'—';
const post=(url,body,method='POST')=>api(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
const secs=s=>{s=Math.round(s||0);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${fmt(h)} س ${m} د`:m?`${fmt(m)} د ${s%60} ث`:`${s} ث`};
const SRC={home:'الرئيسية',search:'البحث',share:'رابط مشاركة',related:'اقتراحات',continue:'متابعة المشاهدة',shorts:'Shorts',channel:'قناة',next:'التالي تلقائياً',direct:'مباشر'};
const CC={SY:'سوريا',RU:'روسيا',US:'أمريكا',TR:'تركيا',DE:'ألمانيا',SA:'السعودية',AE:'الإمارات',EG:'مصر',LB:'لبنان',JO:'الأردن',IQ:'العراق',XX:'غير معروف'};

const SECTIONS=`
<section class="admin-section hidden" id="section-commerce"><div class="page-title"><div><h1>الاشتراكات والكوبونات</h1><p>خطط اشتراك تفتح كل الأفلام المدفوعة، وأكواد خصم للأفلام والخطط.</p></div></div>
 <div class="panel-grid">
  <section class="panel"><div class="panel-title"><h2>خطط الاشتراك</h2></div><div id="plans-list" class="movie-admin-list"></div>
   <form id="plan-form" class="mini-form"><input name="name" placeholder="اسم الخطة (شهري)" maxlength="60" required><input name="days" type="number" min="1" max="3650" placeholder="المدة بالأيام" required><input name="price" type="number" min="1" step="any" placeholder="السعر" required><select name="currency"><option value="SYP">ل.س</option><option value="USD">$</option></select><input name="account" placeholder="حساب شام كاش" dir="ltr" required><button class="primary-admin" type="submit">إضافة خطة</button></form></section>
  <section class="panel"><div class="panel-title"><h2>أكواد الخصم</h2></div><div id="coupons-list" class="movie-admin-list"></div>
   <form id="coupon-form" class="mini-form"><input name="code" placeholder="الكود (HALF50)" maxlength="24" dir="ltr" required><input name="percent" type="number" min="1" max="100" placeholder="الخصم %" required><input name="maxUses" type="number" min="0" placeholder="الحد الأقصى (0 = بلا حد)"><input name="expiresAt" type="date" title="تاريخ الانتهاء"><select name="scope"><option value="all">أفلام وخطط</option><option value="movie">أفلام فقط</option><option value="plan">خطط فقط</option></select><button class="primary-admin" type="submit">إضافة كود</button></form></section>
 </div>
 <section class="panel"><div class="panel-title"><h2>المشتركون الحاليون</h2></div><div id="subs-list" class="movie-admin-list"></div>
  <form id="grant-form" class="mini-form"><input name="username" placeholder="اسم المستخدم" required><input name="days" type="number" min="1" max="3650" placeholder="عدد الأيام" required><button class="secondary-admin" type="submit">منح اشتراك يدوي</button></form></section>
</section>
<section class="admin-section hidden" id="section-reports"><div class="page-title"><div><h1>البلاغات</h1><p>بلاغات المستخدمين عن المقاطع والتعليقات والأفلام.</p></div><span class="counter" id="reports-total">0</span></div><section class="panel"><div id="reports-list" class="movie-admin-list"></div></section></section>
<section class="admin-section hidden" id="section-watch"><div class="page-title"><div><h1>تحليلات المشاهدة</h1><p>زمن المشاهدة الفعلي، إعادة التشغيل، المصادر والدول.</p></div><button class="secondary-admin" id="watch-refresh"><i data-lucide="refresh-cw"></i> تحديث</button></div>
 <div class="stat-grid" id="watch-tiles"></div>
 <div class="panel-grid"><section class="panel"><div class="panel-title"><h2>زمن المشاهدة آخر 14 يوماً</h2></div><div class="chart-box tall"><canvas id="watch-chart"></canvas></div></section>
 <section class="panel"><div class="panel-title"><h2>مصادر المشاهدة</h2></div><div id="watch-sources" class="bars"></div><div class="panel-title" style="margin-top:16px"><h2>الدول</h2></div><div id="watch-countries" class="bars"></div></section></div>
 <section class="panel"><div class="panel-title"><h2>الأكثر مشاهدة (بالزمن)</h2></div><div id="watch-items" class="movie-admin-list"></div></section></section>
<section class="admin-section hidden" id="section-tools"><div class="page-title"><div><h1>الأدوات والنسخ الاحتياطي</h1><p>حدود الرفع، النسخ الاحتياطي، وحالة الخدمات الاختيارية.</p></div></div>
 <section class="panel"><div class="panel-title"><h2>حالة الخدمات</h2></div><div id="caps-grid" class="system-grid"></div></section>
 <div class="panel-grid">
  <section class="panel"><div class="panel-title"><h2>حدّ حجم الرفع</h2></div><form id="settings-form" class="mini-form"><label>الأفلام (MB)<input name="maxMovieMB" type="number" min="10" max="20480" required></label><label>Shorts (MB)<input name="maxShortMB" type="number" min="1" max="1024" required></label><button class="primary-admin" type="submit">حفظ</button></form></section>
  <section class="panel"><div class="panel-title"><h2>النسخ الاحتياطي</h2><button class="primary-admin" id="backup-now"><i data-lucide="database-backup"></i> نسخة الآن</button></div><p class="hint" id="backup-hint"></p><div id="backups-list" class="movie-admin-list"></div></section>
 </div>
 <section class="panel"><div class="panel-title"><h2>المستخدمون</h2></div><div id="users-list" class="movie-admin-list"></div></section></section>`;

function inject(){
  const nav=document.querySelector('.admin-nav');
  const main=document.querySelector('#section-system').parentElement;
  main.insertAdjacentHTML('beforeend',SECTIONS);
  const items=[['commerce','crown','الاشتراكات والكوبونات'],['reports','flag','البلاغات'],['watch','timer','تحليلات المشاهدة'],['tools','wrench','الأدوات والنسخ']];
  nav.insertAdjacentHTML('beforeend',items.map(([k,i,l])=>`<button data-section="${k}" type="button"><i data-lucide="${i}"></i><span>${l}</span></button>`).join(''));
  nav.querySelectorAll('[data-section="commerce"],[data-section="reports"],[data-section="watch"],[data-section="tools"]').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
  // موعد النشر في نموذج الإضافة
  const paid=document.querySelector('.paid-toggle');
  paid.insertAdjacentHTML('beforebegin','<label class="full">موعد النشر (اختياري — يظهر «قريباً» بعدّاد تنازلي حتى هذا الوقت)<input name="publishAt" type="datetime-local"></label>');
  document.querySelector('#movie-form').addEventListener('formdata',e=>{const v=e.formData.get('publishAt');if(v)e.formData.set('publishAt',new Date(v).toISOString());else e.formData.delete('publishAt')});
  icons();
}

/* ---------- الاشتراكات ---------- */
async function loadCommerce(){
  try{
    const [plans,coupons,subs]=await Promise.all([api('/api/admin/plans'),api('/api/admin/coupons'),api('/api/admin/subs')]);
    $$('#plans-list').innerHTML=plans.length?plans.map(p=>`<article class="admin-movie"><div><h3>${E(p.name)}</h3><div class="movie-meta"><span>${fmt(p.days)} يوم</span><span>${fmt(p.price)} ${p.currency==='USD'?'$':'ل.س'}</span><span dir="ltr">${E(p.account)}</span></div></div><button class="danger-btn" data-del-plan="${E(p.id)}">حذف</button></article>`).join(''):'<div class="empty-inline">لا توجد خطط.</div>';
    $$('#coupons-list').innerHTML=coupons.length?coupons.map(c=>`<article class="admin-movie"><div><h3 dir="ltr" style="text-align:right">${E(c.code)} — ${c.percent}%</h3><div class="movie-meta"><span>استُخدم ${fmt(c.used||0)}${c.maxUses?' / '+fmt(c.maxUses):''}</span><span>${{all:'أفلام وخطط',movie:'أفلام',plan:'خطط'}[c.scope]||''}</span><span>${c.expiresAt?'ينتهي '+new Date(c.expiresAt).toLocaleDateString('ar'):'بلا انتهاء'}</span></div></div><button class="danger-btn" data-del-coupon="${E(c.code)}">حذف</button></article>`).join(''):'<div class="empty-inline">لا توجد أكواد.</div>';
    $$('#subs-list').innerHTML=subs.length?subs.map(s=>`<article class="admin-movie"><div><h3>${E(s.username)}</h3><div class="movie-meta"><span>${E(s.planName)}</span><span>حتى ${dt(s.until)}</span></div></div><button class="danger-btn" data-del-sub="${E(s.userId)}">إلغاء الاشتراك</button></article>`).join(''):'<div class="empty-inline">لا يوجد مشتركون.</div>';
    document.querySelectorAll('[data-del-plan]').forEach(b=>b.onclick=()=>run(()=>api(`/api/admin/plans/${b.dataset.delPlan}`,{method:'DELETE'}),loadCommerce));
    document.querySelectorAll('[data-del-coupon]').forEach(b=>b.onclick=()=>run(()=>api(`/api/admin/coupons/${encodeURIComponent(b.dataset.delCoupon)}`,{method:'DELETE'}),loadCommerce));
    document.querySelectorAll('[data-del-sub]').forEach(b=>b.onclick=()=>run(()=>api(`/api/admin/subs/${encodeURIComponent(b.dataset.delSub)}`,{method:'DELETE'}),loadCommerce));
  }catch(e){toast(e.message,'error')}
}
async function run(fn,after,msg='تم التنفيذ'){try{await fn();toast(msg);if(after)await after()}catch(e){toast(e.message,'error')}}
function bindForms(){
  const form=(sel,fn)=>$$(sel).addEventListener('submit',async e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));await fn(d,f)});
  form('#plan-form',(d,f)=>run(()=>post('/api/admin/plans',d),()=>{f.reset();return loadCommerce()},'تمت إضافة الخطة'));
  form('#coupon-form',(d,f)=>run(()=>post('/api/admin/coupons',d),()=>{f.reset();return loadCommerce()},'تمت إضافة الكود'));
  form('#grant-form',(d,f)=>run(()=>post('/api/admin/subs/grant',d),()=>{f.reset();return loadCommerce()},'تم منح الاشتراك'));
  form('#settings-form',(d)=>run(()=>post('/api/admin/settings',d,'PUT'),loadTools,'تم حفظ الحدود'));
  $$('#backup-now').onclick=async e=>{const b=e.currentTarget;b.disabled=true;await run(()=>post('/api/admin/backups',{}),loadTools,'تم إنشاء النسخة');b.disabled=false};
  $$('#watch-refresh').onclick=loadWatch;
}

/* ---------- البلاغات ---------- */
const REASON={spam:'مزعج/إعلان',abuse:'إساءة',sexual:'محتوى جنسي',violence:'عنف',copyright:'حقوق',other:'أخرى'};
const TYPE={short:'مقطع',comment:'تعليق',movie:'فيلم'};
async function loadReports(){
  try{
    const list=await api('/api/admin/reports');$$('#reports-total').textContent=fmt(list.length);
    $$('#reports-list').innerHTML=list.length?list.map(r=>`<article class="admin-movie"><div><h3>${TYPE[r.type]}: ${E(r.label)}</h3><p>${E(r.note||'—')}</p><div class="movie-meta"><span>السبب: ${REASON[r.reason]||r.reason}</span><span>المُبلِّغ: ${E(r.reporter)}</span>${r.owner?`<span>صاحب المحتوى: ${E(r.owner)}</span>`:''}<span>${dt(r.createdAt)}</span></div></div><div class="pay-actions"><button class="secondary-admin" data-rep="${E(r.id)}" data-act="dismiss">تجاهل</button>${r.type!=='movie'?`<button class="danger-btn" data-rep="${E(r.id)}" data-act="remove">حذف المحتوى</button>`:''}</div></article>`).join(''):'<div class="empty-inline">لا توجد بلاغات مفتوحة. 🎉</div>';
    document.querySelectorAll('[data-rep]').forEach(b=>b.onclick=()=>run(()=>post(`/api/admin/reports/${b.dataset.rep}/resolve`,{action:b.dataset.act}),loadReports));
  }catch(e){toast(e.message,'error')}
}

/* ---------- تحليلات المشاهدة ---------- */
async function loadWatch(){
  try{
    const d=await api('/api/admin/watch-stats');
    $$('#watch-tiles').innerHTML=[['timer','إجمالي زمن المشاهدة',secs(d.totalSecs)],['play','عدد التشغيلات',fmt(d.plays)],['repeat','إعادات التشغيل',fmt(d.replays)],['hourglass','متوسط المدة لكل تشغيل',secs(d.avgSecs)]].map(x=>`<div class="stat-card"><div class="icon"><i data-lucide="${x[0]}"></i></div><span>${x[1]}</span><strong>${x[2]}</strong></div>`).join('');
    const bars=(arr,label,val)=>{const mx=Math.max(1,...arr.map(val));return arr.length?arr.map(x=>`<div class="bar-row"><span>${E(label(x))}</span><i><b style="width:${Math.round(val(x)/mx*100)}%"></b></i><em>${fmt(val(x))}</em></div>`).join(''):'<div class="empty-inline">لا بيانات بعد.</div>'};
    $$('#watch-sources').innerHTML=bars(d.sources,x=>SRC[x.name]||x.name,x=>x.n);
    $$('#watch-countries').innerHTML=bars(d.countries,x=>CC[x.code]||x.code,x=>Math.round(x.secs/60))+'<p class="hint">القيمة بالدقائق. تظهر الدولة فقط خلف خدمة تضيف ترويسة الدولة (مثل Cloudflare)، وإلا «غير معروف».</p>';
    $$('#watch-items').innerHTML=d.items.length?d.items.map((x,i)=>`<div class="rank"><span class="num">${i+1}</span><div><strong>${E(x.title)}</strong><small>${x.kind==='short'?'Short':'فيلم'} · ${fmt(x.plays)} تشغيل · ${fmt(x.replays)} إعادة · متوسط ${secs(x.avg)}</small></div><b>${secs(x.secs)}</b></div>`).join(''):'<div class="empty-inline">لا بيانات بعد.</div>';
    if(window.Chart){if(charts.watch)charts.watch.destroy();charts.watch=new Chart($$('#watch-chart'),{type:'bar',data:{labels:d.days.map(x=>x.date.slice(5)),datasets:[{label:'دقائق',data:d.days.map(x=>Math.round(x.secs/60))}]},options:chartOpts()})}
    icons();
  }catch(e){toast(e.message,'error')}
}

/* ---------- الأدوات ---------- */
async function loadTools(){
  try{
    const [caps,bk,users]=await Promise.all([api('/api/admin/capabilities'),api('/api/admin/backups'),api('/api/admin/users')]);
    const st=(ok,on,off)=>`<span class="${ok?'pay-approved':'pay-rejected'}">${ok?on:off}</span>`;
    $$('#caps-grid').innerHTML=[['ffmpeg (جودات/صور مصغّرة/تحويل)',st(caps.ffmpeg,'مثبّت','غير مثبّت')],['التفريغ الصوتي (Whisper)',st(caps.whisper,'جاهز','غير مُهيّأ: OPENAI_API_KEY أو WHISPER_URL')],['البريد (SMTP)',st(caps.smtp,'مُهيّأ','غير مُهيّأ: SMTP_HOST (يُطبع الرابط في سجل الخادم)')]].map(x=>`<div class="system-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    const f=$$('#settings-form');f.maxMovieMB.value=caps.settings.maxMovieMB;f.maxShortMB.value=caps.settings.maxShortMB;
    $$('#backup-hint').textContent=`تلقائي كل ${bk.everyHours} ساعة، ويُحتفَظ بآخر ${bk.keep} نسخ (BACKUP_EVERY_HOURS / BACKUP_KEEP). تشمل البيانات والترجمات وحساب الإدارة دون الفيديوهات.`;
    $$('#backups-list').innerHTML=bk.items.length?bk.items.map(b=>`<article class="admin-movie"><div><h3 dir="ltr" style="text-align:right">${E(b.name)}</h3><div class="movie-meta"><span>${bytes(b.size)}</span><span>${dt(b.createdAt)}</span></div></div><div class="pay-actions"><a class="secondary-admin" href="/api/admin/backups/${encodeURIComponent(b.name)}" download>تحميل</a><button class="danger-btn" data-del-bk="${E(b.name)}">حذف</button></div></article>`).join(''):'<div class="empty-inline">لا توجد نسخ بعد.</div>';
    document.querySelectorAll('[data-del-bk]').forEach(b=>b.onclick=()=>run(()=>api(`/api/admin/backups/${encodeURIComponent(b.dataset.delBk)}`,{method:'DELETE'}),loadTools));
    $$('#users-list').innerHTML=users.length?users.map(u=>`<article class="admin-movie"><div><h3>${E(u.username)} ${u.verified?'<span class="pay-approved">مؤكَّد</span>':''}</h3><div class="movie-meta"><span dir="ltr">${E(u.email)}</span><span>${dt(u.createdAt)}</span>${u.sub?`<span>اشتراك: ${E(u.sub)}</span>`:''}</div></div></article>`).join(''):'<div class="empty-inline">لا مستخدمون.</div>';
  }catch(e){toast(e.message,'error')}
}

/* ---------- إعدادات متقدمة لكل فيلم (جدولة، مقدمة، معالجة، تفريغ) ---------- */
const PROC={queued:'في الانتظار',working:'قيد المعالجة',done:'جاهز',failed:'فشلت المعالجة'};
const _renderMovies=window.renderMovies;
window.renderMovies=function(){
  _renderMovies.apply(this,arguments);
  document.querySelectorAll('#movies-list [data-sub]').forEach(btn=>{
    const id=btn.dataset.sub,m=movies.find(x=>x.id===id);if(!m)return;
    const row=btn.closest('.admin-movie');
    const meta=row.querySelector('.movie-meta');
    const bits=[];
    if(m.comingSoon)bits.push(`<span class="pay-pending">مجدول: ${dt(m.publishAt)}</span>`);
    if(m.processing)bits.push(`<span>${PROC[m.processing]||m.processing}${(m.qualities||[]).length?' · '+m.qualities.map(q=>q+'p').join('/'):''}</span>`);
    if(m.duration)bits.push(`<span>${secs(m.duration)}</span>`);
    if(m.introEnd)bits.push(`<span>مقدمة ${m.introStart}–${m.introEnd}ث</span>`);
    if(m.transcribe&&m.transcribe.status!=='done')bits.push(`<span>تفريغ: ${m.transcribe.status==='working'?'جارٍ…':'فشل'}</span>`);
    meta.insertAdjacentHTML('beforeend',bits.join(''));
    btn.insertAdjacentHTML('afterend',`<button class="secondary-admin" data-adv="${E(id)}" type="button"><i data-lucide="sliders-horizontal"></i> متقدم</button>`);
  });
  document.querySelectorAll('[data-adv]').forEach(b=>b.onclick=()=>advanced(b.dataset.adv));icons();
};
function toLocalInput(iso){if(!iso)return '';const d=new Date(iso);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
async function advanced(id){
  const m=movies.find(x=>x.id===id);if(!m)return;
  const caps=await api('/api/admin/capabilities').catch(()=>({}));
  const r=await Swal.fire({title:m.title,showCancelButton:true,confirmButtonText:'حفظ',cancelButtonText:'إغلاق',width:560,
    html:`<div style="display:grid;gap:10px;text-align:right">
    <label>موعد النشر (فارغ = منشور الآن)<input id="adv-pub" type="datetime-local" class="swal2-input" style="width:100%;margin:6px 0" value="${toLocalInput(m.publishAt)}"></label>
    <div style="display:flex;gap:8px"><label style="flex:1">بداية المقدمة (ثانية)<input id="adv-is" type="number" min="0" class="swal2-input" style="width:100%;margin:6px 0" value="${m.introStart||0}"></label><label style="flex:1">نهاية المقدمة (ثانية)<input id="adv-ie" type="number" min="0" class="swal2-input" style="width:100%;margin:6px 0" value="${m.introEnd||0}"></label></div>
    <small style="color:#718095">نهاية المقدمة = 0 تعطّل زر «تخطي المقدمة».</small>
    <hr><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="swal2-confirm swal2-styled" id="adv-proc" ${caps.ffmpeg?'':'disabled title="ffmpeg غير مثبّت"'}>معالجة الفيديو (جودات + معاينة)</button><button type="button" class="swal2-confirm swal2-styled" id="adv-tr" ${caps.whisper?'':'disabled title="Whisper غير مُهيّأ"'}>تفريغ صوتي تلقائي</button></div>
    <small style="color:#718095">${caps.ffmpeg?'':'ffmpeg غير مثبّت على الخادم. '}${caps.whisper?'':'التفريغ يحتاج OPENAI_API_KEY أو WHISPER_URL.'}</small></div>`,
    didOpen:()=>{
      document.getElementById('adv-proc').onclick=()=>run(()=>post(`/api/admin/movies/${encodeURIComponent(id)}/process`,{}),load,'بدأت المعالجة في الخلفية');
      document.getElementById('adv-tr').onclick=async()=>{const l=await Swal.fire({title:'لغة الكلام في الفيلم',input:'select',inputOptions:{'':'تلقائي',ar:'العربية',en:'English',ru:'Русский',tr:'Türkçe',fr:'Français'},showCancelButton:true,confirmButtonText:'ابدأ',cancelButtonText:'إلغاء'});if(l.isConfirmed)run(()=>post(`/api/admin/movies/${encodeURIComponent(id)}/transcribe`,{lang:l.value}),load,'بدأ التفريغ — سيظهر كمسار ترجمة «تلقائي» عند الانتهاء')};
    },
    preConfirm:()=>({publishAt:document.getElementById('adv-pub').value,introStart:Number(document.getElementById('adv-is').value||0),introEnd:Number(document.getElementById('adv-ie').value||0)})});
  if(!r.isConfirmed)return;
  const v=r.value;
  await run(()=>post(`/api/admin/movies/${encodeURIComponent(id)}/meta`,{publishAt:v.publishAt?new Date(v.publishAt).toISOString():'',introStart:v.introStart,introEnd:v.introEnd},'PATCH'),load,'تم حفظ الإعدادات');
}

/* ---------- ربط ---------- */
const _showSection=window.showSection;
window.showSection=function(name){
  _showSection.apply(this,arguments);
  if(name==='commerce')loadCommerce();else if(name==='reports')loadReports();else if(name==='watch')loadWatch();else if(name==='tools')loadTools();
};
document.addEventListener('DOMContentLoaded',()=>{inject();bindForms();renderMovies()});
})();
