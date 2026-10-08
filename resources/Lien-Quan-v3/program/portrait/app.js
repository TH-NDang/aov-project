'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const asset=path=>'/files/'+new URL(path,'http://local/').pathname.slice(1).split('/').map(encodeURIComponent).join('/');
  let state,heroId='',skinId='',selected='',upload=null,uploadURL=null,dirty=false,busy=false;
  let uploadGeneration=0;
  const hero=()=>state.data.heroes.find(h=>h.id===heroId);
  const entry=()=>skinId?hero().skins.find(s=>s.id===skinId):hero();
  function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
  function setDirty(value){dirty=value;$('dirty').hidden=!value;$('save').disabled=!value||busy;}
  function approveDiscard(){return !dirty || confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi để chuyển mục?');}
  function clearUpload(){uploadGeneration++;upload=null;if(uploadURL)URL.revokeObjectURL(uploadURL);uploadURL=null;$('upload').value='';$('clear-upload').hidden=true;}
  function renderHeroes(){
    const q=norm($('hero-search').value);
    const list=state.data.heroes.filter(h=>norm(h.name).includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
    $('hero-list').innerHTML=list.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');
    $('hero-list').value=heroId;
  }
  function renderItems(){
    const h=hero();
    $('hero-caption').textContent=`${h.skins.filter(s=>!s.isDefault).length} trang phục · ${h.name}`;
    $('item-list').innerHTML=`<option value="">${esc(h.name)} — Tướng</option>`+h.skins.filter(s=>!s.isDefault).map(s=>`<option value="${esc(s.id)}">${s.portrait?'':'[Thiếu ảnh] '}${esc(s.name||'Chưa có tên')} · ${esc(s.sourceSkinId)}</option>`).join('');
    $('item-list').value=skinId;
  }
  function renderBadge(){const b=state.data.badges.find(b=>b.id===$('badge').value);$('badge-preview').innerHTML=b?`<img src="${asset(b.icon)}" alt="Bậc trang phục">`:'';}
  function preview(){
    const e=entry(), file=selected||e.cover||e.head;
    $('preview').hidden=!file && !uploadURL;
    if(uploadURL)$('preview').src=uploadURL;else if(file)$('preview').src=asset(file);
    $('preview-label').textContent=upload?`Ảnh mới: ${upload.name}`:selected?selected:'Chưa có portrait · Đang xem ảnh gốc';
    document.querySelectorAll('.version').forEach(b=>b.classList.toggle('selected',!upload && b.dataset.file===selected));
    destination();
  }
  function destination(){
    const name=$('name').value.trim(), stem=slug(skinId?hero().name+' '+name:name);
    $('destination').textContent=(selected||upload)?'Ảnh chính sau khi lưu: '+(skinId?'assets/skin/portrait/':'assets/hero/portrait/')+stem+'-portrait.png':'Mục này chưa có portrait';
  }
  function renderEditor(){
    clearUpload();const h=hero(),e=entry();selected=e.portrait||'';
    $('editor').hidden=false;$('entity-kind').textContent=skinId?'TRANG PHỤC':'TƯỚNG';
    $('entity-title').textContent=skinId?(e.name||'Trang phục chưa có tên'):h.name;
    $('name').value=e.name;$('badge-field').hidden=!skinId;$('badge').value=e.badgeId||'';renderBadge();
    $('stable-id').textContent=`Mã giữ nguyên: ${h.id}${skinId?' / '+e.id+' / '+e.sourceSkinId:''}`;
    $('item-note').textContent=e.portrait?'Đã có portrait. Có thể đổi bản chính hoặc thêm ảnh mới.':'Chưa có portrait. Chọn ảnh chưa khớp hoặc thêm ảnh mới để bổ sung.';
    const versions=[e.portrait,...(e.portraitAlternates||[])].filter(Boolean);
    $('versions').innerHTML=versions.length?versions.map((file,i)=>`<button type="button" class="version" data-file="${esc(file)}"><img src="${asset(file)}" alt="${i?'Bản khác '+i:'Ảnh chính hiện tại'}"><span>${i?'Bản khác '+i:'Chính hiện tại'}</span></button>`).join(''):'<p class="small">Mục này chưa có ảnh portrait.</p>';
    $('old-images').innerHTML=[['Head',e.head],['Cover',e.cover]].filter(([,p])=>p).map(([label,p])=>`<figure><a href="${asset(p)}" target="_blank"><img src="${asset(p)}" alt="${label}"></a><figcaption>${label} cũ</figcaption></figure>`).join('');
    const unmatched=state.sources.filter(r=>!r.skinId).sort((a,b)=>Number(b.hero===h.name)-Number(a.hero===h.name)||a.figmaName.localeCompare(b.figmaName,'vi'));
    $('unmatched').innerHTML='<option value="">Chọn ảnh chưa khớp…</option>'+unmatched.map(r=>`<option value="${esc(r.file)}">${esc(r.figmaName)}${r.isPrimary?'':' — Bản trước'}</option>`).join('');
    $('summary').textContent=`${state.summary.heroPortraitsLinked} tướng · ${state.summary.skinPortraitsLinked} trang phục có portrait · ${state.summary.unmatchedPortraitFiles} ảnh chưa khớp`;
    $('restore').disabled=!state.backups.length || busy;
    $('restore').title=state.backups[0]?state.backups[0].label:'';
    setDirty(false);preview();
  }
  function acceptState(next){state=next;if(!heroId || !state.data.heroes.some(h=>h.id===heroId))heroId=state.data.heroes[0].id;$('badge').innerHTML='<option value="">Không gắn bậc</option>'+[...state.data.badges].sort((a,b)=>a.id.localeCompare(b.id)).map(b=>`<option value="${esc(b.id)}">${esc(b.id.replace(/-/g,' '))}</option>`).join('');renderHeroes();renderItems();renderEditor();window.dispatchEvent(new CustomEvent('portrait-state',{detail:state}));}
  async function post(endpoint,payload){
    const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Portrait-Token':state.token},body:JSON.stringify({...payload,revision:state.revision})});
    const result=await r.json();if(!r.ok)throw Error(result.error||'Không thực hiện được.');return result;
  }
  function setBusy(value){busy=value;for(const el of document.querySelectorAll('input,select,button'))el.disabled=value;$('save').disabled=value||!dirty;$('restore').disabled=value||!state.backups.length;$('save').textContent=value?'Đang lưu…':'Lưu thay đổi';window.dispatchEvent(new CustomEvent('portrait-busy',{detail:value}));}
  window.PORTRAIT_MANAGER={applyState:acceptState,setBusy,message,canSwitch:()=>{if(!approveDiscard())return false;if(dirty)renderEditor();return true;}};
  $('hero-search').addEventListener('input',renderHeroes);
  $('hero-list').addEventListener('change',()=>{const next=$('hero-list').value;if(!next)return;if(!approveDiscard()){$('hero-list').value=heroId;return;}heroId=next;skinId='';renderItems();renderEditor();message('');});
  $('item-list').addEventListener('change',()=>{const next=$('item-list').value;if(!approveDiscard()){$('item-list').value=skinId;return;}skinId=next;renderEditor();message('');});
  $('name').addEventListener('input',()=>{setDirty(true);destination();});
  $('badge').addEventListener('change',()=>{setDirty(true);renderBadge();});
  $('versions').addEventListener('click',event=>{const b=event.target.closest('[data-file]');if(!b)return;clearUpload();selected=b.dataset.file;$('unmatched').value='';setDirty(true);preview();});
  $('unmatched').addEventListener('change',()=>{clearUpload();selected=$('unmatched').value || entry().portrait || '';setDirty(true);preview();});
  $('upload').addEventListener('change',async()=>{
    const file=$('upload').files[0];if(!file)return;
    clearUpload();
    if(file.size>12*1024*1024){message('Ảnh tối đa 12 MB.',true);return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){message('Dùng PNG, JPG hoặc WebP.',true);return;}
    const generation=uploadGeneration;
    try {
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Không đọc được file ảnh.'));reader.readAsDataURL(file);});
      if(generation!==uploadGeneration)return;
      upload={name:file.name,base64};uploadURL=URL.createObjectURL(file);$('clear-upload').hidden=false;$('unmatched').value='';setDirty(true);preview();message('Ảnh mới đã được chọn. Bấm Lưu để cập nhật.');
    }catch(e){message(e.message,true);}
  });
  $('clear-upload').addEventListener('click',()=>{clearUpload();preview();setDirty(true);});
  $('discard').addEventListener('click',()=>{if(approveDiscard()){renderEditor();message('Đã bỏ các thay đổi chưa lưu.');}});
  $('save').addEventListener('click',async()=>{
    if(!dirty||busy)return;
    setBusy(true);message('Đang lưu và tạo bản sao…');
    try{const result=await post('/api/save',{heroId,skinId:skinId||null,name:$('name').value,badgeId:$('badge').value,chooseFile:selected,upload});acceptState(result.state);message('Đã lưu. JSON và ảnh đã đồng bộ; bản sao có thể khôi phục bằng nút phía trên.');}
    catch(e){message(e.message,true);}finally{setBusy(false);}
  });
  $('restore').addEventListener('click',async()=>{
    if(busy || !state.backups.length)return;
    $('restore-label').textContent=state.backups[0].label;
    $('restore-dialog').showModal();
  });
  $('cancel-restore').addEventListener('click',()=>$('restore-dialog').close());
  $('confirm-restore').addEventListener('click',async()=>{
    $('restore-dialog').close();
    setBusy(true);
    try{const result=await post('/api/restore',{});acceptState(result.state);message('Đã khôi phục dữ liệu và ảnh trước lần lưu gần nhất.');}
    catch(e){message(e.message,true);}finally{setBusy(false);}
  });
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  fetch('/api/state').then(async r=>{if(!r.ok)throw Error('Không đọc được bộ dữ liệu.');acceptState(await r.json());}).catch(e=>message(e.message+' Hãy mở bằng file Mo-quan-ly.cmd và giữ cửa sổ công cụ chạy.',true));
})();
