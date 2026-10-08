'use strict';
(() => {
  const data = window.HERO_DATA, review = window.PORTRAIT_REVIEW;
  const $ = id => document.getElementById(id);
  if (!data || !review) { $('summary').textContent = 'Không đọc được dữ liệu. Hãy giữ HTML cùng các file JS trong thư mục này.'; return; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normal = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  const number = value => value.toLocaleString('vi-VN');
  const sources = new Map(review.sources.map(r => [r.file, r]));
  const badges = new Map(data.badges.map(b => [b.id, b]));
  const heroMap = new Map(data.heroes.map(h => [h.name, h]));
  const entities = [], alternateEntities = [];
  for (const h of data.heroes) {
    const hero = {key:h.id, type:'heroes', hero:h.name, title:h.name, file:h.portrait, alternatives:h.portraitAlternates || [], head:h.head, cover:h.cover, badgeId:null, heroId:h.id, skinCount:h.skins.filter(s => !s.isDefault).length};
    entities.push(hero);
    for (const s of h.skins.filter(s => !s.isDefault)) entities.push({key:s.id, type:'skins', hero:h.name, title:s.name || 'Trang phục chưa có tên', file:s.portrait, alternatives:s.portraitAlternates || [], head:s.head, cover:s.cover, badgeId:s.badgeId, heroId:h.id, sourceSkinId:s.sourceSkinId});
  }
  for (const e of entities) e.alternatives.forEach((file, i) => alternateEntities.push({...e, key:e.key+'-alt-'+i, type:'duplicates', owner:e, file, alternateIndex:i+1}));
  const unmatched = review.sources.filter(s => !s.skinId).map((s, i) => {
    const siblings = review.sources.filter(r => !r.skinId && r.figmaName === s.figmaName);
    return {key:'unmatched-'+i,type:'unmatched',hero:s.hero || '',heroId:heroMap.get(s.hero)?.id || '',title:s.figmaName.replace(/^.*? - /,''),file:s.file,alternatives:[],siblings,source:s};
  });
  const categories = {
    heroes:{title:'Portrait tướng', note:'Ảnh chính của từng tướng. Bấm ảnh để xem lớn, đối chiếu ảnh gốc và mở danh sách trang phục.', items:entities.filter(e => e.type==='heroes')},
    skins:{title:'Portrait trang phục', note:'Trang phục thuộc dữ liệu cũ, kèm icon bậc nếu có. Các mục thiếu portrait vẫn hiển thị để bạn kiểm tra.', items:entities.filter(e => e.type==='skins')},
    duplicates:{title:'Các bản trùng đã giữ', note:'Mỗi thẻ là một bản ảnh khác được giữ lại. Bấm vào để so sánh với ảnh chính. Bản trùng chưa khớp tên nằm ở mục Chưa khớp.', items:alternateEntities},
    unmatched:{title:'Ảnh chưa khớp dữ liệu', note:`${unmatched.length} ảnh thuộc ${new Set(unmatched.map(e=>e.source.figmaName)).size} tên trang phục chưa tìm được mục tương ứng trong JSON cũ. Ảnh được giữ đầy đủ và chưa tự gán sang trang phục khác.`, items:unmatched},
    missing:{title:'Các mục thiếu portrait', note:'Đây là mục có trong dữ liệu cũ nhưng chưa có portrait khớp. Ảnh bên dưới là ảnh gốc để đối chiếu; trường portrait vẫn là null.', items:entities.filter(e => !e.file)}
  };
  const tabs = {heroes:'Tướng',skins:'Trang phục',duplicates:'Bản trùng',unmatched:'Chưa khớp',missing:'Thiếu portrait'};
  const stats = [
    ['heroes',categories.heroes.items.filter(e=>e.file).length,'Tướng có portrait',''],
    ['skins',categories.skins.items.filter(e=>e.file).length,'Trang phục đã ghép',''],
    ['duplicates',alternateEntities.length,'Bản trùng đã ghép',''],
    ['unmatched',unmatched.length,'Ảnh chưa khớp','warning'],
    ['missing',categories.missing.items.length,'Mục còn thiếu','missing']
  ];
  $('summary').textContent = `Đang quản lý ${number(review.sources.length)} ảnh có nội dung · ${number(categories.heroes.items.filter(e=>e.file).length)} tướng và ${number(categories.skins.items.filter(e=>e.file).length)} trang phục đã ghép`;
  $('stats').innerHTML = stats.map(([key,count,label,style]) => `<button type="button" class="stat ${style}" data-tab="${key}"><strong>${number(count)}</strong><span>${label}</span></button>`).join('');
  $('tabs').innerHTML = Object.entries(tabs).map(([key,label])=>`<button type="button" data-tab="${key}">${label}<span class="tab-count">${number(categories[key].items.length)}</span></button>`).join('');
  [...data.heroes].sort((a,b)=>a.name.localeCompare(b.name,'vi')).forEach(h=> {const o=document.createElement('option');o.value=h.id;o.textContent=h.name;$('hero-filter').append(o);});
  let tab='heroes', limit=84, filtered=[], activeEntry=null;
  const dialog=$('detail');
  const pill=(text,style='')=>`<span class="pill ${style}">${esc(text)}</span>`;
  function render() {
    const query=normal($('search').value.trim()), heroId=$('hero-filter').value;
    filtered=categories[tab].items.filter(e=>(!heroId || e.heroId===heroId) && (!query || normal([e.title,e.hero,e.file,e.sourceSkinId,e.source?.figmaName].filter(Boolean).join(' ')).includes(query))).sort((a,b)=>a.hero.localeCompare(b.hero,'vi') || a.title.localeCompare(b.title,'vi'));
    document.querySelectorAll('[data-tab]').forEach(b=> {b.classList.toggle('active',b.dataset.tab===tab);if(b.closest('#tabs'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));});
    $('section-title').textContent=categories[tab].title;$('section-note').textContent=categories[tab].note;
    $('result-count').textContent=`${number(filtered.length)} / ${number(categories[tab].items.length)} mục`;
    $('gallery').innerHTML=filtered.slice(0,limit).map((e,i)=> {
      const image=e.file || e.cover || e.head, badge=badges.get(e.badgeId);
      const metadata=e.type==='unmatched' ? pill(e.source.isPrimary?'Chưa ghép · Bản chính':'Chưa ghép · Bản trước','warning') : !e.file ? pill('Thiếu portrait','missing') : e.type==='duplicates' ? pill('Bản trước '+e.alternateIndex,'warning') : (e.type==='heroes'?pill(e.skinCount+' trang phục'):pill('Đã ghép','good')) + (e.alternatives.length?pill('+'+e.alternatives.length+' bản khác'): '');
      return `<button type="button" class="card" data-entry="${i}" aria-label="${esc(e.hero+' — '+e.title)}"><div class="card-image ${!e.file?'missing-image':''}">${image?`<img src="${esc(image)}" alt="${esc(e.title)}" loading="lazy" decoding="async">`:''}${badge?`<img class="badge" src="${esc(badge.icon)}" alt="Bậc trang phục" loading="lazy">`:''}${!e.file?'<span class="missing-stamp">Ảnh gốc · Chưa có portrait</span>':''}</div><div class="card-copy">${e.type!=='heroes'?`<span class="hero-name">${esc(e.hero)}</span>`:''}<span class="card-title">${esc(e.title)}</span><div class="card-meta">${metadata}</div></div></button>`;
    }).join('');
    $('empty').hidden=filtered.length>0;$('load-more').hidden=filtered.length<=limit;
    $('loaded-count').textContent=filtered.length?`Đang hiển thị ${number(Math.min(limit,filtered.length))} / ${number(filtered.length)} mục`:'';
  }
  function switchTab(key) {tab=key;limit=84;render();}
  function showFile(file,label) {
    $('detail-image').src=file;$('detail-image').alt=activeEntry.title;$('detail-image-label').textContent=label;
    $('detail-file').href=file;$('detail-file').textContent=file;
    const source=sources.get(file);
    $('source-name').textContent=source?`Tên trong Figma: ${source.figmaName}`:'Ảnh gốc trong bộ dữ liệu cũ';
    $('versions').querySelectorAll('[data-file]').forEach(b=>b.classList.toggle('active',b.dataset.file===file));
  }
  function openDetail(entry) {
    activeEntry=entry;
    const owner=entry.owner || entry;
    const manual=sources.get(owner.file)?.selectionPolicy==='manual';
    $('version-note').textContent=manual?'Ảnh chính được chọn trong công cụ quản lý. Bấm ảnh để đối chiếu.':'Bản cuối trong frame được chọn làm ảnh chính. Bấm ảnh để đối chiếu.';
    $('detail-kind').textContent=entry.type==='duplicates'?'Đối chiếu bản trùng':entry.type==='unmatched'?'Ảnh chưa khớp':!entry.file?'Mục thiếu portrait':'Chi tiết portrait';
    $('detail-hero').textContent=entry.hero;$('detail-title').textContent=entry.title;
    $('detail-status').textContent=entry.type==='unmatched'?'Ảnh đã nhận, chưa có mục khớp chắc chắn trong dữ liệu cũ. Chưa gán vào tướng hoặc trang phục.':!entry.file?`Chưa có portrait. Đang xem ảnh gốc để đối chiếu. Mã mục: ${entry.sourceSkinId || entry.key}.`:owner.alternatives.length?`Có ${owner.alternatives.length+1} bản portrait. ${manual?'Ảnh chính do bạn chọn.':'Bản cuối trong frame làm ảnh chính.'}`:'Portrait đã ghép vào dữ liệu.';
    const badge=badges.get(entry.badgeId);
    $('detail-badge').innerHTML=badge?`<div class="rank-info"><span>Bậc trang phục</span><img src="${esc(badge.icon)}" alt="Bậc trang phục"></div>`:'';
    const versions=entry.siblings?entry.siblings.map((s,i)=>({file:s.file,label:s.isPrimary?'Ảnh chính':'Bản trước '+(i+1)})):owner.file?[{file:owner.file,label:'Ảnh chính'},...owner.alternatives.map((file,i)=>({file,label:'Bản trước '+(i+1)}))]:[];
    $('version-section').hidden=!versions.length;
    $('versions').innerHTML=versions.map(v=>`<button type="button" class="version" data-file="${esc(v.file)}" data-label="${esc(v.label)}"><img src="${esc(v.file)}" alt="${esc(v.label)}"><span>${esc(v.label)}</span></button>`).join('');
    $('original-section').hidden=!entry.head && !entry.cover;
    $('originals').innerHTML=[['Head',entry.head],['Cover',entry.cover]].filter(([,file])=>file).map(([label,file])=>`<figure><a href="${esc(file)}" target="_blank"><img src="${esc(file)}" alt="${esc(label)}"></a><figcaption>${label}</figcaption></figure>`).join('');
    const selected=entry.file || entry.cover || entry.head;
    if(selected)showFile(selected,!entry.file?'Ảnh gốc · Chưa có portrait':entry.type==='duplicates'?'Bản trước '+entry.alternateIndex:entry.type==='unmatched' && !entry.source.isPrimary?'Bản trước':'Ảnh chính');
    $('related').hidden=!(entry.heroId && (entry.type==='heroes' || owner.type==='heroes'));
    dialog.showModal();
  }
  $('stats').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b){$('search').value='';$('hero-filter').value='';switchTab(b.dataset.tab);}});
  $('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)switchTab(b.dataset.tab);});
  $('search').addEventListener('input',()=>{limit=84;render();});
  $('hero-filter').addEventListener('change',()=>{limit=84;render();});
  $('reset').addEventListener('click',()=>{$('search').value='';$('hero-filter').value='';limit=84;render();});
  $('load-more').addEventListener('click',()=>{limit+=84;render();});
  $('gallery').addEventListener('click',e=>{const card=e.target.closest('[data-entry]');if(card)openDetail(filtered[Number(card.dataset.entry)]);});
  $('versions').addEventListener('click',e=>{const b=e.target.closest('[data-file]');if(b)showFile(b.dataset.file,b.dataset.label);});
  $('close-detail').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{activeEntry=null;});
  $('related').addEventListener('click',()=>{const id=activeEntry.heroId;dialog.close();$('hero-filter').value=id;$('search').value='';switchTab('skins');});
  render();
})();
