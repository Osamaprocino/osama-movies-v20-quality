/* الملف الشخصي: الصورة، الاسم، العمر، كلمة المرور */
(function(){
const $=s=>document.querySelector(s);
const msg=(el,text,ok)=>{el.textContent=text||'';el.style.color=ok?'#1d8a4b':''};

function render(){
  if(!me)return;
  setAvatar($('#profile-avatar'),me);
  $('#pf-name').value=me.displayName||me.username;
  const em=$('#pf-email');em.value=me.email||'';em.readOnly=!!me.email;em.required=!me.email;
  $('#pf-age').value=me.age||'';
  $('#avatar-remove').classList.toggle('hidden',!me.avatarUrl);
}

/* قص الصورة إلى مربع 512px وضغطها قبل الرفع */
function squareBlob(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{
      const side=Math.min(img.naturalWidth,img.naturalHeight),size=Math.min(512,side);
      const c=document.createElement('canvas');c.width=c.height=size;
      c.getContext('2d').drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,size,size);
      URL.revokeObjectURL(url);c.toBlob(b=>b?resolve(b):reject(new Error('x')),'image/jpeg',0.9);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(t('profile.badImage')))};
    img.src=url;
  });
}
async function uploadAvatar(file){
  if(!file)return;
  try{
    const blob=await squareBlob(file);
    const fd=new FormData();fd.append('avatar',blob,'avatar.jpg');
    const r=await fetch('/api/user/avatar',{method:'POST',body:fd});const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||t('err.generic'));
    setMe(d.user);render();toast(t('profile.photoUpdated'));
  }catch(e){toast(e.message,'error')}
}
async function removeAvatar(){
  try{const d=await postJSON('/api/user/avatar',{},'DELETE');setMe(d.user);render();toast(t('profile.photoRemoved'))}
  catch(e){toast(e.message,'error')}
}

function init(){
  $('#avatar-change').onclick=()=>$('#avatar-input').click();
  $('#profile-avatar').onclick=()=>$('#avatar-input').click();
  $('#avatar-input').onchange=e=>{const f=e.target.files[0];e.target.value='';uploadAvatar(f)};
  $('#avatar-remove').onclick=removeAvatar;
  $('#profile-logout').onclick=doLogout;

  $('#profile-form').onsubmit=async e=>{
    e.preventDefault();const b=$('#pf-save'),out=$('#pf-msg');msg(out,'');
    const name=$('#pf-name').value.trim();
    if(Array.from(name).length<2){msg(out,t('profile.nameInvalid'));return}
    const ageRaw=$('#pf-age').value.trim();
    if(ageRaw!==''){const a=Number(ageRaw);if(!Number.isInteger(a)||a<5||a>120){msg(out,t('profile.ageInvalid'));return}}
    const body={displayName:name,age:ageRaw===''?null:Number(ageRaw)};
    if(!me.email&&$('#pf-email').value.trim())body.email=$('#pf-email').value.trim();
    b.disabled=true;
    try{const d=await postJSON('/api/user/profile',body,'PATCH');setMe(d.user);render();msg(out,t('profile.saved'),true);toast(t('profile.saved'))}
    catch(x){msg(out,x.message)}finally{b.disabled=false}
  };

  bindStrength('#pw-new','#pw-strength-fill','#pw-strength-text');
  $('#pass-form').onsubmit=async e=>{
    e.preventDefault();const b=$('#pw-save'),out=$('#pw-msg');msg(out,'');
    const cur=$('#pw-current').value,nw=$('#pw-new').value;
    const pr=passProblem(nw,me&&me.username);if(pr){msg(out,pr);return}
    if(nw!==$('#pw-new2').value){msg(out,t('pw.mismatch'));return}
    b.disabled=true;
    try{await postJSON('/api/user/password',{current:cur,next:nw});['#pw-current','#pw-new','#pw-new2'].forEach(s=>$(s).value='');msg(out,t('profile.passwordUpdated'),true);toast(t('profile.passwordUpdated'))}
    catch(x){msg(out,x.message)}finally{b.disabled=false}
  };
  document.addEventListener('tabchange',e=>{if(e.detail==='profile')render()});
  document.addEventListener('auth:changed',render);
  document.addEventListener('langchange',()=>{msg($('#pf-msg'),'');msg($('#pw-msg'),'')});
}
document.addEventListener('DOMContentLoaded',init);
})();
