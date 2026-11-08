/* لوحة الإدارة — «المؤثرات»: تشغيل/إطفاء المؤثرات لكل الزوار (الزائر يختار لنفسه إن سمحتَ). ids: fxa-* */
(function(){
const $$=s=>document.querySelector(s);const J={'Content-Type':'application/json'};
const ROWS=[['cardexpand','انتقال البطاقة إلى صفحة الفيلم'],['rubber','مطاطية سحب Shorts'],['cinemadim','تعتيم السينما أثناء التشغيل'],['clicksound','نقرة صوتية خفيفة (مطفأة افتراضياً)'],['cursor','توهّج المؤشر'],['sparkles','لمعات المؤشر'],['allowUserCustom','السماح للزوار باختيار مؤثراتهم من «المظهر»']];
const SECTION=`<section class="admin-section hidden" id="section-fxs"><div class="page-title"><div><h1>المؤثرات</h1><p>التغيير يسري على كل الزوار فور تحديث صفحاتهم. المؤثرات تُحترم دائماً مع «تقليل الحركة».</p></div></div>
<section class="panel"><div class="panel-title"><h2>التشغيل</h2></div>${ROWS.map(([k,l])=>`<label class="mini-form"><input type="checkbox" id="fxa-${k}"> ${l}</label>`).join('')}
<div class="mini-form" style="gap:8px"><button class="primary-admin" id="fxa-save" type="button">حفظ للجميع</button></div><p class="hint" id="fxa-msg"></p></section></section>`;
async function load(){try{const d=await api('/api/admin/site-ui');for(const [k] of ROWS)$$('#fxa-'+k).checked=!!d.fx[k]}catch(e){$$('#fxa-msg').textContent=e.message}}
function inject(){
  (document.querySelector('.admin-main')||document.body).insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');if(!nav)return;
  nav.insertAdjacentHTML('beforeend','<button data-section="fxs" type="button"><i data-lucide="sparkles"></i><span>المؤثرات</span></button>');
  nav.querySelector('[data-section="fxs"]').onclick=()=>showSection('fxs');
  $$('#fxa-save').onclick=async()=>{try{const fx={};for(const [k] of ROWS)fx[k]=$$('#fxa-'+k).checked;await api('/api/admin/site-ui',{method:'PUT',headers:J,body:JSON.stringify({fx})});$$('#fxa-msg').textContent='✅ حُفظ للجميع.'}catch(e){$$('#fxa-msg').textContent='❌ '+e.message}};
  const orig=window.showSection;window.showSection=function(n){const r=orig.apply(this,arguments);if(n==='fxs')load();return r};
  if(window.lucide)lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
