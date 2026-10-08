'use strict';
(() => {
  const $=id=>document.getElementById(id), manager=window.PORTRAIT_MANAGER;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLowerCase();
  const slug=s=>norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const asset=p=>'/files/'+new URL(p,'http://local/').pathname.slice(1).split('/').map(encodeURIComponent).join('/');
  const labels={all:'Tất cả ảnh',unmatched:'Chưa khớp',skins:'Ảnh trang phục',heroes:'Ảnh tướng',alternates:'Bản khác',portraitOnly:'Chỉ có portrait'};
  let state,images=[],filtered=[],selected=null,filter='all',limit=72,mode='images',targetMode='existing',draft=false,busy=false,customName=false;
  let owners=new Map(), searchText=new Map();
  function owner(row){return owners.get(row.file)||{h:null,e:null};}
  function destinationHero(){return state?.data.heroes.find(h=>norm(h.name).trim()===norm($('target-hero').value).trim());}
  function destinationEntry(){const h=destinationHero();return targetMode==='hero'?h:targetMode==='existing'?h?.skins.find(s=>s.id===$('target-skin').value):null;}
  function matches(row,key){const o=owner(row);return key==='all'||key==='unmatched'&&!row.skinId||key==='heroes'&&row.skinId==='heroSkin-1'||key==='skins'&&row.skinId&&row.skinId!=='heroSkin-1'||key==='alternates'&&!row.isPrimary||key==='portraitOnly'&&o.e&&o.e!==o.h&&!o.e.head&&!o.e.cover;}
  function setDraft(value){draft=value;updatePlan();}
  function approveDiscard(){return !draft||confirm('Ảnh này có thay đổi chưa lưu. Bỏ thay đổi để chuyển sang ảnh khác?');}
  function renderLibrary(){
    if(!state)return;
    const q=norm($('image-search').value),heroId=$('image-hero').value;
    filtered=images.filter(r=>matches(r,filter)&&(!heroId||owner(r).h?.id===heroId)&&(!q||searchText.get(r.file).includes(q)));
    $('image-tabs').innerHTML=Object.entries(labels).map(([key,title])=>`<button type="button" data-filter="${key}" class="${filter===key?'active':''}">${title}<span>${images.filter(r=>matches(r,key)).length}</span></button>`).join('');
    $('library-title').textContent=labels[filter];$('image-count').textContent=`${filtered.length} ảnh · hiện ${Math.min(limit,filtered.length)}`;
    $('image-grid').innerHTML=filtered.slice(0,limit).map(r=>{const {h,e}=owner(r),only=e&&e!==h&&!e.head&&!e.cover;return `<button type="button" class="image-card ${selected?.file===r.file?'selected':''}" data-file="${esc(r.file)}"><div class="image-thumb"><img src="${asset(r.file)}" alt="${esc(e?.name||r.figmaName)}" loading="lazy" decoding="async"><span class="image-state ${!r.skinId?'unmatched':''}">${!r.skinId?'Chưa khớp':r.isPrimary?'Ảnh chính':'Bản khác'}</span>${only?'<span class="portrait-only">Chỉ portrait</span>':''}</div><div class="image-card-copy"><strong>${esc(e&&e!==h?e.name||'Chưa có tên':e?h.name:r.figmaName.replace(/^.*? - /,''))}</strong><span>Đang ở: ${esc(!e?'Chưa ghép':e===h?h.name:h.name+' / '+(e.name||'Chưa có tên'))}</span><small>${esc(r.figmaName)}</small></div></button>`;}).join('');
    $('image-empty').hidden=filtered.length>0;$('image-more').hidden=filtered.length<=limit;
  }
  function filename(){let value=$('target-file-name').value.trim();value=value.replace(/\.png$/i,'').replace(/-portrait$/i,'');return slug(value)+'-portrait.png';}
  function automaticFilename(){const h=destinationHero();return slug(targetMode==='hero'?$('target-name').value:(h?.name||'')+' '+$('target-name').value)+'-portrait.png';}
  function renderReference(){const e=destinationEntry();$('target-reference').innerHTML=e?`<span class="small">Mục nhận hiện tại</span><div>${[e.portrait,e.head,e.cover].filter(Boolean).slice(0,3).map((p,i)=>`<img src="${asset(p)}" alt="Ảnh của mục nhận" title="${esc(p)}">`).join('')}</div>${!e.portrait?'<p class="small">Chưa có portrait.</p>':''}`:'';}
  function renderBadge(){const badge=state.data.badges.find(b=>b.id===$('target-badge').value);$('target-badge-preview').innerHTML=badge?`<img src="${asset(badge.icon)}" alt="Bậc đã chọn">`:'';}
  function renderSkinChoices(preferred=''){
    const h=destinationHero(),q=norm($('target-search').value);
    const skins=(h?.skins||[]).filter(s=>!s.isDefault&&(!q||norm(s.name).includes(q)));
    const old=preferred||$('target-skin').value;
    $('target-skin').innerHTML=skins.length?skins.map(s=>`<option value="${esc(s.id)}">${esc(s.name||'Chưa có tên')}${s.portrait?'':' · Thiếu portrait'}</option>`).join(''):'<option value="">Không có trang phục phù hợp</option>';
    if(skins.some(s=>s.id===old))$('target-skin').value=old;
  }
  function suggestedName(){const {h}=owner(selected);let value=selected.figmaName;const split=value.indexOf(' - ');if(split>=0)value=value.slice(split+3);else if(h&&norm(value).startsWith(norm(h.name)))value=value.slice(h.name.length).replace(/^[- ]+/,'');return value||'Trang phục mới';}
  function updateTarget(preferred=''){
    if(!selected)return;
    $('existing-target').hidden=targetMode!=='existing';$('new-target-note').hidden=targetMode!=='new';$('target-badge-field').hidden=targetMode==='hero';
    document.querySelectorAll('[data-target]').forEach(b=>b.classList.toggle('active',b.dataset.target===targetMode));
    renderSkinChoices(preferred);const e=destinationEntry();
    $('target-name').value=targetMode==='new'?suggestedName():e?.name||'';
    $('target-badge').value=e?.badgeId||'';customName=false;
    $('target-file-name').value=e?.portraitFileName||automaticFilename();
    if(e?.portraitFileName)customName=true;
    renderReference();renderBadge();updatePlan();
  }
  function updatePlan(){
    if(!selected)return;
    const h=destinationHero(),e=destinationEntry(),name=$('target-name').value.trim();
    const role=document.querySelector('input[name="image-role"]:checked')?.value||'primary';
    const valid=h&&name&&slug(name)&&filename()!=='-portrait.png'&&(targetMode!=='existing'||e);
    const old=owner(selected),same=e&&old.e===e;
    let lines=[];
    if(!h)lines.push('Gõ hoặc chọn tên tướng hợp lệ để tiếp tục.');
    else if(targetMode==='existing'&&!e)lines.push('Chọn một trang phục nhận ảnh.');
    else{
      lines.push(`${targetMode==='new'?'Tạo trang phục mới:':'Nơi nhận:'} ${h.name}${targetMode==='hero'?'': ' / '+(name||'Chưa đặt tên')}`);
      if(e&&name!==e.name)lines.push(`Đổi tên hiển thị: ${e.name||'Chưa có tên'} → ${name||'Chưa nhập'}`);
      lines.push(`Tên file: ${filename()}`);
      if(old.e&&!same)lines.push('Ảnh sẽ rời mục đang chứa nó; các ảnh khác tại đó được giữ.');
      if(role==='primary'&&e?.portrait&&e.portrait!==selected.file)lines.push('Ảnh chính ở nơi nhận sẽ chuyển thành bản khác.');
      if(role==='alternate'&&!e?.portrait)lines.push('Nơi nhận chưa có ảnh chính, nên ảnh này sẽ làm chính.');
      if(targetMode==='new')lines.push('Chỉ tạo portrait; head và cover để trống.');
    }
    $('move-plan').innerHTML=lines.map(line=>`<p>${esc(line)}</p>`).join('');
    $('image-save').disabled=!valid||busy;$('image-save-next').disabled=!valid||busy;
    $('image-save').textContent=same?'Lưu ảnh này':'Chuyển & lưu';
  }
  function openImage(row){
    selected=row;draft=false;customName=false;$('image-panel').hidden=false;$('image-workspace').classList.add('with-panel');
    const {h,e}=owner(row);$('picked-preview').src=asset(row.file);$('picked-owner').textContent=!e?'Chưa ghép':e===h?h.name:h.name+' / '+(e.name||'Chưa có tên');
    $('picked-original').textContent='Tên trong Figma: '+row.figmaName;$('picked-file').textContent=row.file;
    $('target-hero').value=h?.name||'';$('target-search').value='';targetMode=e===h&&e?'hero':e?'existing':'new';
    document.querySelector('input[name="image-role"][value="primary"]').checked=true;
    updateTarget(e&&e!==h?e.id:'');renderLibrary();
  }
  function closePanel(){if(!approveDiscard())return;selected=null;draft=false;$('image-panel').hidden=true;$('image-workspace').classList.remove('with-panel');renderLibrary();}
  function acceptState(next){
    const previousHero=$('image-hero').value;
    state=next;images=[...state.sources];
    const heroIndex=new Map(state.data.heroes.map(h=>[norm(h.name),h]));
    const skinIndex=new Map(state.data.heroes.map(h=>[h.id,new Map(h.skins.map(s=>[s.sourceSkinId,s]))]));
    owners=new Map(images.map(r=>{const h=heroIndex.get(norm(r.hero)),e=!r.skinId?null:r.skinId==='heroSkin-1'?h:skinIndex.get(h?.id)?.get(r.skinId);return [r.file,{h,e}];}));
    searchText=new Map(images.map(r=>[r.file,norm([r.hero,r.figmaName,r.file,owner(r).e?.name].join(' '))]));
    const heroes=[...state.data.heroes].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
    $('image-hero').innerHTML='<option value="">Tất cả tướng</option>'+heroes.map(h=>`<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('');$('image-hero').value=previousHero;
    $('target-hero-options').innerHTML=heroes.map(h=>`<option value="${esc(h.name)}"></option>`).join('');
    $('target-badge').innerHTML='<option value="">Chưa gắn bậc</option>'+[...state.data.badges].sort((a,b)=>a.id.localeCompare(b.id)).map(b=>`<option value="${esc(b.id)}">${esc(b.id.replace(/-/g,' '))}</option>`).join('');
    if(selected){const updated=images.find(r=>r.sourceFile===selected.sourceFile);if(updated)openImage(updated);else closePanel();}
    renderLibrary();
  }
  async function saveImage(nextImage){
    if(!selected||busy)return;
    const h=destinationHero(),e=destinationEntry();if(!h||(targetMode==='existing'&&!e))return;
    const index=filtered.findIndex(r=>r.file===selected.file),candidate=filtered[index+1]||filtered[index-1];
    const payload={revision:state.revision,file:selected.file,heroId:h.id,skinId:targetMode==='existing'?e.id:null,targetMode,name:$('target-name').value,badgeId:$('target-badge').value,fileName:$('target-file-name').value,role:document.querySelector('input[name="image-role"]:checked').value};
    manager.setBusy(true);manager.message('Đang chuyển ảnh, cập nhật JSON và giữ bản sao…');
    try{
      const response=await fetch('/api/move',{method:'POST',headers:{'Content-Type':'application/json','X-Portrait-Token':state.token},body:JSON.stringify(payload)});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Không chuyển được ảnh.');
      draft=false;selected=null;manager.applyState(result.state);
      const chosen=nextImage&&candidate?images.find(r=>r.sourceFile===candidate.sourceFile):images.find(r=>r.file===result.file);
      if(chosen)openImage(chosen);else closePanel();
      manager.message('Đã lưu ảnh đúng nơi nhận và đồng bộ JSON. Có thể khôi phục bằng nút phía trên.');
    }catch(error){manager.message(error.message,true);}finally{manager.setBusy(false);updatePlan();}
  }
  $('mode-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-mode]');if(!button||button.dataset.mode===mode)return;if(mode==='metadata'&&!manager.canSwitch())return;if(mode==='images'){if(!approveDiscard())return;if(draft&&selected)openImage(selected);}draft=false;mode=button.dataset.mode;$('image-workspace').hidden=mode!=='images';$('metadata-view').hidden=mode!=='metadata';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));});
  $('image-grid').addEventListener('click',event=>{const card=event.target.closest('[data-file]');if(!card||!approveDiscard())return;openImage(images.find(r=>r.file===card.dataset.file));});
  $('image-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button){filter=button.dataset.filter;limit=72;renderLibrary();}});
  $('image-search').addEventListener('input',()=>{limit=72;renderLibrary();});$('image-hero').addEventListener('change',()=>{limit=72;renderLibrary();});
  $('image-reset').addEventListener('click',()=>{$('image-search').value='';$('image-hero').value='';limit=72;renderLibrary();});$('image-more').addEventListener('click',()=>{limit+=72;renderLibrary();});
  $('image-close').addEventListener('click',closePanel);
  $('target-hero').addEventListener('input',()=>{if(destinationHero()){$('target-search').value='';updateTarget();}setDraft(true);});
  $('target-modes').addEventListener('click',event=>{const button=event.target.closest('[data-target]');if(!button)return;targetMode=button.dataset.target;updateTarget();setDraft(true);});
  $('target-search').addEventListener('input',()=>{renderSkinChoices();const e=destinationEntry();$('target-name').value=e?.name||'';$('target-badge').value=e?.badgeId||'';customName=false;$('target-file-name').value=e?.portraitFileName||automaticFilename();renderReference();renderBadge();setDraft(true);});
  $('target-skin').addEventListener('change',()=>{const e=destinationEntry();$('target-name').value=e?.name||'';$('target-badge').value=e?.badgeId||'';customName=Boolean(e?.portraitFileName);$('target-file-name').value=e?.portraitFileName||automaticFilename();renderReference();renderBadge();setDraft(true);});
  $('target-name').addEventListener('input',()=>{if(!customName)$('target-file-name').value=automaticFilename();setDraft(true);});
  $('target-file-name').addEventListener('input',()=>{customName=true;setDraft(true);});$('auto-file-name').addEventListener('click',()=>{customName=false;$('target-file-name').value=automaticFilename();setDraft(true);});
  $('target-badge').addEventListener('change',()=>{renderBadge();setDraft(true);});document.querySelectorAll('input[name="image-role"]').forEach(r=>r.addEventListener('change',()=>setDraft(true)));
  $('image-save').addEventListener('click',()=>saveImage(false));$('image-save-next').addEventListener('click',()=>saveImage(true));
  window.addEventListener('portrait-state',event=>acceptState(event.detail));window.addEventListener('portrait-busy',event=>{busy=event.detail;updatePlan();});
  window.addEventListener('beforeunload',event=>{if(draft){event.preventDefault();event.returnValue='';}});
  window.addEventListener('keydown',event=>{if(mode!=='images'||!selected||busy)return;if(event.key==='Escape')closePanel();if(event.key==='Enter'&&event.ctrlKey){event.preventDefault();if(!$('image-save').disabled)saveImage(false);}});
})();
