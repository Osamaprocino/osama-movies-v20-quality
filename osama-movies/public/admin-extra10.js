/* لوحة الإدارة — «هوية التطبيق»: اسم التطبيق وأيقونته عند التثبيت على الهاتف */
(function(){
const $$=s=>document.querySelector(s);const J={'Content-Type':'application/json'};
const SECTION=`<section class="admin-section hidden" id="section-appbrand"><div class="page-title"><div><h1>هوية التطبيق</h1><p>الاسم والأيقونة اللذان يظهران عند تثبيت الموقع كتطبيق على الهاتف. من ثبّت التطبيق سابقاً يحتاج حذفه وتثبيته من جديد ليرى التغيير.</p></div></div>
<div class="panel-grid"><section class="panel"><div class="panel-title"><h2>الاسم والألوان</h2></div>
 <label class="mini-form" style="display:block">الاسم الكامل (يظهر في نافذة التثبيت)<input id="abr-name" maxlength="40" style="width:100%"></label>
 <label class="mini-form" style="display:block">الاسم المختصر (تحت الأيقونة، حتى 12 حرفاً)<input id="abr-short" maxlength="12" style="width:100%"></label>
 <div class="mini-form"><label style="flex:1">لون شريط الحالة<input type="color" id="abr-theme"></label><label style="flex:1">لون شاشة الإقلاع<input type="color" id="abr-bg"></label></div>
 <label class="mini-form"><input type="checkbox" id="abr-mask"> أيقونتي مصمَّمة بهامش آمن (تتكيف مع الأشكال الدائرية في أندرويد)</label>
 <div class="mini-form"><button class="btn primary" id="abr-save" type="button">حفظ</button><span id="abr-msg" style="margin-inline-start:10px"></span></div></section>
<section class="panel"><div class="panel-title"><h2>أيقونة التطبيق</h2></div>
 <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:6px 0 12px"><img id="abr-prev" width="96" height="96" alt="" style="border-radius:22px;box-shadow:0 8px 24px rgba(0,0,0,.25);background:#111"><div><b id="abr-pname">Cineo</b><div id="abr-pstate" style="opacity:.7;font-size:13px"></div></div></div>
 <p style="opacity:.75;font-size:13px;margin:0 0 8px">صورة PNG مربّعة بين 512 و2048 بكسل وحتى 2MB. الأفضل أن يكون الشعار في وسطها مع هامش حوالي 10%.</p>
 <div class="mini-form"><input type="file" id="abr-file" accept="image/png" aria-label="رفع أيقونة التطبيق (PNG مربّعة)"><button class="btn" id="abr-reset" type="button">استعادة الأيقونة الافتراضية</button></div><div id="abr-imsg"></div></section></div></section>`;
const read=()=>({name:$$('#abr-name').value,shortName:$$('#abr-short').value,themeColor:$$('#abr-theme').value,backgroundColor:$$('#abr-bg').value,maskableSafe:$$('#abr-mask').checked});
function fill(d){$$('#abr-name').value=d.name;$$('#abr-short').value=d.shortName;$$('#abr-theme').value=d.themeColor;$$('#abr-bg').value=d.backgroundColor;$$('#abr-mask').checked=!!d.maskableSafe;
 $$('#abr-pname').textContent=d.shortName;$$('#abr-prev').src='/app-icon/512.png?v='+(d.iconVersion||0)+'&t='+Date.now();$$('#abr-pstate').textContent=d.customIcon?'أيقونة مخصّصة':'الأيقونة الافتراضية'}
async function load(){try{fill(await api('/api/admin/app-brand'))}catch(e){$$('#abr-msg').textContent=e.message}}
function dims(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok([i.naturalWidth,i.naturalHeight])};i.onerror=()=>{URL.revokeObjectURL(u);no(new Error('تعذر قراءة الصورة'))};i.src=u})}
function inject(){
 (document.querySelector('.admin-main')||document.body).insertAdjacentHTML('beforeend',SECTION);
 const nav=document.querySelector('.admin-nav');nav.insertAdjacentHTML('beforeend','<button data-section="appbrand" type="button"><i data-lucide="smartphone"></i><span>هوية التطبيق</span></button>');
 nav.querySelector('[data-section="appbrand"]').onclick=()=>showSection('appbrand');
 $$('#abr-save').onclick=async()=>{try{const r=await api('/api/admin/app-brand',{method:'PUT',headers:J,body:JSON.stringify(read())});fill(r);$$('#abr-msg').textContent='✅ حُفظ'}catch(e){$$('#abr-msg').textContent='❌ '+e.message}};
 $$('#abr-file').onchange=async function(){const f=this.files[0];if(!f)return;const m=$$('#abr-imsg');m.textContent='';
  try{if(f.type!=='image/png')throw new Error('الصيغة المقبولة PNG فقط');if(f.size>2*1024*1024)throw new Error('الحجم الأقصى 2MB');const [w,h]=await dims(f);if(w!==h)throw new Error('يجب أن تكون الصورة مربّعة ('+w+'×'+h+')');if(w<512||w>2048)throw new Error('المقاس المقبول 512–2048 بكسل (الحالي '+w+')');
   const r=await api('/api/admin/app-brand/icon',{method:'POST',headers:{'Content-Type':'image/png'},body:f});m.textContent='✅ رُفعت الأيقونة';await load()}catch(e){m.textContent='❌ '+e.message}this.value=''};
 $$('#abr-reset').onclick=async()=>{if(!confirm('استعادة الأيقونة الافتراضية؟'))return;try{await api('/api/admin/app-brand/icon',{method:'DELETE'});$$('#abr-imsg').textContent='تمت الاستعادة';await load()}catch(e){$$('#abr-imsg').textContent='❌ '+e.message}};
 const orig=window.showSection;window.showSection=function(n){const r=orig.apply(this,arguments);if(n==='appbrand')load();return r};
 if(window.lucide)lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
