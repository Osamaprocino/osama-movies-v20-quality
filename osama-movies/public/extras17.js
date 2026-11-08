/* v20 — معاينة سريعة (تحويم على سطح المكتب)، زر صعود بحلقة تقدّم، اهتزاز خفيف في الهاتف، تلميح تثبيت التطبيق */
(()=>{const root=document.documentElement;const L=()=>{try{return (window.I18N&&I18N.lang&&I18N.lang())||root.lang||'ar'}catch{return 'ar'}};
const T3=(a,e,r)=>({ar:a,en:e,ru:r})[L()]||a;const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const calm=()=>root.classList.contains('no-motion');
/* 1) معاينة سريعة */
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
if(fine){let pk,tm,cur;
 const build=()=>{if(pk)return;pk=document.createElement('div');pk.className='pk';pk.setAttribute('role','tooltip');document.body.appendChild(pk);
  pk.addEventListener('mouseenter',()=>clearTimeout(tm));pk.addEventListener('mouseleave',hide)};
 const hide=()=>{clearTimeout(tm);tm=setTimeout(()=>{if(pk)pk.classList.remove('on');cur=null},120)};
 const find=id=>(typeof moviesData!=='undefined'&&Array.isArray(moviesData))?moviesData.find(m=>String(m.id)===String(id)):null;
 document.addEventListener('mouseover',e=>{const c=e.target.closest&&e.target.closest('.movie-card[data-movie]');if(!c||c.closest('#cp'))return;if(c===cur)return;clearTimeout(tm);
  tm=setTimeout(()=>{const m=find(c.dataset.movie);if(!m||(!m.description&&!m.rating))return;build();cur=c;
   const meta=[m.year,m.category&&(typeof catLabel==='function'?catLabel(m.category):m.category),m.duration].filter(Boolean).map(esc).join(' · ');
   pk.innerHTML='<h5>'+esc(m.title)+'</h5><div class="pk-m">'+(m.rating?'<span class="pk-r">★ '+esc(m.rating)+'</span>':'')+'<span>'+meta+'</span></div>'+(m.description?'<p>'+esc(m.description)+'</p>':'')+'<div class="pk-b"><button class="pk-play" type="button">▶ '+T3('شاهد','Play','Смотреть')+'</button><button class="pk-save" type="button">🔖 '+T3('حفظ','Save','Сохранить')+'</button></div>';
   pk.querySelector('.pk-play').onclick=()=>{pk.classList.remove('on');window.openPlayer&&openPlayer(m)};
   pk.querySelector('.pk-save').onclick=()=>{try{window.toggleSave&&toggleSave(m)}catch{}};
   const r=c.getBoundingClientRect(),w=300,h=pk.offsetHeight||190;let x=r.left+r.width/2-w/2;x=Math.max(10,Math.min(innerWidth-w-10,x));let y=r.bottom+10;if(y+h>innerHeight-10)y=Math.max(10,r.top-h-10);
   pk.style.left=x+'px';pk.style.top=y+'px';pk.classList.add('on')},520)});
 document.addEventListener('mouseout',e=>{const c=e.target.closest&&e.target.closest('.movie-card[data-movie]');if(c&&!(e.relatedTarget&&(c.contains(e.relatedTarget)||(pk&&pk.contains(e.relatedTarget)))))hide()});
 addEventListener('scroll',()=>{if(pk&&pk.classList.contains('on')){pk.classList.remove('on');cur=null}},{passive:true})}
/* 2) زر العودة للأعلى بحلقة تقدّم */
const b=document.createElement('button');b.className='btt';b.type='button';b.setAttribute('aria-label',T3('إلى أعلى الصفحة','Back to top','Наверх'));
b.innerHTML='<svg viewBox="0 0 46 46"><circle class="t" cx="23" cy="23" r="20"/><circle class="p" cx="23" cy="23" r="20"/></svg><i></i>';document.body.appendChild(b);
const ring=b.querySelector('.p');let tk=0;
const upd=()=>{tk=0;const h=document.documentElement.scrollHeight-innerHeight,y=scrollY;b.classList.toggle('on',y>500);ring.style.strokeDashoffset=(125.7*(1-(h>0?Math.min(1,y/h):0))).toFixed(1)};
addEventListener('scroll',()=>{if(!tk)tk=requestAnimationFrame(upd)},{passive:true});upd();
b.onclick=()=>scrollTo({top:0,behavior:calm()?'auto':'smooth'});
/* 3) اهتزاز خفيف عند لمس شريط التنقل (هواتف تدعمه فقط) */
document.addEventListener('click',e=>{if(!calm()&&navigator.vibrate&&e.target.closest&&e.target.closest('.bottom-nav button'))try{navigator.vibrate(8)}catch{}},true);
/* 4) تلميح تثبيت التطبيق (آيفون: إرشاد؛ أندرويد: زر تثبيت) — يظهر مرة، بعد الزيارة الثانية، ويمكن إغلاقه */
const standalone=matchMedia('(display-mode:standalone)').matches||navigator.standalone;
const st=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch{return null}};
if(!standalone&&!st('osama_ins_done')){const visits=(+st('osama_visits')||0)+1;st('osama_visits',String(visits));
 let ev=null;const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;
 const show=async()=>{if(document.querySelector('.ins')||visits<2||st('osama_ins_done'))return;let nm='Cineo';try{nm=(await (await fetch('/manifest.webmanifest')).json()).short_name||nm}catch{}if(document.querySelector('.ins'))return;const d=document.createElement('div');d.className='ins';
  d.innerHTML='<img src="/app-icon/192.png" alt=""><div style="flex:1"><b>'+T3('ثبّت '+nm+' كتطبيق','Install '+nm+' as an app','Установите '+nm)+'</b><span>'+(ios?T3('اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».','Tap Share, then “Add to Home Screen”.','Нажмите «Поделиться» → «На экран Домой».'):T3('أسرع وأسهل وبملء الشاشة.','Faster, full-screen, one tap away.','Быстрее и на весь экран.'))+'</span></div>'+(ev?'<button class="go" type="button">'+T3('تثبيت','Install','Установить')+'</button>':'')+'<button class="x" type="button" aria-label="close">✕</button>';
  document.body.appendChild(d);const done=()=>{st('osama_ins_done','1');d.remove()};d.querySelector('.x').onclick=done;const g=d.querySelector('.go');if(g)g.onclick=async()=>{try{ev.prompt();await ev.userChoice}catch{}done()}};
 addEventListener('beforeinstallprompt',e=>{ev=e;setTimeout(show,4000)});if(ios)setTimeout(show,5000);
 addEventListener('appinstalled',()=>st('osama_ins_done','1'))}
})();
