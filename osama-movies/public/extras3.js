/* ===================================================================
   extras3.js — الإصدار 12: مشاهدة لاحقاً • متابعة مسلسل • مجموعات الكتالوج • شارات وتحدٍ و«سنتك»
   اختر لي فيلماً بالمزاج • وضع المسرح • إشعارات الحلقات الجديدة
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Lang':I18N.lang()},body:body===undefined?undefined:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null,closeModal=()=>window.Extras&&Extras.closeModal();
const byId=id=>moviesData.find(m=>m.id===id);

/* =====================================================
   1) مشاهدة لاحقاً
   ===================================================== */
let wl=new Set();
function paintWL(){
  $$('.yt-later').forEach(b=>{const on=wl.has(b.dataset.id);b.classList.toggle('on',on);b.setAttribute('aria-label',t(on?'later.remove':'later.add'))});
  const b=$('#act-later');if(b){const on=currentMovie&&wl.has(currentMovie.id);b.classList.toggle('on',!!on);const s=b.querySelector('span');if(s)s.textContent=t(on?'later.added':'later.add')}
  const n=$('#nav-later em');if(n)n.textContent=wl.size?String(wl.size):'';
}
async function loadWL(){if(!me){wl=new Set();paintWL();return}try{wl=new Set((await api('/api/user/watch-later')).items)}catch{}paintWL()}
async function toggleWL(id){
  if(!me){openAuth('login');return}
  const on=!wl.has(id);
  try{const d=await api(`/api/user/watch-later/${encodeURIComponent(id)}`,'POST',{on});if(on)wl.add(id);else wl.delete(id);paintWL();toast(t(on?'later.addedMsg':'later.removedMsg'),'success');if(!$('#later-view').classList.contains('hidden'))renderLater()}
  catch(e){toast(e.message,'error')}
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.yt-later');if(!b)return;e.preventDefault();e.stopPropagation();toggleWL(b.dataset.id)},true);
const _open=window.openPlayer;
window.openPlayer=function(m){
  const r=_open.apply(this,arguments);
  const box=$('#movie-actions');
  if(box&&!$('#act-later')){box.insertAdjacentHTML('beforeend',`<button class="act-btn lg" id="act-later" type="button"><i data-lucide="clock"></i><span>${esc(t('later.add'))}</span></button>`);$('#act-later').onclick=()=>currentMovie&&toggleWL(currentMovie.id);icons()}
  paintWL();paintTheaterBtn();return r;
};
document.addEventListener('auth:changed',loadWL);
document.addEventListener('langchange',paintWL);

/* ---- تبويبات جديدة: لاحقاً + مجموعات ---- */
function injectViews(){
  const content=$('main.content');if(!content||$('#later-view'))return;
  content.insertAdjacentHTML('beforeend','<section class="view hidden" id="later-view"></section><section class="view hidden" id="collections-view"></section>');
  const nav=$('.side-nav');
  nav.insertAdjacentHTML('beforeend',`<button data-tab="later" id="nav-later" type="button"><i data-lucide="clock"></i><span>${esc(t('later.nav'))}</span><em class="nav-count"></em></button><button data-tab="collections" id="nav-collections" type="button"><i data-lucide="layers"></i><span>${esc(t('col.nav'))}</span></button>`);
  nav.querySelectorAll('[data-tab="later"],[data-tab="collections"]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));icons();
}
const _switchTab=window.switchTab;
window.switchTab=function(tab){
  if(tab==='later'&&!me){openAuth('login');return}
  const r=_switchTab.apply(this,arguments);
  if(tab==='later')renderLater();if(tab==='collections')renderCollections();
  return r;
};
async function renderLater(){
  const v=$('#later-view');await loadWL();
  const list=[...wl].map(byId).filter(Boolean);
  v.innerHTML=`<div class="section-head"><div><h2>${esc(t('later.title'))}</h2><p>${esc(t('later.sub'))}</p></div>${list.length?`<button class="ghost-btn danger-ghost" id="later-clear" type="button"><i data-lucide="trash-2"></i><span>${esc(t('history.clear'))}</span></button>`:''}</div>
    ${list.length?`<div class="movie-grid" id="later-grid">${list.map(card).join('')}</div>`:`<div class="empty glass"><i data-lucide="clock"></i><h3>${esc(t('later.empty'))}</h3><p>${esc(t('later.emptyD'))}</p></div>`}`;
  bindCards(v);const c=$('#later-clear');if(c)c.onclick=async()=>{try{await api('/api/user/watch-later','DELETE');wl=new Set();renderLater();paintWL()}catch(e){toast(e.message,'error')}};
  paintWL();icons();
}
function bindCards(root){root.querySelectorAll('[data-movie]').forEach(c=>c.onclick=()=>{const m=byId(c.dataset.movie);if(m)openPlayer(m)})}

/* =====================================================
   2) متابعة مسلسل (زر داخل بطاقة الحلقات)
   ===================================================== */
let sf=new Set();
async function loadSF(){if(!me){sf=new Set();return}try{sf=new Set((await api('/api/user/series-follow')).items.map(x=>x.key))}catch{}}
function paintSF(){
  const box=$('#dx-series .ser-head');if(!box||!currentMovie||!currentMovie.series)return;
  let b=$('#ser-follow');if(!b){b=document.createElement('button');b.id='ser-follow';b.type='button';b.className='ghost-btn';box.appendChild(b);
    b.onclick=async()=>{if(!me){openAuth('login');return}const k=currentMovie.series.trim().toLowerCase(),on=!sf.has(k);
      try{await api('/api/series/follow','POST',{series:currentMovie.series,on});if(on)sf.add(k);else sf.delete(k);paintSF();toast(t(on?'ser.followedMsg':'ser.unfollowedMsg'),'success')}catch(e){toast(e.message,'error')}}}
  const on=sf.has(currentMovie.series.trim().toLowerCase());b.classList.toggle('on',on);b.innerHTML=`<i data-lucide="${on?'bell-ring':'bell'}"></i><span>${esc(t(on?'ser.following':'ser.follow'))}</span>`;icons();
}
new MutationObserver(()=>{if($('#dx-series .ser-head')&&!$('#ser-follow'))paintSF()}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('auth:changed',()=>loadSF().then(paintSF));

/* =====================================================
   3) مجموعات تلقائية من الكتالوج
   ===================================================== */
const KIND_ICON={director:'clapperboard',cast:'users',series:'tv',year:'calendar',country:'globe',tag:'hash'};
async function renderCollections(name){
  const v=$('#collections-view');v.innerHTML=`<div class="cm-empty">${esc(t('common.loading'))}</div>`;
  let d;try{d=await api('/api/collections')}catch(e){v.innerHTML=`<div class="empty glass"><h3>${esc(e.message)}</h3></div>`;return}
  const kinds=[...new Set(d.items.map(x=>x.kind))];let cur=window.__colKind||'all';
  const draw=()=>{
    const items=d.items.filter(x=>cur==='all'||x.kind===cur);
    v.innerHTML=`<div class="section-head"><div><h2>${esc(t('col.title'))}</h2><p>${esc(t('col.sub'))}</p></div></div>
      <div class="col-tabs"><button type="button" data-k="all" class="${cur==='all'?'on':''}">${esc(t('col.all'))}</button>${kinds.map(k=>`<button type="button" data-k="${k}" class="${cur===k?'on':''}">${esc(t('col.k_'+k))}</button>`).join('')}</div>
      ${items.length?`<div class="col-grid">${items.map(x=>`<button type="button" class="col-card glass" data-kind="${esc(x.kind)}" data-name="${esc(x.name)}"><span class="col-img" style="background-image:url('${esc(x.posterUrl)}')"></span><span class="col-body"><i data-lucide="${KIND_ICON[x.kind]||'layers'}"></i><b>${esc(x.name)}</b><small>${esc(t('col.k_'+x.kind))} · ${esc(t('col.count',{n:x.count}))}</small></span></button>`).join('')}</div>`:`<div class="empty glass"><i data-lucide="layers"></i><h3>${esc(t('col.empty'))}</h3><p>${esc(t('col.emptyD'))}</p></div>`}`;
    v.querySelectorAll('.col-tabs [data-k]').forEach(b=>b.onclick=()=>{cur=window.__colKind=b.dataset.k;draw()});
    v.querySelectorAll('.col-card').forEach(b=>b.onclick=()=>openCollection(b.dataset.kind,b.dataset.name));icons();
  };
  draw();
}
async function openCollection(kind,name){
  const v=$('#collections-view');let d;try{d=await api(`/api/collections/${encodeURIComponent(kind)}/${encodeURIComponent(name)}`)}catch(e){toast(e.message,'error');return}
  const list=d.ids.map(byId).filter(Boolean);
  v.innerHTML=`<button class="back-btn" id="col-back" type="button"><i data-lucide="arrow-right" class="flip-rtl"></i><span>${esc(t('common.back'))}</span></button><div class="section-head"><div><h2>${esc(name)}</h2><p>${esc(t('col.k_'+kind))} · ${esc(t('col.count',{n:list.length}))}</p></div></div><div class="movie-grid">${list.map(card).join('')}</div>`;
  bindCards(v);$('#col-back').onclick=()=>renderCollections();icons();
}
// الضغط على المخرج/الممثل/المسلسل في صفحة الفيلم يفتح مجموعته (روابط extras2 تستخدم data-flt)
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-col-kind]');if(!a)return;e.preventDefault();switchTab('collections');openCollection(a.dataset.colKind,a.dataset.colName)});

/* =====================================================
   4) الملف الشخصي: تحدٍ أسبوعي + شارات + «سنتك في الأفلام»
   ===================================================== */
async function paintProfile3(){
  const grid=$('#profile-view .profile-grid');if(!grid||!me)return;
  let card=$('#pf-extra3');if(!card){card=document.createElement('div');card.id='pf-extra3';card.className='glass profile-card';grid.appendChild(card)}
  const [ch,bd]=await Promise.all([api('/api/user/challenge').catch(()=>null),api('/api/user/badges').catch(()=>({items:[]}))]);
  const left=ch?Math.max(0,Math.ceil((Date.parse(ch.endsAt)-Date.now())/86400e3)):0;
  card.innerHTML=`${ch?`<h3 class="card-h"><i data-lucide="target"></i><span>${esc(t('chal.title'))}</span></h3>
    <p class="muted-p">${esc(t('chal.desc',{n:ch.target}))}</p>
    <div class="chal-bar"><i style="width:${Math.round(ch.progress/ch.target*100)}%"></i></div>
    <div class="pf-row"><span>${esc(ch.done?t('chal.done'):t('chal.progress',{a:ch.progress,b:ch.target}))}</span><small class="muted-p">${esc(t('chal.left',{n:left}))} · ${esc(t('chal.completed',{n:ch.completed}))}</small></div>`:''}
    <h3 class="card-h"><i data-lucide="award"></i><span>${esc(t('badge.title'))}</span></h3>
    <div class="badges">${bd.items.map(b=>`<div class="badge${b.earned?' on':''}" title="${esc(t('badge.d_'+b.id))}"><span class="b-ico">${b.icon}</span><b>${esc(t('badge.n_'+b.id))}</b><small>${b.earned?esc(t('badge.earned')):`${b.progress}/${b.target}`}</small></div>`).join('')}</div>
    <button class="primary-btn" id="wrapped-btn" type="button"><i data-lucide="sparkles"></i><span>${esc(t('wrap.btn'))}</span></button>`;
  const w=$('#wrapped-btn');if(w)w.onclick=openWrapped;icons();
}
document.addEventListener('tabchange',e=>{if(e.detail==='profile')paintProfile3()});
async function openWrapped(){
  let d;try{d=await api('/api/user/wrapped')}catch(e){toast(e.message,'error');return}
  const mx=Math.max(1,...d.months),mn=I18N.lang();
  const mname=i=>{try{return new Date(Date.UTC(2000,i,1)).toLocaleDateString(mn,{month:'short',timeZone:'UTC'})}catch{return i+1}};
  const top=(arr)=>arr.length?arr.map(x=>`<li><b>${esc(x.name)}</b> <small>×${x.n}</small></li>`).join(''):`<li class="muted-p">—</li>`;
  const hrs=Math.floor(d.minutes/60),mins=d.minutes%60;
  modal(`<h3 class="wr-h"><i data-lucide="sparkles"></i> ${esc(t('wrap.title',{year:d.year}))}</h3>
    <div class="wr-kpis"><div><strong>${fmt(d.started)}</strong><span>${esc(t('wrap.started'))}</span></div><div><strong>${fmt(d.finished)}</strong><span>${esc(t('wrap.finished'))}</span></div><div><strong>${hrs?hrs+t('wrap.h')+' ':''}${mins}${t('wrap.m')}</strong><span>${esc(t('wrap.time'))}</span></div><div><strong>${d.ratings?d.avgRating+' ★':'—'}</strong><span>${esc(t('wrap.rated',{n:d.ratings}))}</span></div></div>
    <div class="wr-cols"><div><h4>${esc(t('wrap.cats'))}</h4><ol>${top(d.topCategories)}</ol></div><div><h4>${esc(t('wrap.dirs'))}</h4><ol>${top(d.topDirectors)}</ol></div><div><h4>${esc(t('wrap.cast'))}</h4><ol>${top(d.topCast)}</ol></div></div>
    ${d.busiestMonth!==null?`<p class="muted-p">${esc(t('wrap.busiest',{m:mname(d.busiestMonth)}))}</p>`:`<p class="muted-p">${esc(t('wrap.none'))}</p>`}
    <div class="wr-chart" dir="ltr">${d.months.map((x,i)=>`<span title="${esc(mname(i))}: ${x}${t('wrap.m')}"><i style="height:${Math.max(3,Math.round(x/mx*70))}px"></i><small>${esc(mname(i))}</small></span>`).join('')}</div>
    <p class="muted-p">${esc(t('wrap.chal',{n:d.challenges}))}</p>`,{cls:'wr-card'});
}

/* =====================================================
   5) اختر لي فيلماً بالمزاج
   ===================================================== */
const MOODS=['any','funny','sad','thrilling','romantic','family','scifi'],MOOD_ICON={any:'dices',funny:'laugh',sad:'cloud-rain',thrilling:'zap',romantic:'heart',family:'users',scifi:'rocket'};
function injectPick(){
  if($('#pick-fab'))return;
  document.body.insertAdjacentHTML('beforeend',`<button class="pick-fab lg" id="pick-fab" type="button" aria-label="${esc(t('pick.btn'))}" title="${esc(t('pick.btn'))}"><i data-lucide="dices"></i></button>`);
  $('#pick-fab').onclick=openPick;icons();
}
function paintFab(){const f=$('#pick-fab');if(!f)return;const home=!$('#home-view').classList.contains('hidden');f.classList.toggle('hidden',!home)}
document.addEventListener('tabchange',paintFab);
function openPick(){
  let mood='any',len='any',last='';
  const el=modal(`<h3><i data-lucide="dices"></i> ${esc(t('pick.title'))}</h3><p class="muted-p">${esc(t('pick.desc'))}</p>
    <div class="mood-grid">${MOODS.map(m=>`<button type="button" data-m="${m}" class="${m===mood?'on':''}"><i data-lucide="${MOOD_ICON[m]}"></i><span>${esc(t('pick.m_'+m))}</span></button>`).join('')}</div>
    <div class="seg" id="pk-len">${['any','short','long'].map(x=>`<button type="button" data-l="${x}" class="${x===len?'on':''}">${esc(t('pick.l_'+x))}</button>`).join('')}</div>
    <button class="primary-btn" id="pk-go" type="button"><i data-lucide="sparkles"></i><span>${esc(t('pick.go'))}</span></button><div id="pk-res"></div>`);
  const sel=(q,attr,set)=>el.querySelectorAll(q).forEach(b=>b.onclick=()=>{el.querySelectorAll(q).forEach(x=>x.classList.remove('on'));b.classList.add('on');set(b.dataset[attr])});
  sel('.mood-grid [data-m]','m',v=>mood=v);sel('#pk-len [data-l]','l',v=>len=v);
  const go=async()=>{
    const out=el.querySelector('#pk-res');out.innerHTML=`<div class="cm-empty">${esc(t('common.loading'))}</div>`;
    let d;try{d=await api(`/api/pick?mood=${mood}&len=${len}&not=${encodeURIComponent(last)}`)}catch(e){out.innerHTML=`<div class="cm-empty">${esc(e.message)}</div>`;return}
    const m=d.id&&byId(d.id);if(!m){out.innerHTML=`<div class="cm-empty">${esc(t('pick.none'))}</div>`;return}
    last=m.id;
    out.innerHTML=`${d.fallback?`<p class="muted-p">${esc(t('pick.fallback'))}</p>`:''}<div class="pk-card"><img src="${esc(m.posterUrl)}" alt=""><div><h4>${esc(m.title)}</h4><small>${esc(catLabel(m.category))}${m.year?' · '+m.year:''}${m.duration?' · '+Math.round(m.duration/60)+' '+esc(t('wrap.m')):''}${m.rating&&m.rating.count?' · ★ '+m.rating.avg:''}</small><p>${esc((m.description||'').slice(0,120))}</p><div class="pk-btns"><button class="primary-btn" id="pk-play" type="button"><i data-lucide="play"></i><span>${esc(t('common.play'))}</span></button><button class="ghost-btn" id="pk-again" type="button"><i data-lucide="refresh-cw"></i><span>${esc(t('pick.again'))}</span></button></div></div></div>`;
    icons();out.querySelector('#pk-play').onclick=()=>{closeModal();openPlayer(m,'home')};out.querySelector('#pk-again').onclick=go;
  };
  el.querySelector('#pk-go').onclick=go;
}

/* =====================================================
   6) وضع المسرح
   ===================================================== */
function paintTheaterBtn(){
  if(!$('#pl-theater')){const fs=$('#pl-fs');if(fs){fs.insertAdjacentHTML('beforebegin',`<button class="pl-btn pl-hide-sm" id="pl-theater" type="button" aria-label="${esc(t('theater.btn'))}" title="${esc(t('theater.btn'))}"><i data-lucide="rectangle-horizontal"></i></button>`);
    $('#pl-theater').onclick=()=>{LS.set('osama_theater',LS.get('osama_theater','0')==='1'?'0':'1');paintTheater()};icons()}}
  paintTheater();
}
function paintTheater(){const on=LS.get('osama_theater','0')==='1';document.body.classList.toggle('theater',on&&!$('#player-view').classList.contains('hidden'));const b=$('#pl-theater');if(b)b.classList.toggle('on',on)}
document.addEventListener('tabchange',paintTheater);
document.addEventListener('keydown',e=>{if(e.key==='t'&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||'')&&!$('#player-view').classList.contains('hidden')&&!e.ctrlKey&&!e.metaKey){LS.set('osama_theater',LS.get('osama_theater','0')==='1'?'0':'1');paintTheater()}});

/* =====================================================
   تهيئة
   ===================================================== */
function init(){injectViews();injectPick();paintFab();loadWL();loadSF()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
