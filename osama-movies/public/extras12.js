/* extras12.js — v19.1: شاشة افتتاح قصيرة • توهّج يتبع المؤشر • عدّاد أرقام • خط تحت العناوين • أزرار مغناطيسية • قصاصات احتفال */
(function(){
const root=document.documentElement;
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('no-motion');
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const safe=(f)=>{try{return f()}catch{return null}};

/* 1) شاشة افتتاح مرة واحدة لكل جلسة، لا تحجب الضغط ولا تظهر مع الأتمتة */
if(!reduce()&&!navigator.webdriver&&!safe(()=>sessionStorage.getItem('osama_splash'))){
  safe(()=>sessionStorage.setItem('osama_splash','1'));
  const s=document.createElement('div');s.id='fx-splash';
  s.innerHTML='<div class="fx-s-in"><svg class="fx-s-logo" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="#f5b942" stroke-width="3"/><circle cx="32" cy="32" r="6" fill="#f5b942"/><g fill="#f5b942"><circle cx="32" cy="14" r="5"/><circle cx="32" cy="50" r="5"/><circle cx="14" cy="32" r="5"/><circle cx="50" cy="32" r="5"/></g></svg><div class="fx-s-name">OSAMA CINEMA</div><div class="fx-s-bar"><i></i></div></div>';
  document.body.appendChild(s);setTimeout(()=>s.remove(),2000);
}

/* 2) توهّج ناعم يتبع المؤشر */
if(fine){
  const g=document.createElement('div');g.id='fx-cursor';document.body.prepend(g);let raf=0,x=0,y=0;
  addEventListener('pointermove',e=>{if(reduce())return;x=e.clientX;y=e.clientY;if(!raf)raf=requestAnimationFrame(()=>{raf=0;g.style.transform=`translate3d(${x}px,${y}px,0)`;g.classList.add('on')})},{passive:true});
  document.addEventListener('pointerleave',()=>g.classList.remove('on'),true);
}

/* 3) عدّاد أرقام للإحصاءات (يحسب من القيمة السابقة إلى الجديدة) */
const counters=new WeakMap();
function animateNum(el,to){
  const from=counters.get(el)||0;if(from===to||reduce()){counters.set(el,to);return}
  counters.set(el,to);const t0=performance.now(),dur=700;el.__fxSet=true;
  const step=t=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(to-from)*e);if(k<1)requestAnimationFrame(step);else{el.textContent=to;el.__fxSet=false;el.classList.remove('fx-count');void el.offsetWidth;el.classList.add('fx-count')}};
  requestAnimationFrame(step);
}
function watchNum(el){
  if(!el||el.__fxW)return;el.__fxW=1;
  new MutationObserver(()=>{if(el.__fxSet)return;const n=parseInt((el.textContent||'').replace(/[^\d]/g,''),10);if(!isNaN(n)&&String(n)===el.textContent.trim()){const prev=counters.get(el)||0;if(n!==prev){el.__fxSet=true;el.textContent=prev;requestAnimationFrame(()=>{el.__fxSet=false;animateNum(el,n)})}}})
   .observe(el,{childList:true,characterData:true,subtree:true});
}
['mini-movies','mini-views','mini-saved','movies-count','saved-count'].forEach(id=>watchNum(document.getElementById(id)));

/* 4) خط ملوّن يرسم نفسه تحت عناوين الأقسام عند ظهورها */
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('fx-seen');io.unobserve(e.target)}}),{threshold:.3});
  const scan=()=>document.querySelectorAll('.section-head:not(.fx-w)').forEach(h=>{h.classList.add('fx-w');io.observe(h)});
  scan();new MutationObserver(()=>scan()).observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>document.querySelectorAll('.section-head').forEach(h=>h.classList.add('fx-seen')),3500);
}

/* 5) أزرار مغناطيسية خفيفة */
if(fine){
  let cur=null;
  document.addEventListener('pointermove',e=>{
    if(reduce())return;const b=e.target.closest&&e.target.closest('.primary-btn');
    if(cur&&cur!==b){cur.style.transform='';cur=null}
    if(b&&!b.disabled){const r=b.getBoundingClientRect();b.classList.add('fx-magnet');b.style.transform=`translate(${((e.clientX-r.left)/r.width-.5)*8}px,${((e.clientY-r.top)/r.height-.5)*6}px)`;cur=b}
  },{passive:true});
}

/* 6) قصاصات احتفال عند أول تسجيل/إنشاء حساب ناجح (حدث اختياري يطلقه أي كود: window.dispatchEvent(new Event('osama:celebrate'))) */
window.Cinema12={confetti(n){
  if(reduce())return;n=n||60;const cols=['#f5b942','#ec4899','#8b5cf6','#3478f6','#22c55e'];
  for(let i=0;i<n;i++){const c=document.createElement('i');c.className='fx-confetti';
    c.style.cssText=`left:${Math.random()*100}vw;background:${cols[i%5]};animation-duration:${1.6+Math.random()*1.4}s;animation-delay:${Math.random()*.4}s;--cx:${(Math.random()*160-80)|0}px;--cr:${(Math.random()*720-360)|0}deg`;
    document.body.appendChild(c);setTimeout(()=>c.remove(),3600)}
}};
window.addEventListener('osama:celebrate',()=>window.Cinema12.confetti());
})();
