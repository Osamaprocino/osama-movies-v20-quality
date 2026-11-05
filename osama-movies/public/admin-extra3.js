/* لوحة الإدارة — مراجعة أفلام المستخدمين (v13) */
(function(){
const $$=s=>document.querySelector(s);const E=s=>escapeHtml(String(s==null?'':s));
const post=(u,b,m='POST')=>api(u,{method:m,headers:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});
const SECTION=`<section class="admin-section hidden" id="section-usermovies"><div class="page-title"><div><h1>أفلام المستخدمين</h1><p>راجع ما ينشره المستخدمون قبل ظهوره للجميع، أو احذف أي فيلم مخالف.</p></div></div>
<section class="panel"><label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="um-appr"><span>أفلام المستخدمين تنتظر موافقتي قبل الظهور (موصى به)</span></label>
<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="primary-admin" id="um-save" type="button">حفظ</button><button class="secondary-admin" id="um-all" type="button">عرض كل أفلام المستخدمين</button></div></section>
<div id="um-list" style="display:grid;gap:12px;margin-top:14px"></div></section>`;
let all=false;
async function load(){
  try{const d=await api('/api/admin/user-movies'+(all?'?all=1':''));$$('#um-appr').checked=d.approve;
   $$('#um-list').innerHTML=d.items.length?d.items.map(m=>`<article class="admin-movie"><img src="${E(m.posterUrl)}" alt=""><div><h3>${E(m.title)}</h3><p>${E(m.description||'بدون وصف')}</p><div class="movie-meta"><span>@${E(m.owner)}</span><span>${E(m.category)}</span><span>${new Date(m.createdAt).toLocaleString('ar')}</span><span>${m.pending?'بانتظار المراجعة':'منشور'}</span></div><video src="${E(m.videoUrl)}" controls preload="none" style="width:100%;max-width:420px;border-radius:12px;margin-top:8px"></video></div><div class="row-actions">${m.pending?`<button class="primary-admin" data-ap="${E(m.id)}" type="button">موافقة</button>`:''}<button class="danger-btn" data-rj="${E(m.id)}" type="button">${m.pending?'رفض وحذف':'حذف'}</button></div></article>`).join(''):'<div class="empty-inline">لا توجد أفلام بانتظار المراجعة.</div>';
   document.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>act(`/api/admin/user-movies/${encodeURIComponent(b.dataset.ap)}/approve`));
   document.querySelectorAll('[data-rj]').forEach(b=>b.onclick=()=>{if(confirm('حذف هذا الفيلم نهائياً؟'))act(`/api/admin/user-movies/${encodeURIComponent(b.dataset.rj)}/reject`)});
  }catch(e){toast(e.message,'error')}
}
async function act(u){try{await post(u);toast('تم');load()}catch(e){toast(e.message,'error')}}
function inject(){
  const main=document.querySelector('.admin-main')||document.querySelector('main')||document.body;
  main.insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');
  nav.insertAdjacentHTML('beforeend','<button data-section="usermovies" type="button"><i data-lucide="film"></i><span>أفلام المستخدمين</span></button>');
  nav.querySelector('[data-section="usermovies"]').onclick=()=>showSection('usermovies');
  $$('#um-save').onclick=async()=>{try{await post('/api/admin/user-movies/settings',{approveUserMovies:$$('#um-appr').checked},'PUT');toast('تم الحفظ')}catch(e){toast(e.message,'error')}};
  $$('#um-all').onclick=()=>{all=!all;load()};
  if(window.lucide)lucide.createIcons();
}
inject();
const _show=window.showSection;
window.showSection=function(name){_show.apply(this,arguments);if(name==='usermovies')load()};
})();
