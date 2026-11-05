/* extras11.js — v19: حركات وتأثيرات (تقدّم التمرير • ظهور تدريجي • ميل البطاقات • تموّج الأزرار • جسيمات خلفية • انتقالات • انفجار الإعجاب • عودة للأعلى) */
(function(){
const root=document.documentElement;
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||root.classList.contains('no-motion');
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const weak=(navigator.deviceMemory&&navigator.deviceMemory<=2)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);
const $=s=>document.querySelector(s);

/* 1) شريط تقدّم التمرير */
const bar=document.createElement('div');bar.id='fx-progress';document.body.appendChild(bar);
const top=document.createElement('button');top.id='fx-top';top.type='button';top.setAttribute('aria-label','top');top.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';document.body.appendChild(top);
let sc=null;
function onScroll(e){
  const el=(e&&e.target&&e.target.scrollHeight&&e.target!==document)?e.target:(document.scrollingElement||document.documentElement);
  const max=el.scrollHeight-el.clientHeight;if(max<=0)return;sc=el;
  bar.style.transform=`scaleX(${Math.min(1,Math.max(0,el.scrollTop/max))})`;
  top.classList.toggle('on',el.scrollTop>700);
}
window.addEventListener('scroll',onScroll,{passive:true,capture:true});
top.onclick=()=>{(sc||document.scrollingElement).scrollTo({top:0,behavior:reduce()?'auto':'smooth'})};

/* 2) ظهور تدريجي للعناصر الجديدة */
const SEL='.movie-card,.section-head,.hero,.profile-card,.channel-card,.short-card';
let io=null;
if('IntersectionObserver' in window)io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){const el=e.target;io.unobserve(el);requestAnimationFrame(()=>{el.classList.add('fx-in');el.classList.remove('fx-pre');setTimeout(()=>{el.classList.remove('fx-in');el.style.removeProperty('--d')},1100)})}},{threshold:.08,rootMargin:'0px 0px -4% 0px'});
function prep(el){
  if(!io||el.__fx||reduce())return;el.__fx=1;
  const sib=el.parentElement?[...el.parentElement.children].indexOf(el):0;el.style.setProperty('--d',Math.min(sib,12)*.045+'s');
  el.classList.add('fx-pre');io.observe(el);
  setTimeout(()=>{if(el.classList.contains('fx-pre')){el.classList.remove('fx-pre');el.classList.add('fx-in');setTimeout(()=>el.classList.remove('fx-in'),900)}},2600); // شبكة أمان
}
function scan(n){if(n.nodeType!==1)return;if(n.matches&&n.matches(SEL))prep(n);n.querySelectorAll&&n.querySelectorAll(SEL).forEach(prep);
  if(n.matches&&n.matches('.poster'))posterLoad(n);n.querySelectorAll&&n.querySelectorAll('.poster').forEach(posterLoad)}
function posterLoad(p){const im=p.querySelector('img');if(!im||p.__pl)return;p.__pl=1;if(im.complete&&im.naturalWidth){p.classList.add('fx-loaded');return}im.addEventListener('load',()=>p.classList.add('fx-loaded'),{once:true});im.addEventListener('error',()=>p.classList.add('fx-loaded'),{once:true})}
document.querySelectorAll(SEL).forEach(prep);document.querySelectorAll('.poster').forEach(posterLoad);
new MutationObserver(ms=>{for(const m of ms){m.addedNodes.forEach(scan);
  if(m.type==='attributes'&&m.attributeName==='class'&&m.target.classList&&m.target.classList.contains('view')&&!m.target.classList.contains('hidden')&&!reduce()){const v=m.target;const was=(m.oldValue||'').split(/\s+/);if(!was.includes('hidden')||v.classList.contains('fx-view-in'))continue;v.classList.remove('fx-view-in');void v.offsetWidth;v.classList.add('fx-view-in');setTimeout(()=>v.classList.remove('fx-view-in'),700)}}})
 .observe(document.body,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});

/* 3) ميل البطاقات + لمعة + توهّج البطل */
if(fine){
  let raf=0,cur=null;
  document.addEventListener('pointermove',e=>{
    if(reduce())return;
    const c=e.target.closest&&e.target.closest('.movie-card');
    if(cur&&cur!==c){cur.classList.remove('fx-tilt');cur.style.removeProperty('--rx');cur.style.removeProperty('--ry');cur=null}
    if(c){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      c.classList.add('fx-tilt');c.style.setProperty('--ry',((x-.5)*12).toFixed(2)+'deg');c.style.setProperty('--rx',((.5-y)*12).toFixed(2)+'deg');
      c.style.setProperty('--mx',(x*100).toFixed(1)+'%');c.style.setProperty('--my',(y*100).toFixed(1)+'%');cur=c})}
    const h=e.target.closest&&e.target.closest('.hero');
    if(h){if(!h.querySelector('.fx-glow'))h.insertAdjacentHTML('afterbegin','<div class="fx-glow"></div>');const r=h.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      h.style.setProperty('--hx',((x+.5)*100)+'%');h.style.setProperty('--hy',((y+.5)*100)+'%');
      const p=h.querySelector('.hero-poster');if(p){p.style.setProperty('--px',(x*-14)+'px');p.style.setProperty('--py',(y*-10)+'px');p.style.setProperty('--pr',(x*3)+'deg')}}
  },{passive:true});
  document.addEventListener('pointerleave',()=>{if(cur){cur.classList.remove('fx-tilt');cur=null}},true);
}

/* 4) تموّج الأزرار */
document.addEventListener('pointerdown',e=>{
  if(reduce())return;const b=e.target.closest&&e.target.closest('.primary-btn,.secondary-btn,.ghost-btn,.filter-row button');if(!b||b.disabled)return;
  const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height)*2,s=document.createElement('span');s.className='fx-rip';
  s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;b.appendChild(s);setTimeout(()=>s.remove(),700);
},{passive:true});

/* 5) انفجار عند الإعجاب/الحفظ */
document.addEventListener('click',e=>{
  if(reduce())return;const b=e.target.closest&&e.target.closest('button');if(!b)return;
  const ic=b.querySelector('svg');const cls=ic?(ic.getAttribute('class')||''):'';
  const emo=/heart/.test(cls)?['❤️','💖','✨']:/bookmark/.test(cls)?['🔖','✨','⭐']:/thumbs-up/.test(cls)?['👍','✨','🎉']:null;if(!emo)return;
  const r=b.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;b.classList.remove('fx-popbtn');void b.offsetWidth;b.classList.add('fx-popbtn');
  for(let i=0;i<8;i++){const s=document.createElement('span');s.className='fx-burst';s.textContent=emo[i%emo.length];const a=Math.PI*2*i/8+Math.random()*.5,d=38+Math.random()*34;
    s.style.cssText=`left:${cx}px;top:${cy}px;--bx:${Math.cos(a)*d}px;--by:${Math.sin(a)*d-14}px;--br:${(Math.random()*80-40)|0}deg`;document.body.appendChild(s);setTimeout(()=>s.remove(),850)}
},true);

/* 6) جسيمات ضوئية في الخلفية (خفيفة، تتوقف مع الحركة المعطّلة/التبويب المخفي/الأجهزة الضعيفة) */
if(!weak&&innerWidth>=700){
  const cv=document.createElement('canvas');cv.id='fx-canvas';document.body.prepend(cv);const g=cv.getContext('2d');let W=0,H=0,P=[],run=false,last=0;
  const rs=()=>{W=cv.width=innerWidth;H=cv.height=innerHeight};rs();addEventListener('resize',rs);
  const cols=['245,185,66','139,92,246','236,72,153','52,120,246'];
  for(let i=0;i<30;i++)P.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2.2+.6,v:Math.random()*.25+.06,a:Math.random()*Math.PI*2,s:Math.random()*.012+.004,c:cols[i%4]});
  function frame(t){
    if(!run)return;requestAnimationFrame(frame);if(t-last<33)return;last=t;g.clearRect(0,0,W,H);
    for(const p of P){p.y-=p.v;p.x+=Math.sin(p.a)*.25;p.a+=p.s;if(p.y<-8){p.y=H+8;p.x=Math.random()*W}
      const al=.25+.35*Math.abs(Math.sin(p.a*2));g.beginPath();g.fillStyle=`rgba(${p.c},${al})`;g.shadowColor=`rgba(${p.c},.8)`;g.shadowBlur=8;g.arc(p.x,p.y,p.r,0,6.283);g.fill()}
  }
  const upd=()=>{const want=!document.hidden&&!reduce();if(want&&!run){run=true;cv.style.display='';requestAnimationFrame(frame)}else if(!want){run=false;cv.style.display='none'}};
  document.addEventListener('visibilitychange',upd);new MutationObserver(upd).observe(root,{attributes:true,attributeFilter:['class']});upd();
}
})();
