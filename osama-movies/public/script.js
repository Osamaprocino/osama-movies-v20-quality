let moviesData=[];let savedMovies=JSON.parse(localStorage.getItem('osama_saved_movies')||'[]');let historyMovies=JSON.parse(localStorage.getItem('osama_history_movies')||'[]');let currentMovie=null;let activeCategory='all';

const $=s=>document.querySelector(s);
function icons(){if(window.lucide)lucide.createIcons();}
function toast(message,type='success'){if(window.Swal)Swal.fire({toast:true,position:'top',showConfirmButton:false,timer:2200,icon:type,title:message});}
function fmt(n){return new Intl.NumberFormat(I18N.numLocale()).format(Number(n||0));}
function fmtCompact(n){try{return new Intl.NumberFormat(I18N.numLocale(),{notation:'compact',maximumFractionDigits:1}).format(Number(n||0))}catch{return fmt(n)}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function catLabel(c){return !c||c==='عام'?t('cat.general'):c}
function viewsText(n){return t('count.views',{n:fmt(n),count:Number(n||0)})}

/* ===== الصور الرمزية ===== */
function hueOf(s){let h=0;for(const ch of String(s))h=(h*31+ch.codePointAt(0))%360;return h}
function vbHTML(u){return (u&&u.verified)?`<i class="vb" title="${typeof t==='function'?escapeHtml(t('ver.badge')):''}"></i>`:''}
function avatarHTML(u){
  const name=(u&&(u.displayName||u.name||u.username))||'?';
  if(u&&u.avatarUrl)return `<img src="${escapeHtml(u.avatarUrl)}" alt="" loading="lazy" draggable="false">`;
  return `<span class="av-init" style="--h:${hueOf(name)}">${escapeHtml((Array.from(name)[0]||'?').toUpperCase())}</span>`;
}
function setAvatar(el,u){if(el)el.innerHTML=avatarHTML(u)}
function timeAgo(iso){
  const d=(Date.now()-Date.parse(iso))/1000;
  try{
    const rtf=new Intl.RelativeTimeFormat(I18N.lang(),{numeric:'auto'});
    for(const [sec,unit] of [[31536000,'year'],[2592000,'month'],[604800,'week'],[86400,'day'],[3600,'hour'],[60,'minute']])
      if(d>=sec)return rtf.format(-Math.floor(d/sec),unit);
    return rtf.format(0,'second');
  }catch{return ''}
}

async function loadMovies(){
  try{
    const r=await fetch('/api/movies'); if(!r.ok) throw new Error();
    moviesData=await r.json();
    renderCategories(); renderMovies(moviesData); updateMiniStats(); updateHero();
    return true;
  }catch{toast(t('err.loadMovies'),'error');return false}
}
async function loadCategories(){
  try{const r=await fetch('/api/categories');const cats=await r.json();return cats}catch{return []}
}
async function renderCategories(){
  const cats=await loadCategories();
  const all=['all',...cats];
  $('#category-filters').innerHTML=all.map(c=>`<button class="${c===activeCategory?'active':''}" data-cat="${escapeHtml(c)}">${c==='all'?t('search.all'):escapeHtml(catLabel(c))}</button>`).join('');
  $('#side-categories').innerHTML=cats.length?cats.map(c=>`<button data-side-cat="${escapeHtml(c)}">${escapeHtml(catLabel(c))}</button>`).join(''):`<span style="color:#8a98aa;font-size:11px;padding:0 12px">${t('search.noCategories')}</span>`;
  $('#category-filters').querySelectorAll('button').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;applyFilters()});
  $('#side-categories').querySelectorAll('button').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.sideCat;$('#search-panel').classList.remove('hidden');switchTab('home');applyFilters();closeSidebar()});
  icons();
}
function renderMovies(list,target='#movie-grid'){
  const el=$(target); if(!el)return;
  el.innerHTML=list.map(movie=>card(movie)).join('');
  el.querySelectorAll('[data-movie]').forEach(c=>c.onclick=()=>openPlayer(moviesData.find(m=>m.id===c.dataset.movie)||savedMovies.find(m=>m.id===c.dataset.movie)||historyMovies.find(m=>m.id===c.dataset.movie)));
  icons();
}
function card(m){const lock=m.locked?`<span class="lock-chip"><i data-lucide="lock"></i>${fmt(m.price)} ${m.currency==='USD'?'$':t('cur.syp')}</span>`:'';return `<article class="movie-card" data-movie="${escapeHtml(m.id)}"><div class="poster"><img src="${escapeHtml(m.posterUrl)}" alt="${escapeHtml(m.title)}" loading="lazy">${lock}<span class="play-chip"><i data-lucide="${m.locked?'lock':'play'}"></i></span></div><h4>${escapeHtml(m.title)}</h4><div class="cat">${escapeHtml(catLabel(m.category))} · ${viewsText(m.views)}</div></article>`}
function applyFilters(){
  const q=($('#search-input')?.value||'').trim().toLowerCase();
  let list=moviesData.filter(m=>(activeCategory==='all'||m.category===activeCategory)&&(!q||[m.title,m.description,m.category].some(v=>String(v||'').toLowerCase().includes(q))));
  renderMovies(list); $('#movies-count').textContent=fmt(list.length);
  $('#category-filters').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.cat===activeCategory));
}
function updateMiniStats(){const views=moviesData.reduce((s,m)=>s+Number(m.views||0),0);$('#mini-movies').textContent=fmt(moviesData.length);$('#mini-views').textContent=fmt(views);$('#mini-saved').textContent=fmt(savedMovies.length);$('#movies-count').textContent=fmt(moviesData.length);$('#empty-home').classList.toggle('hidden',moviesData.length>0)}
function updateHero(){
  const m=[...moviesData].sort((a,b)=>Number(b.views||0)-Number(a.views||0))[0]; if(!m)return;
  $('#hero-title').removeAttribute('data-i18n');$('#hero-desc').removeAttribute('data-i18n');
  $('#hero-title').textContent=m.title;$('#hero-desc').textContent=m.description||t('home.heroFallback');
  $('#hero-poster').innerHTML=`<img src="${escapeHtml(m.posterUrl)}" alt="${escapeHtml(m.title)}">`; $('#hero-play').onclick=()=>openPlayer(m); $('#hero-save').onclick=()=>toggleSave(m);
}
function renderDetailMeta(movie){
  const subs=(movie.subtitles||[]).length?`<span>${t('player.hasSubs')}</span>`:'';
  $('#detail-meta').innerHTML=`<span>${escapeHtml(catLabel(movie.category))}</span><span>${viewsText(movie.views)}</span>${subs}`;
}
let payPoll=null;
function stopPoll(){if(payPoll){clearInterval(payPoll);payPoll=null}}
function openPlayer(movie){
  if(!movie)return;currentMovie=movie;stopPoll();
  closeSidebar();
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));$('#player-view').classList.remove('hidden');
  document.body.classList.remove('shorts-mode');document.dispatchEvent(new CustomEvent('tabchange',{detail:'player'}));
  $('#detail-title').textContent=movie.title;renderDetailMeta(movie);$('#detail-description').textContent=movie.description||'';
  const video=$('#video');video.pause();video.removeAttribute('src');video.poster=movie.posterUrl;video.load();
  $('#detail-save').classList.toggle('saved',savedMovies.some(x=>x.id===movie.id));
  if(!historyMovies.some(x=>x.id===movie.id)){historyMovies=[movie,...historyMovies.filter(x=>x.id!==movie.id)].slice(0,30);localStorage.setItem('osama_history_movies',JSON.stringify(historyMovies));}
  $('.player').classList.remove('hidden');$('#paywall').classList.add('hidden');
  if(window.WatchPlayer)WatchPlayer.setMovie(movie);
  if(window.Social)Social.mountMovie(movie);
  if(movie.locked){checkAccess(movie)}else{startPlayback(movie)}
  renderRelated(movie);
  window.scrollTo({top:0,behavior:'smooth'});icons();
}
function startPlayback(movie){
  const video=$('#video');
  video.src=movie.locked?`/api/movies/${encodeURIComponent(movie.id)}/stream`:movie.videoUrl;video.poster=movie.posterUrl;video.load();
  $('.player').classList.remove('hidden');$('#paywall').classList.add('hidden');
  if(window.WatchPlayer)WatchPlayer.unlocked(movie);
  fetch(`/api/movies/${encodeURIComponent(movie.id)}/view`,{method:'POST'}).then(r=>r.json()).then(d=>{if(d.views){movie.views=d.views;renderDetailMeta(movie);updateMiniStats();}}).catch(()=>{});
}
async function checkAccess(movie){
  let a={hasAccess:false,authenticated:false,status:'none'};
  try{const r=await fetch(`/api/movies/${encodeURIComponent(movie.id)}/access`);if(r.ok)a=await r.json()}catch{}
  if(currentMovie!==movie)return;
  if(a.hasAccess){startPlayback(movie);return}
  showPaywall(movie,a);
}
function setPayStatus(text,cls=''){const el=$('#pw-status');el.textContent=text;el.className='pw-status '+cls;el.dataset.key=''}
function showPaywall(movie,a){
  $('.player').classList.add('hidden');$('#paywall').classList.remove('hidden');
  if(window.WatchPlayer)WatchPlayer.locked();
  $('#pw-price').textContent=t('pay.price',{amount:fmt(movie.price),cur:movie.currency==='USD'?t('cur.usdWord'):t('cur.sypWord')});
  $('#pw-account').textContent=movie.shamcashAccount||'';
  $('#pw-guest').classList.toggle('hidden',!!a.authenticated);
  $('#pw-form').classList.toggle('hidden',!a.authenticated);
  setPayStatus('');
  if(a.status==='pending'){setPayStatus(t('pay.pending'),'warn');pollAccess(movie)}
  else if(a.status==='rejected'){setPayStatus(t('pay.rejectedRetry'),'err')}
  icons();
}
function pollAccess(movie){
  stopPoll();
  payPoll=setInterval(async()=>{
    if(currentMovie!==movie||$('#paywall').classList.contains('hidden')){stopPoll();return}
    try{const r=await fetch(`/api/movies/${encodeURIComponent(movie.id)}/access`);const a=await r.json();
      if(a.hasAccess){stopPoll();toast(t('pay.confirmed'));startPlayback(movie)}
      else if(a.status==='rejected'){stopPoll();setPayStatus(t('pay.rejected'),'err')}}catch{}
  },10000);
}
async function submitReceipt(e){
  e.preventDefault();const movie=currentMovie;if(!movie)return;
  const btn=$('#pw-verify');btn.disabled=true;setPayStatus(t('pay.checking'));
  try{
    const r=await fetch(`/api/movies/${encodeURIComponent(movie.id)}/verify-payment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receipt:$('#pw-receipt').value})});
    const d=await r.json().catch(()=>({}));
    if(r.status===401){setPayStatus(t('err.loginFirst'),'err');openAuth('login');return}
    if(!r.ok&&r.status!==202)throw new Error(d.error||t('pay.verifyFailed'));
    if(d.status==='approved'){toast(t('pay.confirmed'));startPlayback(movie)}
    else{setPayStatus(t('pay.received'),'warn');pollAccess(movie)}
  }catch(err){setPayStatus(err.message,'err')}finally{btn.disabled=false}
}

/* ===== حسابات المستخدمين ===== */
let currentUser=null;      // اسم المستخدم (للتوافق مع الكود القديم)
let me=null;               // بيانات الحساب الكاملة
function setMe(user){
  me=user||null;currentUser=me?me.username:null;
  renderAuthBtn();renderSidebarUser();
  document.dispatchEvent(new CustomEvent('auth:changed',{detail:me}));
}
function renderAuthBtn(){
  const b=$('#auth-btn');if(!b)return;
  b.innerHTML=me?`<i data-lucide="log-out"></i><span>${t('nav.logout',{name:escapeHtml(me.displayName||me.username)})}</span>`:`<i data-lucide="log-in"></i><span>${t('nav.login')}</span>`;icons();
}
function renderSidebarUser(){
  const box=$('#side-user'),navp=$('#nav-profile');
  if(box)box.classList.toggle('hidden',!me);if(navp)navp.classList.toggle('hidden',!me);
  if(!me)return;
  setAvatar($('#side-avatar'),me);$('#side-name').innerHTML=escapeHtml(me.displayName||me.username)+vbHTML(me);$('#side-email').textContent=me.email||'@'+me.username;
}
async function loadUser(){try{const r=await fetch('/api/user/me');const d=await r.json();setMe(d.authenticated?d.user:null)}catch{setMe(null)}}
function openAuth(tab='login'){closeSidebar();$('#auth-modal').classList.remove('hidden');switchAuthTab(tab);icons()}
function closeAuth(){$('#auth-modal').classList.add('hidden')}
function requireLogin(){
  if(me)return true;
  toast(t('err.loginFirst'),'info');openAuth('login');return false;
}
function switchAuthTab(tab){
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===tab));
  $('#login-form').classList.toggle('hidden',tab!=='login');$('#register-form').classList.toggle('hidden',tab!=='register');
  $('#login-error').textContent='';$('#register-error').textContent='';
}
function passScore(p){
  let s=0;if(p.length>=10)s++;if(p.length>=14)s++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))s++;if(/\d/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;return s;
}
function passProblem(p,u){
  if(p.length<10)return t('pw.min');if(!/[a-z]/.test(p))return t('pw.lower');if(!/[A-Z]/.test(p))return t('pw.upper');
  if(!/\d/.test(p))return t('pw.digit');if(!/[^A-Za-z0-9]/.test(p))return t('pw.symbol');
  if(u&&p.toLowerCase().includes(u.toLowerCase()))return t('pw.hasUser');return null;
}
function bindStrength(inputSel,fillSel,textSel){
  const input=$(inputSel);if(!input)return;
  const paint=()=>{
    const p=input.value,s=passScore(p),pct=Math.round(s/5*100);const f=$(fillSel);
    f.style.width=pct+'%';f.style.background=s<=2?'#d94b5b':s<=3?'#e0a030':s===4?'#5aa9e6':'#1d8a4b';
    $(textSel).textContent=p?(s<=2?t('pw.weak'):s<=3?t('pw.medium'):s===4?t('pw.good'):t('pw.strong')):t('pw.hint');
  };
  input.addEventListener('input',paint);document.addEventListener('langchange',paint);paint();
}
async function postJSON(url,body,method='POST'){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||t('err.generic'));return d}
async function afterAuth(user){
  setMe(user);closeAuth();toast(t('auth.welcome',{name:user.displayName||user.username}));
  if(currentMovie&&currentMovie.locked&&!$('#player-view').classList.contains('hidden'))checkAccess(currentMovie);
}
async function doLogout(){
  try{await postJSON('/api/user/logout',{})}catch{}
  const onProfile=!$('#profile-view').classList.contains('hidden');
  setMe(null);closeSidebar();toast(t('auth.loggedOut'),'info');
  if(onProfile)switchTab('home');
  if(currentMovie&&currentMovie.locked&&!$('#player-view').classList.contains('hidden'))openPlayer(currentMovie);
}
function initAuth(){
  $('#auth-btn').onclick=async()=>{if(!me){openAuth('login');return}doLogout()};
  $('#auth-close').onclick=closeAuth;$('#auth-modal').onclick=e=>{if(e.target.id==='auth-modal')closeAuth()};
  document.querySelectorAll('[data-auth-tab]').forEach(b=>b.onclick=()=>switchAuthTab(b.dataset.authTab));
  document.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.eye);i.type=i.type==='password'?'text':'password'});
  bindStrength('#reg-password','#strength-fill','#strength-text');
  $('#login-form').onsubmit=async e=>{
    e.preventDefault();const b=$('#login-submit'),err=$('#login-error');b.disabled=true;err.textContent='';
    try{const d=await postJSON('/api/user/login',{username:$('#login-username').value.trim(),password:$('#login-password').value});$('#login-password').value='';await afterAuth(d.user)}
    catch(x){err.textContent=x.message}finally{b.disabled=false}
  };
  $('#register-form').onsubmit=async e=>{
    e.preventDefault();const b=$('#register-submit'),err=$('#register-error');err.textContent='';
    const u=$('#reg-username').value.trim(),em=$('#reg-email').value.trim(),p=$('#reg-password').value;
    if(!/^[\p{L}\p{N}_.-]{3,24}$/u.test(u)){err.textContent=t('auth.usernameRule');return}
    if(!/^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/.test(em)){err.textContent=t('auth.emailInvalid');return}
    const pr=passProblem(p,u);if(pr){err.textContent=pr;return}
    if(p!==$('#reg-password2').value){err.textContent=t('pw.mismatch');return}
    b.disabled=true;
    try{const d=await postJSON('/api/user/register',{username:u,email:em,password:p});$('#reg-password').value='';$('#reg-password2').value='';await afterAuth(d.user)}
    catch(x){err.textContent=x.message}finally{b.disabled=false}
  };
  $('#pw-login').onclick=()=>openAuth('login');
  $('#pw-form').onsubmit=submitReceipt;
  $('#pw-receipt').oninput=e=>{e.target.value=e.target.value.replace(/[^0-9٠-٩۰-۹]/g,'')};
  $('#pw-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#pw-account').textContent);toast(t('pay.copied'))}catch{toast(t('err.copyFailed'),'error')}};
  loadUser();
}
function renderRelated(movie){renderMovies(moviesData.filter(m=>m.id!==movie.id&&m.category===movie.category).slice(0,6),'#related-grid');if(!$('#related-grid').children.length)renderMovies(moviesData.filter(m=>m.id!==movie.id).slice(0,6),'#related-grid')}
function toggleSave(movie=currentMovie){
  if(!movie)return;const i=savedMovies.findIndex(x=>x.id===movie.id);
  if(i>=0){savedMovies.splice(i,1);toast(t('saved.removed'),'info')}
  else{savedMovies.unshift(movie);toast(t('saved.added'));fetch(`/api/movies/${encodeURIComponent(movie.id)}/save-event`,{method:'POST'}).catch(()=>{});}
  localStorage.setItem('osama_saved_movies',JSON.stringify(savedMovies));updateMiniStats();renderSaved();if(currentMovie)$('#detail-save').classList.toggle('saved',savedMovies.some(x=>x.id===currentMovie.id));
}
function renderSaved(){const list=savedMovies.map(s=>moviesData.find(m=>m.id===s.id)||s);$('#saved-count').textContent=fmt(list.length);$('#empty-saved').classList.toggle('hidden',list.length>0);renderMovies(list,'#saved-grid')}
function renderHistory(){const list=historyMovies.map(s=>moviesData.find(m=>m.id===s.id)||s);$('#empty-history').classList.toggle('hidden',list.length>0);renderMovies(list,'#history-grid')}
function switchTab(tab){
  if(tab==='profile'&&!me){openAuth('login');return}
  stopPoll();$('#video').pause();
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));document.querySelector(`#${tab}-view`).classList.remove('hidden');
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.body.classList.toggle('shorts-mode',tab==='shorts');
  if(tab==='saved')renderSaved();if(tab==='history')renderHistory();closeSidebar();
  document.dispatchEvent(new CustomEvent('tabchange',{detail:tab}));
  window.scrollTo({top:0,behavior:'auto'});
}
function openSidebar(){$('#app-sidebar').classList.add('open');$('#sidebar-backdrop').classList.add('open')}
function closeSidebar(){$('#app-sidebar').classList.remove('open');$('#sidebar-backdrop').classList.remove('open')}
function applyThemeUI(){
  const d=document.documentElement.classList.contains('dark');
  const b=$('#theme-btn');if(b)b.innerHTML=d?`<i data-lucide="sun"></i><span>${t('nav.light')}</span>`:`<i data-lucide="moon"></i><span>${t('nav.dark')}</span>`;
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content=d?'#0f1620':'#eef3fb';
  icons();
}

/* ===== تغيير اللغة: إعادة رسم كل المحتوى الديناميكي ===== */
function rerenderForLang(){
  applyThemeUI();renderAuthBtn();renderSidebarUser();
  renderCategories();applyFilters();updateMiniStats();updateHero();
  if(!$('#saved-view').classList.contains('hidden'))renderSaved();
  if(!$('#history-view').classList.contains('hidden'))renderHistory();
  if(currentMovie&&!$('#player-view').classList.contains('hidden')){renderDetailMeta(currentMovie);renderRelated(currentMovie);if(!$('#paywall').classList.contains('hidden'))$('#pw-price').textContent=t('pay.price',{amount:fmt(currentMovie.price),cur:currentMovie.currency==='USD'?t('cur.usdWord'):t('cur.sypWord')})}
  icons();
}
function setupLangUI(){
  const sync=()=>{document.querySelectorAll('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===I18N.lang()))};
  document.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{I18N.set(b.dataset.lang);$('#lang-menu').classList.add('hidden')});
  $('#lang-open').onclick=e=>{e.stopPropagation();$('#lang-menu').classList.toggle('hidden')};
  document.addEventListener('click',e=>{if(!e.target.closest('.lang-pop'))$('#lang-menu').classList.add('hidden')});
  document.addEventListener('langchange',()=>{sync();rerenderForLang()});sync();
}

/* ===== روابط المشاركة المباشرة (?movie= / ?short=) ===== */
function handleDeepLink(){
  const p=new URLSearchParams(location.search);
  const mid=p.get('movie'),sid=p.get('short');
  if(mid){const m=moviesData.find(x=>x.id===mid);if(m)openPlayer(m)}
  else if(sid){document.dispatchEvent(new CustomEvent('shorts:open',{detail:sid}));switchTab('shorts')}
}

async function init(){
  try{if(/\bChrome\/\d+/.test(navigator.userAgent)&&!matchMedia('(pointer:coarse)').matches)document.documentElement.classList.add('lg-refract')}catch{}
  I18N.apply();icons();initAuth();setupLangUI();
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('#menu-open').onclick=openSidebar;$('#side-close').onclick=closeSidebar;$('#sidebar-backdrop').onclick=closeSidebar;
  $('#search-open').onclick=()=>$('#search-panel').classList.toggle('hidden');$('#search-input').oninput=applyFilters;$('#search-clear').onclick=()=>{$('#search-input').value='';applyFilters()};
  $('#player-back').onclick=()=>switchTab('home');$('#detail-save').onclick=()=>toggleSave();$('#clear-history').onclick=()=>{historyMovies=[];localStorage.removeItem('osama_history_movies');renderHistory();toast(t('history.cleared'),'success')};
  $('#theme-btn').onclick=()=>{const d=document.documentElement.classList.toggle('dark');try{localStorage.setItem('osama_theme',d?'dark':'light')}catch{}applyThemeUI()};applyThemeUI();
  await loadMovies();
  handleDeepLink();
}
document.addEventListener('DOMContentLoaded',init);
