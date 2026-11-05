/* التفاعلات المشتركة بين الأفلام والـ Shorts: إعجاب، تعليقات، مشاركة، تحميل */
(function(){
const $=s=>document.querySelector(s);
const ROUTE={movie:'movies',short:'shorts'};

async function api(url,opts={}){
  const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(d.error||t('err.generic'));e.status=r.status;e.code=d.code;throw e}
  return d;
}

/* ---------- إعجاب / عدم إعجاب ---------- */
async function react(type,id,current,value){
  if(!requireLogin())return null;
  const next=current===value?null:value;
  try{return await api(`/api/${ROUTE[type]}/${encodeURIComponent(id)}/react`,{method:'POST',body:JSON.stringify({value:next})})}
  catch(e){if(e.status===401){openAuth('login')}else toast(e.message,'error');return null}
}
async function loadSummary(type,id){try{return await api(`/api/${ROUTE[type]}/${encodeURIComponent(id)}/social`)}catch{return null}}

/* ---------- التحميل الحقيقي ---------- */
async function download(type,id){
  if(type==='movie'){
    try{
      const r=await fetch(`/api/movies/${encodeURIComponent(id)}/access`);const a=await r.json();
      if(!a.hasAccess){toast(t('act.downloadLocked'),'info');return}
    }catch{}
  }
  const a=document.createElement('a');
  a.href=`/api/${ROUTE[type]}/${encodeURIComponent(id)}/download`;a.download='';a.rel='noopener';
  document.body.appendChild(a);a.click();a.remove();
  toast(t('act.downloadStarted'));
}

/* ---------- المشاركة ---------- */
let shareCtx=null;
function shareUrl(type,id){return `${location.origin}/?${type==='movie'?'movie':'short'}=${encodeURIComponent(id)}`}
async function countShare(){
  if(!shareCtx)return;
  try{const s=await api(`/api/${ROUTE[shareCtx.type]}/${encodeURIComponent(shareCtx.id)}/share`,{method:'POST',body:'{}'});
    document.dispatchEvent(new CustomEvent('social:updated',{detail:{type:shareCtx.type,id:shareCtx.id,summary:s}}))}catch{}
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);return true}
  catch{
    try{const i=$('#share-url');i.select();i.setSelectionRange(0,99999);const ok=document.execCommand('copy');return ok}catch{return false}
  }
}
function share(opts){
  shareCtx=opts;
  const url=shareUrl(opts.type,opts.id);
  const text=opts.title||'';
  $('#share-name').textContent=text;
  $('#share-url').value=url;
  const u=encodeURIComponent(url),tx=encodeURIComponent(text);
  const targets=[
    ['WhatsApp',`https://wa.me/?text=${tx}%20${u}`,'#25D366','W'],
    ['Telegram',`https://t.me/share/url?url=${u}&text=${tx}`,'#2AABEE','T'],
    ['Facebook',`https://www.facebook.com/sharer/sharer.php?u=${u}`,'#1877F2','f'],
    ['X',`https://twitter.com/intent/tweet?url=${u}&text=${tx}`,'#111','X'],
    [t('share.email'),`mailto:?subject=${tx}&body=${u}`,'#6b7a90','@']
  ];
  $('#share-targets').innerHTML=targets.map(([n,href,c,l])=>`<a class="share-target" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><span style="background:${c}">${escapeHtml(l)}</span><em>${escapeHtml(n)}</em></a>`).join('');
  $('#share-targets').querySelectorAll('a').forEach(a=>a.onclick=()=>{countShare();closeShare()});
  const nat=$('#share-native');
  nat.classList.toggle('hidden',!navigator.share);
  nat.onclick=async()=>{try{await navigator.share({title:text,text,url});countShare();closeShare()}catch{}};
  $('#share-copy').onclick=async()=>{const ok=await copyText(url);toast(ok?t('share.copied'):t('err.copyFailed'),ok?'success':'error');if(ok)countShare()};
  $('#share-modal').classList.remove('hidden');icons();
}
function closeShare(){$('#share-modal').classList.add('hidden')}

/* ---------- التعليقات ---------- */
function createComments(root,{type,id,onTotal}){
  let sort='top',offset=0,total=0,loading=false,dead=false;
  const route=ROUTE[type];
  root.innerHTML=`
    <div class="cm-top"><h3><i data-lucide="message-circle"></i><span>${t('cm.title')}</span> <em class="cm-count">0</em></h3>
      <div class="cm-sort" role="group"><button type="button" data-sort="top" class="active">${t('cm.top')}</button><button type="button" data-sort="new">${t('cm.newest')}</button></div></div>
    <div class="cm-compose"></div>
    <div class="cm-list"></div>
    <button type="button" class="ghost-btn cm-more hidden">${t('cm.more')}</button>`;
  const list=root.querySelector('.cm-list'),more=root.querySelector('.cm-more'),countEl=root.querySelector('.cm-count'),compose=root.querySelector('.cm-compose');

  function setTotal(n){total=n;countEl.textContent=fmt(n);if(onTotal)onTotal(n)}
  function renderCompose(){
    if(!me){compose.innerHTML=`<button type="button" class="cm-login lg"><i data-lucide="log-in"></i><span>${t('cm.loginToComment')}</span></button>`;compose.querySelector('button').onclick=()=>openAuth('login');icons();return}
    compose.innerHTML=`<span class="avatar avatar-sm">${avatarHTML(me)}</span><div class="cm-box"><textarea rows="1" maxlength="1000" placeholder="${escapeHtml(t('cm.placeholder'))}"></textarea><button type="button" class="primary-btn cm-send" disabled><i data-lucide="send"></i><span>${t('cm.send')}</span></button></div>`;
    const ta=compose.querySelector('textarea'),btn=compose.querySelector('.cm-send');
    ta.oninput=()=>{btn.disabled=!ta.value.trim();ta.style.height='auto';ta.style.height=Math.min(140,ta.scrollHeight)+'px'};
    btn.onclick=async()=>{
      const text=ta.value.trim();if(!text)return;btn.disabled=true;
      try{const d=await api(`/api/comments/${route}/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({text})});
        ta.value='';ta.style.height='auto';list.insertAdjacentHTML('afterbegin',itemHTML(d.comment));bindItems();setTotal(d.total);emptyCheck();icons()}
      catch(e){toast(e.message,'error');btn.disabled=false}
    };
    icons();
  }
  function itemHTML(c,isReply){
    return `<div class="cm${isReply?' cm-reply':''}" data-id="${escapeHtml(c.id)}">
      <span class="avatar avatar-sm">${avatarHTML(c.author)}</span>
      <div class="cm-body">
        <div class="cm-head"><strong>${escapeHtml(c.author.name)}${vbHTML(c.author)}</strong><time>${escapeHtml(timeAgo(c.createdAt))}</time></div>
        ${c.pinned?`<span class="cm-pin"><i data-lucide="pin"></i>${t('cm.pinned')}</span>`:''}<p class="cm-text">${window.Extras2?Extras2.cmText(c,type):escapeHtml(c.text)}</p>
        <div class="cm-actions">
          <button type="button" class="cm-like${c.liked?' on':''}" data-act="like"><i data-lucide="thumbs-up"></i><span>${c.likes?fmt(c.likes):''}</span></button>
          <button type="button" data-act="reply">${t('cm.reply')}</button>
          ${c.mine?'':`<button type="button" data-act="report" class="cm-rep">${t('rep.report')}</button>`}
          ${c.canPin?`<button type="button" data-act="pin" class="cm-pinb">${t(c.pinned?'cm.unpin':'cm.pin')}</button>`:''}
          ${(!c.mine&&c.author.username)?`<button type="button" data-act="block" class="cm-rep" data-user="${escapeHtml(c.author.username)}">${t('blk.block')}</button>`:''}
          ${c.canDelete?`<button type="button" data-act="delete" class="cm-del">${t('cm.delete')}</button>`:''}
        </div>
        <div class="cm-replybox"></div>
        ${(c.replies&&c.replies.length)?`<div class="cm-replies">${c.replies.map(r=>itemHTML(r,true)).join('')}</div>`:'<div class="cm-replies"></div>'}
      </div></div>`;
  }
  function emptyCheck(){
    let e=list.querySelector('.cm-empty');
    if(!list.querySelector('.cm')){if(!e)list.innerHTML=`<div class="cm-empty">${t('cm.empty')}</div>`}else if(e)e.remove();
  }
  function bindItems(){
    list.querySelectorAll('.cm:not([data-bound])').forEach(el=>{
      el.dataset.bound='1';
      const cid=el.dataset.id;
      el.querySelector(':scope > .cm-body > .cm-actions').addEventListener('click',async e=>{
        const b=e.target.closest('button');if(!b)return;
        if(b.dataset.act==='like'){
          if(!requireLogin())return;
          try{const d=await api(`/api/comment/${encodeURIComponent(cid)}/like`,{method:'POST',body:'{}'});b.classList.toggle('on',d.liked);b.querySelector('span').textContent=d.likes?fmt(d.likes):''}catch(x){toast(x.message,'error')}
        }else if(b.dataset.act==='reply'){
          if(!requireLogin())return;
          const box=el.querySelector(':scope > .cm-body > .cm-replybox');
          if(box.firstChild){box.innerHTML='';return}
          box.innerHTML=`<div class="cm-box"><textarea rows="1" maxlength="1000" placeholder="${escapeHtml(t('cm.replyPlaceholder'))}"></textarea><button type="button" class="primary-btn cm-send" disabled><span>${t('cm.send')}</span></button></div>`;
          const ta=box.querySelector('textarea'),sb=box.querySelector('button');ta.focus();
          ta.oninput=()=>{sb.disabled=!ta.value.trim()};
          sb.onclick=async()=>{sb.disabled=true;
            try{const d=await api(`/api/comments/${route}/${encodeURIComponent(id)}`,{method:'POST',body:JSON.stringify({text:ta.value.trim(),parentId:cid})});
              const wrap=el.querySelector(':scope > .cm-body > .cm-replies');wrap.insertAdjacentHTML('beforeend',itemHTML(d.comment,true));box.innerHTML='';setTotal(d.total);bindItems();icons()}
            catch(x){toast(x.message,'error');sb.disabled=false}};
        }else if(b.dataset.act==='pin'){
          try{await api(`/api/comment/${encodeURIComponent(cid)}/pin`,{method:'POST',body:'{}'});load(true)}catch(x){toast(x.message,'error')}
        }else if(b.dataset.act==='block'){
          if(window.Extras2&&requireLogin())Extras2.blockUser(b.dataset.user,()=>load(true));
        }else if(b.dataset.act==='report'){
          if(window.Extras)Extras.report('comment',cid);
        }else if(b.dataset.act==='delete'){
          let ok=true;
          if(window.Swal&&Swal.fire){const r=await Swal.fire({title:t('cm.deleteConfirm'),icon:'warning',showCancelButton:true,confirmButtonText:t('cm.delete'),cancelButtonText:t('common.cancel'),confirmButtonColor:'#d94b5b'});ok=!!r.isConfirmed}
          if(!ok)return;
          try{const d=await api(`/api/comment/${encodeURIComponent(cid)}`,{method:'DELETE'});el.remove();setTotal(d.total);emptyCheck()}catch(x){toast(x.message,'error')}
        }
      });
    });
  }
  async function load(reset){
    if(loading||dead)return;loading=true;
    if(reset){offset=0;list.innerHTML=`<div class="cm-empty">${t('common.loading')}</div>`}
    try{
      const d=await api(`/api/comments/${route}/${encodeURIComponent(id)}?offset=${offset}&limit=15&sort=${sort}`);
      if(dead)return;
      if(reset)list.innerHTML='';
      list.insertAdjacentHTML('beforeend',d.items.map(c=>itemHTML(c)).join(''));
      offset+=d.items.length;setTotal(d.total);more.classList.toggle('hidden',!d.hasMore);bindItems();emptyCheck();icons();
    }catch(e){if(reset)list.innerHTML=`<div class="cm-empty">${escapeHtml(e.message)}</div>`}
    finally{loading=false}
  }
  root.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;root.querySelectorAll('[data-sort]').forEach(x=>x.classList.toggle('active',x===b));load(true)});
  more.onclick=()=>load(false);
  const onAuth=()=>{renderCompose();load(true)};
  document.addEventListener('auth:changed',onAuth);
  renderCompose();load(true);icons();
  return{destroy(){dead=true;document.removeEventListener('auth:changed',onAuth);root.innerHTML=''}};
}

/* ---------- أفعال صفحة الفيلم ---------- */
let movieNow=null,movieComments=null,movieSummary={myReaction:null};
function paintMovie(s){
  movieSummary=s;
  $('#act-like').classList.toggle('on',s.myReaction==='like');$('#act-dislike').classList.toggle('on',s.myReaction==='dislike');
  $('#act-like-n').textContent=fmtCompact(s.likes);$('#act-dislike-n').textContent=s.dislikes?fmtCompact(s.dislikes):'';
  $('#act-share-n').textContent=s.shares?fmtCompact(s.shares):'';
  const cm=$('#movie-comments .cm-count');if(cm)cm.textContent=fmt(s.comments);
}
async function mountMovie(movie){
  movieNow=movie;
  paintMovie({likes:0,dislikes:0,shares:0,comments:0,myReaction:null});
  if(movieComments){movieComments.destroy();movieComments=null}
  movieComments=createComments($('#movie-comments'),{type:'movie',id:movie.id});
  const s=await loadSummary('movie',movie.id);
  if(s&&movieNow===movie)paintMovie(s);
}
function initMovieActions(){
  $('#act-like').onclick=async()=>{if(!movieNow)return;const s=await react('movie',movieNow.id,movieSummary.myReaction,'like');if(s)paintMovie(s)};
  $('#act-dislike').onclick=async()=>{if(!movieNow)return;const s=await react('movie',movieNow.id,movieSummary.myReaction,'dislike');if(s)paintMovie(s)};
  $('#act-share').onclick=()=>{if(movieNow)share({type:'movie',id:movieNow.id,title:movieNow.title})};
  $('#act-download').onclick=()=>{if(movieNow)download('movie',movieNow.id)};
  $('#share-close').onclick=closeShare;$('#share-modal').onclick=e=>{if(e.target.id==='share-modal')closeShare()};
  document.addEventListener('social:updated',e=>{const d=e.detail;if(d.type==='movie'&&movieNow&&d.id===movieNow.id)paintMovie(d.summary)});
  document.addEventListener('auth:changed',async()=>{if(movieNow){const s=await loadSummary('movie',movieNow.id);if(s)paintMovie(s)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeShare()}});
}
document.addEventListener('DOMContentLoaded',initMovieActions);

window.Social={react,loadSummary,download,share,closeShare,createComments,mountMovie,shareUrl};
})();
