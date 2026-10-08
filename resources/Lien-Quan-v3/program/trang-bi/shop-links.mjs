import {routeWire} from './wire-routing.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function relatedEdges(items,selected,draft,status){
 const recipes=new Map(items.map(x=>[x.id,x.id===selected?{status,components:draft}:x.recipe]));
 const all=[];for(const [to,r] of recipes)if(r.status==='verified')for(const c of r.components)all.push({from:c.itemId,to,quantity:c.quantity});
 const result=new Set();for(const direction of ['from','to']){const seen=new Set(),queue=[selected];while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);for(let i=0;i<all.length;i++){const e=all[i];if(e[direction]===id){result.add(i);queue.push(e[direction==='from'?'to':'from']);}}}}
 return [...result].map(i=>all[i]);
}
export function orientConnection(start,end){
 if(start.id===end.id)throw Error('Không thể nối với chính nó.');
 if(end.port&&start.port===end.port)throw Error('Hãy nối chấm phải (nâng cấp thành) với chấm trái (ghép từ).');
 return start.port==='in'?{from:end.id,to:start.id}:{from:start.id,to:end.id};
}
export function installShopLinks({state,connect,apply}){
 const grid=document.querySelector('#grid'),board=grid.parentElement;
 const wrap=document.createElement('div');wrap.className='shop-link-wrap';grid.before(wrap);wrap.append(grid);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('shop-wires');wrap.append(svg);
 const external=document.createElement('section');external.className='external-items';grid.before(external);
 const picker=document.createElement('details');picker.className='ingredient-picker';wrap.before(picker);picker.innerHTML='<summary>＋ Thêm nguyên liệu · tất cả nhóm</summary><input class="ingredient-search" placeholder="Tìm nguyên liệu theo tên…" aria-label="Tìm nguyên liệu tất cả nhóm"><div class="ingredient-results"></div>';
 const normalize=v=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
 function search(){const s=state(),q=normalize(picker.querySelector('input').value);picker.querySelector('.ingredient-results').innerHTML=s.items.filter(x=>x.id!==s.selected&&normalize(x.name).includes(q)).map(x=>`<button data-candidate="${esc(x.id)}"><img src="${esc(x.image)}" alt=""><span>${esc(x.name)}<small>${esc(x.category)} · Cấp ${x.tier}</small></span></button>`).join('');}
 picker.querySelector('input').addEventListener('input',search);picker.addEventListener('toggle',()=>{if(picker.open)search();});
 const tooltip=document.createElement('div');tooltip.className='wire-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');document.body.append(tooltip);
 function hideTooltip(){tooltip.hidden=true;}
 svg.addEventListener('pointermove',e=>{const edge=e.target.closest('.wire-edge');if(!edge||drag){hideTooltip();return;}tooltip.textContent=edge.dataset.label;tooltip.hidden=false;const r=tooltip.getBoundingClientRect();let x=e.clientX+16,y=e.clientY+18;if(x+r.width>window.innerWidth-8)x=e.clientX-r.width-16;if(y+r.height>window.innerHeight-8)y=e.clientY-r.height-14;tooltip.style.left=Math.max(8,x)+'px';tooltip.style.top=Math.max(8,y)+'px';});
 svg.addEventListener('pointerleave',hideTooltip);document.addEventListener('scroll',hideTooltip,true);window.addEventListener('blur',hideTooltip);
 const toolbar=document.createElement('div');toolbar.className='link-toolbar';wrap.before(toolbar);
 const hint=document.createElement('p');hint.className='link-hint';toolbar.before(hint);
 let armed=null,drag=null,suppress=false,frame;
 function finish(start,end){try{const edge=orientConnection(start,end);connect(edge.from,edge.to);}catch(e){hint.textContent=e.message;}}
 function paint(){
  const s=state();if(!s.items.length)return;
  const rect=wrap.getBoundingClientRect(),cards=[...wrap.querySelectorAll('.mini')],map=new Map();
  cards.forEach(c=>{if(!map.has(c.dataset.id))map.set(c.dataset.id,c);c.classList.remove('link-related');});
  const edges=relatedEdges(s.items,s.selected,s.draft,s.draftStatus);let hidden=0;
  svg.setAttribute('width','100%');svg.setAttribute('height','100%');
  const paths=edges.map((e,edgeIndex)=>{const a=map.get(e.from),b=map.get(e.to);if(!a||!b){hidden++;return '';}
   a.classList.add('link-related');b.classList.add('link-related');const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
   const local=r=>({left:r.left-rect.left,right:r.right-rect.left,top:r.top-rect.top,bottom:r.bottom-rect.top});
   const obstacles=cards.map(c=>local(c.getBoundingClientRect()));
   const points=routeWire(local(ar),local(br),obstacles,edgeIndex)||routeWire(local(ar),local(br),obstacles);
   if(!points){hidden++;return '';}

   const ingredient=s.items.find(x=>x.id===e.from),destination=s.items.find(x=>x.id===e.to);
   const quantityLabel=(ingredient?.name||e.from)+' ×'+(e.quantity??'?')+' → '+(destination?.name||e.to);
   const labelWidth=Math.max(100,quantityLabel.length*7+20);
   const segments=points.slice(1).map((p,i)=>({a:points[i],b:p,length:Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y)}));
   const segment=segments.filter(v=>v.a.y===v.b.y).sort((a,b)=>b.length-a.length)[0]||segments[0];
   const anchor={x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2};
   const label={x:Math.max(labelWidth/2+4,Math.min(wrap.clientWidth-labelWidth/2-4,anchor.x)),y:anchor.y-24};
   const direct=e.from===s.selected||e.to===s.selected;
   const color=direct?'#94c6dc':'#688598';
   const d=points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
   return `<g class="wire-edge" style="--edge-color:${color}" data-from="${esc(e.from)}" data-to="${esc(e.to)}" data-label="${esc(quantityLabel)}"><path class="wire-hit" d="${d}"/><path class="wire-visible ${direct?'wire-direct':'wire-indirect'}" d="${d}"/><g class="wire-quantity ${e.quantity===1?'quantity-on-hover':''}"><path class="label-leader" d="M${anchor.x} ${anchor.y} L${label.x} ${label.y+8}"/><circle cx="${anchor.x}" cy="${anchor.y}" r="3"/><rect x="${label.x-labelWidth/2}" y="${label.y-12}" width="${labelWidth}" height="20" rx="6"/><text x="${label.x}" y="${label.y+2}" text-anchor="middle">${esc(quantityLabel)}</text></g></g>`;


  }).join('');
  svg.innerHTML=`<defs><marker id="shop-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="context-stroke"/></marker></defs><g class="wire-lines">${paths}</g>`;
  hint.textContent=armed?'Bấm chấm phía đối diện ở món cần nối; Esc để hủy.':`Bấm món để xem đường ghép. Chấm trái: ghép từ. Chấm phải: nâng cấp thành. Kéo nối hai phía hoặc bấm hai chấm. ${hidden?hidden+' liên kết chưa vẽ được; xem danh sách công thức.':''}`;
 }
 function refresh(){
 hideTooltip();
 const current=state(),visible=new Set([...grid.querySelectorAll('.mini')].map(c=>c.dataset.id));
 const edges=relatedEdges(current.items,current.selected,current.draft,current.draftStatus);
 const absent=new Set([current.selected,...edges.flatMap(e=>[e.from,e.to])].filter(id=>id&&!visible.has(id)));
 const outside=current.items.filter(x=>absent.has(x.id));
 external.hidden=!outside.length;
 external.innerHTML=outside.length?'<h3>Liên quan ngoài bảng đang xem</h3><p>Khác nhóm, khác nhánh hoặc chưa xếp vị trí. Các ô này không đổi vị trí shop.</p><div class="external-cards">'+outside.map(x=>`<div class="mini" data-id="${esc(x.id)}"><button class="link-port port-in" data-port="in" aria-label="Ghép từ ${esc(x.name)}">●</button><img src="${esc(x.image)}" alt=""><span>${esc(x.name)}<small>${esc(x.category)} · Cấp ${x.tier}</small></span><button class="link-port port-out" data-port="out" aria-label="Nâng cấp từ ${esc(x.name)}">●</button></div>`).join('')+'</div>':'';
 if(picker.open)search();
 cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);const s=state(),target=s.items.find(x=>x.id===s.selected);toolbar.innerHTML=target?`<strong>Công thức trực tiếp: ${esc(target.name)}</strong>${s.draft.some(c=>s.items.find(x=>x.id===c.itemId)?.category!==target.category)?'<span class="cross-group-badge">Ghép khác nhóm</span>':''}<div>${s.draft.map((c,i)=>`<label>${esc(s.items.find(x=>x.id===c.itemId)?.name)} × <input type="number" min="1" step="1" data-quantity="${i}" value="${c.quantity??''}" placeholder="SL" aria-label="Số lượng ${esc(c.itemId)}"><button data-remove="${i}">Bỏ</button></label>`).join('')||'<span> Chưa có nguyên liệu trực tiếp.</span>'}</div><button class="apply-links">Áp dụng công thức</button><div class="upgrade-summary"><strong>Nâng cấp thành:</strong> ${s.items.filter(x=>x.recipe.status==='verified'&&x.recipe.components.some(c=>c.itemId===s.selected)).map(x=>`<button data-choose="${esc(x.id)}">${esc(x.name)}</button>`).join('')||'<span>Chưa có công thức đã xác nhận sử dụng món này.</span>'}<small>Đường nối dẫn tới các món này, có thể nằm ở hàng phía trên hoặc dưới. Rê chuột lên đường để xem rõ liên kết.</small></div>`:'';}
 toolbar.addEventListener('click',e=>{if(e.target.closest('.apply-links'))apply();});
 document.addEventListener('pointerdown',e=>{const port=e.target.closest('.link-port');if(!port||state().saving||e.button!==0)return;e.preventDefault();e.stopPropagation();drag={id:port.closest('.mini').dataset.id,port:port.dataset.port,x:e.clientX,y:e.clientY};},true);
 document.addEventListener('pointermove',e=>{if(!drag)return;let line=document.querySelector('#live-wire');if(!line){line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.id='live-wire';document.body.append(line);}line.innerHTML=`<path d="M${drag.x} ${drag.y} L${e.clientX} ${e.clientY}"/>`;});
 document.addEventListener('pointerup',e=>{if(!drag)return;const start=drag;drag=null;document.querySelector('#live-wire')?.remove();if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){suppress=true;setTimeout(()=>suppress=false,0);const hit=document.elementFromPoint(e.clientX,e.clientY),target=hit?.closest('.mini');if(target){armed=null;finish(start,{id:target.dataset.id,port:hit.closest('.link-port')?.dataset.port});}else paint();}});
 document.addEventListener('pointercancel',()=>{drag=null;document.querySelector('#live-wire')?.remove();});
 document.addEventListener('click',e=>{const port=e.target.closest('.link-port');if(!port&&!suppress)return;e.preventDefault();e.stopImmediatePropagation();if(suppress||state().saving)return;const end={id:port.closest('.mini').dataset.id,port:port.dataset.port};if(armed){const start=armed;armed=null;finish(start,end);}else {armed=end;paint();}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){armed=null;drag=null;document.querySelector('#live-wire')?.remove();paint();}});
 new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);}).observe(grid);
 window.addEventListener('resize',()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);});
 return {refresh};
}
