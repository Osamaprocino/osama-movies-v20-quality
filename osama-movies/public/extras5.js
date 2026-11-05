/* ===================================================================
   extras5.js — الإصدار 13: نشر الأفلام الطويلة من الحسابات • أفلامي • صف القناة والاشتراك تحت الفيلم
   قناة الموقع • زر إعدادات المشغّل (يضم الأزرار عدا ملء الشاشة)
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
async function api(url,method='GET',body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-Lang':I18N.lang()},body:body===undefined?undefined:JSON.stringify(body)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}
const modal=(h,o)=>window.Extras?Extras.modal(h,o):null,closeModal=()=>window.Extras&&Extras.closeModal();
const byId=id=>moviesData.find(m=>m.id===id);
const brandName=()=>{const s=$('.brand-compact strong')||$('.brand strong');return s?s.textContent.trim():'Cinema'};

/* =====================================================
   1) نشر فيلم طويل
   ===================================================== */
const AGES=[['','—'],['0',null],['7','7+'],['10','10+'],['13','13+'],['16','16+'],['18','18+']];
function openPublish(){
  if(!me){openAuth('login');return}
  if(me.kids&&me.kids.on){toast(t('pub.kids'),'info');return}
  const cats=[...new Set(moviesData.map(m=>m.category).filter(Boolean))];
  const el=modal(`<h3><i data-lucide="clapperboard"></i> ${esc(t('pub.title'))}</h3><p class="muted-p">${esc(t('pub.sub'))}</p>
   <form id="pub-form" class="pub-form" autocomplete="off">
    <label><span>${esc(t('pub.fTitle'))}</span><input name="title" maxlength="160" required></label>
    <label><span>${esc(t('pub.fCat'))}</span><input name="category" list="pub-cats" maxlength="60" placeholder="${esc(t('pub.catPh'))}"><datalist id="pub-cats">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
    <label><span>${esc(t('pub.fDesc'))}</span><textarea name="description" rows="3" maxlength="4000"></textarea></label>
    <div class="pub-files">
      <label class="pub-file"><i data-lucide="image"></i><span id="pub-p-n">${esc(t('pub.fPoster'))}</span><input type="file" name="poster" accept="image/jpeg,image/png,image/webp" required hidden></label>
      <label class="pub-file"><i data-lucide="film"></i><span id="pub-v-n">${esc(t('pub.fVideo'))}</span><input type="file" name="video" accept="video/mp4,video/webm" required hidden></label>
    </div>
    <details class="pub-more"><summary>${esc(t('pub.more'))}</summary>
      <div class="pub-grid"><label><span>${esc(t('pub.year'))}</span><input name="year" type="number" min="1888" max="2100"></label>
       <label><span>${esc(t('pub.director'))}</span><input name="director" maxlength="80"></label>
       <label class="w2"><span>${esc(t('pub.cast'))}</span><input name="cast" maxlength="400"></label>
       <label class="w2"><span>${esc(t('pub.tags'))}</span><input name="tags" maxlength="300"></label>
       <label><span>${esc(t('pub.age'))}</span><select name="ageRating">${AGES.map(([v,l])=>`<option value="${v}">${esc(l===null?t('age.all'):l)}</option>`).join('')}</select></label>
       <label><span>${esc(t('pub.series'))}</span><input name="series" maxlength="100"></label>
       <label><span>${esc(t('pub.season'))}</span><input name="season" type="number" min="1" max="99"></label>
       <label><span>${esc(t('pub.episode'))}</span><input name="episode" type="number" min="1" max="999"></label></div></details>
    <p class="muted-p pub-note">${esc(t('pub.rules'))}</p>
    <div class="pub-bar hidden" id="pub-bar"><i></i><b id="pub-pct">0%</b></div>
    <div class="auth-error" id="pub-err"></div>
    <button class="primary-btn" id="pub-go" type="submit"><i data-lucide="upload"></i><span>${esc(t('pub.go'))}</span></button>
   </form>`,{cls:'pub-card'});
  const f=el.querySelector('#pub-form');
  f.poster.onchange=()=>{el.querySelector('#pub-p-n').textContent=f.poster.files[0]?f.poster.files[0].name:t('pub.fPoster')};
  f.video.onchange=()=>{el.querySelector('#pub-v-n').textContent=f.video.files[0]?f.video.files[0].name:t('pub.fVideo')};
  f.onsubmit=e=>{
    e.preventDefault();const err=el.querySelector('#pub-err');err.textContent='';
    if(!f.poster.files[0]||!f.video.files[0]){err.textContent=t('pub.needFiles');return}
    const fd=new FormData(f);for(const k of ['year','director','cast','tags','ageRating','series','season','episode','category'])if(fd.get(k)==='')fd.delete(k);
    const x=new XMLHttpRequest(),bar=el.querySelector('#pub-bar'),go=el.querySelector('#pub-go');
    x.open('POST','/api/user/movies');x.setRequestHeader('X-Lang',I18N.lang());bar.classList.remove('hidden');go.disabled=true;
    x.upload.onprogress=ev=>{if(ev.lengthComputable){const p=Math.round(ev.loaded/ev.total*100);bar.querySelector('i').style.width=p+'%';el.querySelector('#pub-pct').textContent=p+'%'}};
    x.onload=async()=>{
      let d={};try{d=JSON.parse(x.responseText)}catch{}
      go.disabled=false;
      if(x.status===201){await loadMovies();closeModal();toast(t(d.pending?'pub.pending':'pub.done'),'success');const m=byId(d.id);if(m&&!d.pending)openPlayer(m,'direct')}
      else{bar.classList.add('hidden');err.textContent=d.error||t('err.generic')}
    };
    x.onerror=()=>{go.disabled=false;bar.classList.add('hidden');err.textContent=t('err.generic')};
    x.send(fd);
  };
}

/* =====================================================
   2) أفلامي
   ===================================================== */
async function openMine(){
  if(!me){openAuth('login');return}
  let list;try{list=await api('/api/user/movies')}catch(e){return toast(e.message,'error')}
  const draw=()=>{
    const el=$('#ex-modal .mine-list');if(!el)return;
    el.innerHTML=list.length?list.map(m=>`<div class="mine-item" data-id="${esc(m.id)}"><img src="${esc(m.posterUrl)}" alt=""><div class="mine-info"><b>${esc(m.title)}</b><small>${esc(catLabel(m.category))} · ${esc(viewsText(m.views))}${m.pending?' · '+esc(t('mine.pending')):''}${m.processing==='working'?' · '+esc(t('mine.processing')):''}</small></div>
      <button type="button" class="ghost-btn" data-act="open" aria-label="${esc(t('mine.open'))}"><i data-lucide="play"></i></button>
      <button type="button" class="ghost-btn" data-act="edit" aria-label="${esc(t('mine.edit'))}"><i data-lucide="pencil"></i></button>
      <button type="button" class="ghost-btn danger-ghost" data-act="del" aria-label="${esc(t('mine.del'))}"><i data-lucide="trash-2"></i></button></div>`).join(''):`<div class="cm-empty">${esc(t('mine.empty'))}</div>`;
    el.querySelectorAll('.mine-item').forEach(row=>{
      const id=row.dataset.id,m=list.find(x=>x.id===id);
      row.querySelector('[data-act=open]').onclick=()=>{closeModal();const mm=byId(id);if(mm)openPlayer(mm,'direct')};
      row.querySelector('[data-act=edit]').onclick=()=>editMine(m,()=>{draw()});
      row.querySelector('[data-act=del]').onclick=async()=>{
        if(!confirm(t('mine.delConfirm',{title:m.title})))return;
        try{await api(`/api/user/movies/${encodeURIComponent(id)}`,'DELETE');list=list.filter(x=>x.id!==id);await loadMovies();draw();toast(t('mine.deleted'),'success')}catch(e){toast(e.message,'error')}};
    });icons();
  };
  modal(`<h3><i data-lucide="film"></i> ${esc(t('mine.title'))}</h3><div class="mine-list"></div><button class="primary-btn" id="mine-new" type="button"><i data-lucide="plus"></i><span>${esc(t('pub.nav'))}</span></button>`,{cls:'pub-card'});
  $('#mine-new').onclick=openPublish;draw();
}
function editMine(m,done){
  const el=modal(`<h3><i data-lucide="pencil"></i> ${esc(t('mine.edit'))}</h3><form class="pub-form" id="em-form"><label><span>${esc(t('pub.fTitle'))}</span><input name="title" maxlength="160" value="${esc(m.title)}" required></label>
   <label><span>${esc(t('pub.fCat'))}</span><input name="category" maxlength="60" value="${esc(m.category)}"></label>
   <label><span>${esc(t('pub.fDesc'))}</span><textarea name="description" rows="4" maxlength="4000">${esc(m.description||'')}</textarea></label><div class="auth-error" id="em-err"></div>
   <button class="primary-btn" type="submit"><i data-lucide="check"></i><span>${esc(t('common.confirm'))}</span></button></form>`,{cls:'pub-card'});
  el.querySelector('#em-form').onsubmit=async e=>{e.preventDefault();const f=e.target;
    try{const d=await api(`/api/user/movies/${encodeURIComponent(m.id)}`,'PATCH',{title:f.title.value,category:f.category.value,description:f.description.value});await loadMovies();toast(t('mine.saved'),'success');openMine()}
    catch(x){el.querySelector('#em-err').textContent=x.message}};
}
function injectNav(){
  const nav=$('.side-nav');if(!nav||$('#nav-publish'))return;
  nav.insertAdjacentHTML('beforeend',`<button type="button" id="nav-publish"><i data-lucide="clapperboard"></i><span>${esc(t('pub.nav'))}</span></button><button type="button" id="nav-mine"><i data-lucide="film"></i><span>${esc(t('mine.nav'))}</span></button>`);
  $('#nav-publish').onclick=()=>{closeSidebar();openPublish()};$('#nav-mine').onclick=()=>{closeSidebar();openMine()};icons();
}

/* =====================================================
   3) صف القناة تحت الفيلم: صورة + اسم + اشتراك
   ===================================================== */
const _openPlayer=window.openPlayer;
window.openPlayer=function(m){const r=_openPlayer.apply(this,arguments);if(m)setTimeout(()=>paintChan(m),140);return r};
async function paintChan(m){
  if(!currentMovie||currentMovie.id!==m.id)return;
  let row=$('#yt-chan');
  if(!row){const box=$('#movie-actions');if(!box)return;box.insertAdjacentHTML('beforebegin','<div id="yt-chan"></div>');row=$('#yt-chan')}
  const au=m.author,site=!au;
  let c;try{c=await api(site?'/api/site/card':`/api/users/${encodeURIComponent(au.username)}/card`)}catch{return}
  if(!currentMovie||currentMovie.id!==m.id)return;
  const name=site?(c.name||brandName()):(c.displayName||au.displayName),ava=site?(c.avatarUrl?`<span class="avatar"><img src="${esc(c.avatarUrl)}" alt=""></span>`:`<span class="avatar chan-site">${esc(Array.from(name)[0]||'S')}</span>`):`<span class="avatar">${avatarHTML({name:au.displayName,avatarUrl:au.avatarUrl,initial:Array.from(au.displayName)[0]})}</span>`;
  row.className='chan-row';
  row.innerHTML=`<button type="button" class="chan-ava" aria-label="${esc(t('chan.open'))}">${ava}</button>
    <button type="button" class="chan-meta"><b>${esc(name)}${c.verified?`<i class="vb" title="${esc(t('ver.badge'))}"></i>`:''}</b><small>${esc(t('chan.subs',{n:fmt(c.followers),count:c.followers}))} · ${esc(t('chan.movies',{n:fmt(c.movies),count:c.movies}))}</small></button>
    ${c.isMe?`<span class="chan-mine">${esc(t('chan.yours'))}</span>`:`<button type="button" class="sub-btn${c.isFollowing?' on':''}" id="chan-sub"><i data-lucide="${c.isFollowing?'bell-ring':'bell'}"></i><span>${esc(t(c.isFollowing?'chan.subscribed':'chan.subscribe'))}</span></button>`}`;
  const open=()=>site?openSiteChannel():Extras.openChannel(au.username);
  row.querySelector('.chan-ava').onclick=open;row.querySelector('.chan-meta').onclick=open;
  const sb=$('#chan-sub');
  if(sb)sb.onclick=async()=>{
    if(!me){openAuth('login');return}
    const on=!sb.classList.contains('on');sb.disabled=true;
    try{if(site)await api('/api/site/follow',on?'POST':'DELETE');else await api(`/api/users/${encodeURIComponent(au.username)}/follow`,on?'POST':'DELETE');toast(t(on?'chan.subOk':'chan.subOff'),'success');paintChan(m)}
    catch(e){toast(e.message,'error');sb.disabled=false}
  };
  icons();
}
document.addEventListener('langchange',()=>{if(currentMovie&&!$('#player-view').classList.contains('hidden'))paintChan(currentMovie)});
document.addEventListener('auth:changed',()=>{if(currentMovie&&!$('#player-view').classList.contains('hidden'))paintChan(currentMovie)});

/* ---------- قناة الموقع ---------- */
async function openSiteChannel(){
  switchTab('channel');const v=$('#channel-view');v.innerHTML=`<div class="cm-empty">${esc(t('common.loading'))}</div>`;
  let c,l;try{[c,l]=await Promise.all([api('/api/site/card'),api('/api/site/movies')])}catch(e){v.innerHTML=`<div class="empty glass"><h3>${esc(e.message)}</h3></div>`;return}
  const name=c.name||brandName();
  v.innerHTML=`<button class="back-btn" id="sc-back" type="button"><i data-lucide="arrow-right" class="flip-rtl"></i><span>${esc(t('common.back'))}</span></button>
   ${c.bannerUrl?`<div class="ch-banner" style="background-image:url('${esc(c.bannerUrl)}')"></div>`:''}
   <div class="glass ch-head"><span class="avatar avatar-xl chan-site">${c.avatarUrl?`<img src="${esc(c.avatarUrl)}" alt="">`:esc(Array.from(name)[0]||'S')}</span><div class="ch-info"><h2>${esc(name)}</h2><small>${esc(c.handle?'@'+c.handle:t('chan.site'))}</small>${c.bio?`<p class="ch-bio">${esc(c.bio)}</p>`:''}
    <div class="ch-stats"><span><b>${fmt(c.followers)}</b> ${esc(t('chan.subsWord'))}</span><span><b>${fmt(c.movies)}</b> ${esc(t('chan.moviesWord'))}</span></div>
    <div class="ch-actions"><button class="primary-btn${c.isFollowing?' following':''}" id="sc-sub" type="button"><i data-lucide="${c.isFollowing?'bell-ring':'bell'}"></i><span>${esc(t(c.isFollowing?'chan.subscribed':'chan.subscribe'))}</span></button></div></div></div>
   <div class="section-head"><div><h3>${esc(t('chan.films'))}</h3></div></div>
   ${l.items.length?`<div class="movie-grid" id="sc-grid">${l.items.map(card).join('')}</div>`:`<div class="cm-empty">${esc(t('chan.noMovies'))}</div>`}`;
  $('#sc-back').onclick=()=>switchTab('home');
  $('#sc-sub').onclick=async()=>{if(!me){openAuth('login');return}const on=!$('#sc-sub').classList.contains('following');try{await api('/api/site/follow',on?'POST':'DELETE');openSiteChannel()}catch(e){toast(e.message,'error')}};
  v.querySelectorAll('[data-movie]').forEach(cd=>cd.onclick=()=>{const m=byId(cd.dataset.movie);if(m)openPlayer(m,'channel')});icons();
}
/* ---------- أفلام القناة داخل صفحة قناة المستخدم ---------- */
let chObs=null;
function watchChannel(){
  const v=$('#channel-view');if(!v||chObs)return;
  chObs=new MutationObserver(async()=>{
    const small=v.querySelector('.ch-info small[dir=ltr]');if(!small||v.querySelector('#ch-movies'))return;
    const uname=small.textContent.replace('@','').trim();if(!uname||v.dataset.mv===uname&&v.querySelector('#ch-movies'))return;
    v.dataset.mv=uname;let d;try{d=await api(`/api/users/${encodeURIComponent(uname)}/movies`)}catch{return}
    if(!d.items.length||v.querySelector('#ch-movies')||!v.querySelector('.ch-head'))return;
    const head=v.querySelector('.ch-head');
    head.insertAdjacentHTML('afterend',`<section id="ch-movies"><div class="section-head"><div><h3>${esc(t('chan.films'))}</h3></div></div><div class="movie-grid">${d.items.map(m=>{const g=byId(m.id)||m;return card(g)}).join('')}</div></section>`);
    v.querySelectorAll('#ch-movies [data-movie]').forEach(cd=>cd.onclick=()=>{const m=byId(cd.dataset.movie);if(m)openPlayer(m,'channel')});icons();
  });
  chObs.observe(v,{childList:true,subtree:true});
}

/* =====================================================
   4) زر الإعدادات في شريط المشغّل
   ===================================================== */
function initGear(){
  const ui=$('#pl-ui'),fs=$('#pl-fs');if(!ui||!fs||$('#pl-gear'))return;
  const grp=fs.parentElement;
  fs.insertAdjacentHTML('beforebegin',`<button class="pl-btn" id="pl-gear" type="button" aria-haspopup="true" aria-expanded="false" aria-label="${esc(t('set.btn'))}" title="${esc(t('set.btn'))}"><i data-lucide="settings"></i></button>`);
  ui.insertAdjacentHTML('beforeend',`<div class="pl-set lg hidden" id="pl-set" role="menu"><div class="pl-set-h">${esc(t('set.title'))}</div><div class="pl-set-list" id="pl-set-list"></div></div>`);
  const list=$('#pl-set-list'),gear=$('#pl-gear'),panel=$('#pl-set');
  const keep=new Set(['pl-fs','pl-gear']);
  const sweep=()=>{[...grp.children].forEach(b=>{if(!keep.has(b.id)&&b.nodeType===1){list.appendChild(b)}})};
  sweep();
  new MutationObserver(sweep).observe(grp,{childList:true});
  const close=()=>{panel.classList.add('hidden');gear.setAttribute('aria-expanded','false');gear.classList.remove('on')};
  const toggle=()=>{const open=panel.classList.contains('hidden');if(open){$$('.pl-menu').forEach(m=>m.classList.add('hidden'))}panel.classList.toggle('hidden',!open);gear.setAttribute('aria-expanded',String(open));gear.classList.toggle('on',open)};
  gear.onclick=e=>{e.stopPropagation();toggle()};
  list.addEventListener('click',e=>{if(e.target.closest('button'))setTimeout(close,0)});
  document.addEventListener('pointerdown',e=>{if(!panel.classList.contains('hidden')&&!e.target.closest('#pl-set,#pl-gear'))close()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('tabchange',close);
  document.addEventListener('langchange',()=>{gear.title=t('set.btn');gear.setAttribute('aria-label',t('set.btn'));const h=$('.pl-set-h');if(h)h.textContent=t('set.title')});
  icons();
}

function init(){injectNav();watchChannel();initGear();setTimeout(initGear,800)}
document.addEventListener('langchange',()=>{const a=$('#nav-publish span');if(a)a.textContent=t('pub.nav');const b=$('#nav-mine span');if(b)b.textContent=t('mine.nav')});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Cinema5={openPublish,openMine,openSiteChannel};
})();
