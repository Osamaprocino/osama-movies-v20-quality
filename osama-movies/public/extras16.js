/* v20 — row arrows, rank numerals, command palette (Ctrl/⌘+K). Additive; respects no-motion. */
(()=>{const L=()=>{try{return (window.I18N&&I18N.lang&&I18N.lang())||document.documentElement.lang||'ar'}catch{return 'ar'}};
const T3=(a,e,r)=>({ar:a,en:e,ru:r})[L()]||a;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---- row arrows + rank numerals ---- */
const CH={l:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',r:'<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'};
function upd(row){const s=row.querySelector('.hrow-scroll');if(!s)return;const max=s.scrollWidth-s.clientWidth-2,x=Math.abs(s.scrollLeft);
 // physical scrollLeft: LTR 0..max ; RTL 0..-max  → can go left/right physically
 const rtl=getComputedStyle(s).direction==='rtl';const left=rtl?(-s.scrollLeft)<max:s.scrollLeft>2;const right=rtl?(-s.scrollLeft)>2:s.scrollLeft<max;
 const bl=row.querySelector('.hr-arrow.l'),br=row.querySelector('.hr-arrow.r');if(bl)bl.classList.toggle('can',left&&max>4);if(br)br.classList.toggle('can',right&&max>4)}
function setup(row){const s=row.querySelector('.hrow-scroll');if(!s)return;
 if(!row.querySelector('.hr-arrow')){['l','r'].forEach(k=>{const b=document.createElement('button');b.type='button';b.className='hr-arrow '+k;b.setAttribute('aria-label',k==='l'?'Scroll left':'Scroll right');b.innerHTML=CH[k];
  b.addEventListener('click',e=>{e.stopPropagation();s.scrollBy({left:(k==='l'?-1:1)*s.clientWidth*.85})});row.appendChild(b)});
  s.addEventListener('scroll',()=>upd(row),{passive:true});addEventListener('resize',()=>upd(row))}
 if(row.dataset.k==='trending')[...row.querySelectorAll('.movie-card')].slice(0,10).forEach((c,i)=>{c.dataset.rank=i+1;const p=c.querySelector('.poster');if(p)p.dataset.rank=i+1});
 setTimeout(()=>upd(row),60);setTimeout(()=>upd(row),600)}
const scan=()=>document.querySelectorAll('.hrow').forEach(setup);
scan();new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,80)}).observe(document.body,{childList:true,subtree:true});
/* ---- command palette ---- */
let box,inp,list,items=[],sel=0;
const ACTIONS=()=>[
 {k:'home',i:'🏠',t:T3('الرئيسية','Home','Главная'),f:()=>window.switchTab&&switchTab('home')},
 {k:'shorts',i:'⚡',t:'Shorts',f:()=>window.switchTab&&switchTab('shorts')},
 {k:'saved',i:'🔖',t:T3('المحفوظات','Saved','Сохранённое'),f:()=>window.switchTab&&switchTab('saved')},
 {k:'history',i:'🕘',t:T3('سجل المشاهدة','History','История'),f:()=>window.switchTab&&switchTab('history')},
 {k:'search',i:'🔎',t:T3('بحث متقدم','Open search','Открыть поиск'),f:()=>{const b=document.getElementById('search-open');if(b)b.click()}},
 {k:'top',i:'⬆️',t:T3('إلى أعلى الصفحة','Scroll to top','Наверх'),f:()=>scrollTo({top:0,behavior:'smooth'})}];
function norm(s){return String(s||'').toLowerCase().normalize('NFKD').replace(/[ً-ٰٟ]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')}
function build(){if(box)return;box=document.createElement('div');box.id='cp';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',T3('لوحة الأوامر','Command palette','Палитра команд'));
 box.innerHTML='<div class="cp-box"><input type="text" autocomplete="off" spellcheck="false" aria-label="search"><div class="cp-list" role="listbox"></div><div class="cp-f"><span><kbd>↑</kbd><kbd>↓</kbd> '+T3('تنقّل','navigate','выбор')+'</span><span><kbd>Enter</kbd> '+T3('فتح','open','открыть')+'</span><span><kbd>Esc</kbd> '+T3('إغلاق','close','закрыть')+'</span></div></div>';
 document.body.appendChild(box);inp=box.querySelector('input');inp.placeholder=T3('ابحث عن فيلم أو اكتب أمراً…','Search movies or type a command…','Фильм или команда…');list=box.querySelector('.cp-list');
 box.addEventListener('mousedown',e=>{if(e.target===box)close()});
 inp.addEventListener('input',()=>render(inp.value));
 inp.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();mv(1)}else if(e.key==='ArrowUp'){e.preventDefault();mv(-1)}else if(e.key==='Enter'){e.preventDefault();run(sel)}else if(e.key==='Escape'){e.preventDefault();close()}});
 list.addEventListener('click',e=>{const el=e.target.closest('.cp-i');if(el)run(+el.dataset.n)});
 list.addEventListener('mousemove',e=>{const el=e.target.closest('.cp-i');if(el&&+el.dataset.n!==sel){sel=+el.dataset.n;paint()}})}
function render(q){const n=norm(q.trim());const ms=(typeof moviesData!=='undefined'&&Array.isArray(moviesData))?moviesData:[];
 let a=ACTIONS();if(n)a=a.filter(x=>norm(x.t).includes(n));
 let m=n?ms.filter(x=>[x.title,x.titleEn,x.titleAr,x.director,x.category,...(x.cast||[]),...(x.tags||[])].some(v=>norm(v).includes(n))):ms.slice().sort((x,y)=>(y.views||0)-(x.views||0));
 m=m.slice(0,8);items=[...m.map(x=>({m:x})),...a.map(x=>({a:x}))];sel=0;
 let h='',i=0;if(m.length){h+='<div class="cp-h">'+T3('أفلام','MOVIES','ФИЛЬМЫ')+'</div>';m.forEach(x=>{h+='<div class="cp-i" role="option" data-n="'+(i++)+'">'+(x.posterUrl?'<img alt="" loading="lazy" src="'+esc(x.posterUrl)+'">':'<span class="ic">🎬</span>')+'<div><b>'+esc(x.title)+'</b><small>'+esc([x.year,x.category].filter(Boolean).join(' · '))+'</small></div></div>'})}
 if(a.length){h+='<div class="cp-h">'+T3('إجراءات','ACTIONS','ДЕЙСТВИЯ')+'</div>';a.forEach(x=>{h+='<div class="cp-i" role="option" data-n="'+(i++)+'"><span class="ic">'+x.i+'</span><div><b>'+esc(x.t)+'</b></div></div>'})}
 if(!items.length)h='<div class="cp-h">'+T3('لا نتائج','NO RESULTS','НЕТ РЕЗУЛЬТАТОВ')+'</div>';list.innerHTML=h;paint()}
function paint(){list.querySelectorAll('.cp-i').forEach(el=>{const on=+el.dataset.n===sel;el.setAttribute('aria-selected',on?'true':'false');if(on)el.scrollIntoView({block:'nearest'})})}
function mv(d){if(!items.length)return;sel=(sel+d+items.length)%items.length;paint()}
function run(n){const it=items[n];if(!it)return;close();setTimeout(()=>{try{if(it.m&&window.openPlayer)openPlayer(it.m);else if(it.a)it.a.f()}catch{}},120)}
function open(){build();box.classList.add('on');inp.value='';render('');setTimeout(()=>inp.focus(),20)}
function close(){if(box)box.classList.remove('on')}
window.CinemaPalette={open,close};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();box&&box.classList.contains('on')?close():open()}else if(e.key==='Escape'&&box&&box.classList.contains('on'))close()});
})();
