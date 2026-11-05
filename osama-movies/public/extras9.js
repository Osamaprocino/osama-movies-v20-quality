/* extras9.js — الإصدار 17: «مساعد أسامة» (ذكاء محلي بلا API) + جولة ترحيب للمستخدم الجديد */
(function(){
const $=s=>document.querySelector(s);const esc=s=>escapeHtml(String(s==null?'':s));
const lg=()=>I18N.lang();const T=(a,e,r)=>lg()==='en'?e:lg()==='ru'?r:a;
async function ask(q){
  const r=await fetch('/api/assist',{method:'POST',headers:{'Content-Type':'application/json','X-Lang':lg()},body:JSON.stringify({q})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'error');return d;
}
let panel=null,hist=[];
const MD=()=>{try{return typeof moviesData!=='undefined'?moviesData:[]}catch{return[]}};
function playMovie(id){const mv=MD().find(x=>x.id===id);if(mv&&typeof openPlayer==='function'){if(panel)panel.classList.add('hidden');const sp=$('#search-panel');sp&&sp.classList.add('hidden');openPlayer(mv);return}location.href='/?movie='+encodeURIComponent(id)}
function learnClick(q,id){try{fetch('/api/assist/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q,id}),keepalive:true})}catch{}}
function smartSearch(){
  const inp=$('#search-input'),sp=$('#search-panel');if(!inp||!sp||$('#smart-res'))return;
  const box=document.createElement('div');box.id='smart-res';box.className='smart-res hidden';sp.appendChild(box);let tm,seq=0;
  inp.addEventListener('input',()=>{clearTimeout(tm);const q=inp.value.trim();if(q.length<2){box.classList.add('hidden');box.innerHTML='';return}
    tm=setTimeout(async()=>{const my=++seq;try{const d=await fetch('/api/assist/search?q='+encodeURIComponent(q),{headers:{'X-Lang':lg()}}).then(r=>r.json());if(my!==seq)return;
      if(!d.items||(!d.items.length&&!d.didYouMean)){box.classList.add('hidden');return}
      let h=`<div class="sm-h"><b>✨ ${esc(T('بحث ذكي','Smart search','Умный поиск'))}</b>${(d.notes||[]).map(n=>`<span class="sm-n">${esc(n)}</span>`).join('')}</div>`;
      if(d.didYouMean)h+=`<button type="button" class="sm-dym" data-q="${esc(d.didYouMean)}">${esc(T('هل تقصد','Did you mean','Возможно'))}: «${esc(d.didYouMean)}»؟</button>`;
      h+=`<div class="sm-row">${d.items.map(m=>`<button type="button" class="sm-card" data-id="${esc(m.id)}"><img src="${esc(m.posterUrl)}" alt="" loading="lazy"><b>${esc(m.title)}</b><small>${esc((m.why||[]).join(' • '))}</small></button>`).join('')}</div>`;
      box.innerHTML=h;box.classList.remove('hidden');
      box.onclick=e=>{const dy=e.target.closest('.sm-dym');if(dy){inp.value=dy.dataset.q;inp.dispatchEvent(new Event('input'));return}
        const c=e.target.closest('.sm-card');if(!c)return;learnClick(q,c.dataset.id);playMovie(c.dataset.id)};
    }catch{}},420)});
}
function bubble(cls,html){const l=$('#as-log');if(!l)return;l.insertAdjacentHTML('beforeend',`<div class="as-b ${cls}">${html}</div>`);l.scrollTop=l.scrollHeight}
function render(d){
  let h=`<p>${esc(d.text)}</p>`;
  if(d.movies&&d.movies.length)h+=`<div class="as-mv">${d.movies.map(m=>`<a class="as-card" data-q="${esc(d.q||'')}" data-id="${esc(m.id)}" href="/?movie=${encodeURIComponent(m.id)}"><img src="${esc(m.posterUrl)}" alt="" loading="lazy"><b>${esc(m.title)}</b><small>${esc(m.category||'')}${m.year?' • '+esc(m.year):''}${m.isPaid?' • 💳':''}</small>${m.why&&m.why.length?`<small class="as-why">${esc(m.why[0])}</small>`:''}</a>`).join('')}</div>`;
  if(d.chips&&d.chips.length)h+=`<div class="as-chips">${d.chips.map(c=>`<button type="button" class="as-chip">${esc(c)}</button>`).join('')}</div>`;
  bubble('bot',h);
  if(d.action&&d.action.type==='play'){learnClick(d.q||'',d.action.id);setTimeout(()=>playMovie(d.action.id),700)}
}
async function send(q){
  q=String(q||'').trim();if(!q)return;bubble('me',`<p>${esc(q)}</p>`);
  bubble('bot as-typing','<span></span><span></span><span></span>');
  try{const d=await ask(q);$('.as-typing')?.remove();render(d)}catch(e){$('.as-typing')?.remove();bubble('bot',`<p>${esc(e.message)}</p>`)}
}
function open(){
  if(panel){panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))$('#as-in').focus();return}
  panel=document.createElement('div');panel.className='as-panel';panel.id='as-panel';
  panel.innerHTML=`<div class="as-head"><i data-lucide="sparkles"></i><div><b>${esc(T('مساعد أسامة','Osama Assistant','Помощник Осамы'))}</b><small>${esc(T('يعمل محلياً بدون إنترنت خارجي','Runs locally, no external AI','Работает локально, без внешнего ИИ'))}</small></div><button type="button" id="as-x" aria-label="x"><i data-lucide="x"></i></button></div>
   <div class="as-log" id="as-log"></div>
   <form class="as-form" id="as-form" autocomplete="off"><input id="as-in" maxlength="300" placeholder="${esc(T('اسأل أو ابحث عن فيلم…','Ask or search a movie…','Спросите или найдите фильм…'))}"><button class="primary-btn" type="submit" aria-label="send"><i data-lucide="send"></i></button></form>`;
  document.body.appendChild(panel);
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){const mic=document.createElement('button');mic.type='button';mic.className='as-mic';mic.setAttribute('aria-label','mic');mic.textContent='🎤';
    panel.querySelector('#as-form').insertBefore(mic,panel.querySelector('#as-form button'));
    mic.onclick=()=>{try{const r=new SR();r.lang=lg()==='en'?'en-US':lg()==='ru'?'ru-RU':'ar-SA';r.interimResults=false;mic.classList.add('on');
      r.onresult=e=>{const t=e.results[0][0].transcript;mic.classList.remove('on');send(t)};r.onerror=r.onend=()=>mic.classList.remove('on');r.start()}catch{mic.classList.remove('on')}}}
  panel.querySelector('#as-x').onclick=()=>panel.classList.add('hidden');
  panel.querySelector('#as-form').onsubmit=e=>{e.preventDefault();const i=$('#as-in');const v=i.value;i.value='';send(v)};
  panel.addEventListener('click',e=>{const c=e.target.closest('.as-chip');if(c)send(c.textContent);const k=e.target.closest('.as-card');if(k){e.preventDefault();if(k.dataset.q)learnClick(k.dataset.q,k.dataset.id);playMovie(k.dataset.id)}});
  if(window.lucide)lucide.createIcons();
  ask('').then(render).catch(()=>{});$('#as-in').focus();
}
function fab(){
  if($('#as-fab'))return;
  const b=document.createElement('button');b.type='button';b.id='as-fab';b.className='as-fab';b.setAttribute('aria-label','assistant');
  b.innerHTML='<i data-lucide="sparkles"></i>';b.onclick=open;document.body.appendChild(b);if(window.lucide)lucide.createIcons();
}
/* ---------- جولة الترحيب (مرة واحدة) ---------- */
const STEPS=()=>[
 {sel:null,t:T('أهلاً بك في سينما أسامة 🎬','Welcome to Osama Cinema 🎬','Добро пожаловать 🎬'),d:T('جولة سريعة (20 ثانية) تعرّفك على أهم الميزات.','A quick 20-second tour of the main features.','Короткий тур по главным возможностям.')},
 {sel:'#search-open',t:T('البحث','Search','Поиск'),d:T('ابحث عن أي فيلم بالاسم أو التصنيف أو الممثل.','Find any movie by title, genre or actor.','Ищите фильмы по названию, жанру или актёру.')},
 {sel:'#nav-look',t:T('المظهر','Appearance','Оформление'),d:T('اختر ثيماً جاهزاً (iOS 27 وغيره) أو خصّص الألوان والزجاجية.','Pick a ready theme (iOS 27 and more) or customize colours and glass.','Готовые темы (iOS 27 и др.) и настройка цвета и стекла.')},
 {sel:'#nav-studio',t:T('استوديو القناة','Channel studio','Студия канала'),d:T('انشر أفلامك، وابدأ بثاً مباشراً، وتابع إحصاءاتك.','Publish movies, go live and track your stats.','Публикуйте фильмы, ведите эфиры, следите за статистикой.')},
 {sel:'#as-fab',t:T('مساعد أسامة ✨','Osama Assistant ✨','Помощник ✨'),d:T('اطلب اقتراح فيلم أو اسأل عن الدفع والنشر والتوثيق.','Ask for a movie suggestion or about payments, publishing and verification.','Попросите посоветовать фильм или спросите об оплате и публикации.')}];
function tour(force){
  try{if(!force&&localStorage.getItem('osama_tour'))return}catch{}
  const steps=STEPS();let i=0;
  const ov=document.createElement('div');ov.className='tr-ov';document.body.appendChild(ov);
  const done=()=>{ov.remove();document.querySelector('.tr-hl')?.classList.remove('tr-hl');try{localStorage.setItem('osama_tour','1')}catch{}};
  const show=()=>{
    document.querySelector('.tr-hl')?.classList.remove('tr-hl');
    const s=steps[i],el=s.sel&&$(s.sel),vis=el&&el.getClientRects().length>0;
    if(vis)el.classList.add('tr-hl');
    ov.innerHTML=`<div class="tr-card"><b>${esc(s.t)}</b><p>${esc(s.d)}</p><div class="tr-act"><button type="button" class="secondary-btn" id="tr-skip">${esc(T('تخطي','Skip','Пропустить'))}</button><span>${i+1}/${steps.length}</span><button type="button" class="primary-btn" id="tr-next">${esc(i===steps.length-1?T('ابدأ','Start','Начать'):T('التالي','Next','Далее'))}</button></div></div>`;
    ov.querySelector('#tr-skip').onclick=done;ov.querySelector('#tr-next').onclick=()=>{if(++i>=steps.length)done();else show()};
  };
  show();
}
function init(){fab();smartSearch();setTimeout(()=>{if(!document.querySelector('#ex-modal'))tour()},2500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.Cinema9={open,tour:()=>tour(true)};
})();
