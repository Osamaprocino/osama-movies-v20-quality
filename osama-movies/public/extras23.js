/* extras23.js — v22: قسم «الموسيقى»: قائمة المقاطع + مشغّل مصغّر يبقى أثناء التنقل + تحميل + مشاركة + Media Session. */
(function(){
const $=s=>document.querySelector(s);
const lg=()=>{try{return I18N.lang()}catch{return 'ar'}};
const T=(a,e,r)=>lg()==='en'?e:lg()==='ru'?r:a;
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=$('main.content');if(!main)return;
try{const D=I18N.dict;D.ar['nav.music']='الموسيقى';D.en['nav.music']='Music';D.ru['nav.music']='Музыка';I18N.apply&&I18N.apply()}catch{}
if(!$('#music-view'))main.insertAdjacentHTML('beforeend','<section class="view hidden" id="music-view"></section>');
const view=$('#music-view');
const au=new Audio();au.preload='none';
let tracks=[],queue=[],idx=-1,loaded=false,q='',repeat=0,shuffle=false;const counted=new Set();
const fmt=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const cover=t=>t.hasCover?`/api/music/${t.id}/cover`:'';
const ph=t=>`<span class="mu-ph">♪</span>`;
const cur=()=>queue[idx];

/* ---------- المشغّل المصغّر ---------- */
let bar=$('#mu-bar');
if(!bar){bar=document.createElement('div');bar.id='mu-bar';bar.className='mu-bar glass hidden';bar.setAttribute('role','region');
  bar.innerHTML=`<div class="mu-bar-in"><div class="mu-art" id="mu-art"></div><div class="mu-meta"><b id="mu-t"></b><small id="mu-a"></small></div>
  <div class="mu-ctl"><button type="button" id="mu-shuf" aria-pressed="false" title="shuffle">⇄</button><button type="button" id="mu-prev" aria-label="prev">⏮</button><button type="button" id="mu-pp" class="mu-pp" aria-label="play">▶</button><button type="button" id="mu-next" aria-label="next">⏭</button><button type="button" id="mu-rep" aria-pressed="false" title="repeat">⟲</button><button type="button" id="mu-x" aria-label="close">✕</button></div>
  <div class="mu-seek"><span id="mu-cu">0:00</span><input type="range" id="mu-r" min="0" max="1000" value="0" aria-label="seek"><span id="mu-du">0:00</span></div></div>`;
  document.body.appendChild(bar)}
const ui=()=>{const t=cur();if(!t)return;$('#mu-t').textContent=t.title;$('#mu-a').textContent=t.artist||'';$('#mu-art').innerHTML=t.hasCover?`<img src="${cover(t)}" alt="">`:ph();
  $('#mu-pp').textContent=au.paused?'▶':'⏸';$('#mu-pp').setAttribute('aria-label',au.paused?'play':'pause');
  view.querySelectorAll('.mu-row').forEach(r=>{const on=r.dataset.id===t.id;r.classList.toggle('playing',on);const b=r.querySelector('.mu-play');if(b)b.textContent=on&&!au.paused?'⏸':'▶'})};
function play(i){if(i<0||i>=queue.length)return;idx=i;const t=queue[i];
  try{const v=$('#video');if(v&&!v.paused)v.pause()}catch{}
  au.src=`/api/music/${t.id}/file`;au.play().catch(()=>{});bar.classList.remove('hidden');document.body.classList.add('mu-on');ui();ms();
  if(!counted.has(t.id)){counted.add(t.id);fetch(`/api/music/${t.id}/play`,{method:'POST'}).catch(()=>{})}}
function next(dir=1){if(!queue.length)return;let n;if(shuffle&&queue.length>1){do n=Math.floor(Math.random()*queue.length);while(n===idx)}else{n=idx+dir;if(n>=queue.length){if(!repeat)return;n=0}if(n<0)n=queue.length-1}play(n)}
au.addEventListener('play',ui);au.addEventListener('pause',ui);
au.addEventListener('ended',()=>{if(repeat===2){au.currentTime=0;au.play().catch(()=>{})}else next(1)});
au.addEventListener('timeupdate',()=>{if(au.duration)$('#mu-r').value=Math.round(au.currentTime/au.duration*1000);$('#mu-cu').textContent=fmt(au.currentTime);$('#mu-du').textContent=fmt(au.duration)});
$('#mu-r').addEventListener('input',e=>{if(au.duration)au.currentTime=au.duration*e.target.value/1000});
$('#mu-pp').onclick=()=>{if(au.paused)au.play().catch(()=>{});else au.pause()};
$('#mu-prev').onclick=()=>{if(au.currentTime>3)au.currentTime=0;else next(-1)};$('#mu-next').onclick=()=>next(1);
$('#mu-shuf').onclick=e=>{shuffle=!shuffle;e.currentTarget.setAttribute('aria-pressed',shuffle);e.currentTarget.classList.toggle('on',shuffle)};
$('#mu-rep').onclick=e=>{repeat=(repeat+1)%3;const b=e.currentTarget;b.setAttribute('aria-pressed',repeat>0);b.classList.toggle('on',repeat>0);b.textContent=repeat===2?'⟲1':'⟲'};
$('#mu-x').onclick=()=>{au.pause();au.removeAttribute('src');au.load();bar.classList.add('hidden');document.body.classList.remove('mu-on');idx=-1;ui();view.querySelectorAll('.mu-row.playing').forEach(r=>r.classList.remove('playing'))};
document.addEventListener('play',e=>{if(e.target&&e.target.id==='video'&&!au.paused)au.pause()},true);
function ms(){const t=cur();if(!t||!('mediaSession' in navigator))return;try{navigator.mediaSession.metadata=new MediaMetadata({title:t.title,artist:t.artist||'Cineo',album:t.album||'Cineo Music',artwork:t.hasCover?[{src:cover(t),sizes:'512x512'}]:[]});
  navigator.mediaSession.setActionHandler('play',()=>au.play());navigator.mediaSession.setActionHandler('pause',()=>au.pause());navigator.mediaSession.setActionHandler('previoustrack',()=>next(-1));navigator.mediaSession.setActionHandler('nexttrack',()=>next(1))}catch{}}

/* ---------- الصفحة ---------- */
const shown=()=>{const s=q.trim().toLowerCase();return s?tracks.filter(t=>[t.title,t.artist,t.album,t.genre].some(x=>String(x||'').toLowerCase().includes(s))):tracks};
function head(){return `<div class="section-head"><div><h2>${E(T('الموسيقى','Music','Музыка'))}</h2><p>${E(T('استمع وحمّل وشارك','Listen, download and share','Слушайте, скачивайте и делитесь'))}</p></div>${tracks.length?`<button class="primary-btn" id="mu-all" type="button">▶ ${E(T('تشغيل الكل','Play all','Играть все'))}</button>`:''}</div>${tracks.length>5?`<div class="search-box mu-search"><input id="mu-q" type="search" placeholder="${E(T('ابحث بالعنوان أو الفنان…','Search title or artist…','Поиск по названию или исполнителю…'))}" value="${E(q)}" aria-label="search"></div>`:''}`}
function rows(){const l=shown();if(!l.length)return `<div class="mu-empty glass"><p>${E(tracks.length?T('لا نتائج.','No results.','Нет результатов.'):T('لا توجد موسيقى منشورة بعد.','No music published yet.','Музыка пока не опубликована.'))}</p></div>`;
  return `<div class="mu-list">${l.map(t=>`<div class="mu-row glass" data-id="${E(t.id)}"><button type="button" class="mu-cv" data-a="play" aria-label="${E(t.title)}">${t.hasCover?`<img src="${cover(t)}" alt="" loading="lazy">`:ph()}<i class="mu-play">▶</i></button><div class="mu-info"><b>${E(t.title)}</b><small>${E(t.artist||'—')}${t.genre?' · '+E(t.genre):''}${t.duration?' · '+fmt(t.duration):''}</small></div><div class="mu-acts"><button type="button" class="icon-btn" data-a="share" aria-label="${E(T('مشاركة','Share','Поделиться'))}" title="${E(T('مشاركة','Share','Поделиться'))}">🔗</button>${t.allowDownload?`<a class="icon-btn" href="/api/music/${E(t.id)}/download" download aria-label="${E(T('تحميل','Download','Скачать'))}" title="${E(T('تحميل','Download','Скачать'))}">⬇</a>`:''}</div></div>`).join('')}</div>`}
function draw(){view.innerHTML=head()+`<div id="mu-rows">${rows()}</div>`;bind();ui()}
function bind(){
  const all=$('#mu-all');if(all)all.onclick=()=>{queue=shown().slice();play(0)};
  const sq=$('#mu-q');if(sq)sq.oninput=()=>{q=sq.value;$('#mu-rows').innerHTML=rows();bind();ui()};
  view.querySelectorAll('.mu-row').forEach(r=>{const id=r.dataset.id;
    r.querySelector('[data-a="play"]').onclick=()=>{const t=cur();if(t&&t.id===id){au.paused?au.play().catch(()=>{}):au.pause();return}queue=shown().slice();play(queue.findIndex(x=>x.id===id))};
    r.querySelector('[data-a="share"]').onclick=async()=>{const url=location.origin+'/?track='+id;try{if(navigator.share){await navigator.share({title:(tracks.find(x=>x.id===id)||{}).title,url});return}}catch(e){if(e&&e.name==='AbortError')return}
      try{await navigator.clipboard.writeText(url);toast(T('نُسخ الرابط','Link copied','Ссылка скопирована'))}catch{prompt(T('الرابط','Link','Ссылка'),url)}}})}
async function load(){
  view.innerHTML=head()+`<div class="mu-empty"><p>${E(T('جارٍ التحميل…','Loading…','Загрузка…'))}</p></div>`;
  try{const r=await fetch('/api/music',{cache:'no-cache'});tracks=r.ok?await r.json():[];loaded=true}catch{tracks=[]}draw();
  const want=new URLSearchParams(location.search).get('track');if(want&&tracks.some(t=>t.id===want)){const row=view.querySelector(`.mu-row[data-id="${want}"]`);if(row){row.classList.add('mu-hl');row.scrollIntoView({block:'center'})}}}
document.addEventListener('tabchange',e=>{if(e.detail==='music')load()});
document.addEventListener('langchange',()=>{if(!view.classList.contains('hidden'))draw()});
{const w=new URLSearchParams(location.search).get('track');if(w&&/^[a-f0-9]{16}$/.test(w))setTimeout(()=>{try{switchTab('music')}catch{}},700)}
})();
