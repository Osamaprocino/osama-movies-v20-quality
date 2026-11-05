/* لوحة الإدارة — «عنّي والتواصل» (v18): نصوص المقالتين وروابط التواصل */
(function(){
const $$=s=>document.querySelector(s);const E=s=>escapeHtml(String(s==null?'':s));
const SECTION=`<section class="admin-section hidden" id="section-about"><div class="page-title"><div><h1>عنّي والتواصل</h1><p>مقالة «من أنا» ومقالة «أمان الموقع» وأيقونات التواصل التي تظهر للزوّار.</p></div></div>
<div class="panel-grid">
 <section class="panel"><div class="panel-title"><h2>روابط التواصل</h2></div>
  <div class="mini-form"><label style="flex:1">اسمك<input id="ab-owner" maxlength="60"></label></div>
  <div class="mini-form"><label style="flex:1">واتساب (بصيغة دولية)<input id="ab-wa" dir="ltr" placeholder="+963984215420"></label><label style="flex:1">تيليجرام (رقم)<input id="ab-tg" dir="ltr" placeholder="+963984215420"></label></div>
  <div class="mini-form"><label style="flex:1">تيك توك (اسم الحساب)<input id="ab-tk" dir="ltr" placeholder="osama_200934"></label><label style="flex:1">إنستغرام (اسم الحساب أو الرابط)<input id="ab-ig" dir="ltr" placeholder="osama_yosif2"></label></div>
  <p class="hint">اترك الخانة فارغة لإخفاء الأيقونة. تظهر الأيقونات في «عنّي والتواصل» بالموقع.</p></section>
 <section class="panel"><div class="panel-title"><h2>النصوص</h2></div>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">اللغة<select id="ab-lang"><option value="ar">العربية</option><option value="en">English</option><option value="ru">Русский</option></select></label>
  <div class="mini-form"><label style="flex:1">عنوان «من أنا»<input id="ab-at" maxlength="120"></label><label style="flex:1">عنوان «الأمان»<input id="ab-st" maxlength="120"></label></div>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">مقالة «من أنا» (سطر فارغ بين الفقرات)<textarea id="ab-a" rows="9" style="width:100%"></textarea></label>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">مقالة «أمان الموقع»<textarea id="ab-s" rows="9" style="width:100%"></textarea></label>
  <div class="mini-form"><label style="flex:1">عنوان التواصل<input id="ab-ct" maxlength="120"></label><label style="flex:2">جملة التواصل<input id="ab-ch" maxlength="120"></label></div>
  <button class="primary-admin" id="ab-save" type="button" style="margin-top:10px">حفظ</button></section>
</div></section>`;
let data=null,cur='ar';
const fill=()=>{const t=data.texts[$$('#ab-lang').value]||{};$$('#ab-at').value=t.aboutTitle||'';$$('#ab-st').value=t.securityTitle||'';$$('#ab-a').value=t.about||'';$$('#ab-s').value=t.security||'';$$('#ab-ct').value=t.contactTitle||'';$$('#ab-ch').value=t.contactHint||''};
async function load(){try{data=await api('/api/admin/about');$$('#ab-owner').value=data.owner||'';$$('#ab-wa').value=data.contacts.whatsapp||'';$$('#ab-tg').value=data.contacts.telegram||'';$$('#ab-tk').value=data.contacts.tiktok||'';$$('#ab-ig').value=data.contacts.instagram||'';cur=$$('#ab-lang').value;fill()}catch(e){toast(e.message,'error')}}
function inject(){
  (document.querySelector('.admin-main')||document.body).insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');nav.insertAdjacentHTML('beforeend','<button data-section="about" type="button"><i data-lucide="message-circle-heart"></i><span>عنّي والتواصل</span></button>');
  nav.querySelector('[data-section="about"]').onclick=()=>showSection('about');
  $$('#ab-lang').onchange=()=>{stash(cur);cur=$$('#ab-lang').value;fill()};
  function stash(l){if(!data)return;data.texts[l]={...data.texts[l],aboutTitle:$$('#ab-at').value,securityTitle:$$('#ab-st').value,about:$$('#ab-a').value,security:$$('#ab-s').value,contactTitle:$$('#ab-ct').value,contactHint:$$('#ab-ch').value}}
  $$('#ab-save').onclick=async()=>{stash(cur);
    try{await api('/api/admin/about',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:$$('#ab-owner').value,contacts:{whatsapp:$$('#ab-wa').value,telegram:$$('#ab-tg').value,tiktok:$$('#ab-tk').value,instagram:$$('#ab-ig').value},texts:data.texts})});toast('تم الحفظ')}catch(e){toast(e.message,'error')}};
  if(window.lucide)lucide.createIcons();
}
inject();
const _show=window.showSection;window.showSection=function(name){_show.apply(this,arguments);if(name==='about')load()};
})();
