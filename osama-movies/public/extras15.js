/* v20 refined polish — all effects skip under no-motion / reduced-motion */
(()=>{const root=document.documentElement;
const calm=()=>root.classList.contains('no-motion')||matchMedia('(prefers-reduced-motion:reduce)').matches;
// header condenses with a soft shadow after scrolling
const tb=document.querySelector('.topbar');let tk=0;
const hero=()=>document.querySelector('.hero #hero-poster img');
function onScroll(){if(tk)return;tk=requestAnimationFrame(()=>{tk=0;const y=scrollY;if(tb)tb.classList.toggle('fx15-scrolled',y>12);
 if(!calm()){const h=hero();if(h&&y<900){h.style.setProperty('--py',(y*0.18).toFixed(1)+'px');h.style.setProperty('--ps',(1.06+Math.min(y,600)/6000).toFixed(3))}}})}
addEventListener('scroll',onScroll,{passive:true});onScroll();
// blur-up for poster images as they load
function bu(img){if(img.dataset.fx15||calm())return;img.dataset.fx15='1';if(img.complete&&img.naturalWidth)return;img.classList.add('fx15-bu');
 const done=()=>requestAnimationFrame(()=>img.classList.add('fx15-in'));img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true})}
// accent rule under section titles when they scroll into view
const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('fx15-on');io.unobserve(e.target)}}),{threshold:.6}):null;
function scan(r){(r||document).querySelectorAll('.movie-card .poster img').forEach(bu);if(io)(r||document).querySelectorAll('.section-head h2').forEach(t=>{if(!t.dataset.fx15t){t.dataset.fx15t='1';io.observe(t)}else if(!io)t.classList.add('fx15-on')});if(!io)document.querySelectorAll('.section-head h2').forEach(t=>t.classList.add('fx15-on'))}
scan();new MutationObserver(m=>{for(const x of m)for(const n of x.addedNodes)if(n.nodeType===1)scan(n)}).observe(document.body,{childList:true,subtree:true});
})();
