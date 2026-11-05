/* ===================================================================
   extras4.js — الإصدار 12 (تتمة): فصول الفيلم على شريط التقدم • اختيار المحرر + تريلر الرئيسية
   اختصارات إضافية ولوحة مساعدة • لوحة المتصدرين • هياكل تحميل • «شوهد» على البطاقات • اختصارات PWA
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},json(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}};
async function api(url){const r=await fetch(url,{headers:{'X-Lang':I18N.lang()}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||t('err.generic'));return d}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null;
const byId=id=>moviesData.find(m=>m.id===id);
const mmss=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')};

/* ---------- 1) الفصول (Chapters) ---------- */
function paintChapters(){
  const v=$('#video'),rail=$('#pl-seek .pl-rail'),m=currentMovie;if(!v||!rail)return;
  $$('#pl-seek .chap-tick').forEach(x=>x.remove());$('#chap-list')&&$('#chap-list').remove();
  const ch=(m&&m.chapters)||[];if(!ch.length||!isFinite(v.duration)||!v.duration)return;
  const seek=$('#pl-seek');
  ch.forEach(c=>{if(c.t<=0||c.t>=v.duration)return;const i=document.createElement('i');i.className='chap-tick';i.style.left=(c.t/v.duration*100)+'%';seek.appendChild(i)});
  const box=$('#detail-description');if(!box)return;
  box.insertAdjacentHTML('beforebegin',`<div class="chap-list" id="chap-list"><h4><i data-lucide="list"></i> ${esc(t('chap.title'))}</h4><div>${ch.map(c=>`<button type="button" data-t="${c.t}"><b dir="ltr">${mmss(c.t)}</b><span>${esc(c.title)}</span></button>`).join('')}</div></div>`);
  $$('#chap-list [data-t]').forEach(b=>b.onclick=()=>{v.currentTime=+b.dataset.t;v.play().catch(()=>{});window.scrollTo({top:0,behavior:'smooth'})});icons();
}
function chapNow(){
  const v=$('#video'),ch=(currentMovie&&currentMovie.chapters)||[];let el=$('#pl-chap');
  if(!ch.length){if(el)el.textContent='';return}
  if(!el){const tm=$('#pl-time');if(!tm)return;tm.insertAdjacentHTML('afterend','<span class="pl-chap" id="pl-chap"></span>');el=$('#pl-chap')}
  let cur=null;for(const c of ch)if(c.t<=v.currentTime+0.3)cur=c;
  const txt=cur?cur.title:'';if(el.textContent!==txt)el.textContent=txt;
}
function tipChapter(e){
  const ch=(currentMovie&&currentMovie.chapters)||[],v=$('#video');if(!ch.length||!isFinite(v.duration))return;
  const r=$('#pl-seek').getBoundingClientRect(),f=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),tt=f*v.duration;
  let cur=null;for(const c of ch)if(c.t<=tt)cur=c;
  requestAnimationFrame(()=>{const tip=$('#pl-tip');if(tip&&cur&&!tip.textContent.includes(cur.title))tip.textContent+=' · '+cur.title});
}
function initChapters(){
  const v=$('#video'),s=$('#pl-seek');if(!v||!s)return;
  v.addEventListener('loadedmetadata',paintChapters);v.addEventListener('timeupdate',chapNow);
  s.addEventListener('pointermove',tipChapter);
}

/* ---------- 2) اختيار المحرر + تريلر الرئيسية ---------- */
function picks(){return moviesData.filter(m=>m.featured&&!m.comingSoon)}
function paintPicks(){
  const home=$('#home-view');if(!home)return;let box=$('#yt-picks');const list=picks();
  if(!list.length){if(box)box.remove();return}
  if(!box){box=document.createElement('section');box.id='yt-picks';const anchor=$('#home-rows')||$('#home-view .section-head');anchor?anchor.parentNode.insertBefore(box,anchor):home.appendChild(box)}
  const key=list.map(m=>m.id).join(',');if(box.dataset.k===key&&box.dataset.l===I18N.lang())return;box.dataset.k=key;box.dataset.l=I18N.lang();
  box.innerHTML=`<div class="pk-head"><h3><i data-lucide="award"></i> ${esc(t('picks.title'))}</h3></div><div class="hrow-scroll">${list.map(card).join('')}</div>`;
  box.querySelectorAll('[data-movie]').forEach(c=>c.onclick=()=>{const m=byId(c.dataset.movie);if(m)openPlayer(m,'home')});icons();
}
const _renderMovies=window.renderMovies;
window.renderMovies=function(list,target){const r=_renderMovies.apply(this,arguments);if(!target||target==='#movie-grid'){paintPicks();paintWatched()}return r};
let heroT=null;
function heroTeaser(){
  clearTimeout(heroT);const old=$('#hero-teaser');if(old){try{old.pause()}catch{}old.remove()}
  const box=$('#hero-poster');if(!box||box.offsetParent===null)return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||(navigator.connection&&navigator.connection.saveData))return;
  const m=picks()[0]||[...moviesData].sort((a,b)=>(b.views||0)-(a.views||0))[0];
  if(!m||m.locked||m.comingSoon||!m.videoUrl)return;
  heroT=setTimeout(()=>{
    const v=document.createElement('video');v.id='hero-teaser';v.muted=true;v.playsInline=true;v.preload='metadata';
    const st=Math.floor(Math.min(Math.max(5,(m.duration||120)*0.12),300));v.src=`${m.videoUrl}#t=${st}`;
    v.addEventListener('timeupdate',()=>{if(v.currentTime>st+14)v.currentTime=st});
    v.addEventListener('playing',()=>v.classList.add('on'),{once:true});box.appendChild(v);v.play().catch(()=>v.remove())},1400);
}
const _hero=window.updateHero;
if(_hero)window.updateHero=function(){
  const r=_hero.apply(this,arguments);const f=picks()[0];
  if(f){$('#hero-title').textContent=f.title;$('#hero-desc').textContent=f.description||'';$('#hero-poster').innerHTML=`<img src="${esc(f.posterUrl)}" alt="${esc(f.title)}">`;$('#hero-play').onclick=()=>openPlayer(f,'home');$('#hero-save').onclick=()=>toggleSave(f)}
  heroTeaser();return r;
};
document.addEventListener('tabchange',e=>{if(e.detail==='home')heroTeaser();else{const o=$('#hero-teaser');if(o){o.pause();o.remove()}}});

/* ---------- 3) «شوهد» على البطاقات ---------- */
const _card=window.card;
window.card=function(m){
  const h=_card(m),p=LS.json('osama_progress',{})[m.id];
  if(p&&p.d&&p.t/p.d>=0.9&&!/class="seen-chip"/.test(h))return h.replace('<div class="poster">',`<div class="poster"><span class="seen-chip"><i data-lucide="check"></i>${esc(t('seen.chip'))}</span>`);
  return h;
};
function paintWatched(){}

/* ---------- 4) اختصارات إضافية ولوحة المساعدة ---------- */
const typing=e=>/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||'')||(e.target&&e.target.isContentEditable);
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||typing(e))return;
  const pv=$('#player-view'),inPlayer=pv&&!pv.classList.contains('hidden')&&!pv.classList.contains('yt-mini'),v=$('#video');
  if(e.key==='?'){e.preventDefault();return helpModal()}
  if(!inPlayer||!v||document.querySelector('.modal:not(.hidden)'))return;
  if(/^[0-9]$/.test(e.key)&&isFinite(v.duration)){v.currentTime=v.duration*(+e.key)/10;e.preventDefault()}
  else if(e.key===','&&v.paused){v.currentTime=Math.max(0,v.currentTime-1/30);e.preventDefault()}
  else if(e.key==='.'&&v.paused){v.currentTime=Math.min(v.duration||1e9,v.currentTime+1/30);e.preventDefault()}
  else if(e.key==='n'||e.key==='N'){const b=$('#pl-next');if(b&&!b.classList.contains('hidden'))b.click()}
  else if(e.key==='i'||e.key==='I'){if(document.pictureInPictureEnabled){document.pictureInPictureElement?document.exitPictureInPicture():v.requestPictureInPicture().catch(()=>{});e.preventDefault()}}
  else if(e.key==='Home'){v.currentTime=0;e.preventDefault()}
  else if(e.key==='End'&&isFinite(v.duration)){v.currentTime=Math.max(0,v.duration-1);e.preventDefault()}
});
function helpModal(){
  const rows=[['Space / K','kb.play'],['J / L','kb.skip10'],['0–9','kb.jump'],[', / .','kb.frame'],['↑ ↓','kb.volume'],['M','kb.mute'],['F','kb.full'],['T','kb.theater'],['C','kb.captions'],['< / >','kb.speed'],['I','kb.pip'],['N','kb.next'],['?','kb.help']];
  modal(`<h3><i data-lucide="keyboard"></i> ${esc(t('kb.title'))}</h3><div class="kb-list">${rows.map(([k,l])=>`<div><kbd dir="ltr">${esc(k)}</kbd><span>${esc(t(l))}</span></div>`).join('')}</div>`);
}

/* ---------- 5) لوحة المتصدرين ---------- */
async function openLeaders(){
  let d;try{d=await api('/api/leaderboard')}catch(e){return toast(e.message,'error')}
  const medal=['🥇','🥈','🥉'];
  modal(`<h3><i data-lucide="trophy"></i> ${esc(t('lead.title'))}</h3><p class="muted-p">${esc(t('lead.sub'))}</p>
    ${d.items.length?`<ol class="lead-list">${d.items.map((u,i)=>`<li><button type="button" data-u="${esc(u.username)}"><span class="lead-rank">${medal[i]||i+1}</span><span class="avatar avatar-sm">${avatarHTML({name:u.displayName,avatarUrl:u.avatarUrl,initial:Array.from(u.displayName)[0]})}</span><span class="lead-name"><b>${esc(u.displayName)}</b><small>${esc(t('lead.stats',{s:u.shorts,f:u.followers,l:u.likes}))}</small></span><em>${fmt(u.score)}</em></button></li>`).join('')}</ol>`:`<div class="cm-empty">${esc(t('lead.empty'))}</div>`}`);
  $$('#ex-modal [data-u]').forEach(b=>b.onclick=()=>{Extras.closeModal();Extras.openChannel(b.dataset.u)});icons();
}
function injectNav(){
  const nav=$('.side-nav');if(!nav||$('#nav-leaders'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" id="nav-leaders"><i data-lucide="trophy"></i><span>${esc(t('lead.nav'))}</span></button><button type="button" id="nav-keys"><i data-lucide="keyboard"></i><span>${esc(t('kb.nav'))}</span></button>`);
  $('#nav-leaders').onclick=()=>{closeSidebar();openLeaders()};$('#nav-keys').onclick=()=>{closeSidebar();helpModal()};icons();
}

/* ---------- 6) هياكل التحميل ---------- */
function skeleton(){
  const g=$('#movie-grid');if(!g||g.children.length)return;
  g.innerHTML=Array.from({length:10},()=>'<div class="sk-card"><i class="sk-img"></i><i class="sk-l"></i><i class="sk-l s"></i></div>').join('');
}

/* ---------- 7) اختصارات PWA: ?tab= ---------- */
function pwaShortcut(){
  const p=new URLSearchParams(location.search),tab=p.get('tab');
  if(tab&&['shorts','saved','history','home','library','notifs'].includes(tab)&&!p.get('movie')&&!p.get('short'))switchTab(tab);
  if(p.get('search')==='1'){const b=$('#search-open');if(b)b.click();const i=$('#search-input');if(i)setTimeout(()=>i.focus(),100)}
}

function init(){injectNav();skeleton();initChapters();
  const wait=setInterval(()=>{if(moviesData.length){clearInterval(wait);paintPicks();heroTeaser();pwaShortcut()}},200);setTimeout(()=>clearInterval(wait),15000)}
document.addEventListener('langchange',()=>{paintPicks();const n=$('#nav-leaders span');if(n)n.textContent=t('lead.nav');const k=$('#nav-keys span');if(k)k.textContent=t('kb.nav')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
