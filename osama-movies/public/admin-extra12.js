/* لوحة الإدارة — «الموسيقى»: رفع المقاطع، النشر/الإخفاء، السماح بالتحميل، الحذف. ids: mu-* */
(function(){
const $$=s=>document.querySelector(s);
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const J={'Content-Type':'application/json'};
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';
const fmtDur=s=>s?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'—';
const SECTION=`<section class="admin-section hidden" id="section-music"><div class="page-title"><div><h1>الموسيقى</h1><p>ارفع مقاطع صوتية (mp3 / m4a / ogg / wav / flac). المنشور يظهر للزوار في قسم «الموسيقى»، والمخفي مسودّة لا يراها أحد غيرك.</p></div></div>
<section class="panel"><div class="panel-title"><h2>رفع مقطع جديد</h2></div>
<form id="mu-form" class="mini-form" style="display:grid;gap:10px">
<label>الملف الصوتي <input type="file" id="mu-audio" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" required></label>
<label>صورة الغلاف (اختياري) <input type="file" id="mu-cover" accept="image/jpeg,image/png,image/webp"></label>
<input id="mu-title" placeholder="عنوان المقطع *" maxlength="120" required>
<input id="mu-artist" placeholder="الفنان" maxlength="80"><input id="mu-album" placeholder="الألبوم" maxlength="80"><input id="mu-genre" placeholder="النوع (طرب، بوب، قرآن…)" maxlength="40">
<label><input type="checkbox" id="mu-dl" checked> السماح بالتحميل</label>
<label><input type="checkbox" id="mu-pub" checked> نشر الآن (وإلا يُحفظ كمسودّة)</label>
<button class="primary-admin" id="mu-go" type="submit">رفع</button><p class="hint" id="mu-msg"></p></form></section>
<section class="panel"><div class="panel-title"><h2>المقاطع</h2></div><div id="mu-list"></div></section></section>`;
let max=100;
async function api(url,opt){const r=await fetch(url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'خطأ');return d}
async function load(){try{const d=await api('/api/admin/music');max=d.maxMB;render(d.tracks)}catch(e){$$('#mu-list').textContent=e.message}}
function render(ts){
  const box=$$('#mu-list');if(!ts.length){box.innerHTML='<p class="hint">لا توجد مقاطع بعد.</p>';return}
  box.innerHTML=ts.map(t=>`<div class="mu-row" data-id="${E(t.id)}" style="display:grid;gap:6px;padding:10px 0;border-bottom:1px solid var(--line,#0001)"><b>${E(t.title)}</b><small>${E(t.artist||'—')} · ${E(t.format)} · ${fmtSize(t.size)} · ${fmtDur(t.duration)} · ▶ ${t.plays} · ⬇ ${t.downloads} · ${t.published?'✅ منشور':'📝 مسودّة'}</small>
  <audio controls preload="none" src="/api/admin/music/${E(t.id)}/file" style="width:100%"></audio>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="secondary-admin" data-act="pub">${t.published?'إخفاء':'نشر'}</button><button type="button" class="secondary-admin" data-act="dl">${t.allowDownload?'منع التحميل':'السماح بالتحميل'}</button><button type="button" class="secondary-admin" data-act="edit">تعديل</button><button type="button" class="danger-btn" data-act="del">حذف</button></div></div>`).join('');
  box.querySelectorAll('.mu-row').forEach(r=>{const id=r.dataset.id,t=ts.find(x=>x.id===id);
    r.querySelectorAll('[data-act]').forEach(b=>b.onclick=async()=>{try{
      if(b.dataset.act==='pub')await api('/api/admin/music/'+id,{method:'PATCH',headers:J,body:JSON.stringify({published:!t.published})});
      else if(b.dataset.act==='dl')await api('/api/admin/music/'+id,{method:'PATCH',headers:J,body:JSON.stringify({allowDownload:!t.allowDownload})});
      else if(b.dataset.act==='edit'){const title=prompt('العنوان',t.title);if(title===null)return;const artist=prompt('الفنان',t.artist||'');if(artist===null)return;await api('/api/admin/music/'+id,{method:'PATCH',headers:J,body:JSON.stringify({title,artist})})}
      else if(b.dataset.act==='del'){if(!confirm('حذف هذا المقطع نهائياً (الملف أيضاً)؟'))return;await api('/api/admin/music/'+id,{method:'DELETE'})}
      load()}catch(e){alert(e.message)}})})
}
function dur(file){return new Promise(res=>{try{const a=new Audio();a.preload='metadata';a.src=URL.createObjectURL(file);a.onloadedmetadata=()=>{res(isFinite(a.duration)?Math.round(a.duration):0);URL.revokeObjectURL(a.src)};a.onerror=()=>res(0);setTimeout(()=>res(0),4000)}catch{res(0)}})}
function inject(){
  (document.querySelector('.admin-main')||document.body).insertAdjacentHTML('beforeend',SECTION);
  const nav=document.querySelector('.admin-nav');if(!nav)return;
  nav.insertAdjacentHTML('beforeend','<button data-section="music" type="button"><i data-lucide="music"></i><span>الموسيقى</span></button>');
  nav.querySelector('[data-section="music"]').onclick=()=>showSection('music');
  $$('#mu-audio').onchange=e=>{const f=e.target.files[0];if(f&&!$$('#mu-title').value)$$('#mu-title').value=f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,120)};
  $$('#mu-form').onsubmit=async e=>{e.preventDefault();const f=$$('#mu-audio').files[0];if(!f)return;const msg=$$('#mu-msg'),go=$$('#mu-go');
    if(f.size>max*1048576){msg.textContent='❌ الملف أكبر من '+max+'MB.';return}
    go.disabled=true;msg.textContent='جارٍ الرفع…';
    try{const fd=new FormData();fd.append('title',$$('#mu-title').value);fd.append('artist',$$('#mu-artist').value);fd.append('album',$$('#mu-album').value);fd.append('genre',$$('#mu-genre').value);fd.append('allowDownload',$$('#mu-dl').checked);fd.append('published',$$('#mu-pub').checked);fd.append('duration',await dur(f));fd.append('audio',f);const c=$$('#mu-cover').files[0];if(c)fd.append('cover',c);
      await api('/api/admin/music',{method:'POST',body:fd});msg.textContent='✅ تم الرفع.';$$('#mu-form').reset();$$('#mu-dl').checked=true;$$('#mu-pub').checked=true;load()}
    catch(x){msg.textContent='❌ '+x.message}finally{go.disabled=false}};
  const orig=window.showSection;window.showSection=function(n){const r=orig.apply(this,arguments);if(n==='music')load();return r};
  if(window.lucide)lucide.createIcons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();
