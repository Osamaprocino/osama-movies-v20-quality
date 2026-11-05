/* لوحة الإدارة — إعدادات الموقع وقناته + البث المباشر (v14) */
(function(){
const $$=s=>document.querySelector(s);const E=s=>escapeHtml(String(s==null?'':s));
const post=(u,b,m='POST')=>api(u,{method:m,headers:{'Content-Type':'application/json'},body:b===undefined?undefined:JSON.stringify(b)});
const upl=(u,field,file)=>{const fd=new FormData();fd.append(field,file);return api(u,{method:'POST',body:fd})};
const SECTIONS=`
<section class="admin-section hidden" id="section-sitecfg"><div class="page-title"><div><h1>إعدادات الموقع وقناته</h1><p>الاسم والرابط والصورة والبانر للقناة الرسمية، وتحكم بنشر المستخدمين.</p></div></div>
<div class="panel-grid">
 <section class="panel"><div class="panel-title"><h2>القناة الرسمية</h2></div>
  <div id="sc-banner" style="height:130px;border-radius:18px;background:linear-gradient(135deg,#3478f6,#8b5cf6) center/cover;position:relative;margin-bottom:10px"></div>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><img id="sc-ava" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;background:#3478f6">
   <label class="secondary-admin" style="cursor:pointer">صورة القناة<input type="file" id="sc-afile" accept="image/jpeg,image/png,image/webp" hidden></label>
   <label class="secondary-admin" style="cursor:pointer">البانر<input type="file" id="sc-bfile" accept="image/jpeg,image/png,image/webp" hidden></label>
   <button class="secondary-admin" id="sc-arm" type="button">حذف الصورة</button><button class="secondary-admin" id="sc-brm" type="button">حذف البانر</button></div>
  <div class="mini-form"><label style="flex:1">اسم القناة<input id="sc-name" maxlength="40"></label><label style="flex:1">رابط القناة<input id="sc-handle" dir="ltr" maxlength="24" placeholder="osama"></label></div>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">النبذة<textarea id="sc-bio" rows="3" maxlength="200" style="width:100%;border:1px solid var(--line);border-radius:13px;padding:10px"></textarea></label>
  <p class="hint" id="sc-link"></p><button class="primary-admin" id="sc-save" type="button">حفظ</button></section>
 <section class="panel"><div class="panel-title"><h2>نشر المستخدمين</h2></div>
  <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="sc-pub"><span>السماح للمستخدمين بنشر أفلام طويلة</span></label>
  <p class="hint">عند الإيقاف يختفي زر «انشر فيلماً» ويرفض الخادم أي رفع. المراجعة المسبقة تُضبط من قسم «أفلام المستخدمين».</p>
  <button class="primary-admin" id="sc-pub-save" type="button">حفظ</button></section>
</div></section>
<section class="admin-section hidden" id="section-live"><div class="page-title"><div><h1>البث المباشر</h1><p>ابدأ بثاً من الكاميرا أو الشاشة مباشرة من المتصفح؛ يظهر للزوار فوراً ويصل مشتركي القناة إشعار.</p></div></div>
<section class="panel"><div class="mini-form"><label style="flex:2">عنوان البث<input id="lv-title" maxlength="120" placeholder="مثال: عرض أول لفيلم الأسبوع"></label>
 <label>المصدر<select id="lv-src"><option value="cam">الكاميرا + الميكروفون</option><option value="screen">الشاشة (+ صوت التبويب)</option></select></label></div>
 <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="primary-admin" id="lv-go" type="button">بدء البث</button><button class="danger-btn" id="lv-stop" type="button" disabled>إيقاف البث</button></div>
 <p class="hint" id="lv-state">غير مباشر.</p>
 <video id="lv-prev" muted playsinline autoplay style="width:100%;max-width:560px;border-radius:16px;background:#000;margin-top:8px"></video>
 <p class="hint">يعمل بثّ المتصفح على Chrome / Edge / Firefox (حاسوب أو أندرويد). أبقِ هذه الصفحة مفتوحة طوال البث. الجودة 720p تقريباً 1.2 ميغابت/ث لكل مشاهد؛ انتبه لحصة الباندويث.</p></section>
<section class="panel" style="margin-top:14px"><div class="panel-title"><h2>بث أصحاب القنوات</h2></div>
 <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ul-on"><span>السماح لأصحاب الحسابات بالبث المباشر</span></label>
 <div class="mini-form"><label>أقصى مشاهدين لكل بث<input id="ul-max" type="number" min="5" max="2000"></label><button class="primary-admin" id="ul-save" type="button">حفظ</button></div>
 <div class="mini-form"><label style="flex:1">منع مستخدم من البث (اسم المستخدم)<input id="ul-user" dir="ltr"></label><button class="secondary-admin" id="ul-block" type="button">منع</button><button class="secondary-admin" id="ul-unblock" type="button">رفع المنع</button></div>
 <p class="hint" id="ul-blocked"></p><h3 style="margin:12px 0 6px;font-size:14px">البثوث الجارية الآن</h3><div id="ul-list" style="display:grid;gap:8px"></div><button class="secondary-admin" id="ul-refresh" type="button" style="margin-top:8px">تحديث</button></section></section>
<section class="admin-section hidden" id="section-verify"><div class="page-title"><div><h1>التوثيق ✓</h1><p>اعتمد طلبات التوثيق أو امنح العلامة مباشرة. تظهر بجانب الاسم والصورة والقناة.</p></div></div>
<section class="panel" style="margin-bottom:14px"><div class="panel-title"><h2>الدفع عبر شام كاش</h2></div>
<p class="hint">يُثبَّت هذا الحساب تلقائياً على بطاقات الدفع كلها (الأفلام المدفوعة والباقات والتوثيق) ويستطيع المستخدم نسخه وإرسال رقم الإيصال (6–14 رقماً). دفعات التوثيق تظهر في قسم «المدفوعات» للموافقة.</p>
<div class="mini-form"><label style="flex:2">حساب شام كاش<input id="pc-acc" dir="ltr"></label><label>سعر التوثيق (0 = بدون دفع، طلب عادي)<input id="pc-price" type="number" min="0"></label><label>العملة<select id="pc-cur"><option value="SYP">ل.س</option><option value="USD">$</option></select></label><button class="primary-admin" id="pc-save" type="button">حفظ</button></div></section>
<div class="panel-grid"><section class="panel"><div class="panel-title"><h2>الطلبات المعلّقة</h2></div><label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="vf-sub"><span>يشترط الاشتراك في إحدى الباقات (يُستعمل فقط حين يكون سعر التوثيق 0)</span></label><button class="primary-admin" id="vf-save" type="button" style="margin:8px 0">حفظ</button><div id="vf-reqs" style="display:grid;gap:8px"></div></section>
<section class="panel"><div class="panel-title"><h2>الحسابات الموثّقة</h2></div><div class="mini-form"><label style="flex:1">اسم المستخدم<input id="vf-user" dir="ltr"></label><button class="primary-admin" id="vf-grant" type="button">توثيق</button><button class="secondary-admin" id="vf-revoke" type="button">سحب التوثيق</button></div><div id="vf-list" style="display:grid;gap:8px;margin-top:10px"></div></section></div></section>
<section class="admin-section hidden" id="section-security"><div class="page-title"><div><h1>الحساب والأمان</h1><p>غيّر كلمة مرور لوحة التحكم.</p></div></div>
<section class="panel" style="max-width:520px"><div class="mini-form" style="display:grid;gap:10px"><label>كلمة المرور الحالية<input id="pw-cur" type="password" autocomplete="current-password"></label><label>كلمة المرور الجديدة (10 أحرف فأكثر)<input id="pw-new" type="password" autocomplete="new-password"></label><label>تأكيد كلمة المرور الجديدة<input id="pw-new2" type="password" autocomplete="new-password"></label></div>
<p class="hint">بعد التغيير تُغلق جلسات الإدارة الأخرى المفتوحة على أجهزة ثانية، وتبقى جلستك الحالية.</p><button class="primary-admin" id="pw-save" type="button">تغيير كلمة المرور</button></section></section>`;
const PICK=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'];
let sess=null;
async function loadSite(){
  try{const [c,s]=await Promise.all([api('/api/admin/site-channel'),api('/api/admin/site-settings')]);
   $$('#sc-name').value=c.name||'';$$('#sc-handle').value=c.handle||'';$$('#sc-bio').value=c.bio||'';
   $$('#sc-ava').src=c.avatarUrl||'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#3478f6"/></svg>');
   $$('#sc-banner').style.backgroundImage=c.bannerUrl?`url('${c.bannerUrl}')`:'';
   $$('#sc-link').textContent=c.handle?`${location.origin}/c/${c.handle}`:'لم يُحدَّد رابط بعد.';$$('#sc-pub').checked=s.userPublish;
  }catch(e){toast(e.message,'error')}
}
async function run(fn,msg='تم'){try{await fn();toast(msg);loadSite()}catch(e){toast(e.message,'error')}}
async function loadVerify(){
  try{const [d,pc]=await Promise.all([api('/api/admin/verification'),api('/api/admin/payment-settings')]);$$('#vf-sub').checked=d.requireSub;$$('#pc-acc').value=pc.account||'';$$('#pc-price').value=pc.verifyPrice||0;$$('#pc-cur').value=pc.verifyCurrency||'SYP';
   $$('#vf-reqs').innerHTML=d.requests.length?d.requests.map(r=>`<div class="rank"><div><strong>@${E(r.username)}</strong><small>${r.sub?'مشترك':'غير مشترك'} · ${new Date(r.createdAt).toLocaleDateString('ar')}${r.note?' — '+E(r.note):''}</small></div><div class="row-actions"><button class="primary-admin" data-vo="${E(r.id)}|approve" type="button">قبول</button><button class="danger-btn" data-vo="${E(r.id)}|reject" type="button">رفض</button></div></div>`).join(''):'<div class="empty-inline">لا توجد طلبات معلّقة.</div>';
   $$('#vf-list').innerHTML=d.verified.length?d.verified.map(v=>`<div class="rank"><div><strong>@${E(v.username)} <span style="color:#3b82f6">✓</span></strong><small>${new Date(v.at).toLocaleDateString('ar')}</small></div></div>`).join(''):'<div class="empty-inline">لا توجد حسابات موثّقة.</div>';
   document.querySelectorAll('[data-vo]').forEach(b=>b.onclick=()=>{const [id,a]=b.dataset.vo.split('|');post(`/api/admin/verification/${encodeURIComponent(id)}/${a}`).then(()=>{toast('تم');loadVerify()}).catch(e=>toast(e.message,'error'))});
  }catch(e){toast(e.message,'error')}
}
async function loadLives(){
  try{const [d,k]=await Promise.all([api('/api/admin/lives'),api('/api/admin/site-settings')]);
   $$('#ul-on').checked=k.userLive!==false;$$('#ul-max').value=k.maxViewers||100;
   $$('#ul-blocked').textContent=d.blocked.length?'الممنوعون من البث: '+d.blocked.join('، '):'';
   $$('#ul-list').innerHTML=d.items.length?d.items.map(l=>`<div class="rank"><div><strong>${E(l.title)}</strong><small>${l.owner?'@'+E(l.owner.username):'الإدارة'} · ${l.viewers} يشاهدون</small></div><button class="danger-btn" data-end="${E(l.id)}" type="button">إنهاء</button></div>`).join(''):'<div class="empty-inline">لا توجد بثوث جارية.</div>';
   document.querySelectorAll('[data-end]').forEach(b=>b.onclick=async()=>{try{await post(`/api/admin/live/${encodeURIComponent(b.dataset.end)}/stop`);toast('أُنهي البث');loadLives()}catch(e){toast(e.message,'error')}});
  }catch(e){toast(e.message,'error')}
}
function recordOnce(stream,mime,ms){return new Promise(res=>{const parts=[];let rec;try{rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1200000,audioBitsPerSecond:96000})}catch{res(null);return}
  rec.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};rec.onstop=()=>res(new Blob(parts,{type:mime}));rec.start();setTimeout(()=>{if(rec.state!=='inactive')rec.stop()},ms)})}
async function startLive(){
  const mime=PICK.find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m));
  if(!mime){toast('هذا المتصفح لا يدعم البث (استعمل Chrome أو Edge أو Firefox).','error');return}
  let stream;
  try{ if($$('#lv-src').value==='screen'){stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:true});try{const mic=await navigator.mediaDevices.getUserMedia({audio:true});mic.getAudioTracks().forEach(t=>stream.addTrack(t))}catch{}}
       else stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:true}); }
  catch(e){toast('تعذّر الوصول للكاميرا/الشاشة: '+e.message,'error');return}
  let info;try{info=await post('/api/admin/live/start',{title:$$('#lv-title').value,mime})}catch(e){stream.getTracks().forEach(t=>t.stop());toast(e.message,'error');return}
  const prev=$$('#lv-prev');prev.srcObject=stream;
  sess={id:info.id,stream,stop:false,n:0,t0:Date.now(),chain:Promise.resolve()};
  $$('#lv-go').disabled=true;$$('#lv-stop').disabled=false;
  stream.getVideoTracks().forEach(t=>t.addEventListener('ended',stopLive));
  (async()=>{
    while(sess&&!sess.stop){
      const blob=await recordOnce(stream,mime,2000);if(!blob||!blob.size)continue;
      const s=sess;if(!s)break;
      s.chain=s.chain.then(()=>fetch(`/api/admin/live/${s.id}/seg`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob}).then(r=>r.json()).then(d=>{s.n=d.n||s.n;s.viewers=d.viewers||0}).catch(()=>{}));
    }
  })();
  sess.timer=setInterval(()=>{if(!sess)return;const sec=Math.floor((Date.now()-sess.t0)/1000);$$('#lv-state').textContent=`🔴 مباشر منذ ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')} — ${sess.viewers||0} يشاهدون — ${sess.n} مقطعاً`},1000);
  toast('بدأ البث');
}
async function stopLive(){
  const s=sess;if(!s)return;s.stop=true;sess=null;clearInterval(s.timer);
  s.stream.getTracks().forEach(t=>t.stop());$$('#lv-prev').srcObject=null;
  try{await s.chain;await post(`/api/admin/live/${s.id}/stop`)}catch{}
  $$('#lv-go').disabled=false;$$('#lv-stop').disabled=true;$$('#lv-state').textContent='انتهى البث.';toast('أُوقف البث');
}
function inject(){
  const main=document.querySelector('.admin-main')||document.body;main.insertAdjacentHTML('beforeend',SECTIONS);
  const nav=document.querySelector('.admin-nav');
  nav.insertAdjacentHTML('beforeend','<button data-section="sitecfg" type="button"><i data-lucide="settings"></i><span>إعدادات الموقع وقناته</span></button><button data-section="live" type="button"><i data-lucide="radio"></i><span>بث مباشر</span></button><button data-section="verify" type="button"><i data-lucide="badge-check"></i><span>التوثيق</span></button><button data-section="security" type="button"><i data-lucide="key-round"></i><span>كلمة المرور</span></button>');
  nav.querySelector('[data-section="security"]').onclick=()=>showSection('security');nav.querySelector('[data-section="verify"]').onclick=()=>showSection('verify');
  nav.querySelector('[data-section="sitecfg"]').onclick=()=>showSection('sitecfg');nav.querySelector('[data-section="live"]').onclick=()=>showSection('live');
  $$('#sc-save').onclick=()=>run(()=>post('/api/admin/site-channel',{name:$$('#sc-name').value,handle:$$('#sc-handle').value,bio:$$('#sc-bio').value},'PUT'),'تم الحفظ');
  $$('#sc-afile').onchange=e=>e.target.files[0]&&run(()=>upl('/api/admin/site-channel/avatar','avatar',e.target.files[0]),'تم رفع الصورة');
  $$('#sc-bfile').onchange=e=>e.target.files[0]&&run(()=>upl('/api/admin/site-channel/banner','banner',e.target.files[0]),'تم رفع البانر');
  $$('#sc-arm').onclick=()=>run(()=>api('/api/admin/site-channel/avatar',{method:'DELETE'}));$$('#sc-brm').onclick=()=>run(()=>api('/api/admin/site-channel/banner',{method:'DELETE'}));
  $$('#sc-pub-save').onclick=()=>run(()=>post('/api/admin/site-settings',{userPublish:$$('#sc-pub').checked},'PUT'),'تم الحفظ');
  $$('#pw-save').onclick=async()=>{const a=$$('#pw-cur').value,b=$$('#pw-new').value,c=$$('#pw-new2').value;
    if(b!==c){toast('التأكيد لا يطابق كلمة المرور الجديدة','error');return}
    try{await post('/api/admin/password',{current:a,next:b});toast('تم تغيير كلمة المرور');['#pw-cur','#pw-new','#pw-new2'].forEach(i=>$$(i).value='')}catch(e){toast(e.message,'error')}};
  $$('#ul-save').onclick=()=>run(()=>post('/api/admin/site-settings',{userLive:$$('#ul-on').checked,maxViewers:Number($$('#ul-max').value)||100},'PUT'),'تم الحفظ').then(loadLives);
  const blk=b=>run(()=>post('/api/admin/live/block',{username:$$('#ul-user').value.trim(),blocked:b}),b?'تم المنع':'رُفع المنع').then(loadLives);
  $$('#ul-block').onclick=()=>blk(true);$$('#ul-unblock').onclick=()=>blk(false);$$('#ul-refresh').onclick=loadLives;
  $$('#pc-save').onclick=()=>post('/api/admin/payment-settings',{account:$$('#pc-acc').value.trim(),verifyPrice:Number($$('#pc-price').value)||0,verifyCurrency:$$('#pc-cur').value},'PUT').then(()=>toast('تم الحفظ')).catch(e=>toast(e.message,'error'));
  $$('#vf-save').onclick=()=>post('/api/admin/verification/settings',{requireSub:$$('#vf-sub').checked},'PUT').then(()=>toast('تم الحفظ')).catch(e=>toast(e.message,'error'));
  const vu=g=>post('/api/admin/verification-user',{username:$$('#vf-user').value.trim(),verified:g}).then(()=>{toast(g?'تم التوثيق':'سُحب التوثيق');loadVerify()}).catch(e=>toast(e.message,'error'));
  $$('#vf-grant').onclick=()=>vu(true);$$('#vf-revoke').onclick=()=>vu(false);
  $$('#lv-go').onclick=startLive;$$('#lv-stop').onclick=stopLive;
  if(window.lucide)lucide.createIcons();
}
inject();
const _show=window.showSection;
window.showSection=function(name){_show.apply(this,arguments);if(name==='sitecfg')loadSite();if(name==='live')loadLives();if(name==='verify')loadVerify()};
})();
