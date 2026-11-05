let analytics=null,movies=[],payments=[],charts={};const $=s=>document.querySelector(s);
function icons(){if(window.lucide)lucide.createIcons()}
function fmt(n){return new Intl.NumberFormat('ar').format(Number(n||0))}
function bytes(n){n=Number(n||0);const u=['بايت','KB','MB','GB','TB'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`}
function duration(sec){sec=Math.floor(Number(sec||0));return `${Math.floor(sec/3600)}س ${Math.floor(sec%3600/60)}د`}
function toast(title,icon='success'){Swal.fire({toast:true,position:'top',showConfirmButton:false,timer:2200,title,icon})}

async function api(url,opts){const r=await fetch(url,opts);if(r.status===401){location.href='/admin-login.html';throw new Error('انتهت الجلسة')}let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'تعذر تنفيذ العملية');return d}

async function load(){
 try{
  const [a,m,h]=await Promise.all([api('/api/admin/analytics'),api('/api/movies'),api('/api/admin/health')]);
  analytics=a;movies=m;renderStats();renderTop();renderMovies();renderAnalytics();renderEvents();renderSystem(h);await loadPayments();icons();
 }catch(e){toast(e.message,'error')}
}
function renderStats(){
 const t=analytics.totals;
 const data=[
  ['film','الأفلام',t.movies],['eye','إجمالي المشاهدات',t.views],['bookmark','عمليات الحفظ',t.saves],['users','الأجهزة المعروفة',t.devices],
  ['activity','نشطة خلال 24 ساعة',t.active24h],['upload','عمليات الرفع',t.uploads],['trash-2','عمليات الحذف',t.deletes],['hard-drive','حجم المحتوى',bytes(t.storageBytes)]
 ];
 $('#stat-grid').innerHTML=data.map(x=>`<div class="stat-card"><div class="icon"><i data-lucide="${x[0]}"></i></div><span>${x[1]}</span><strong>${x[2]}</strong></div>`).join('')
}
function renderTop(){
 const list=analytics.topMovies;
 $('#top-movies').innerHTML=list.length?list.map((m,i)=>`<div class="rank"><span class="num">${i+1}</span><div><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.category)}</small></div><b>${fmt(m.views)}</b></div>`).join(''):'<div class="empty-inline">لا توجد مشاهدات بعد.</div>'
}
function renderMovies(filter=''){
 const f=String(filter).trim().toLowerCase();const list=movies.filter(m=>[m.title,m.category,m.description].some(x=>String(x||'').toLowerCase().includes(f)));
 $('#movies-total').textContent=fmt(list.length);
 $('#movies-list').innerHTML=list.length?list.map(m=>`<article class="admin-movie"><img src="${escapeHtml(m.posterUrl)}" alt="${escapeHtml(m.title)}"><div><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.description||'بدون وصف')}</p><div class="movie-meta"><span>${escapeHtml(m.category||'عام')}</span><span>${fmt(m.views)} مشاهدة</span><span>${new Date(m.createdAt).toLocaleDateString('ar')}</span><span>${bytes(m.fileSize)}</span>${m.isPaid?`<span>مدفوع: ${fmt(m.price)} ${m.currency==='USD'?'$':'ل.س'}</span>`:''}</div></div><div class="row-actions"><button class="secondary-admin" data-sub="${escapeHtml(m.id)}"><i data-lucide="captions"></i> ترجمة (${fmt((m.subtitles||[]).length)})</button><button class="danger-btn" data-delete="${escapeHtml(m.id)}"><i data-lucide="trash-2"></i> حذف</button></div></article>`).join(''):'<div class="empty-inline">لا توجد نتائج.</div>';
 $('#movies-list').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteMovie(b.dataset.delete));$('#movies-list').querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>manageSubs(b.dataset.sub));icons()
}
function renderAnalytics(){
 const daily=analytics.daily;const labels=daily.map(x=>x.date.slice(5));const views=daily.map(x=>x.views);const saves=daily.map(x=>x.saves);
 destroy('views');charts.views=new Chart($('#views-chart'),{type:'line',data:{labels,datasets:[{label:'المشاهدات',data:views,tension:.35,fill:true},{label:'الحفظ',data:saves,tension:.35,fill:false}]},options:chartOpts()});
 destroy('activity');charts.activity=new Chart($('#activity-chart'),{type:'bar',data:{labels,datasets:[{label:'المشاهدات',data:views},{label:'الحفظ',data:saves}]},options:chartOpts()});
 const c=analytics.categories;destroy('category');charts.category=new Chart($('#category-chart'),{type:'doughnut',data:{labels:c.map(x=>x.name),datasets:[{data:c.map(x=>x.count)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}});
}
function chartOpts(){return{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}}
function destroy(k){if(charts[k])charts[k].destroy()}
function renderEvents(){
 const icon={view:'eye',save:'bookmark',upload:'upload-cloud',delete:'trash-2',admin_login:'log-in',user_register:'user-plus',payment_submitted:'wallet',payment_approved:'check-circle',payment_rejected:'x-circle'};
 $('#events-list').innerHTML=analytics.recentEvents.length?analytics.recentEvents.map(e=>`<div class="event"><i data-lucide="${icon[e.type]||'activity'}"></i><div><strong>${eventText(e)}</strong><small>${new Date(e.at).toLocaleString('ar')}</small></div></div>`).join(''):'<div class="empty-inline">لا يوجد نشاط مسجل.</div>'
}
function eventText(e){if(e.type==='view')return`مشاهدة: ${escapeHtml(e.title)}`;if(e.type==='save')return`حفظ: ${escapeHtml(e.title)}`;if(e.type==='upload')return`إضافة فيلم: ${escapeHtml(e.title)}`;if(e.type==='delete')return`حذف فيلم: ${escapeHtml(e.title)}`;if(e.type==='user_register')return`حساب جديد: ${escapeHtml(e.username)}`;if(e.type==='payment_submitted')return`طلب دفع: ${escapeHtml(e.title)} (${escapeHtml(e.username)})`;if(e.type==='payment_approved')return`دفع مؤكد: ${escapeHtml(e.title)} (${escapeHtml(e.username)})`;if(e.type==='payment_rejected')return`دفع مرفوض: ${escapeHtml(e.title)} (${escapeHtml(e.username)})`;if(e.type==='download')return`تحميل: ${escapeHtml(e.title)}`;if(e.type==='short_upload')return`مقطع جديد من: ${escapeHtml(e.username||'')}`;if(e.type==='short_delete')return`حذف مقطع`;return`دخول إداري: ${escapeHtml(e.username||'حساب الإدارة')}`}
async function renderSystem(h){
 $('#system-grid').innerHTML=[
  ['حالة الخادم',h.status==='ok'?'يعمل':'متوقف'],['إصدار Node.js',h.node],['مدة التشغيل',duration(h.uptime)],
  ['عدد الأفلام',fmt(h.movies)],['حجم الملفات',bytes(h.storageBytes)],['ذاكرة العملية',bytes(h.memory)]
 ].map(x=>`<div class="system-card"><span>${x[0]}</span><strong>${escapeHtml(x[1])}</strong></div>`).join('')
}
async function deleteMovie(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 const result=await Swal.fire({title:'حذف الفيلم؟',text:`سيُحذف "${m.title}" وملفاته من الخادم.`,icon:'warning',showCancelButton:true,confirmButtonText:'حذف',cancelButtonText:'إلغاء',confirmButtonColor:'#d94b5b'});
 if(!result.isConfirmed)return;
 try{await api(`/api/movies/${encodeURIComponent(id)}`,{method:'DELETE'});toast('تم حذف الفيلم');await load()}catch(e){toast(e.message,'error')}
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

document.addEventListener('DOMContentLoaded',()=>{
 icons();load();
 document.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>showSection(b.dataset.section));
 $('#menu-open').onclick=()=>{$('#admin-sidebar').classList.add('open');$('#admin-backdrop').classList.add('open')}
 $('#side-close').onclick=closeSide;$('#admin-backdrop').onclick=closeSide;$('#refresh').onclick=load;
 $('#movie-search').oninput=e=>renderMovies(e.target.value);
 $('#logout').onclick=async()=>{try{await fetch('/api/auth/logout',{method:'POST'})}finally{location.href='/admin-login.html'}};
 $('#movie-form').onsubmit=submitMovie;
 $('#isPaid').onchange=e=>{$('#paid-fields').classList.toggle('hidden',!e.target.checked);$('#price').required=e.target.checked;$('#shamcashAccount').required=e.target.checked};
});
function closeSide(){$('#admin-sidebar').classList.remove('open');$('#admin-backdrop').classList.remove('open')}
function showSection(name){
 document.querySelectorAll('.admin-section').forEach(s=>s.classList.add('hidden'));$(`#section-${name}`).classList.remove('hidden');
 document.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===name));
 const subtitles={content:'إدارة المحتوى',payments:'مراجعة الإيصالات',overview:'نظرة عامة على المنصة',add:'إضافة فيلم جديد',movies:'إدارة المكتبة',analytics:'تحليلات النشاط',system:'معلومات التشغيل'};
 $('#admin-subtitle').textContent=subtitles[name]||'';closeSide();
 if(name==='content')loadContent();if(name==='movies')renderMovies();if(name==='payments')loadPayments();if(name==='analytics'&&analytics)renderAnalytics()
}
async function submitMovie(e){
 e.preventDefault();const b=$('#submit-btn');b.disabled=true;b.innerHTML='<i data-lucide="loader-circle"></i> جارٍ الرفع...';icons();
 try{const fdm=new FormData(e.target);const subF=fdm.get('subtitleFile'),subL=fdm.get('subtitleLang');fdm.delete('subtitleFile');fdm.delete('subtitleLang');const d=await api('/api/movies',{method:'POST',body:fdm});if(subF&&subF.size){const sf=new FormData();sf.append('subtitle',subF);sf.append('lang',subL||'und');try{await api(`/api/admin/movies/${encodeURIComponent(d.id)}/subtitles`,{method:'POST',body:sf})}catch(se){toast('تم نشر الفيلم لكن ملف الترجمة مرفوض: '+se.message,'error')}}e.target.reset();toast(`تم نشر ${d.title}`);showSection('movies');await load()}catch(err){toast(err.message,'error')}finally{b.disabled=false;b.innerHTML='<i data-lucide="upload-cloud"></i> نشر الفيلم';icons()}
}

async function loadPayments(){
 try{payments=await api('/api/admin/payments')}catch(e){return}
 const pending=payments.filter(p=>p.status==='pending').length;$('#payments-pending').textContent=fmt(pending);
 const label={pending:'قيد المراجعة',approved:'مؤكد',rejected:'مرفوض'};
 const sorted=[...payments].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1));
 $('#payments-list').innerHTML=sorted.length?sorted.map(p=>`<article class="admin-movie pay-row"><div><h3>${escapeHtml(p.movieTitle)} — ${escapeHtml(p.username)}</h3><p dir="ltr" style="text-align:right">إيصال: <b>${escapeHtml(p.receipt)}</b></p><div class="movie-meta"><span>${fmt(p.amount)} ${p.currency==='USD'?'$':'ل.س'}</span><span>${new Date(p.createdAt).toLocaleString('ar')}</span><span class="pay-${p.status}">${label[p.status]||p.status}</span></div></div>${p.status==='pending'?`<div class="pay-actions"><button class="primary-admin" data-approve="${escapeHtml(p.id)}">قبول</button><button class="danger-btn" data-reject="${escapeHtml(p.id)}">رفض</button></div>`:''}</article>`).join(''):'<div class="empty-inline">لا توجد طلبات دفع.</div>';
 document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>decidePay(b.dataset.approve,'approve'));
 document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>decidePay(b.dataset.reject,'reject'));
}
async function decidePay(id,action){
 const p=payments.find(x=>x.id===id);if(!p)return;
 const r=await Swal.fire({title:action==='approve'?'قبول الدفع؟':'رفض الدفع؟',text:`إيصال ${p.receipt} — ${p.username}`,icon:action==='approve'?'question':'warning',showCancelButton:true,confirmButtonText:action==='approve'?'قبول':'رفض',cancelButtonText:'إلغاء'});
 if(!r.isConfirmed)return;
 try{await api(`/api/admin/payments/${encodeURIComponent(id)}/${action}`,{method:'POST'});toast('تم التنفيذ');await loadPayments()}catch(e){toast(e.message,'error')}
}


/* ===== ملفات الترجمة لكل فيلم ===== */
async function manageSubs(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 const subs=m.subtitles||[];
 const langs={ar:'العربية',en:'English',ru:'Русский',tr:'Türkçe',fr:'Français',de:'Deutsch',es:'Español',und:'غير محددة'};
 const list=subs.length?subs.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0"><span>${escapeHtml(s.label)} (${escapeHtml(s.lang)})</span><button class="danger-btn" data-delsub="${escapeHtml(s.id)}" type="button">حذف</button></div>`).join(''):'<p>لا توجد ملفات ترجمة.</p>';
 const r=await Swal.fire({title:`ترجمة: ${m.title}`,html:`<div id="subs-box">${list}</div><hr><select id="sub-lang" class="swal2-select">${Object.entries(langs).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>`,showCancelButton:true,confirmButtonText:'رفع ملف SRT/VTT',cancelButtonText:'إغلاق',didOpen:()=>{document.querySelectorAll('[data-delsub]').forEach(b=>b.onclick=async()=>{try{await api(`/api/admin/movies/${encodeURIComponent(id)}/subtitles/${encodeURIComponent(b.dataset.delsub)}`,{method:'DELETE'});Swal.close();toast('تم حذف الترجمة');await load()}catch(e){toast(e.message,'error')}})},preConfirm:()=>document.getElementById('sub-lang').value});
 if(!r.isConfirmed)return;
 const lang=r.value,inp=$('#sub-file-input');
 inp.onchange=async()=>{const f=inp.files[0];inp.value='';if(!f)return;const fd=new FormData();fd.append('subtitle',f);fd.append('lang',lang);
  try{await api(`/api/admin/movies/${encodeURIComponent(id)}/subtitles`,{method:'POST',body:fd});toast('تم رفع الترجمة');await load()}catch(e){toast(e.message,'error')}};
 inp.click();
}

/* ===== Shorts والتعليقات ===== */
async function loadContent(){
 try{
  const [sh,cm]=await Promise.all([api('/api/admin/shorts'),api('/api/admin/comments')]);
  $('#content-total').textContent=fmt(sh.length+cm.length);
  $('#shorts-admin-list').innerHTML=sh.length?sh.map(s=>`<article class="admin-movie"><img src="${escapeHtml(s.posterUrl||'')}" alt=""><div><h3>${escapeHtml(s.caption||'بدون وصف')}</h3><p>بواسطة: ${escapeHtml(s.username)}</p><div class="movie-meta"><span>${fmt(s.views)} مشاهدة</span><span>${fmt(s.likes)} إعجاب</span><span>${fmt(s.comments)} تعليق</span><span>${bytes(s.size)}</span></div></div><button class="danger-btn" data-del-short="${escapeHtml(s.id)}"><i data-lucide="trash-2"></i> حذف</button></article>`).join(''):'<div class="empty-inline">لا توجد مقاطع.</div>';
  $('#comments-admin-list').innerHTML=cm.length?cm.map(c=>`<article class="admin-movie"><div><h3>${escapeHtml(c.user)} — ${c.type==='movie'?'فيلم':'Short'}: ${escapeHtml(c.target)}</h3><p>${escapeHtml(c.text)}</p><div class="movie-meta"><span>${new Date(c.createdAt).toLocaleString('ar')}</span></div></div><button class="danger-btn" data-del-comment="${escapeHtml(c.id)}"><i data-lucide="trash-2"></i> حذف</button></article>`).join(''):'<div class="empty-inline">لا توجد تعليقات.</div>';
  document.querySelectorAll('[data-del-short]').forEach(b=>b.onclick=async()=>{const r=await Swal.fire({title:'حذف المقطع؟',icon:'warning',showCancelButton:true,confirmButtonText:'حذف',cancelButtonText:'إلغاء',confirmButtonColor:'#d94b5b'});if(!r.isConfirmed)return;try{await api(`/api/admin/shorts/${encodeURIComponent(b.dataset.delShort)}`,{method:'DELETE'});toast('تم الحذف');loadContent()}catch(e){toast(e.message,'error')}});
  document.querySelectorAll('[data-del-comment]').forEach(b=>b.onclick=async()=>{try{await api(`/api/admin/comments/${encodeURIComponent(b.dataset.delComment)}`,{method:'DELETE'});toast('تم الحذف');loadContent()}catch(e){toast(e.message,'error')}});
  icons();
 }catch(e){toast(e.message,'error')}
}
