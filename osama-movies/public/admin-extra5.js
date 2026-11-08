/* لوحة الإدارة — مساعد الإدارة (v17): ملخص • ما يحتاج مراجعة • تدقيق المحتوى • توليد وصف ووسوم • فاحص نصوص (محلي بلا API) */
(function(){
const $$=s=>document.querySelector(s);const E=s=>escapeHtml(String(s==null?'':s));
const post=(u,b)=>api(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
const SECTION=`<section class="admin-section hidden" id="section-assist"><div class="page-title"><div><h1>مساعد الإدارة</h1><p>ذكاء محلي بلا API ولا تكلفة: يجيب وينفّذ أوامرك بعد تأكيدك — مثل «وافق على الإيصال 123456»، «وثّق المستخدم ahmad»، «امنح المستخدم ahmad اشتراك 30 يوم»، «أنشئ كوبون SAVE20 خصم 20%»، «أوقف نشر المستخدمين»، «احذف فيلم …»، «خذ نسخة احتياطية».</p></div></div>
<div class="panel-grid">
 <section class="panel"><div class="panel-title"><h2>اسأل المساعد أو أعطِه أمراً</h2></div>
  <div id="ai-log" style="min-height:220px;max-height:360px;overflow:auto;display:grid;gap:8px;align-content:start;margin-bottom:10px"></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${['ملخص الموقع','ما يحتاج مراجعة','تدقيق المحتوى','الأكثر مشاهدة','أخذ نسخة احتياطية'.replace('أخذ','خذ'),'آخر العمليات'].map(x=>`<button type="button" class="secondary-admin ai-q">${x}</button>`).join('')}</div>
  <form id="ai-form" class="mini-form" autocomplete="off"><label style="flex:1"><input id="ai-in" maxlength="300" placeholder="اسأل أو أمرني: «وافق على كل أفلام المستخدمين»…"></label><button class="primary-admin" type="submit">إرسال</button></form></section>
 <section class="panel"><div class="panel-title"><h2>اقتراحات المساعد لك الآن</h2></div><div id="ag-sug" class="hint">...</div>
  <div class="panel-title" style="margin-top:14px"><h2>تراجع عن آخر أوامر</h2></div><div id="ag-undo" class="hint">...</div></section>
 <section class="panel"><div class="panel-title"><h2>الطيّار الآلي 🤖</h2></div>
  <p class="hint">يعمل وحده كل 15 دقيقة وأنت مرتاح. لا يقبل دفعات ولا يحذف أي شيء أبداً.</p>
  <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ap-en"><b>تفعيل الطيّار الآلي</b></label>
  <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ap-desc"><span>كتابة وصف للأفلام الناقصة</span></label>
  <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ap-tags"><span>إضافة وسوم مقترحة</span></label>
  <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ap-ver"><span>قبول أفلام المستخدمين الموثّقين تلقائياً</span></label>
  <div style="display:flex;gap:8px;margin-top:8px"><button class="primary-admin" id="ap-save" type="button">حفظ</button><button class="secondary-admin" id="ap-run" type="button">شغّله الآن</button></div><div id="ap-log" class="hint" style="margin-top:8px"></div></section>
 <section class="panel"><div class="panel-title"><h2>ذكاء أقوى (اختياري)</h2></div>
  <p class="hint">لفهم الجمل الحرة بذكاء حقيقي اربط نموذجاً خارجياً متوافقاً مع OpenAI (Groq / OpenRouter / Gemini / Ollama محلي…). يحوّل جملتك إلى أوامر قياسية فقط، وتبقى خطوة موافقتك قائمة. لا يُرسل إليه سوى نص أمرك.</p>
  <div class="mini-form"><label style="flex:2">رابط الخدمة (…/v1)<input id="ll-url" dir="ltr" placeholder="https://api.groq.com/openai/v1"></label><label>النموذج<input id="ll-model" dir="ltr" placeholder="llama-3.3-70b-versatile"></label></div>
  <div class="mini-form"><label style="flex:1">مفتاح الخدمة<input id="ll-key" type="password" dir="ltr" autocomplete="off" placeholder="اتركه فارغاً للإبقاء على المحفوظ"></label></div>
  <label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ll-en"><span>تفعيل</span></label>
  <div style="display:flex;gap:8px;margin-top:8px"><button class="primary-admin" id="ll-save" type="button">حفظ</button><button class="secondary-admin" id="ll-test" type="button">اختبار الاتصال</button></div><p class="hint" id="ll-res"></p></section>
 <section class="panel"><div class="panel-title"><h2>علّم المساعد أوامرك 🎓</h2></div>
  <p class="hint">اربط عبارتك الخاصة بأمر أو عدة أوامر. استخدم <b>*</b> لجزء متغيّر و<b>$1</b> في الأمر. مثال: العبارة «اخف *» ← «احذف فيلم «$1»». أو اكتب في المحادثة: <code>تعلّم: «نظّف الموقع» = ولّد وصفاً للأفلام الناقصة ثم أوقف المراجعة المسبقة</code></p>
  <div class="mini-form"><label style="flex:1">العبارة<input id="mc-p" maxlength="80" placeholder="نظّف الموقع"></label></div>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">الأوامر (افصل بـ «ثم»)<textarea id="mc-c" rows="2" style="width:100%" placeholder="ولّد وصفاً للأفلام الناقصة ثم وافق على كل أفلام المستخدمين المعلقة"></textarea></label>
  <button class="primary-admin" id="mc-save" type="button" style="margin-top:8px">علّمه</button><div id="mc-list" class="hint" style="margin-top:8px"></div></section>
 <section class="panel"><div class="panel-title"><h2>علّم مساعد الزوّار معلوماتك 📚</h2></div>
  <p class="hint">اكتب سؤالاً وجوابه (عن أسعار، مواعيد، سياسة الموقع، أي شيء). المساعد يطابق أسئلة الزوّار بأسلوبهم الخاص ويجيب بما علّمته. الأسئلة التي لم يعرف جوابها تظهر أدناه لتجيب عنها بنقرة.</p>
  <div class="mini-form"><label style="flex:1">السؤال أو كلماته<input id="kb-q" maxlength="200" placeholder="كيف أتواصل معكم؟"></label></div>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">الجواب<textarea id="kb-a" rows="2" style="width:100%" maxlength="1500" placeholder="تواصل معنا عبر واتساب على الرقم ..."></textarea></label>
  <button class="primary-admin" id="kb-save" type="button" style="margin-top:8px">علّمه</button>
  <div class="hint" style="margin-top:10px"><b>أسئلة لم يعرف المساعد جوابها:</b></div><div id="kb-un" class="hint">...</div><div id="kb-list" class="hint" style="margin-top:8px"></div></section>
 <section class="panel"><div class="panel-title"><h2>ماذا يبحث زوّارك؟ 🔎</h2></div>
  <p class="hint">كلمات بحث بلا نتائج — علّم الموقع ماذا تعني فيبحث بها مستقبلاً.</p><div id="si-zero" class="hint">...</div>
  <div class="mini-form"><label>الكلمة<input id="si-w" maxlength="40"></label><label style="flex:2">تعني (افصل بفاصلة)<input id="si-m" maxlength="120" placeholder="كوميدي، مضحك"></label></div>
  <button class="primary-admin" id="si-save" type="button" style="margin-top:8px">علّم البحث</button><div id="si-list" class="hint" style="margin-top:8px"></div>
  <div class="panel-title" style="margin-top:12px"><h2>الأكثر بحثاً</h2></div><div id="si-top" class="hint"></div></section>
 <section class="panel"><div class="panel-title"><h2>توليد وصف ووسوم</h2></div>
  <div class="mini-form"><label style="flex:2">العنوان<input id="ai-t" maxlength="160"></label><label>التصنيف<input id="ai-c" maxlength="60"></label></div>
  <div class="mini-form"><label>السنة<input id="ai-y" maxlength="4" dir="ltr"></label><label style="flex:1">المخرج<input id="ai-d" maxlength="80"></label></div>
  <label class="mini-form" style="display:grid;gap:4px;font-size:11px;font-weight:700">الممثلون (مفصولون بفاصلة)<input id="ai-cast" maxlength="200"></label>
  <button class="primary-admin" id="ai-gen" type="button" style="margin-top:8px">توليد</button>
  <textarea id="ai-out" rows="4" style="width:100%;margin-top:8px" placeholder="سيظهر الوصف المقترح هنا"></textarea><p class="hint" id="ai-tags"></p></section>
 <section class="panel"><div class="panel-title"><h2>فاحص النصوص</h2></div>
  <textarea id="ai-chk" rows="4" style="width:100%" placeholder="الصق تعليقاً أو وصفاً لفحصه (كلمات غير لائقة، روابط، صراخ)"></textarea>
  <button class="secondary-admin" id="ai-chkgo" type="button" style="margin-top:8px">فحص</button><p class="hint" id="ai-chkres"></p></section>
</div></section>`;
function msg(cls,html){const l=$$('#ai-log');l.insertAdjacentHTML('beforeend',`<div style="padding:9px 12px;border-radius:14px;${cls==='me'?'background:var(--accent,#3478f6);color:#fff;justify-self:end':'background:rgba(127,127,127,.14)'};max-width:94%;line-height:1.7">${html}</div>`);l.scrollTop=l.scrollHeight}
const OKURL=/^\/api\/(admin\/|movies\/[\w-]+$)/;
async function runPlan(box,d){
  const btn=box.querySelector('.ag-go'),log=box.querySelector('.ag-log');btn.disabled=true;let okN=0,bad=0;
  for(const st of d.steps){
    if(!OKURL.test(st.url)){bad++;log.insertAdjacentHTML('beforeend',`<div>❌ ${E(st.label)} — مرفوض</div>`);continue}
    try{await api(st.url,{method:st.method,headers:{'Content-Type':'application/json'},body:st.body===undefined?undefined:JSON.stringify(st.body)});okN++;log.insertAdjacentHTML('beforeend',`<div>✅ ${E(st.label)}</div>`)}
    catch(e){bad++;log.insertAdjacentHTML('beforeend',`<div>❌ ${E(st.label)} — ${E(e.message)}</div>`)}
  }
  log.insertAdjacentHTML('beforeend',`<b>انتهى: ${okN} نجح${bad?'، '+bad+' فشل':''}</b>`);
  try{await post('/api/admin/agent/done',{summary:d.summary+` (${okN}/${d.steps.length})`,macroId:d.macroId,undo:d.steps.filter(x=>x.undo).map(x=>x.undo)})}catch{}
  loadUndo();
  box.querySelector('.ag-cancel').remove();
  const l=$$('#ai-log');l.scrollTop=l.scrollHeight;
}
function showPlan(d){
  msg('bot',`<div class="ag-box"><b>${d.danger?'⚠️ ':'🤖 '}${E(d.summary)}</b>${d.note?`<p style="margin:6px 0;color:#b45309">${E(d.note)}</p>`:''}
   <ol style="margin:6px 0;padding-inline-start:20px;max-height:150px;overflow:auto">${d.steps.map(x=>`<li>${E(x.label)}</li>`).join('')}</ol>${d.truncated?'<small>(عُرضت أول 50 خطوة؛ أعد الأمر بعد التنفيذ لإكمال الباقي)</small>':''}
   <div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="${d.danger?'danger-btn':'primary-admin'} ag-go">نفّذ (${d.steps.length})</button><button type="button" class="secondary-admin ag-cancel">إلغاء</button></div><div class="ag-log" style="margin-top:8px;display:grid;gap:3px"></div></div>`);
  const box=[...document.querySelectorAll('#ai-log .ag-box')].pop();
  box.querySelector('.ag-go').onclick=()=>runPlan(box,d);box.querySelector('.ag-cancel').onclick=()=>{box.querySelector('.ag-go').disabled=true;box.querySelector('.ag-cancel').disabled=true;box.insertAdjacentHTML('beforeend','<small>أُلغي.</small>')};
}
async function ask(q){
  if(q)msg('me',E(q));
  if(q){try{const p=await post('/api/admin/agent/plan',{q});
    if(p.understood){showPlan(p);return}
    if(p.learned){msg('bot',E(p.message));loadMacros();return}
    if(p.message){let h=E(p.message);if(p.options&&p.options.length)h+='<ul style="margin:6px 0 0;padding-inline-start:18px">'+p.options.map(x=>`<li>${E(x)}</li>`).join('')+'</ul>';msg('bot',h);return}
  }catch(e){}}
  try{
    if(q){const c=await post('/api/admin/assist/command',{q});
      if(c.plan)return showPlan(c.plan);
      if(c.text)return msg('bot',E(c.text).replace(/\n/g,'<br>'))}
    const d=await post('/api/admin/assist',{q});
    let h=E(d.text).replace(/\n/g,'<br>');
    if(d.items&&d.items.length)h+='<ul style="margin:6px 0 0;padding-inline-start:18px">'+d.items.map(x=>`<li>${E(x.title)} <small style="opacity:.6">— ${E(x.note)}</small></li>`).join('')+'</ul>';
    if(d.links&&d.links.length)h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+d.links.map(l=>`<button type="button" class="secondary-admin ai-go" data-s="${E(l.section)}">${E(l.label)} ←</button>`).join('')+'</div>';
    msg('bot',h)}catch(e){msg('bot',E(e.message))}
}
const lbl=(c,t)=>`<button type="button" class="secondary-admin ai-q" ${c?'data-c="1"':''}>${E(t)}</button>`;
async function loadSug(){try{const d=await api('/api/admin/agent/suggest');$$('#ag-sug').innerHTML=d.items.length?d.items.map(x=>`<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:4px 0"><span>${E(x.text)}</span><button type="button" class="secondary-admin ai-cmd" data-q="${E(x.cmd)}">${x.careful?'راجع ثم نفّذ':'نفّذ'}</button></div>`).join(''):'✅ لا شيء يحتاج انتباهك الآن.'}catch{}}
async function loadUndo(){try{const d=await api('/api/admin/agent/undo');$$('#ag-undo').innerHTML=d.items.length?d.items.slice(0,5).map(x=>`<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin:4px 0"><span>${E(x.summary)}</span><button type="button" class="secondary-admin ag-undo" data-id="${E(x.id)}">تراجع</button></div>`).join(''):'لا شيء للتراجع عنه.';window.__undo=d.items}catch{}}
async function doUndo(id){const it=(window.__undo||[]).find(x=>x.id===id);if(!it)return;let bad=0;for(const st of it.steps){if(!OKURL.test(st.url)){bad++;continue}try{await api(st.url,{method:st.method,headers:{'Content-Type':'application/json'},body:st.body===undefined?undefined:JSON.stringify(st.body)})}catch{bad++}}
  await api('/api/admin/agent/undo/'+id,{method:'DELETE'});toast(bad?'تم التراجع جزئياً':'تم التراجع');loadUndo()}
async function loadAP(){try{const d=await api('/api/admin/autopilot');$$('#ap-en').checked=d.enabled;$$('#ap-desc').checked=d.fillDescriptions;$$('#ap-tags').checked=d.addTags;$$('#ap-ver').checked=d.approveVerified;
  $$('#ap-log').innerHTML=d.log.length?d.log.slice(0,4).map(l=>`<div>${E(new Date(l.at).toLocaleString('ar'))}: ${E(l.did.join('، ')||'لا جديد')} — بانتظارك: ${l.waiting.payments} دفعة، ${l.waiting.userMovies} فيلم، ${l.waiting.verify} توثيق</div>`).join(''):'لم يعمل بعد.';
  const k=await api('/api/admin/agent/llm');$$('#ll-url').value=k.baseUrl||'';$$('#ll-model').value=k.model||'';$$('#ll-en').checked=k.enabled;$$('#ll-key').placeholder=k.hasKey?'•••• محفوظ':'اتركه فارغاً للإبقاء على المحفوظ'}catch{}}
async function loadMacros(){try{const d=await api('/api/admin/agent/learned');$$('#mc-list').innerHTML=d.items.length?d.items.map(x=>`<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin:4px 0"><span><b>${E(x.phrase)}</b> ← ${E(x.commands.join(' ثم '))} <small style="opacity:.6">(${x.uses||0}×)</small></span><button type="button" class="secondary-admin mc-del" data-id="${E(x.id)}">حذف</button></div>`).join(''):'لم تعلّمه شيئاً بعد.'}catch{}}
async function loadKB(){try{const d=await api('/api/admin/assist-kb');
  $$('#kb-un').innerHTML=d.unanswered.length?d.unanswered.map(x=>`<button type="button" class="secondary-admin kb-u" data-q="${E(x.q)}" style="margin:2px">${E(x.q)} (${x.n})</button>`).join(''):'✅ لا شيء.';
  $$('#kb-list').innerHTML=d.items.length?d.items.map(x=>`<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin:4px 0"><span><b>${E(x.q)}</b> ← ${E(x.answer.slice(0,70))}${x.answer.length>70?'…':''} <small style="opacity:.6">(${x.hits||0}×)</small></span><button type="button" class="secondary-admin kb-del" data-id="${E(x.id)}">حذف</button></div>`).join(''):''}catch{}}
async function loadSI(){try{const d=await api('/api/admin/search-insights');
  $$('#si-zero').innerHTML=d.zero.length?d.zero.map(x=>`<button type="button" class="secondary-admin si-z" data-q="${E(x.q)}" style="margin:2px">${E(x.q)} (${x.n})</button>`).join(''):'✅ لا بحث بلا نتائج.';
  $$('#si-list').innerHTML=d.synonyms.length?d.synonyms.map(x=>`<div style="display:flex;gap:8px;justify-content:space-between;margin:3px 0"><span><b>${E(x.word)}</b> = ${E(x.means.join('، '))}</span><button type="button" class="secondary-admin si-del" data-w="${E(x.word)}">حذف</button></div>`).join(''):'';
  $$('#si-top').textContent=d.top.length?d.top.map(x=>`${x.q} (${x.n})`).join(' • '):'لا بيانات بعد.'}catch{}}
function inject(){
  const main=document.querySelector('.admin-main')||document.body;main.insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');nav.insertAdjacentHTML('beforeend','<button data-section="assist" type="button"><i data-lucide="sparkles"></i><span>مساعد الإدارة</span></button>');
  nav.querySelector('[data-section="assist"]').onclick=()=>showSection('assist');
  $$('#ai-form').onsubmit=e=>{e.preventDefault();const i=$$('#ai-in'),v=i.value.trim();i.value='';if(v)ask(v)};
  $$('#section-assist').addEventListener('click',e=>{const q=e.target.closest('.ai-q');if(q)ask(q.textContent);const cm=e.target.closest('.ai-cmd');if(cm)ask(cm.dataset.q);const ku=e.target.closest('.kb-u');if(ku){$$('#kb-q').value=ku.dataset.q;$$('#kb-a').focus()}const kd=e.target.closest('.kb-del');if(kd)api('/api/admin/assist-kb/'+kd.dataset.id,{method:'DELETE'}).then(loadKB);const md=e.target.closest('.mc-del');if(md)api('/api/admin/agent/learned/'+md.dataset.id,{method:'DELETE'}).then(loadMacros);const sd=e.target.closest('.si-del');if(sd)api('/api/admin/search-synonyms/'+encodeURIComponent(sd.dataset.w),{method:'DELETE'}).then(loadSI);const sz=e.target.closest('.si-z');if(sz){$$('#si-w').value=sz.dataset.q;$$('#si-m').focus()}const un=e.target.closest('.ag-undo');if(un)doUndo(un.dataset.id);const g=e.target.closest('.ai-go');if(g)showSection(g.dataset.s);});
  $$('#ap-save').onclick=()=>api('/api/admin/autopilot',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:$$('#ap-en').checked,fillDescriptions:$$('#ap-desc').checked,addTags:$$('#ap-tags').checked,approveVerified:$$('#ap-ver').checked})}).then(()=>toast('تم الحفظ')).catch(e=>toast(e.message,'error'));
  $$('#ap-run').onclick=async()=>{try{const r=await post('/api/admin/autopilot/run',{});toast(r.did.length?r.did.join('، '):'لا جديد للعمل عليه');loadAP();loadSug()}catch(e){toast(e.message,'error')}};
  $$('#ll-save').onclick=()=>api('/api/admin/agent/llm',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({baseUrl:$$('#ll-url').value,model:$$('#ll-model').value,...($$('#ll-key').value?{apiKey:$$('#ll-key').value}:{}),enabled:$$('#ll-en').checked})}).then(()=>{$$('#ll-key').value='';toast('تم الحفظ');loadAP()}).catch(e=>toast(e.message,'error'));
  $$('#ll-test').onclick=async()=>{$$('#ll-res').textContent='...';try{const r=await post('/api/admin/agent/llm/test',{});$$('#ll-res').textContent=r.ok?'✅ يعمل: '+JSON.stringify(r.sample):'❌ لم يستجب بشكل صحيح (تحقق من الرابط/المفتاح/النموذج، أو أن بلدك غير محجوب عن الخدمة)'}catch(e){$$('#ll-res').textContent=e.message}};
  $$('#mc-save').onclick=()=>post('/api/admin/agent/learned',{phrase:$$('#mc-p').value,commands:$$('#mc-c').value}).then(r=>{toast(r.message);$$('#mc-p').value='';$$('#mc-c').value='';loadMacros()}).catch(e=>toast(e.message,'error'));
  $$('#kb-save').onclick=()=>post('/api/admin/assist-kb',{q:$$('#kb-q').value,answer:$$('#kb-a').value}).then(()=>{toast('تعلّم المساعد');$$('#kb-q').value='';$$('#kb-a').value='';loadKB()}).catch(e=>toast(e.message,'error'));
  $$('#si-save').onclick=()=>api('/api/admin/search-synonyms',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:$$('#si-w').value,means:$$('#si-m').value})}).then(()=>{toast('تم التعليم');$$('#si-w').value='';$$('#si-m').value='';loadSI()}).catch(e=>toast(e.message,'error'));
  $$('#ai-gen').onclick=async()=>{try{const d=await post('/api/admin/assist/describe',{title:$$('#ai-t').value,category:$$('#ai-c').value,year:$$('#ai-y').value,director:$$('#ai-d').value,cast:$$('#ai-cast').value.split(/[,،]/).map(x=>x.trim()).filter(Boolean)});
    $$('#ai-out').value=d.description;$$('#ai-tags').textContent=d.tags.length?'وسوم مقترحة: '+d.tags.join('، '):''}catch(e){toast(e.message,'error')}};
  $$('#ai-chkgo').onclick=async()=>{try{const d=await post('/api/admin/assist/check',{text:$$('#ai-chk').value});$$('#ai-chkres').textContent=d.ok?'✅ لا مشاكل ظاهرة.':'⚠️ '+d.warnings.join(' • ')}catch(e){toast(e.message,'error')}};
  if(window.lucide)lucide.createIcons();
}
inject();
const _show=window.showSection;
window.showSection=function(name){_show.apply(this,arguments);try{window.scrollTo({top:0,behavior:'smooth'});const m=document.querySelector('.admin-main');if(m&&m.scrollTo)m.scrollTo({top:0,behavior:'smooth'})}catch{}if(name==='assist'){loadSug();loadUndo();loadAP();loadMacros();loadSI();loadKB();loadKB();if(!$$('#ai-log').children.length)ask('ملخص الموقع')}};
})();
