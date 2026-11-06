/* لوحة الإدارة — «شريط التطبيق»: ألوان وحركة الشريط السفلي لكل الزوار (الزائر يستطيع تخصيصه لهاتفه فقط) */
(function(){
const $$=s=>document.querySelector(s);const J={'Content-Type':'application/json'};
const TABS=['الرئيسية','Shorts','المحفوظات','السجل','الإدارة'];
const SECTION=`<section class="admin-section hidden" id="section-navui"><div class="page-title"><div><h1>شريط التطبيق السفلي</h1><p>غيّر ألوان وحركة الشريط السفلي لكل الزوار. كل زائر يستطيع تخصيصه لهاتفه فقط من «المظهر» دون التأثير على غيره.</p></div></div>
<div class="panel-grid"><section class="panel"><div class="panel-title"><h2>الألوان</h2></div>
 <label class="mini-form"><input type="checkbox" id="nv-enabled"> تفعيل الشريط الجديد (بحافة منحنية)</label>
 <div class="mini-form"><label style="flex:1">النمط<select id="nv-style"><option value="notch">منحني بفقاعة</option><option value="classic">كلاسيكي</option></select></label><label style="flex:1">ألوان الفقاعة<select id="nv-mode"><option value="per-tab">لون لكل صفحة</option><option value="single">لون واحد</option></select></label></div>
 <div id="nv-colors" style="display:flex;flex-wrap:wrap;gap:12px;margin:8px 0"></div>
 <div class="mini-form"><label style="flex:1">لون الفقاعة الواحد<input type="color" id="nv-single"></label><label style="flex:1">الشريط (نهاري)<input type="color" id="nv-bl"></label><label style="flex:1">الشريط (ليلي)<input type="color" id="nv-bd"></label></div>
 <div id="nv-prev" style="margin-top:14px"></div></section>
<section class="panel"><div class="panel-title"><h2>الحركة والخيارات</h2></div>
 <div class="mini-form"><label style="flex:1">حركة الانتقال<select id="nv-anim"><option value="jelly">جيلي (مرن)</option><option value="slide">انزلاق ناعم</option><option value="none">بدون حركة</option></select></label></div>
 <label class="mini-form"><input type="checkbox" id="nv-halo"> هالة نابضة حول الفقاعة</label>
 <label class="mini-form"><input type="checkbox" id="nv-labels"> إظهار أسماء الصفحات</label>
 <label class="mini-form"><input type="checkbox" id="nv-haptic"> اهتزاز خفيف عند التنقل (للهواتف)</label>
 <label class="mini-form"><input type="checkbox" id="nv-allow"> السماح للزوار بتخصيص الشريط لهواتفهم (لا يؤثر على غيرهم)</label>
 <div class="mini-form" style="gap:8px"><button class="primary-admin" id="nv-save" type="button">حفظ للجميع</button><button class="secondary-admin" id="nv-reset" type="button">استعادة الافتراضي</button></div><p class="hint" id="nv-msg"></p></section></div></section>`;
let cfg=null;
function prev(){
  const c=read();const col=c.mode==='single'?[c.single,c.single,c.single,c.single,c.single]:c.colors;
  $$('#nv-prev').innerHTML=`<div style="display:flex;gap:6px;justify-content:center;padding:14px 10px;border-radius:16px;background:${c.barLight};box-shadow:0 6px 18px rgba(0,0,0,.15)">${TABS.map((t,i)=>`<div style="text-align:center;font-size:10px;width:54px"><div style="width:34px;height:34px;margin:0 auto 3px;border-radius:50%;background:${col[i]};box-shadow:0 5px 14px ${col[i]}88"></div><span style="color:${col[i]};font-weight:700">${t}</span></div>`).join('')}</div>`;
}
function read(){return{enabled:$$('#nv-enabled').checked,style:$$('#nv-style').value,mode:$$('#nv-mode').value,colors:[...document.querySelectorAll('#nv-colors input')].map(i=>i.value),single:$$('#nv-single').value,barLight:$$('#nv-bl').value,barDark:$$('#nv-bd').value,anim:$$('#nv-anim').value,halo:$$('#nv-halo').checked,labels:$$('#nv-labels').checked,haptic:$$('#nv-haptic').checked,allowUserCustom:$$('#nv-allow').checked}}
function fill(n){cfg=n;$$('#nv-enabled').checked=n.enabled;$$('#nv-style').value=n.style;$$('#nv-mode').value=n.mode;$$('#nv-colors').innerHTML=n.colors.map((c,i)=>`<label style="display:grid;justify-items:center;gap:3px;font-size:11px"><input type="color" value="${c}" style="width:46px;height:46px;border-radius:50%;padding:0"><small>${TABS[i]}</small></label>`).join('');
  $$('#nv-single').value=n.single;$$('#nv-bl').value=n.barLight;$$('#nv-bd').value=n.barDark;$$('#nv-anim').value=n.anim;$$('#nv-halo').checked=n.halo;$$('#nv-labels').checked=n.labels;$$('#nv-haptic').checked=n.haptic;$$('#nv-allow').checked=n.allowUserCustom;
  document.querySelectorAll('#section-navui input,#section-navui select').forEach(e=>{e.oninput=prev;e.onchange=prev});prev()}
async function load(){try{const d=await api('/api/admin/site-ui');fill(d.nav)}catch(e){$$('#nv-msg').textContent=e.message}}
function inject(){
  (document.querySelector('.admin-main')||document.body).insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');nav.insertAdjacentHTML('beforeend','<button data-section="navui" type="button"><i data-lucide="panel-bottom"></i><span>شريط التطبيق</span></button>');
  nav.querySelector('[data-section="navui"]').onclick=()=>showSection('navui');
  $$('#nv-save').onclick=async()=>{try{const r=await api('/api/admin/site-ui',{method:'PUT',headers:J,body:JSON.stringify({nav:read()})});fill(r.nav);$$('#nv-msg').textContent='✅ حُفظ، ويظهر للزوار فوراً عند تحديث صفحاتهم.'}catch(e){$$('#nv-msg').textContent='❌ '+e.message}};
  $$('#nv-reset').onclick=async()=>{if(!confirm('استعادة الألوان والحركة الافتراضية للجميع؟'))return;const r=await api('/api/admin/site-ui/reset',{method:'POST'});fill(r.nav);$$('#nv-msg').textContent='تمت الاستعادة.'};
  const orig=window.showSection;window.showSection=function(n){const r=orig.apply(this,arguments);if(n==='navui')load();return r};
  if(window.lucide)lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
