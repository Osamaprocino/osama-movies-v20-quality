/* ===================================================================
   youtube.js — شكل YouTube كطبقة اختيارية: بطاقات 16:9 بمدة وصورة قناة ومعاينة عند التمرير،
   صفحة مشاهدة بعمودين، وصف قابل للتوسيع، ومشغّل مصغّر. لا يعدّل script.js؛ يغلّف دوالها فقط.
   =================================================================== */
(function(){
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>escapeHtml(String(s==null?'':s));
const LS={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const on=()=>LS.get('osama_yt','1')==='1';
const byId=id=>moviesData.find(m=>m.id===id);
const dur=s=>{s=Math.round(s||0);if(!s)return '';const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}`:`${m}:${String(x).padStart(2,'0')}`};
const LOC={ar:'ar',en:'en',ru:'ru'};
function ago(iso){
  const d=(Date.parse(iso)-Date.now())/1000;if(!isFinite(d))return '';
  try{const rf=new Intl.RelativeTimeFormat(LOC[I18N.lang()]||'ar',{numeric:'auto'});const a=Math.abs(d);
    for(const [u,s] of [['year',31536000],['month',2592000],['week',604800],['day',86400],['hour',3600],['minute',60]])if(a>=s)return rf.format(Math.round(d/s),u);
    return rf.format(0,'second')}catch{return ''}
}
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.codePointAt(0))%360;return h};

/* ---------- البطاقة ---------- */
const _card=window.card;
window.card=function(m){
  const h=_card(m);if(!on())return h;
  const x=/^([\s\S]*?)<\/div><h4>([\s\S]*?)<\/h4><div class="cat">([\s\S]*?)<\/div><\/article>$/.exec(h);if(!x)return h;
  const d=dur(m.duration),first=Array.from(m.title||'?')[0]||'?';
  const star=m.rating&&m.rating.count?` · <span class="yt-star">★ ${m.rating.avg}</span>`:'';
  const later=`<button type="button" class="yt-later" data-id="${esc(m.id)}" aria-label="${esc(t('later.add'))}"><i data-lucide="clock"></i></button>`;
  return `${x[1]}${d?`<span class="dur-chip">${d}</span>`:''}${later}</div><div class="yt-info"><span class="yt-ava" style="background:hsl(${hue(m.category||m.title)} 55% 45%)">${esc(first)}</span><div><h4>${x[2]}</h4><div class="cat">${x[3]}${m.createdAt?' · '+esc(ago(m.createdAt)):''}${star}</div></div></div></article>`;
};

/* ---------- زر التبديل ---------- */
function injectToggle(){
  if($('#yt-toggle'))return;const host=$('.top-actions');if(!host)return;
  host.insertAdjacentHTML('afterbegin',`<button class="icon-btn" id="yt-toggle" type="button" aria-label="${esc(t('yt.toggle'))}" title="${esc(t('yt.toggle'))}"><i data-lucide="layout-grid"></i></button>`);
  $('#yt-toggle').onclick=()=>{LS.set('osama_yt',on()?'0':'1');apply(true);toast(t(on()?'yt.onMsg':'yt.offMsg'),'info')};icons();
}
function apply(rerender){
  document.body.classList.toggle('yt',on());const b=$('#yt-toggle');if(b)b.classList.toggle('on',on());
  if(!on())unmini();
  layoutPlayer();
  if(rerender){try{applyFilters()}catch{}try{if(currentMovie&&!$('#player-view').classList.contains('hidden'))document.dispatchEvent(new CustomEvent('yt:relayout'))}catch{}document.dispatchEvent(new CustomEvent('tabchange',{detail:'home'}))}
}

/* ---------- صفحة المشاهدة: عمود جانبي + وصف قابل للتوسيع + صف القناة ---------- */
function layoutPlayer(){
  const pv=$('#player-view');if(!pv)return;
  if(on()&&!$('#yt-side')){
    const grid=$('#related-grid'),head=grid&&grid.previousElementSibling;
    if(grid&&head){const side=document.createElement('aside');side.id='yt-side';pv.appendChild(side);side.appendChild(head);side.appendChild(grid)}
  }
  if(on()&&!$('#yt-chan')){
    const box=$('#movie-actions');
    if(box)box.insertAdjacentHTML('beforebegin','<div class="yt-chan" id="yt-chan"><span class="yt-ava">س</span><div><b id="yt-chan-name"></b><small id="yt-chan-sub"></small></div></div>');
  }
}
function paintWatch(m){
  if(!on()||!m)return;layoutPlayer();
  const nm=$('#yt-chan-name');if(nm){const s=$('.brand-compact strong');nm.textContent=s?s.textContent:'';const sub=$('#yt-chan-sub');if(sub)sub.textContent=[catLabel(m.category),m.year||'',viewsText(m.views)].filter(Boolean).join(' · ')}
  const d=$('#detail-description');
  if(d){let more=$('#yt-more');if(!more){more=document.createElement('button');more.id='yt-more';more.type='button';d.insertAdjacentElement('afterend',more);more.onclick=()=>{const c=d.classList.toggle('collapsed');more.textContent=t(c?'yt.more':'yt.less')}}
    const long=(d.textContent||'').length>140||(d.textContent||'').split('\n').length>3;
    d.classList.toggle('collapsed',long);more.classList.toggle('hidden',!long);more.textContent=t('yt.more')}
}
const _openPlayer=window.openPlayer;
window.openPlayer=function(m){
  unmini();
  const r=_openPlayer.apply(this,arguments);
  setTimeout(()=>paintWatch(m),60);return r;
};
document.addEventListener('yt:relayout',()=>paintWatch(currentMovie));
document.addEventListener('langchange',()=>{if(currentMovie)paintWatch(currentMovie)});

/* ---------- معاينة عند التمرير (للفأرة فقط) ---------- */
let hv=null;
const stopPrev=()=>{if(!hv)return;clearTimeout(hv.t);const v=hv.p.querySelector('.yt-prev');if(v){try{v.pause()}catch{}v.removeAttribute('src');v.load();v.remove()}hv=null};
document.addEventListener('mouseover',e=>{
  if(!on()||!matchMedia('(hover:hover)').matches)return;
  const p=e.target.closest&&e.target.closest('.yt .movie-card .poster');if(!p||(hv&&hv.p===p))return;
  stopPrev();const m=byId(p.closest('.movie-card').dataset.movie);if(!m||m.locked||m.comingSoon||!m.videoUrl)return;
  hv={p,t:setTimeout(()=>{const v=document.createElement('video');v.className='yt-prev';v.muted=true;v.loop=true;v.playsInline=true;v.preload='metadata';
    v.src=`${m.videoUrl}#t=${Math.floor(Math.min((m.duration||60)*0.2,300))}`;p.appendChild(v);v.play().catch(()=>{})},650)};
});
document.addEventListener('mouseout',e=>{if(hv&&!hv.p.contains(e.relatedTarget))stopPrev()});
document.addEventListener('tabchange',stopPrev);

/* ---------- مشغّل مصغّر عند مغادرة الصفحة والفيديو يعمل ---------- */
function mini(){
  const pv=$('#player-view');if(!pv||!currentMovie)return;
  if(!$('.yt-mini-bar')){pv.insertAdjacentHTML('beforeend',`<div class="yt-mini-bar"><span id="ymb-t"></span><button type="button" id="ymb-play" aria-label="${esc(t('player.play'))}"><i data-lucide="pause"></i></button><button type="button" id="ymb-open" aria-label="${esc(t('yt.open'))}"><i data-lucide="maximize-2"></i></button><button type="button" id="ymb-x" aria-label="${esc(t('common.close'))}"><i data-lucide="x"></i></button></div>`);
    $('#ymb-play').onclick=()=>{const v=$('#video');if(v.paused)v.play();else v.pause()};
    $('#ymb-open').onclick=$('#ymb-t').onclick=()=>{unmini();switchTab('player');const v=$('#video');v.play().catch(()=>{})};
    $('#ymb-x').onclick=()=>{unmini();$('#video').pause();$('#player-view').classList.add('hidden')};
    const v=$('#video');['play','pause'].forEach(ev=>v.addEventListener(ev,()=>{const b=$('#ymb-play i');if(b&&$('#player-view').classList.contains('yt-mini'))b.setAttribute('data-lucide',v.paused?'play':'pause'),icons()}));
  }
  $('#ymb-t').textContent=currentMovie.title;pv.classList.add('yt-mini');icons();
}
function unmini(){const pv=$('#player-view');if(pv)pv.classList.remove('yt-mini')}
const _switchTab=window.switchTab;
window.switchTab=function(tab){
  const v=$('#video'),pv=$('#player-view');
  const was=on()&&pv&&!pv.classList.contains('hidden')&&!pv.classList.contains('yt-mini')&&v&&!v.paused&&!v.ended&&tab!=='player'&&!document.querySelector('.party-panel');
  if(tab==='player')unmini();
  const r=_switchTab.apply(this,arguments);
  if(was&&!$('#paywall:not(.hidden)')){mini();v.play().catch(()=>{})}
  else if(tab!=='player')unmini();
  return r;
};

document.addEventListener('DOMContentLoaded',()=>{injectToggle();apply(false)});
document.addEventListener('langchange',()=>{const b=$('#yt-toggle');if(b){b.title=t('yt.toggle');b.setAttribute('aria-label',t('yt.toggle'))}});
if(document.readyState!=='loading'){injectToggle();apply(false)}
})();
