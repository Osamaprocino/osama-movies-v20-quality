/* ===================================================================
   extras.js — إضافات الإصدار 10 فوق الواجهة الحالية (لا يعدّل منطقها، يغلّفها فقط):
   متابعة المشاهدة • مكتبة وقوائم تشغيل مرتبطة بالحساب • الإشعارات • القنوات والمتابعة
   Shorts (تبويبات/وسوم/بحث) • بلاغات • اشتراكات وكوبونات • نسيت كلمة المرور / تأكيد البريد
   المشغّل: جودات، معاينة التمرير، تخطي المقدمة، التالي تلقائياً، Cast/AirPlay، تنسيق الترجمة • PWA
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
const LS={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},
  set(k,v){try{localStorage.setItem(k,v)}catch{}},
  json(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
  setJson(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
};
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),keepalive:method==='PUT'||method==='POST'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const fmtDur=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};
const pad=n=>String(n).padStart(2,'0');
const dateStr=iso=>{try{return new Date(iso).toLocaleDateString(I18N.numLocale(),{year:'numeric',month:'short',day:'numeric'})}catch{return ''}};
const money=(n,cur)=>`${fmt(n)} ${cur==='USD'?'$':t('cur.syp')}`;
const delay=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- نافذة عامة ---------- */
function modal(html,{cls=''}={}){
  closeModal();
  const el=document.createElement('div');el.className='modal ex-modal';el.id='ex-modal';
  el.innerHTML=`<div class="modal-card glass ${cls}"><button class="icon-btn modal-close" type="button" data-x aria-label="${esc(t('common.close'))}"><i data-lucide="x"></i></button>${html}</div>`;
  el.addEventListener('click',e=>{if(e.target===el||e.target.closest('[data-x]'))closeModal()});
  document.body.appendChild(el);icons();return el;
}
function closeModal(){const m=$('#ex-modal');if(m)m.remove()}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

/* =====================================================
   1) تغليف دوال الواجهة الحالية
   ===================================================== */
let resumeFor=null,srcNext=null;
const prog={local:LS.json('osama_progress',{}),server:{}};
function progOf(id){
  const l=prog.local[id],s=prog.server[id];
  if(me&&s&&(!l||s.t>=l.t||!l.u))return s;
  return l||s||null;
}
function saveLocalProg(id,t_,d){prog.local[id]={t:Math.round(t_),d:Math.round(d),u:Date.now()};
  const keys=Object.keys(prog.local);if(keys.length>60){keys.sort((a,b)=>prog.local[a].u-prog.local[b].u).slice(0,keys.length-60).forEach(k=>delete prog.local[k])}
  LS.setJson('osama_progress',prog.local)}

const _openPlayer=window.openPlayer;
window.openPlayer=function(movie,source){
  if(!movie)return;
  hideSoon();hideNext();
  trk.reset(movie,source||srcNext||'direct');srcNext=null;resumeFor=movie.id;quality.reset(movie);
  const r=_openPlayer.apply(this,arguments);
  if(me)api(`/api/user/library/history/${encodeURIComponent(movie.id)}`,'POST',{}).catch(()=>{});
  paintExtraActions();
  return r;
};
const _startPlayback=window.startPlayback;
window.startPlayback=function(movie){
  if(movie&&movie.comingSoon){showSoon(movie);return}
  hideSoon();return _startPlayback.apply(this,arguments);
};
const _card=window.card;
window.card=function(m){
  let h=_card(m);
  let extra='';
  if(m.comingSoon)extra+=`<span class="soon-chip"><i data-lucide="clock"></i>${esc(t('soon.chip'))}</span>`;
  const p=progOf(m.id);
  if(p&&p.t>5&&p.d&&p.t/p.d<0.95)extra+=`<i class="prog-bar"><b style="width:${Math.round(p.t/p.d*100)}%"></b></i>`;
  return extra?h.replace('</div><h4>',extra+'</div><h4>'):h;
};
const _switchTab=window.switchTab;
window.switchTab=function(tab){
  if((tab==='notifs'||tab==='library')&&!me){openAuth('login');return}
  return _switchTab.apply(this,arguments);
};
const _toggleSave=window.toggleSave;
window.toggleSave=function(movie=currentMovie){
  if(!movie)return;
  const was=savedMovies.some(x=>x.id===movie.id);
  const r=_toggleSave.call(this,movie);
  if(me)api(`/api/user/library/saved/${encodeURIComponent(movie.id)}`,'POST',{on:!was}).catch(()=>{});
  return r;
};
const _updateMiniStats=window.updateMiniStats;
window.updateMiniStats=function(){const r=_updateMiniStats.apply(this,arguments);try{renderContinue()}catch{}return r};
const _handleDeepLink=window.handleDeepLink;
window.handleDeepLink=function(){
  const p=new URLSearchParams(location.search);
  if(p.get('channel')){openChannel(p.get('channel'));return}
  if(p.get('movie'))srcNext='share';
  if(p.get('tab')==='shorts'&&!p.get('short')){switchTab('shorts');return}
  return _handleDeepLink.apply(this,arguments);
};
// كوبون الشراء: يُضاف إلى طلب التحقق من الدفع دون تعديل الدالة الأصلية
const _fetch=window.fetch.bind(window);
window.fetch=function(input,init){
  try{
    const url=typeof input==='string'?input:input.url;
    if(init&&init.method==='POST'&&/^\/api\/movies\/[^/]+\/verify-payment$/.test(url)){
      const c=($('#pw-coupon')||{}).value;
      if(c&&c.trim()){const b=JSON.parse(init.body||'{}');b.coupon=c.trim();init={...init,body:JSON.stringify(b)}}
    }
  }catch{}
  return _fetch(input,init);
};
// مصدر المشاهدة للتحليلات
document.addEventListener('click',e=>{
  const c=e.target.closest&&e.target.closest('.movie-card');if(!c)return;
  const g=c.parentElement&&c.parentElement.id;
  srcNext=g==='related-grid'?'related':g==='movie-grid'?(($('#search-input')||{}).value?'search':'home'):'home';
},true);

/* =====================================================
   2) متابعة المشاهدة + تتبّع زمن المشاهدة
   ===================================================== */
const trk={m:null,src:'direct',acc:0,last:null,started:false,replay:false,lastSaved:0,lastFlush:0,
  reset(m,src){this.flush(true);this.m=m;this.src=src;this.acc=0;this.last=null;this.started=false;this.replay=false;this.lastSaved=0;this.lastFlush=Date.now()},
  tick(v){
    if(!this.m||v.paused)return;
    const t_=v.currentTime;
    if(this.last!==null){const d=t_-this.last;if(d>0&&d<2.5)this.acc+=d}
    this.last=t_;
    if(Math.abs(t_-this.lastSaved)>=10){this.lastSaved=t_;this.save(v)}
    if(Date.now()-this.lastFlush>=15000)this.flush();
  },
  save(v){
    if(!this.m||!isFinite(v.duration)||!v.duration)return;
    saveLocalProg(this.m.id,v.currentTime,v.duration);
    if(me)api(`/api/user/progress/${encodeURIComponent(this.m.id)}`,'PUT',{t:v.currentTime,d:v.duration}).catch(()=>{});
  },
  flush(final){
    this.lastFlush=Date.now();
    if(!this.m)return;
    const secs=Math.round(this.acc);
    if(secs<1&&this.started)return;
    if(secs<1&&!final)return;
    if(secs<1)return;
    this.acc=0;
    const body={kind:'movie',id:this.m.id,seconds:secs,source:this.src,start:!this.started,replay:this.replay};
    this.started=true;this.replay=false;
    fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});
  }
};
function initProgress(){
  const v=$('#video');
  v.addEventListener('timeupdate',()=>trk.tick(v));
  v.addEventListener('pause',()=>{trk.save(v);trk.flush()});
  v.addEventListener('seeking',()=>{trk.last=null});
  v.addEventListener('play',()=>{trk.last=null;if(v.dataset.ended){trk.replay=true;delete v.dataset.ended}});
  v.addEventListener('ended',()=>{
    v.dataset.ended='1';
    if(trk.m&&isFinite(v.duration)){saveLocalProg(trk.m.id,v.duration,v.duration);if(me)api(`/api/user/progress/${encodeURIComponent(trk.m.id)}`,'PUT',{t:v.duration,d:v.duration}).catch(()=>{})}
    trk.flush();showNext();
  });
  v.addEventListener('loadedmetadata',()=>{
    if(quality.pendingSeek!=null){const p=quality.pendingSeek;quality.pendingSeek=null;try{v.currentTime=Math.min(p,(v.duration||p)-0.5)}catch{}if(quality.wasPlaying)v.play().catch(()=>{});return}
    if(!currentMovie||resumeFor!==currentMovie.id)return;
    resumeFor=null;
    const p=progOf(currentMovie.id);
    if(p&&p.t>5&&v.duration&&p.t/v.duration<0.95){v.currentTime=p.t;toast(t('cont.resumed',{time:fmtDur(p.t)}),'info')}
    quality.applyPreferred();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){trk.save(v);trk.flush()}});
  window.addEventListener('pagehide',()=>{trk.save(v);trk.flush(true)});
  document.addEventListener('tabchange',e=>{if(e.detail!=='player'){trk.save(v);trk.flush(true)}});
  // Shorts: نبضة كل 10 ثوانٍ للمقطع الذي يُشغَّل فعلاً
  const seen=new Set();
  setInterval(()=>{
    const sv=$('#shorts-view');if(!sv||sv.classList.contains('hidden')||document.hidden)return;
    const vid=$$('#shorts-feed .short video').find(x=>!x.paused&&x.currentTime>0);if(!vid)return;
    const id=vid.closest('.short').dataset.id;
    fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'short',id,seconds:10,source:'shorts',start:!seen.has(id)})}).catch(()=>{});
    seen.add(id);
  },10000);
}
async function loadServerProgress(){
  if(!me){prog.server={};return}
  try{const d=await api('/api/user/progress');prog.server=d.map||{}}catch{}
  try{renderContinue()}catch{}
}
function continueList(){
  const ids=new Set([...Object.keys(prog.local),...Object.keys(prog.server)]);
  const out=[];
  for(const id of ids){
    const m=moviesData.find(x=>x.id===id);if(!m||m.comingSoon)continue;
    const p=progOf(id);if(!p||!(p.t>5)||!p.d||p.t/p.d>=0.95)continue;
    out.push({m,p,u:(prog.local[id]||{}).u||0});
  }
  return out.sort((a,b)=>b.u-a.u).slice(0,12);
}
function renderContinue(){
  let box=$('#continue-row');
  if(!box){
    const head=$('#home-view .section-head');if(!head)return;
    box=document.createElement('section');box.id='continue-row';box.className='continue-row hidden';
    head.parentNode.insertBefore(box,head);
  }
  const list=continueList();
  box.classList.toggle('hidden',!list.length);
  if(!list.length){box.innerHTML='';return}
  box.innerHTML=`<div class="section-head"><div><h2>${esc(t('cont.title'))}</h2><p>${esc(t('cont.sub'))}</p></div></div>
  <div class="cont-scroll">${list.map(({m,p})=>`<article class="cont-card" data-id="${esc(m.id)}"><button type="button" class="cont-x" data-rm="${esc(m.id)}" aria-label="${esc(t('cont.remove'))}"><i data-lucide="x"></i></button>
    <div class="cont-poster"><img src="${esc(m.posterUrl)}" alt="" loading="lazy"><span class="cont-play"><i data-lucide="play"></i></span><i class="prog-bar"><b style="width:${Math.round(p.t/p.d*100)}%"></b></i></div>
    <h4>${esc(m.title)}</h4><small>${esc(t('cont.left',{time:fmtDur(p.d-p.t)}))}</small></article>`).join('')}</div>`;
  box.querySelectorAll('.cont-card').forEach(c=>c.onclick=e=>{
    const rm=e.target.closest('[data-rm]');
    if(rm){e.stopPropagation();const id=rm.dataset.rm;delete prog.local[id];delete prog.server[id];LS.setJson('osama_progress',prog.local);if(me)api(`/api/user/progress/${encodeURIComponent(id)}`,'DELETE').catch(()=>{});renderContinue();return}
    const m=moviesData.find(x=>x.id===c.dataset.id);if(m){srcNext='continue';openPlayer(m,'continue')}
  });
  icons();
}

/* =====================================================
   3) المكتبة المرتبطة بالحساب + قوائم التشغيل
   ===================================================== */
let libState={saved:[],history:[],playlists:[]};
async function ensureMovies(){for(let i=0;i<30&&!moviesData.length;i++)await delay(100)}
async function syncLibrary(){
  if(!me)return;
  await ensureMovies();
  try{
    const d=await api('/api/user/library/sync','POST',{saved:savedMovies.map(x=>x.id),history:historyMovies.map(x=>x.id)});
    libState=d;
    const pick=ids=>ids.map(id=>moviesData.find(m=>m.id===id)).filter(Boolean);
    savedMovies=pick(d.saved);historyMovies=pick(d.history).slice(0,30);
    LS.setJson('osama_saved_movies',savedMovies);LS.setJson('osama_history_movies',historyMovies);
    updateMiniStats();
    if(!$('#saved-view').classList.contains('hidden'))renderSaved();
    if(!$('#history-view').classList.contains('hidden'))renderHistory();
    if(!$('#library-view').classList.contains('hidden'))renderLibrary();
    if(currentMovie)$('#detail-save').classList.toggle('saved',savedMovies.some(x=>x.id===currentMovie.id));
  }catch{}
}
async function loadLibrary(){if(!me)return;try{libState=await api('/api/user/library')}catch{}}
function renderLibrary(){
  const v=$('#library-view');if(!v)return;
  const pls=libState.playlists||[];
  v.innerHTML=`<div class="section-head"><div><h2>${esc(t('lib.title'))}</h2><p>${esc(t('lib.sub'))}</p></div><button class="primary-btn" id="pl-new" type="button"><i data-lucide="plus"></i><span>${esc(t('lib.new'))}</span></button></div>
  ${pls.length?pls.map(p=>`<section class="glass lib-card" data-pid="${esc(p.id)}"><div class="lib-head"><div><h3>${esc(p.name)}</h3><small>${esc(t('lib.count',{n:fmt(p.items.length),count:p.items.length}))}</small></div>
    <div class="lib-tools"><button class="ghost-btn" data-ren type="button"><i data-lucide="pencil"></i><span>${esc(t('lib.rename'))}</span></button><button class="ghost-btn danger-ghost" data-del type="button"><i data-lucide="trash-2"></i><span>${esc(t('cm.delete'))}</span></button></div></div>
    ${p.items.length?`<div class="movie-grid lib-grid" id="lib-grid-${esc(p.id)}"></div>`:`<p class="lib-empty">${esc(t('lib.emptyList'))}</p>`}</section>`).join(''):`<div class="empty glass"><i data-lucide="list-video"></i><h3>${esc(t('lib.emptyTitle'))}</h3><p>${esc(t('lib.emptyDesc'))}</p></div>`}`;
  $('#pl-new').onclick=()=>newPlaylistModal();
  pls.forEach(p=>{
    const sec=v.querySelector(`[data-pid="${p.id}"]`);
    const g=sec.querySelector('.lib-grid');
    if(g){const list=p.items.map(id=>moviesData.find(m=>m.id===id)).filter(Boolean);renderMovies(list,'#lib-grid-'+p.id);
      g.querySelectorAll('.movie-card').forEach(c=>{const b=document.createElement('button');b.type='button';b.className='lib-rm';b.setAttribute('aria-label',t('lib.removeItem'));b.innerHTML='<i data-lucide="x"></i>';
        b.onclick=async e=>{e.stopPropagation();try{libState=await api(`/api/user/playlists/${p.id}/items/${encodeURIComponent(c.dataset.movie)}`,'DELETE');renderLibrary()}catch(x){toast(x.message,'error')}};c.appendChild(b)})}
    sec.querySelector('[data-ren]').onclick=()=>nameModal(t('lib.rename'),p.name,async name=>{libState=await api(`/api/user/playlists/${p.id}`,'PATCH',{name});renderLibrary()});
    sec.querySelector('[data-del]').onclick=async()=>{
      let ok=true;if(window.Swal&&Swal.fire){const r=await Swal.fire({title:t('lib.deleteConfirm'),icon:'warning',showCancelButton:true,confirmButtonText:t('cm.delete'),cancelButtonText:t('common.cancel'),confirmButtonColor:'#d94b5b'});ok=!!r.isConfirmed}
      if(!ok)return;try{libState=await api(`/api/user/playlists/${p.id}`,'DELETE');renderLibrary()}catch(x){toast(x.message,'error')}};
  });
  icons();
}
function nameModal(title,val,onSave){
  const m=modal(`<h3 class="ex-h">${esc(title)}</h3><form class="auth-form" id="ex-name-form"><label><span>${esc(t('lib.name'))}</span><input id="ex-name" maxlength="60" required value="${esc(val||'')}"></label><div class="auth-error" id="ex-err"></div><button class="primary-btn" type="submit"><i data-lucide="check"></i><span>${esc(t('common.save'))}</span></button></form>`);
  const inp=m.querySelector('#ex-name');inp.focus();inp.select();
  m.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await onSave(inp.value.trim());closeModal()}catch(x){m.querySelector('#ex-err').textContent=x.message}};
}
function newPlaylistModal(then){
  nameModal(t('lib.new'),'',async name=>{libState=await api('/api/user/playlists','POST',{name});if(!$('#library-view').classList.contains('hidden'))renderLibrary();if(then)then(libState)});
}
async function playlistPicker(){
  if(!requireLogin()||!currentMovie)return;
  await loadLibrary();
  const draw=()=>{
    const pls=libState.playlists||[];
    m.querySelector('.pp-list').innerHTML=pls.length?pls.map(p=>{const has=p.items.includes(currentMovie.id);return `<button type="button" class="pp-row${has?' on':''}" data-pid="${esc(p.id)}"><i data-lucide="${has?'check-square':'square'}"></i><span>${esc(p.name)}</span><small>${fmt(p.items.length)}</small></button>`}).join(''):`<p class="lib-empty">${esc(t('lib.emptyDesc'))}</p>`;
    m.querySelectorAll('.pp-row').forEach(b=>b.onclick=async()=>{
      const p=libState.playlists.find(x=>x.id===b.dataset.pid),has=p.items.includes(currentMovie.id);
      try{libState=has?await api(`/api/user/playlists/${p.id}/items/${encodeURIComponent(currentMovie.id)}`,'DELETE'):await api(`/api/user/playlists/${p.id}/items`,'POST',{movieId:currentMovie.id});toast(t(has?'lib.removed':'lib.added'));draw()}catch(x){toast(x.message,'error')}});
    icons();
  };
  const m=modal(`<h3 class="ex-h">${esc(t('lib.addTo'))}</h3><div class="pp-list"></div><button class="secondary-btn" type="button" id="pp-new"><i data-lucide="plus"></i><span>${esc(t('lib.new'))}</span></button>`);
  m.querySelector('#pp-new').onclick=()=>newPlaylistModal(()=>{playlistPicker()});
  draw();
}

/* =====================================================
   4) الإشعارات
   ===================================================== */
let notifTimer=null;
function paintBadge(n){const b=$('#notif-badge');if(!b)return;b.textContent=n>99?'99+':String(n);b.classList.toggle('hidden',!n)}
async function pollNotifs(){
  if(!me||document.hidden){return}
  try{const d=await api('/api/notifications/count');paintBadge(d.unread)}catch{}
}
const N_ICON={follow:'user-plus',reply:'corner-down-right',short_comment:'message-circle',comment_like:'thumbs-up',payment_approved:'badge-check',payment_rejected:'x-circle',sub_granted:'crown',movie_published:'film',password_changed:'shield-check',mention:'at-sign',short_hidden:'eye-off'};
function notifText(n){
  const d=n.data||{};
  const key=n.type==='payment_approved'&&d.plan?'notif.payment_approved_plan':n.type==='payment_rejected'&&d.plan?'notif.payment_rejected_plan':'notif.'+n.type;
  return t(key,{name:d.name||'',title:d.title||'',days:d.days||''});
}
async function renderNotifs(){
  const v=$('#notifs-view');if(!v||!me)return;
  v.innerHTML=`<div class="section-head"><div><h2>${esc(t('notif.title'))}</h2><p>${esc(t('notif.sub'))}</p></div><div class="lib-tools"><button class="ghost-btn" id="n-read" type="button"><i data-lucide="check-check"></i><span>${esc(t('notif.readAll'))}</span></button><button class="ghost-btn danger-ghost" id="n-clear" type="button"><i data-lucide="trash-2"></i><span>${esc(t('history.clear'))}</span></button></div></div><div id="n-list" class="n-list"><div class="cm-empty">${esc(t('common.loading'))}</div></div>`;
  let d;try{d=await api('/api/notifications')}catch(e){$('#n-list').innerHTML=`<div class="cm-empty">${esc(e.message)}</div>`;return}
  paintBadge(d.unread);
  const list=$('#n-list');
  list.innerHTML=d.items.length?d.items.map(n=>`<button type="button" class="n-item glass${n.read?'':' unread'}" data-id="${esc(n.id)}"><span class="n-ico"><i data-lucide="${N_ICON[n.type]||'bell'}"></i></span><span class="n-body"><span>${esc(notifText(n))}</span><small>${esc(timeAgo(n.createdAt))}</small></span></button>`).join(''):`<div class="empty glass"><i data-lucide="bell"></i><h3>${esc(t('notif.empty'))}</h3></div>`;
  list.querySelectorAll('.n-item').forEach(b=>b.onclick=()=>{
    const n=d.items.find(x=>x.id===b.dataset.id);if(!n)return;
    api('/api/notifications/read','POST',{ids:[n.id]}).then(pollNotifs).catch(()=>{});b.classList.remove('unread');
    const x=n.data||{};
    if(n.type==='follow'&&x.username)openChannel(x.username);
    else if(x.targetType==='short')document.dispatchEvent(new CustomEvent('shorts:open',{detail:x.targetId})),switchTab('shorts');
    else if(x.targetType==='movie'||x.movieId){const m=moviesData.find(y=>y.id===(x.targetId||x.movieId));if(m)openPlayer(m)}
    else if(n.type==='sub_granted'||(n.type==='payment_approved'&&x.plan))switchTab('plans');
  });
  $('#n-read').onclick=async()=>{await api('/api/notifications/read','POST',{}).catch(()=>{});renderNotifs()};
  $('#n-clear').onclick=async()=>{await api('/api/notifications','DELETE').catch(()=>{});renderNotifs()};
  icons();
}

/* =====================================================
   5) القنوات والمتابعة
   ===================================================== */
async function openChannel(username){
  switchTab('channel');
  const v=$('#channel-view');v.innerHTML=`<div class="cm-empty">${esc(t('common.loading'))}</div>`;
  history.replaceState(null,'',`/?channel=${encodeURIComponent(username)}`);
  try{
    const d=await api(`/api/users/${encodeURIComponent(username)}/channel`);
    const u=d.user;
    v.innerHTML=`<button class="back-btn" id="ch-back" type="button"><i data-lucide="arrow-right" class="flip-rtl"></i><span>${esc(t('common.back'))}</span></button>
    <div class="glass ch-head"><span class="avatar avatar-xl">${avatarHTML(u)}</span>
      <div class="ch-info"><h2>${esc(u.displayName)}</h2><small dir="ltr">@${esc(u.username)}</small>
        <div class="ch-stats"><span><b>${fmt(d.shortsCount)}</b> ${esc(t('ch.shorts'))}</span><span><b id="ch-followers">${fmt(d.followers)}</b> ${esc(t('ch.followers'))}</span><span><b>${fmt(d.following)}</b> ${esc(t('ch.following'))}</span></div>
        <div class="ch-actions">${d.isMe?`<button class="secondary-btn" id="ch-edit" type="button"><i data-lucide="user-round"></i><span>${esc(t('nav.profile'))}</span></button>`:`<button class="primary-btn${d.isFollowing?' following':''}" id="ch-follow" type="button"><i data-lucide="${d.isFollowing?'user-check':'user-plus'}"></i><span>${esc(t(d.isFollowing?'ch.following_btn':'ch.follow'))}</span></button>`}
        <button class="ghost-btn" id="ch-share" type="button"><i data-lucide="share-2"></i><span>${esc(t('act.share'))}</span></button></div></div></div>
    <div class="section-head"><div><h3>${esc(t('ch.clips'))}</h3></div></div>
    ${d.shorts.length?`<div class="ch-grid">${d.shorts.map(s=>`<button type="button" class="ch-short" data-id="${esc(s.id)}">${s.posterUrl?`<img src="${esc(s.posterUrl)}" alt="" loading="lazy">`:`<video src="${esc(s.videoUrl)}#t=0.5" preload="metadata" muted playsinline></video>`}<span class="ch-views"><i data-lucide="play"></i>${esc(fmtCompact(s.views))}</span></button>`).join('')}</div>`:`<div class="empty glass"><i data-lucide="zap"></i><h3>${esc(t('ch.none'))}</h3></div>`}`;
    $('#ch-back').onclick=()=>{history.replaceState(null,'','/');switchTab('shorts')};
    v.querySelectorAll('.ch-short').forEach(b=>b.onclick=()=>{history.replaceState(null,'','/');document.dispatchEvent(new CustomEvent('shorts:open',{detail:b.dataset.id}));switchTab('shorts')});
    const f=$('#ch-follow');
    if(f)f.onclick=async()=>{
      if(!requireLogin())return;
      const on=!f.classList.contains('following');
      try{const r=await api(`/api/users/${encodeURIComponent(u.username)}/follow`,on?'POST':'DELETE');openChannel(u.username)}catch(x){toast(x.message,'error')}
    };
    const e=$('#ch-edit');if(e)e.onclick=()=>switchTab('profile');
    $('#ch-share').onclick=async()=>{const url=`${location.origin}/?channel=${encodeURIComponent(u.username)}`;
      try{if(navigator.share)await navigator.share({title:u.displayName,url});else{await navigator.clipboard.writeText(url);toast(t('share.copied'))}}catch{}};
    icons();
  }catch(e){v.innerHTML=`<div class="empty glass"><i data-lucide="user-x"></i><h3>${esc(e.message)}</h3></div>`;icons()}
}

/* =====================================================
   6) شريط Shorts: تبويبات + بحث + وسوم
   ===================================================== */
const sf={feed:'',tag:'',q:''};
function sfQS(){return (sf.feed?`&feed=${sf.feed}`:'')+(sf.tag?`&tag=${encodeURIComponent(sf.tag)}`:'')+(sf.q?`&q=${encodeURIComponent(sf.q)}`:'')}
function applyShortsFilter(){document.dispatchEvent(new CustomEvent('shorts:filter',{detail:sfQS()}));paintShortsBar()}
function paintShortsBar(){
  const bar=$('#shorts-top');if(!bar)return;
  bar.querySelectorAll('[data-feed]').forEach(b=>b.classList.toggle('on',b.dataset.feed===sf.feed&&!sf.tag&&!sf.q));
  const inp=$('#st-input');if(document.activeElement!==inp)inp.value=sf.tag?'#'+sf.tag:sf.q;
  $('#st-clear').classList.toggle('hidden',!(sf.tag||sf.q));
}
function initShortsBar(){
  const wrap=$('#shorts-wrap');if(!wrap||$('#shorts-top'))return;
  wrap.insertAdjacentHTML('beforeend',`<div class="shorts-top" id="shorts-top">
    <div class="st-tabs lg" role="tablist"><button type="button" data-feed="" class="on">${esc(t('shorts.forYou'))}</button><button type="button" data-feed="following">${esc(t('shorts.following'))}</button><button type="button" data-feed="trending">${esc(t('shorts.trending'))}</button><button type="button" data-feed="saved">${esc(t('sv.tab'))}</button><button type="button" id="st-search-btn" aria-label="${esc(t('nav.search'))}"><i data-lucide="search"></i></button></div>
    <div class="st-search lg hidden" id="st-search"><form id="st-form"><i data-lucide="search"></i><input id="st-input" maxlength="60" placeholder="${esc(t('shorts.searchPh'))}" autocomplete="off"><button type="button" id="st-clear" class="hidden" aria-label="${esc(t('common.clear'))}"><i data-lucide="x"></i></button></form><div class="st-tags" id="st-tags"></div></div></div>`);
  const bar=$('#shorts-top');
  bar.querySelectorAll('[data-feed]').forEach(b=>b.onclick=()=>{
    if((b.dataset.feed==='following'||b.dataset.feed==='saved')&&!requireLogin())return;
    sf.feed=b.dataset.feed;sf.tag='';sf.q='';applyShortsFilter();
  });
  $('#st-search-btn').onclick=async()=>{
    const s=$('#st-search');s.classList.toggle('hidden');
    if(!s.classList.contains('hidden')){$('#st-input').focus();loadTags()}
  };
  $('#st-form').onsubmit=e=>{e.preventDefault();const v=$('#st-input').value.trim();if(v.startsWith('#')){sf.tag=v.replace(/^#+/,'').toLowerCase();sf.q=''}else{sf.q=v;sf.tag=''}sf.feed='';applyShortsFilter()};
  $('#st-clear').onclick=()=>{sf.tag='';sf.q='';$('#st-input').value='';applyShortsFilter()};
  document.addEventListener('shorts:tag',e=>{sf.tag=String(e.detail||'').toLowerCase();sf.q='';sf.feed='';$('#st-search').classList.remove('hidden');applyShortsFilter()});
  document.addEventListener('langchange',()=>{bar.remove();initShortsBar();paintShortsBar()});
  icons();
}
async function loadTags(){
  try{const d=await api('/api/hashtags/trending');$('#st-tags').innerHTML=d.map(x=>`<button type="button" data-tag="${esc(x.tag)}">#${esc(x.tag)}</button>`).join('');
    $('#st-tags').querySelectorAll('button').forEach(b=>b.onclick=()=>{sf.tag=b.dataset.tag;sf.q='';sf.feed='';applyShortsFilter()})}catch{}
}

/* =====================================================
   7) البلاغات
   ===================================================== */
function report(type,id){
  if(!requireLogin())return;
  const reasons=['spam','abuse','sexual','violence','copyright','other'];
  const m=modal(`<h3 class="ex-h"><i data-lucide="flag"></i> ${esc(t('rep.title'))}</h3><form class="auth-form" id="rep-form"><div class="rep-reasons">${reasons.map((r,i)=>`<label class="rep-r"><input type="radio" name="reason" value="${r}"${i===0?' checked':''}><span>${esc(t('rep.'+r))}</span></label>`).join('')}</div>
    <label><span>${esc(t('rep.note'))}</span><textarea id="rep-note" maxlength="300" rows="3"></textarea></label><div class="auth-error" id="rep-err"></div>
    <button class="primary-btn" type="submit"><i data-lucide="send"></i><span>${esc(t('rep.send'))}</span></button></form>`);
  m.querySelector('form').onsubmit=async e=>{e.preventDefault();
    try{await api('/api/report','POST',{type,targetId:id,reason:m.querySelector('input[name=reason]:checked').value,note:$('#rep-note').value});closeModal();toast(t('rep.thanks'))}
    catch(x){m.querySelector('#rep-err').textContent=x.message}};
}

/* =====================================================
   8) الاشتراكات والكوبونات
   ===================================================== */
let plansCache={plans:[],mine:null};
async function loadPlans(){
  try{plansCache=await api('/api/plans')}catch{}
  const nav=$('#nav-plans');if(nav)nav.classList.toggle('hidden',!plansCache.plans.length&&!plansCache.mine);
  const l=$('#pw-subscribe');if(l)l.classList.toggle('hidden',!plansCache.plans.length);
}
function renderPlans(){
  const v=$('#plans-view');if(!v)return;
  const mine=me&&me.sub;
  v.innerHTML=`<div class="section-head"><div><h2>${esc(t('plan.title'))}</h2><p>${esc(t('plan.sub'))}</p></div></div>
  ${mine?`<div class="glass sub-active"><i data-lucide="crown"></i><div><strong>${esc(t('plan.active',{name:mine.planName}))}</strong><small>${esc(t('plan.until',{date:dateStr(mine.until)}))}</small></div></div>`:''}
  ${plansCache.plans.length?`<div class="plan-grid">${plansCache.plans.map(p=>`<section class="glass plan-card" data-id="${esc(p.id)}"><h3>${esc(p.name)}</h3><div class="plan-price"><b data-price>${esc(money(p.price,p.currency))}</b><small>${esc(t('plan.days',{n:fmt(p.days),count:p.days}))}</small></div>
    <ul class="plan-perks"><li><i data-lucide="check"></i>${esc(t('plan.perk1'))}</li><li><i data-lucide="check"></i>${esc(t('plan.perk2'))}</li></ul>
    <p class="plan-how">${esc(t('plan.how'))}</p><div class="pw-account"><code>${esc(p.account)}</code><button class="ghost-btn" data-copy type="button"><i data-lucide="copy"></i><span>${esc(t('common.copy'))}</span></button></div>
    <div class="coupon-row"><input data-coupon maxlength="24" placeholder="${esc(t('coupon.ph'))}" dir="ltr" autocomplete="off"><button class="ghost-btn" data-apply type="button">${esc(t('coupon.apply'))}</button></div><div class="coupon-msg" data-cmsg></div>
    <form class="pw-form" data-form autocomplete="off"><input data-receipt inputmode="numeric" maxlength="20" placeholder="${esc(t('pay.receipt'))}" required><button class="primary-btn" type="submit"><i data-lucide="shield-check"></i><span>${esc(t('plan.subscribe'))}</span></button></form><div class="pw-status" data-status></div></section>`).join('')}</div>`:`<div class="empty glass"><i data-lucide="crown"></i><h3>${esc(t('plan.none'))}</h3></div>`}`;
  v.querySelectorAll('.plan-card').forEach(c=>{
    const p=plansCache.plans.find(x=>x.id===c.dataset.id),st=c.querySelector('[data-status]'),cm=c.querySelector('[data-cmsg]');
    c.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(p.account);toast(t('pay.copied'))}catch{toast(t('err.copyFailed'),'error')}};
    c.querySelector('[data-receipt]').oninput=e=>{e.target.value=e.target.value.replace(/[^0-9٠-٩۰-۹]/g,'')};
    c.querySelector('[data-apply]').onclick=async()=>{
      const code=c.querySelector('[data-coupon]').value.trim();cm.textContent='';cm.className='coupon-msg';
      if(!code){c.querySelector('[data-price]').textContent=money(p.price,p.currency);return}
      try{const d=await api('/api/coupons/check','POST',{kind:'plan',id:p.id,code});c.querySelector('[data-price]').innerHTML=`<s>${esc(money(p.price,p.currency))}</s> ${esc(money(d.price,p.currency))}`;cm.textContent=t('coupon.ok',{p:d.percent});cm.classList.add('ok')}
      catch(x){cm.textContent=x.message;cm.classList.add('bad')}
    };
    c.querySelector('[data-form]').onsubmit=async e=>{
      e.preventDefault();if(!requireLogin())return;
      const btn=e.target.querySelector('button');btn.disabled=true;st.className='pw-status';st.textContent=t('pay.checking');
      try{
        const r=await fetch('/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId:p.id,receipt:c.querySelector('[data-receipt]').value,coupon:c.querySelector('[data-coupon]').value.trim()})});
        const d=await r.json().catch(()=>({}));
        if(!r.ok&&r.status!==202)throw new Error(d.error||t('pay.verifyFailed'));
        if(d.status==='approved'){toast(t('plan.activated'));const u=await (await fetch('/api/user/me')).json();setMe(u.user);await loadPlans();renderPlans()}
        else{st.className='pw-status warn';st.textContent=t('plan.pending')}
      }catch(x){st.className='pw-status err';st.textContent=x.message}finally{btn.disabled=false}
    };
  });
  icons();
}
function initPaywallExtras(){
  const form=$('#pw-form');if(!form||$('#pw-coupon'))return;
  form.insertAdjacentHTML('afterbegin',`<div class="coupon-row pw-coupon-row"><input id="pw-coupon" maxlength="24" dir="ltr" placeholder="${esc(t('coupon.ph'))}" autocomplete="off"><button class="ghost-btn" id="pw-coupon-apply" type="button">${esc(t('coupon.apply'))}</button></div><div class="coupon-msg" id="pw-coupon-msg"></div>`);
  $('#pw-coupon-apply').onclick=async()=>{
    const code=$('#pw-coupon').value.trim(),msg=$('#pw-coupon-msg');msg.textContent='';msg.className='coupon-msg';
    if(!currentMovie||!code)return;
    try{const d=await api('/api/coupons/check','POST',{kind:'movie',id:currentMovie.id,code});
      $('#pw-price').textContent=t('pay.price',{amount:fmt(d.price),cur:d.currency==='USD'?t('cur.usdWord'):t('cur.sypWord')});msg.textContent=t('coupon.ok',{p:d.percent});msg.classList.add('ok')}
    catch(x){msg.textContent=x.message;msg.classList.add('bad')}
  };
  $('#paywall').insertAdjacentHTML('beforeend',`<button class="secondary-btn hidden" id="pw-subscribe" type="button"><i data-lucide="crown"></i><span>${esc(t('plan.orSubscribe'))}</span></button>`);
  $('#pw-subscribe').onclick=()=>switchTab('plans');
}

/* =====================================================
   9) نسيت كلمة المرور / تأكيد البريد
   ===================================================== */
function forgotModal(){
  closeAuth();
  const m=modal(`<h3 class="ex-h"><i data-lucide="mail"></i> ${esc(t('forgot.title'))}</h3><p class="ex-p">${esc(t('forgot.desc'))}</p><form class="auth-form" id="fg-form"><label><span>${esc(t('profile.email'))}</span><input id="fg-email" type="email" dir="ltr" required autocomplete="email"></label><div class="auth-error" id="fg-msg"></div><button class="primary-btn" type="submit"><i data-lucide="send"></i><span>${esc(t('forgot.send'))}</span></button></form>`);
  m.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;const out=$('#fg-msg');out.style.color='';out.textContent='';
    try{await api('/api/user/forgot','POST',{email:$('#fg-email').value.trim()});out.style.color='#1d8a4b';out.textContent=t('forgot.sent')}catch(x){out.textContent=x.message;b.disabled=false}};
}
function resetModal(token){
  const m=modal(`<h3 class="ex-h"><i data-lucide="key-round"></i> ${esc(t('reset.title'))}</h3><form class="auth-form" id="rs-form"><label><span>${esc(t('profile.newPassword'))}</span><span class="pass-wrap"><input id="rs-pw" type="password" autocomplete="new-password" required minlength="10" maxlength="128"><button type="button" class="eye" data-eye="rs-pw" aria-label="${esc(t('common.showHide'))}"><i data-lucide="eye"></i></button></span></label>
    <div class="strength"><div class="strength-bar"><i id="rs-fill"></i></div><small id="rs-text"></small></div>
    <label><span>${esc(t('auth.confirmPassword'))}</span><input id="rs-pw2" type="password" autocomplete="new-password" required></label><div class="auth-error" id="rs-msg"></div>
    <button class="primary-btn" type="submit"><i data-lucide="shield-check"></i><span>${esc(t('profile.updatePassword'))}</span></button></form>`);
  m.querySelector('[data-eye]').onclick=()=>{const i=$('#rs-pw');i.type=i.type==='password'?'text':'password'};
  bindStrength('#rs-pw','#rs-fill','#rs-text');
  m.querySelector('form').onsubmit=async e=>{e.preventDefault();const out=$('#rs-msg');out.textContent='';
    const pw=$('#rs-pw').value,pr=passProblem(pw,'');if(pr){out.textContent=pr;return}
    if(pw!==$('#rs-pw2').value){out.textContent=t('pw.mismatch');return}
    try{await api('/api/user/reset','POST',{token,password:pw});closeModal();history.replaceState(null,'','/');setMe(null);toast(t('reset.done'));openAuth('login')}catch(x){out.textContent=x.message}};
}
async function handleMailLinks(){
  const p=new URLSearchParams(location.search);
  if(p.get('reset')){const tk=p.get('reset');history.replaceState(null,'','/');resetModal(tk)}
  else if(p.get('verify')){
    const tk=p.get('verify');history.replaceState(null,'','/');
    try{await api('/api/user/verify','POST',{token:tk});toast(t('verify.done'));const u=await (await fetch('/api/user/me')).json();if(u.authenticated)setMe(u.user)}catch(x){toast(x.message,'error')}
  }
}
function paintProfileExtras(){
  const form=$('#profile-form');if(!form||!me)return;
  let box=$('#pf-extra');
  if(!box){const lab=$('#pf-email').closest('label');box=document.createElement('div');box.id='pf-extra';box.className='pf-extra';lab.insertAdjacentElement('afterend',box)}
  let h='';
  if(me.email){h+=me.emailVerified?`<span class="pf-ok"><i data-lucide="badge-check"></i>${esc(t('verify.ok'))}</span>`:`<span class="pf-warn"><i data-lucide="mail-warning"></i>${esc(t('verify.no'))}</span><button type="button" class="ghost-btn" id="pf-verify-btn">${esc(t('verify.send'))}</button>`}
  if(me.sub)h+=`<span class="pf-ok"><i data-lucide="crown"></i>${esc(t('plan.active',{name:me.sub.planName}))} · ${esc(t('plan.until',{date:dateStr(me.sub.until)}))}</span>`;
  box.innerHTML=h;
  const b=$('#pf-verify-btn');
  if(b)b.onclick=async()=>{b.disabled=true;try{const d=await api('/api/user/verify/send','POST',{});toast(t(d.mail==='dev'?'verify.dev':'verify.sentMail'),'info')}catch(x){toast(x.message,'error');b.disabled=false}};
  icons();
}

/* =====================================================
   10) المشغّل: جودات • معاينة • تخطي المقدمة • التالي • Cast • تنسيق الترجمة
   ===================================================== */
const quality={cur:'orig',pendingSeek:null,wasPlaying:false,applied:false,
  reset(m){this.cur='orig';this.pendingSeek=null;this.applied=false;paintQ()},
  origSrc(){return currentMovie.locked?`/api/movies/${encodeURIComponent(currentMovie.id)}/stream`:currentMovie.videoUrl},
  srcFor(q){return q==='orig'?this.origSrc():`/api/movies/${encodeURIComponent(currentMovie.id)}/rendition/${q}`},
  set(q,{silent}={}){
    const v=$('#video');if(!currentMovie||q===this.cur)return;
    this.pendingSeek=v.currentTime||0;this.wasPlaying=!v.paused;this.cur=q;
    v.src=this.srcFor(q);v.load();paintQ();if(!silent)say(q==='orig'?t('q.orig'):q+'p');
  },
  applyPreferred(){
    if(this.applied||!currentMovie||!(currentMovie.qualities||[]).length)return;this.applied=true;
    const pref=LS.get('osama_quality','auto');
    let q='orig';
    if(pref==='auto'){const c=navigator.connection;if(c&&(c.saveData||/^(slow-2g|2g|3g)$/.test(c.effectiveType||'')))q=String(currentMovie.qualities[0])}
    else if(pref!=='orig'&&currentMovie.qualities.includes(Number(pref)))q=pref;
    if(q!=='orig')this.set(q,{silent:true});
  }
};
function say(msg){const el=$('#pl-toast');if(!el)return;el.textContent=msg;el.classList.remove('hidden');clearTimeout(say.t);say.t=setTimeout(()=>el.classList.add('hidden'),900)}
function paintQ(){
  const b=$('#pl-q-btn');if(!b)return;
  const has=currentMovie&&(currentMovie.qualities||[]).length;
  b.classList.toggle('hidden',!has);
  b.textContent=quality.cur==='orig'?t('q.hd'):quality.cur+'p';
}
const STYLE_DEFAULT={size:'m',color:'white',bg:'blur',pos:'bottom',dual:'0'};
let ccStyle={...STYLE_DEFAULT,...LS.json('osama_cc_style',{})};
function applyCCStyle(){const pl=$('#pl');if(!pl)return;pl.dataset.ccSize=ccStyle.size;pl.dataset.ccColor=ccStyle.color;pl.dataset.ccBg=ccStyle.bg;pl.dataset.ccPos=ccStyle.pos;pl.dataset.ccDual=ccStyle.dual}
function openPlMenu(id,build){
  const m=$(id),was=!m.classList.contains('hidden');
  $$('.pl-menu').forEach(x=>x.classList.add('hidden'));
  if(!was){build();m.classList.remove('hidden');icons()}
  $('#pl').classList.remove('ui-hidden');
}
function buildQMenu(){
  const m=$('#pl-menu-q'),pref=LS.get('osama_quality','auto');
  const opts=[['auto',t('q.auto')],['orig',t('q.orig')],...(currentMovie.qualities||[]).map(q=>[String(q),q+'p'])];
  m.innerHTML=`<div class="pl-menu-h">${esc(t('q.title'))}</div>`+opts.map(([k,l])=>`<button type="button" role="menuitemradio" class="${pref===k?'on':''}" data-q="${k}"><span>${esc(l)}</span><i data-lucide="check"></i></button>`).join('');
  m.querySelectorAll('[data-q]').forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.q;LS.set('osama_quality',k);
    quality.applied=true;const target=k==='auto'?(()=>{const c=navigator.connection;return c&&(c.saveData||/^(slow-2g|2g|3g)$/.test(c.effectiveType||''))?String(currentMovie.qualities[0]):'orig'})():k;
    quality.set(target);m.classList.add('hidden')});
}
function buildStyleMenu(){
  const m=$('#pl-menu-style');
  const row=(label,key,opts)=>`<div class="st-row"><span>${esc(label)}</span><div class="st-pills">${opts.map(([v,l])=>`<button type="button" class="${ccStyle[key]===v?'on':''}" data-k="${key}" data-v="${v}">${esc(l)}</button>`).join('')}</div></div>`;
  const an=LS.get('osama_autonext','1')==='1';
  m.innerHTML=`<div class="pl-menu-h">${esc(t('st.title'))}</div>
  ${row(t('st.size'),'size',[['s','S'],['m','M'],['l','L'],['xl','XL']])}
  ${row(t('st.color'),'color',[['white',t('st.white')],['yellow',t('st.yellow')],['cyan',t('st.cyan')]])}
  ${row(t('st.bg'),'bg',[['none',t('st.none')],['blur',t('st.blur')],['solid',t('st.solid')]])}
  ${row(t('st.pos'),'pos',[['bottom',t('st.bottom')],['top',t('st.top')]])}
  ${row(t('st.dual'),'dual',[['0',t('st.off')],['1',t('st.on')]])}
  <div class="pl-menu-h">${esc(t('st.playback'))}</div>
  <div class="st-row"><span>${esc(t('st.autonext'))}</span><div class="st-pills"><button type="button" class="${an?'':'on'}" data-an="0">${esc(t('st.off'))}</button><button type="button" class="${an?'on':''}" data-an="1">${esc(t('st.on'))}</button></div></div>`;
  m.querySelectorAll('[data-k]').forEach(b=>b.onclick=e=>{e.stopPropagation();ccStyle[b.dataset.k]=b.dataset.v;LS.setJson('osama_cc_style',ccStyle);applyCCStyle();buildStyleMenu();icons();
    const cap=$('#pl-caption');if(!cap.classList.contains('on')){cap.textContent=t('st.sample');cap.dataset.orig=t('st.sampleOrig');cap.dataset.tr='1';cap.classList.add('on');clearTimeout(buildStyleMenu.t);buildStyleMenu.t=setTimeout(()=>{if(cap.textContent===t('st.sample')){cap.classList.remove('on');cap.textContent='';cap.dataset.orig=''}},1800)}});
  m.querySelectorAll('[data-an]').forEach(b=>b.onclick=e=>{e.stopPropagation();LS.set('osama_autonext',b.dataset.an);buildStyleMenu();icons()});
}
function initPlayerExtras(){
  const grp=$('#pl-dl')&&$('#pl-dl').parentElement;if(!grp||$('#pl-q-btn'))return;
  const ui=$('#pl-ui'),bar=ui.querySelector('.pl-bar');
  bar.insertAdjacentHTML('beforebegin','<div class="pl-menu lg hidden" id="pl-menu-q" role="menu"></div><div class="pl-menu lg pl-menu-style hidden" id="pl-menu-style" role="menu"></div>');
  const dl=$('#pl-dl');
  dl.insertAdjacentHTML('beforebegin',`<button class="pl-btn pl-txt hidden" id="pl-q-btn" type="button" aria-label="${esc(t('q.title'))}">HD</button>
    <button class="pl-btn" id="pl-style-btn" type="button" aria-label="${esc(t('st.title'))}"><i data-lucide="type"></i></button>
    <button class="pl-btn pl-hide-sm hidden" id="pl-cast" type="button" aria-label="${esc(t('cast.title'))}"><i data-lucide="cast"></i></button>`);
  const v=$('#video'),pl=$('#pl');
  $('#pl-q-btn').onclick=e=>{e.stopPropagation();openPlMenu('#pl-menu-q',buildQMenu)};
  $('#pl-style-btn').onclick=e=>{e.stopPropagation();openPlMenu('#pl-menu-style',buildStyleMenu)};
  $$('#pl-menu-q,#pl-menu-style').forEach(m=>m.addEventListener('click',e=>e.stopPropagation()));
  applyCCStyle();
  // Cast / AirPlay
  const hasRemote=!!(v.remote&&v.remote.prompt),hasAir=typeof v.webkitShowPlaybackTargetPicker==='function';
  if(hasRemote||hasAir){
    const b=$('#pl-cast');b.classList.remove('hidden');
    b.onclick=async()=>{
      try{if(hasRemote)await v.remote.prompt();else v.webkitShowPlaybackTargetPicker()}
      catch(e){if(e&&e.name!=='NotAllowedError')toast(t('cast.fail'),'error')}
    };
    if(hasRemote){v.remote.addEventListener('connect',()=>b.classList.add('on'));v.remote.addEventListener('disconnect',()=>b.classList.remove('on'))}
  }
  // معاينة التمرير (شريط الصور)
  const seek=$('#pl-seek');seek.insertAdjacentHTML('beforeend','<div class="pl-thumb hidden" id="pl-thumb" dir="ltr"></div>');
  const th=$('#pl-thumb');
  const moveThumb=e=>{
    const s=currentMovie&&currentMovie.sprite;if(!s||!isFinite(v.duration)){th.classList.add('hidden');return}
    const r=seek.getBoundingClientRect(),f=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));
    const idx=Math.min(s.frames-1,Math.floor(f*v.duration/s.interval));
    th.style.width=s.w+'px';th.style.height=s.h+'px';th.style.backgroundImage=`url(${s.url})`;
    th.style.backgroundSize=`${s.cols*s.w}px ${s.rows*s.h}px`;th.style.backgroundPosition=`-${(idx%s.cols)*s.w}px -${Math.floor(idx/s.cols)*s.h}px`;
    const px=Math.min(r.width-s.w/2,Math.max(s.w/2,f*r.width));th.style.left=px+'px';th.classList.remove('hidden');
  };
  seek.addEventListener('pointermove',moveThumb);seek.addEventListener('pointerdown',moveThumb);
  seek.addEventListener('pointerleave',()=>th.classList.add('hidden'));
  // تخطي المقدمة
  pl.insertAdjacentHTML('beforeend',`<button class="pl-skipintro lg hidden" id="pl-skipintro" type="button"><i data-lucide="skip-forward"></i><span>${esc(t('intro.skip'))}</span></button>
    <div class="pl-next lg hidden" id="pl-next"></div>`);
  ['#pl-skipintro','#pl-next'].forEach(id=>$(id).addEventListener('pointerup',e=>e.stopPropagation()));
  $('#pl-skipintro').onclick=e=>{e.stopPropagation();if(currentMovie&&currentMovie.introEnd){v.currentTime=currentMovie.introEnd;say(t('intro.skipped'))}};
  v.addEventListener('timeupdate',()=>{
    const m=currentMovie,b=$('#pl-skipintro');if(!m||!m.introEnd){b.classList.add('hidden');return}
    const tm=v.currentTime,show=tm>=(m.introStart||0)&&tm<m.introEnd-1;b.classList.toggle('hidden',!show);
  });
  v.addEventListener('loadstart',()=>{const s=currentMovie&&currentMovie.sprite;if(s){const i=new Image();i.src=s.url}});
  document.addEventListener('langchange',()=>{paintQ();$('#pl-skipintro span').textContent=t('intro.skip')});
}

/* التالي تلقائياً */
let nextTimer=null;
function nextOf(m){
  const ok=x=>!x.locked&&!x.comingSoon&&x.id!==m.id;
  const sn=window.Extras2&&Extras2.seriesNext&&Extras2.seriesNext(m);if(sn&&ok(sn))return sn;
  const same=moviesData.filter(x=>x.category===m.category&&(x.id===m.id||ok(x)));
  if(same.length>1){const i=same.findIndex(x=>x.id===m.id);const n=same[(i+1)%same.length];if(ok(n))return n}
  return moviesData.find(ok)||null;
}
function hideNext(){clearInterval(nextTimer);nextTimer=null;const n=$('#pl-next');if(n){n.classList.add('hidden');n.innerHTML=''}}
function showNext(){
  if(LS.get('osama_autonext','1')!=='1'||!currentMovie)return;
  const n=nextOf(currentMovie);if(!n)return;
  const box=$('#pl-next');let left=8;
  const paint=()=>{box.innerHTML=`<img src="${esc(n.posterUrl)}" alt=""><div class="pn-txt"><small>${esc(t('next.up'))}</small><strong>${esc(n.title)}</strong><em>${esc(t('next.in',{n:left}))}</em></div><div class="pn-btns"><button class="primary-btn" data-go type="button"><i data-lucide="play"></i><span>${esc(t('next.now'))}</span></button><button class="ghost-btn" data-no type="button">${esc(t('common.cancel'))}</button></div>`;
    box.querySelector('[data-go]').onclick=()=>{hideNext();srcNext='next';openPlayer(n,'next')};box.querySelector('[data-no]').onclick=hideNext;icons()};
  box.classList.remove('hidden');paint();clearInterval(nextTimer);
  nextTimer=setInterval(()=>{left--;if(left<=0){hideNext();srcNext='next';openPlayer(n,'next');return}paint()},1000);
}
document.addEventListener('tabchange',e=>{if(e.detail!=='player')hideNext()});

/* =====================================================
   11) "قريباً" + عدّاد تنازلي
   ===================================================== */
let soonTimer=null;
function hideSoon(){clearInterval(soonTimer);soonTimer=null;const p=$('#soon-panel');if(p)p.classList.add('hidden')}
function showSoon(m){
  $('.player').classList.add('hidden');$('#paywall').classList.add('hidden');if(window.WatchPlayer)WatchPlayer.locked();
  let p=$('#soon-panel');
  if(!p){p=document.createElement('div');p.id='soon-panel';p.className='soon-panel glass';$('#paywall').insertAdjacentElement('beforebegin',p)}
  p.classList.remove('hidden');
  p.innerHTML=`<div class="soon-ico"><i data-lucide="clock"></i></div><h3>${esc(t('soon.title'))}</h3><p>${esc(t('soon.desc',{date:new Date(m.publishAt).toLocaleString(I18N.numLocale(),{dateStyle:'medium',timeStyle:'short'})}))}</p><div class="soon-count" id="soon-count" dir="ltr"></div><button class="primary-btn" id="soon-remind" type="button"><i data-lucide="bell"></i><span>${esc(t('soon.remind'))}</span></button>`;
  icons();
  const paint=()=>{
    const ms=Date.parse(m.publishAt)-Date.now();
    if(ms<=0){hideSoon();loadMovies().then(()=>{const nm=moviesData.find(x=>x.id===m.id);if(nm&&!nm.comingSoon)openPlayer(nm)});return}
    const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),mi=Math.floor(s%3600/60),x=s%60;
    const el=$('#soon-count');if(el)el.innerHTML=(d?`<span><b>${d}</b>${esc(t('soon.d'))}</span>`:'')+`<span><b>${pad(h)}</b>${esc(t('soon.h'))}</span><span><b>${pad(mi)}</b>${esc(t('soon.m'))}</span><span><b>${pad(x)}</b>${esc(t('soon.s'))}</span>`;
  };
  paint();clearInterval(soonTimer);soonTimer=setInterval(paint,1000);
  const rb=$('#soon-remind');let on=false;
  const sync=async()=>{if(!me)return;try{const d=await api(`/api/movies/${encodeURIComponent(m.id)}/remind`);on=d.reminding;rb.classList.toggle('on',on);rb.querySelector('span').textContent=t(on?'soon.reminding':'soon.remind')}catch{}};
  sync();
  rb.onclick=async()=>{if(!requireLogin())return;try{const d=await api(`/api/movies/${encodeURIComponent(m.id)}/remind`,'POST',{on:!on});on=d.reminding;rb.classList.toggle('on',on);rb.querySelector('span').textContent=t(on?'soon.reminding':'soon.remind');toast(t(on?'soon.set':'soon.unset'),'info')}catch(x){toast(x.message,'error')}};
}

/* =====================================================
   12) أزرار إضافية في صفحة الفيلم + تهيئة الواجهة
   ===================================================== */
function paintExtraActions(){
  const box=$('#movie-actions');if(!box)return;
  if(!$('#act-playlist')){
    box.insertAdjacentHTML('beforeend',`<button class="act-btn lg" id="act-playlist" type="button"><i data-lucide="list-plus"></i><span>${esc(t('lib.addTo'))}</span></button><button class="act-btn lg" id="act-report" type="button" aria-label="${esc(t('rep.report'))}"><i data-lucide="flag"></i><span>${esc(t('rep.report'))}</span></button>`);
    $('#act-playlist').onclick=playlistPicker;
    $('#act-report').onclick=()=>{if(currentMovie)report('movie',currentMovie.id)};
    icons();
  }
}
function injectShell(){
  const content=document.querySelector('main.content');
  content.insertAdjacentHTML('beforeend','<section class="view hidden" id="notifs-view"></section><section class="view hidden" id="channel-view"></section><section class="view hidden" id="library-view"></section><section class="view hidden" id="plans-view"></section>');
  const nav=$('.side-nav');
  nav.insertAdjacentHTML('beforeend',`<button data-tab="notifs" id="nav-notifs" type="button"><i data-lucide="bell"></i><span data-i18n="nav.notifs">${esc(t('nav.notifs'))}</span><b class="side-badge hidden" id="side-badge"></b></button>
    <button data-tab="library" id="nav-library" type="button"><i data-lucide="list-video"></i><span data-i18n="nav.playlists">${esc(t('nav.playlists'))}</span></button>
    <button data-tab="plans" id="nav-plans" type="button" class="hidden"><i data-lucide="crown"></i><span data-i18n="nav.plans">${esc(t('nav.plans'))}</span></button>`);
  nav.querySelectorAll('[data-tab="notifs"],[data-tab="library"],[data-tab="plans"]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  const acts=$('.top-actions'),srch=$('#search-open');
  srch.insertAdjacentHTML('beforebegin',`<button class="icon-btn notif-btn" id="notif-btn" type="button" aria-label="${esc(t('nav.notifs'))}"><i data-lucide="bell"></i><b class="notif-badge hidden" id="notif-badge"></b></button>`);
  $('#notif-btn').onclick=()=>switchTab('notifs');
  // رابط "نسيت كلمة المرور"
  $('#login-form').insertAdjacentHTML('beforeend',`<button type="button" class="link-btn" id="forgot-link">${esc(t('forgot.link'))}</button>`);
  $('#forgot-link').onclick=forgotModal;
  // زر تثبيت التطبيق
  const foot=$('.side-footer');
  foot.insertAdjacentHTML('afterbegin',`<button id="install-btn" type="button" class="hidden"><i data-lucide="smartphone"></i><span>${esc(t('pwa.install'))}</span></button>`);
  icons();
}
function refreshShellText(){
  const set=(sel,key)=>{const el=$(sel);if(el)el.textContent=t(key)};
  set('#nav-notifs span','nav.notifs');set('#nav-library span','nav.playlists');set('#nav-plans span','nav.plans');set('#install-btn span','pwa.install');set('#forgot-link','forgot.link');
  const ap=$('#act-playlist');if(ap){ap.querySelector('span').textContent=t('lib.addTo');$('#act-report span').textContent=t('rep.report')}
  const pc=$('#pw-coupon');if(pc){pc.placeholder=t('coupon.ph');$('#pw-coupon-apply').textContent=t('coupon.apply');$('#pw-subscribe span').textContent=t('plan.orSubscribe')}
  const sc=$('#pl-skipintro span');if(sc)sc.textContent=t('intro.skip');
}

/* ---------- PWA ---------- */
let deferredInstall=null;
function initPWA(){
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
  }
  const btn=$('#install-btn');
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(!standalone)btn.classList.remove('hidden')});
  window.addEventListener('appinstalled',()=>{deferredInstall=null;btn.classList.add('hidden');toast(t('pwa.installed'))});
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone;
  if(ios)btn.classList.remove('hidden');
  btn.onclick=async()=>{
    if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice}catch{}deferredInstall=null;btn.classList.add('hidden')}
    else if(ios){modal(`<h3 class="ex-h"><i data-lucide="smartphone"></i> ${esc(t('pwa.install'))}</h3><p class="ex-p">${esc(t('pwa.iosHint'))}</p>`)}
  };
}

/* ---------- الربط ---------- */
function init(){
  injectShell();initPaywallExtras();initPlayerExtras();initProgress();initShortsBar();initPWA();
  renderContinue();
  const ch=$('#clear-history');if(ch)ch.addEventListener('click',()=>{if(me)api('/api/user/library/history','DELETE').catch(()=>{})});
  document.addEventListener('tabchange',e=>{
    const tab=e.detail;
    if(tab==='notifs')renderNotifs();
    else if(tab==='library')loadLibrary().then(renderLibrary);
    else if(tab==='plans'){loadPlans().then(renderPlans)}
    else if(tab==='profile')paintProfileExtras();
    else if(tab==='home'){renderContinue();try{applyFilters()}catch{}}
    if(tab!=='channel'&&location.search.includes('channel='))history.replaceState(null,'','/');
    if(tab==='shorts')paintShortsBar();
  });
  document.addEventListener('auth:changed',async()=>{
    paintProfileExtras();
    if(me){await loadServerProgress();await syncLibrary();pollNotifs();loadPlans()}
    else{prog.server={};libState={saved:[],history:[],playlists:[]};paintBadge(0);renderContinue();if(!$('#plans-view').classList.contains('hidden')){loadPlans().then(renderPlans)}}
  });
  document.addEventListener('langchange',()=>{
    refreshShellText();paintQ();
    const tab=['notifs','library','plans','channel'].find(x=>!$('#'+x+'-view').classList.contains('hidden'));
    if(tab==='notifs')renderNotifs();else if(tab==='library')renderLibrary();else if(tab==='plans')renderPlans();
    renderContinue();paintProfileExtras();
  });
  notifTimer=setInterval(pollNotifs,45000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollNotifs()});
  loadPlans();
  handleMailLinks();
}
document.addEventListener('DOMContentLoaded',init);
window.Extras={report,openChannel,modal,closeModal};
})();
