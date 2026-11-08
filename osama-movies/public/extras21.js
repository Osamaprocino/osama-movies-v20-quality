/* extras21.js — v20.2: قوائم مشاركة بالرابط • وضع توفير البيانات اليدوي • مؤثرات اختيارية (انتقال البطاقة، مطاطية Shorts،
   تعتيم السينما، نقرة صوتية خفيفة) مع مفاتيح تشغيل من لوحة المدير (للجميع) ومن «المظهر» (للزائر). إضافة فقط. */
(function(){
const root=document.documentElement,$=s=>document.querySelector(s);
const rd=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const wr=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const lg=()=>{try{return I18N.lang()}catch{return 'ar'}};
const T=(a,e,r)=>lg()==='en'?e:lg()==='ru'?r:a;
async function api(url,method='GET',body){const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'error');e.status=r.status;throw e}return d}
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calm=()=>root.classList.contains('no-motion')||matchMedia('(prefers-reduced-motion:reduce)').matches;
const DEF={cardexpand:true,rubber:true,cinemadim:true,clicksound:false,cursor:true,sparkles:false};
let fx={...DEF},site={};
function loadFx(){site=rd('osama_fx_site')||{};const u=rd('osama_fx')||{};const allow=site.allowUserCustom!==false;fx={...DEF,...site,...(allow?u:{})};
  root.classList.toggle('fxoff-cursor',fx.cursor===false);if(!fx.cinemadim)root.classList.remove('cinema')}
loadFx();window.addEventListener('osama:fx-changed',loadFx);
fetch('/api/site-ui',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.fx){wr('osama_fx_site',d.fx);loadFx()}}).catch(()=>{});
window.OsamaFx={get:()=>({...fx}),set(k,v){const u=rd('osama_fx')||{};u[k]=v;wr('osama_fx',u);window.dispatchEvent(new Event('osama:fx-changed'))}};

/* ---------- 1) وضع توفير البيانات اليدوي ---------- */
const dsOn=()=>localStorage.getItem('osama_ds')==='1';
function applyDS(){const on=(()=>{try{return dsOn()}catch{return false}})();root.classList.toggle('data-saver',on);
  try{if(on)Object.defineProperty(navigator,'connection',{get:()=>({saveData:true,effectiveType:'3g',downlink:1,addEventListener(){},removeEventListener(){}}),configurable:true});else if(Object.getOwnPropertyDescriptor(navigator,'connection'))delete navigator.connection}catch{}}
applyDS();

/* ---------- 2) نقرة صوتية خفيفة (افتراضياً مطفأة) ---------- */
let ac=null;
document.addEventListener('click',e=>{if(!fx.clicksound||!e.isTrusted)return;const t=e.target.closest&&e.target.closest('button,.movie-card,.nav-item,a[href]');if(!t)return;
  try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();const o=ac.createOscillator(),g=ac.createGain(),n=ac.currentTime;o.type='sine';o.frequency.setValueAtTime(880,n);o.frequency.exponentialRampToValueAtTime(520,n+.05);g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.05,n+.008);g.gain.exponentialRampToValueAtTime(.0001,n+.07);o.connect(g).connect(ac.destination);o.start(n);o.stop(n+.08)}catch{}},true);

/* ---------- 3) انتقال البطاقة إلى صفحة الفيلم (غلاف يكبر ثم يتلاشى؛ لا يعترض النقرة الأصلية) ---------- */
document.addEventListener('click',e=>{
  if(!fx.cardexpand||calm()||!e.isTrusted||!Element.prototype.animate)return;
  const c=e.target.closest&&e.target.closest('.movie-card');if(!c||c.closest('#shared-list-view'))return;
  const im=c.querySelector('.poster img');if(!im||!im.complete||!im.naturalWidth)return;
  const r=im.getBoundingClientRect();if(r.width<20||r.bottom<0||r.top>innerHeight)return;
  const o=document.createElement('div');o.className='fx21-fly';o.setAttribute('aria-hidden','true');
  o.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background-image:url("${im.currentSrc||im.src}")`;document.body.appendChild(o);
  const vw=innerWidth,vh=innerHeight,s=Math.max(vw/r.width,vh/r.height)*1.02,dx=vw/2-(r.left+r.width/2),dy=vh/2-(r.top+r.height/2);
  const a=o.animate([{transform:'none',opacity:.95,borderRadius:'14px'},{transform:`translate(${dx}px,${dy}px) scale(${s})`,opacity:0,borderRadius:'0px'}],{duration:480,easing:'cubic-bezier(.3,.7,.2,1)',fill:'forwards'});
  a.onfinish=a.oncancel=()=>o.remove();setTimeout(()=>o.remove(),900)},true);

/* ---------- 4) مطاطية السحب العمودي في Shorts ---------- */
function rubber(){const f=$('#shorts-feed');if(!f||f.dataset.rb)return;f.dataset.rb='1';
  let y0=null,dy=0;const edge=d=>(d>0&&f.scrollTop<=0)||(d<0&&f.scrollTop+f.clientHeight>=f.scrollHeight-2);
  const back=()=>{f.style.transition='transform .55s cubic-bezier(.3,1.6,.4,1)';f.style.transform='';dy=0;setTimeout(()=>{f.style.transition=''},600)};
  f.addEventListener('touchstart',e=>{y0=e.touches.length===1?e.touches[0].clientY:null;dy=0;f.style.transition=''},{passive:true});
  f.addEventListener('touchmove',e=>{if(y0==null||!fx.rubber||calm())return;const d=e.touches[0].clientY-y0;if(!edge(d)&&!dy)return;dy=d;const k=Math.sign(d)*Math.min(90,Math.abs(d)*.35);f.style.transform=`translateY(${k}px)`},{passive:true});
  const end=()=>{if(dy)back();y0=null};f.addEventListener('touchend',end,{passive:true});f.addEventListener('touchcancel',end,{passive:true});
  let wt=0;f.addEventListener('wheel',e=>{if(!fx.rubber||calm()||!edge(-e.deltaY))return;const k=Math.sign(e.deltaY)*-14;f.style.transition='transform .12s ease-out';f.style.transform=`translateY(${k}px)`;clearTimeout(wt);wt=setTimeout(back,120)},{passive:true})}

/* ---------- 5) تعتيم السينما حول المشغّل ---------- */
function cinema(){const v=$('#video');if(!v||v.dataset.cn)return;v.dataset.cn='1';
  const on=()=>{if(fx.cinemadim&&!calm()&&!v.paused&&$('#player-view')&&!$('#player-view').classList.contains('hidden'))root.classList.add('cinema')};
  const off=()=>root.classList.remove('cinema');
  v.addEventListener('play',on);v.addEventListener('playing',on);v.addEventListener('pause',off);v.addEventListener('ended',off);v.addEventListener('emptied',off);
  const pv=$('#player-view');if(pv)new MutationObserver(()=>{if(pv.classList.contains('hidden'))off()}).observe(pv,{attributes:true,attributeFilter:['class']})}

/* ---------- 6) قوائم مشاركة ---------- */
async function shareList(pid){
  try{const lib=await api('/api/user/library');const p=(lib.playlists||[]).find(x=>x.id===pid);if(!p||!p.items.length){toast(T('القائمة فارغة','The list is empty','Список пуст'),'info');return}
  const d=await api('/api/user/shares','POST',{name:p.name,ids:p.items});const url=location.origin+d.url;
    let done=false;if(navigator.share){try{await navigator.share({title:p.name,url});done=true}catch(x){if(x&&x.name==='AbortError')return}}
    if(!done){try{await navigator.clipboard.writeText(url);toast(T('نُسخ رابط القائمة','List link copied','Ссылка скопирована'))}catch{prompt(T('رابط القائمة','List link','Ссылка'),url)}}
  }catch(x){toast(x.message,'error')}
}
async function manageShares(){
  if(!window.Extras||!Extras.modal)return;let list=[];try{list=await api('/api/user/shares')}catch(x){toast(x.message,'error');return}
  const el=Extras.modal(`<h3><i data-lucide="link"></i> ${E(T('قوائمي المشاركة','My shared lists','Мои общие списки'))}</h3>${list.length?`<div class="fx21-shares">${list.map(s=>`<div class="fx21-sh" data-t="${E(s.token)}"><div><b>${E(s.name)}</b><small>${E(s.count)} · ${E(new Date(s.createdAt).toLocaleDateString(I18N.numLocale()))}</small></div><button type="button" class="ghost-btn" data-copy><i data-lucide="copy"></i></button><button type="button" class="ghost-btn danger-ghost" data-rev><i data-lucide="link-2-off"></i><span>${E(T('إلغاء الرابط','Revoke','Отозвать'))}</span></button></div>`).join('')}</div>`:`<p class="lib-empty">${E(T('لا توجد روابط مشاركة.','No shared links.','Нет общих ссылок.'))}</p>`}`,{cls:'pub-card'});
  if(!el)return;try{icons()}catch{}
  el.querySelectorAll('.fx21-sh').forEach(r=>{const t=r.dataset.t;
    r.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/?list='+t);toast(T('نُسخ الرابط','Link copied','Ссылка скопирована'))}catch{}};
    r.querySelector('[data-rev]').onclick=async()=>{try{await api('/api/user/shares/'+t,'DELETE');r.remove();toast(T('أُلغي الرابط','Link revoked','Ссылка отозвана'))}catch(x){toast(x.message,'error')}}})
}
function decorateLib(){const v=$('#library-view');if(!v)return;
  v.querySelectorAll('.lib-card:not([data-shr])').forEach(c=>{c.dataset.shr='1';const tools=c.querySelector('.lib-tools');if(!tools||!c.querySelector('.lib-grid'))return;
    const b=document.createElement('button');b.type='button';b.className='ghost-btn';b.innerHTML=`<i data-lucide="share-2"></i><span>${E(T('مشاركة','Share','Поделиться'))}</span>`;b.onclick=()=>shareList(c.dataset.pid);tools.prepend(b)});
  const h=v.querySelector('.section-head');if(h&&!h.querySelector('#fx21-mine')){const m=document.createElement('button');m.id='fx21-mine';m.type='button';m.className='ghost-btn';m.innerHTML=`<i data-lucide="link"></i><span>${E(T('روابطي','My links','Мои ссылки'))}</span>`;m.onclick=manageShares;h.appendChild(m)}
  try{icons()}catch{}}
async function openShared(tok){
  let d;try{const r=await fetch('/api/shared/'+encodeURIComponent(tok));d=await r.json();if(!r.ok)throw new Error(d.error||'error')}catch(x){try{toast(x.message,'error')}catch{}return}
  const v=document.createElement('div');v.id='shared-list-view';v.className='fx21-shared';v.setAttribute('role','dialog');v.setAttribute('aria-modal','true');
  v.innerHTML=`<div class="fx21-shared-in"><div class="section-head"><div><h2>${E(d.name)}</h2><p>${E(T('قائمة مشاركة','Shared list','Общий список'))}${d.owner?' · @'+E(d.owner):''} · ${E(d.movies.length)}</p></div><div class="fx21-acts"><button class="primary-btn" id="sl-save" type="button"><i data-lucide="bookmark-plus"></i><span>${E(T('احفظها عندي','Save to mine','Сохранить себе'))}</span></button><button class="ghost-btn" id="sl-close" type="button" aria-label="${E(T('إغلاق','Close','Закрыть'))}"><i data-lucide="x"></i></button></div></div>${d.movies.length?'<div class="movie-grid" id="sl-grid"></div>':`<p class="lib-empty">${E(T('لا توجد أفلام متاحة في هذه القائمة.','No available movies in this list.','В списке нет доступных фильмов.'))}</p>`}</div>`;
  document.body.appendChild(v);if(d.movies.length)renderMovies(d.movies,'#sl-grid');try{icons()}catch{}
  const close=()=>{v.remove();try{const u=new URL(location.href);u.searchParams.delete('list');history.replaceState(null,'',u)}catch{}};
  v.querySelector('#sl-close').onclick=close;v.addEventListener('click',e=>{if(e.target===v)close()});
  v.querySelectorAll('.movie-card').forEach(c=>c.addEventListener('click',()=>setTimeout(()=>v.remove(),0),true));
  addEventListener('keydown',function k(e){if(e.key==='Escape'){close();removeEventListener('keydown',k)}});
  v.querySelector('#sl-save').onclick=async()=>{try{if(typeof requireLogin==='function'&&!requireLogin())return;const st=await api('/api/user/playlists','POST',{name:d.name});const pl=st.playlists[st.playlists.length-1];for(const m of d.movies.slice().reverse())await api(`/api/user/playlists/${pl.id}/items`,'POST',{movieId:m.id});toast(T('حُفظت في مكتبتك','Saved to your library','Сохранено в вашей библиотеке'))}catch(x){toast(x.message,'error')}}
}

/* ---------- 7) قسم المؤثرات + توفير البيانات داخل «المظهر» ---------- */
const ROWS=[['cardexpand','انتقال البطاقة إلى الفيلم','Card-to-movie transition','Переход карточки'],['rubber','مطاطية سحب Shorts','Shorts rubber-band swipe','Резиновый свайп Shorts'],['cinemadim','تعتيم السينما أثناء التشغيل','Cinema dim while playing','Затемнение при просмотре'],['clicksound','نقرة صوتية خفيفة','Subtle click sound','Тихий звук нажатия'],['cursor','توهّج المؤشر','Cursor glow','Свечение курсора'],['sparkles','لمعات المؤشر','Cursor sparkles','Искры курсора']];
function lookSection(){const s=document.createElement('div');s.className='look-sec fx21-look';
  s.innerHTML=`<b>${E(T('المؤثرات','Effects','Эффекты'))}</b>`+ROWS.map(([k,a,e,r])=>`<label class="look-row"><span>${E(T(a,e,r))}</span><input type="checkbox" data-fx="${k}" ${fx[k]?'checked':''}></label>`).join('')+`<label class="look-row"><span>${E(T('توفير البيانات','Data saver','Экономия трафика'))}</span><input type="checkbox" id="fx21-ds" ${dsOn()?'checked':''}></label><small class="fx21-hint">${E(T('يخفّض جودة الفيديو تلقائياً ويوقف المعاينات المتحركة.','Lowers video quality automatically and stops animated previews.','Снижает качество видео и отключает анимированные превью.'))}</small>`;
  s.querySelectorAll('[data-fx]').forEach(i=>i.onchange=()=>OsamaFx.set(i.dataset.fx,i.checked));
  s.querySelector('#fx21-ds').onchange=e=>{try{localStorage.setItem('osama_ds',e.target.checked?'1':'0')}catch{}applyDS();try{toast(T(e.target.checked?'فُعّل توفير البيانات':'أُوقف توفير البيانات',e.target.checked?'Data saver on':'Data saver off',e.target.checked?'Экономия включена':'Экономия выключена'),'info')}catch{}};
  return s}
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;
  const th=n.matches&&n.matches('.look-themes')?n:(n.querySelector&&n.querySelector('.look-themes'));
  if(th){const card=th.closest('.modal-card,.pub-card')||th.parentNode.parentNode;if(card&&!card.querySelector('.fx21-look')){const rs=card.querySelector('#lk-reset');const s=lookSection();rs?rs.parentNode.insertBefore(s,rs):card.appendChild(s)}}
  if(n.id==='library-view'||n.querySelector&&n.querySelector('.lib-card'))decorateLib()}
  const lv=$('#library-view');if(lv&&lv.querySelector('.lib-card:not([data-shr])'))decorateLib();
  rubber();cinema()}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>{rubber();cinema();const q=new URLSearchParams(location.search).get('list');if(q&&/^[a-f0-9]{20}$/.test(q))setTimeout(()=>openShared(q),600)});
if(document.readyState!=='loading'){rubber();cinema();const q=new URLSearchParams(location.search).get('list');if(q&&/^[a-f0-9]{20}$/.test(q))setTimeout(()=>openShared(q),600)}
})();
