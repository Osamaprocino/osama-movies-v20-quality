/* extras22.js — v21: «الاشتراكات» في الشريط السفلي بدل «الإدارة» (الإدارة باقية في القائمة الجانبية وأعلى الشاشة).
   تعرض القنوات التي يتابعها المستخدم + آخر الفيديوهات المنشورة منها. */
(function(){
const $=s=>document.querySelector(s);
const lg=()=>{try{return I18N.lang()}catch{return 'ar'}};
const T=(a,e,r)=>lg()==='en'?e:lg()==='ru'?r:a;
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=$('main.content');if(!main)return;
try{const D=I18N.dict;const k='nav.subs',v=['الاشتراكات','Following','Подписки'];D.ar[k]=v[0];D.en[k]=v[1];D.ru[k]=v[2];I18N.apply&&I18N.apply()}catch{}
if(!$('#subs-view'))main.insertAdjacentHTML('beforeend','<section class="view hidden" id="subs-view"></section>');
const view=$('#subs-view');let me=false,busy=0;
const ava=u=>u.avatarUrl?`<img src="${E(u.avatarUrl)}" alt="" loading="lazy">`:`<b>${E((u.displayName||u.username||'?').trim().charAt(0).toUpperCase())}</b>`;
const ago=d=>{try{const m=Math.max(1,Math.round((Date.now()-Date.parse(d))/60000));const f=new Intl.RelativeTimeFormat(lg(),{numeric:'auto'});if(m<60)return f.format(-m,'minute');if(m<1440)return f.format(-Math.round(m/60),'hour');return f.format(-Math.round(m/1440),'day')}catch{return ''}};
function head(){return `<div class="section-head"><div><h2>${E(T('الاشتراكات','Following','Подписки'))}</h2><p>${E(T('القنوات التي تتابعها وآخر ما نشرته','Channels you follow and what they posted','Каналы, на которые вы подписаны, и их новые видео'))}</p></div></div>`}
function empty(msg,btn){return head()+`<div class="sb-empty glass"><p>${E(msg)}</p>${btn||''}</div>`}
async function load(){
  if(busy)return;busy=1;view.innerHTML=head()+`<div class="sb-empty"><p>${E(T('جارٍ التحميل…','Loading…','Загрузка…'))}</p></div>`;
  try{
    const r=await fetch('/api/user/following',{cache:'no-store'});
    if(r.status===401){view.innerHTML=empty(T('سجّل الدخول لتتابع القنوات وترى جديدها هنا.','Sign in to follow channels and see their new videos here.','Войдите, чтобы подписываться на каналы и видеть их новые видео.'),`<button class="primary-btn" id="sb-login" type="button">${E(T('تسجيل الدخول','Sign in','Войти'))}</button>`);
      const b=$('#sb-login');if(b)b.onclick=()=>{try{openAuth('login')}catch{}};return}
    const d=await r.json();if(!r.ok)throw new Error(d.error||'error');
    if(!d.channels.length){view.innerHTML=empty(T('لا تتابع أي قناة بعد. افتح قناة من Shorts واضغط «متابعة».','You do not follow any channel yet. Open a channel from Shorts and tap Follow.','Вы пока ни на кого не подписаны. Откройте канал из Shorts и нажмите «Подписаться».'));return}
    view.innerHTML=head()+`<div class="sb-chans" role="list">${d.channels.map(c=>`<button type="button" class="sb-chan" role="listitem" data-u="${E(c.username)}"><span class="avatar">${ava(c)}</span><span class="sb-n">${E(c.displayName)}</span><small>${E(c.count)}</small></button>`).join('')}</div>`+
    (d.videos.length?`<div class="sb-grid">${d.videos.map(v=>`<article class="sb-card glass" data-id="${E(v.id)}" tabindex="0" role="button" aria-label="${E(v.caption||'')}"><div class="sb-th">${v.posterUrl?`<img src="${E(v.posterUrl)}" alt="" loading="lazy">`:`<video src="${E(v.videoUrl)}#t=0.5" preload="metadata" muted playsinline></video>`}<i class="sb-play">▶</i></div><div class="sb-meta"><b>${E(v.caption||'—')}</b><small>@${E(v.author.username)} · ${E(ago(v.createdAt))}</small></div></article>`).join('')}</div>`:`<div class="sb-empty"><p>${E(T('لم تنشر القنوات التي تتابعها فيديوهات بعد.','The channels you follow have not posted yet.','Каналы пока ничего не опубликовали.'))}</p></div>`);
    const byId=new Map(d.videos.map(v=>[v.id,v]));
    view.querySelectorAll('.sb-chan').forEach(b=>b.onclick=()=>{try{Extras.openChannel(b.dataset.u)}catch{}});
    const play=el=>{const v=byId.get(el.dataset.id);if(!v)return;try{Extras.modal(`<div class="sb-player"><video src="${E(v.videoUrl)}" controls autoplay playsinline></video><p><b>${E(v.caption||'')}</b></p><small>@${E(v.author.username)}</small></div>`,{cls:'sb-modal'})}catch{}};
    view.querySelectorAll('.sb-card').forEach(c=>{c.onclick=()=>play(c);c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play(c)}}});
  }catch(x){view.innerHTML=empty(x.message||'error')}finally{busy=0}
}
document.addEventListener('tabchange',e=>{if(e.detail==='subs')load()});
document.addEventListener('langchange',()=>{if(!view.classList.contains('hidden'))load()});
/* زر الشريط السفلي: لا يوجد #subs-view في switchTab لو لم يُنشأ، لذا أنشأناه أعلاه */
})();
