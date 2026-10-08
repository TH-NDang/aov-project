import {installShopLinks} from './shop-links.mjs';
import {renderRecipeGraph} from './recipe-graph.mjs';
import {validateCatalog} from './backend-items.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
let catalog,sources,revision,token,selected,dirty=false,history=[],rows=14,saving=false;
let draft=[],draftStatus='unverified',draftDirty=false;
let shopLinks;
const item=id=>catalog.items.find(x=>x.id===id);
const notice=s=>$('#notice').textContent=s;
function checkpoint(){history.push(structuredClone(catalog));if(history.length>60)history.shift();dirty=true;notice('Có thay đổi chưa lưu.');}
function mini(x,pindex=null){return `<div class="mini ${x.id===selected?'selected':''}" draggable="true" data-id="${x.id}" ${pindex!==null?`data-position="${pindex}"`:''}><button class="link-port port-in" data-port="in" draggable="false" aria-label="Ghép từ ${esc(x.name)}" title="Ghép từ: kéo về nguyên liệu">●</button><button class="link-port port-out" data-port="out" draggable="false" aria-label="Nối ${esc(x.name)}" title="Kéo từ nguyên liệu sang món đích, hoặc bấm hai chấm">●</button><img src="${esc(x.image)}" alt=""><span>${esc(x.name)}<small>${x.price} vàng · ${x.recipe.status==='verified'?'Đã xác nhận':x.recipe.status==='none'?'Không cần ghép':'Chưa xác nhận'}</small></span></div>`;}
function draw(){
 $('#library').innerHTML=catalog.items.filter(x=>norm(x.name+' '+x.id).includes(norm($('#search').value))).map(x=>mini(x)).join('');
 const group=$('#group').value,variant=$('#variant').value;
 const matches=[];for(const x of catalog.items)x.shopPositions.forEach((p,i)=>{if(p.group===group&&(!variant||p.variant===variant||p.variant===null))matches.push({x,p,i});});
 const columns=Math.max(3,...matches.map(v=>(v.p.column??0)+1));
 const count=Math.max(rows,...matches.map(v=>(v.p.row??0)+2));
 $('#grid').style.gridTemplateColumns=`repeat(${columns},minmax(130px,1fr))`;
 $('#grid').innerHTML=Array.from({length:count*columns},(_,k)=>{let r=Math.floor(k/columns),c=k%columns;return `<div class="cell" data-row="${r}" data-col="${c}"><div class="coord">Hàng ${r} · Cột ${c}</div>${matches.filter(v=>v.p.row===r&&v.p.column===c).map(v=>mini(v.x,v.i)).join('')}</div>`;}).join('');
 $('#unplaced').innerHTML=matches.filter(v=>v.p.row===null||v.p.column===null).map(v=>mini(v.x,v.i)).join('');
 shopLinks?.refresh();
 $('#undo').disabled=saving||!history.length;$('#save').disabled=saving;
}
function choose(id){if(draftDirty&&!confirm('Công thức đang chỉnh chưa được áp dụng. Bỏ bản nháp này?'))return false;selected=id;const x=item(id);draft=structuredClone(x.recipe.components);draftStatus=x.recipe.status;draftDirty=false;draw();detail();return true;}
function detail(){
 const x=item(selected);if(!x)return;
 shopLinks?.refresh();
 $('#recipe-graph').innerHTML=renderRecipeGraph(catalog.items,selected,{status:draftStatus,components:draft});
 $('#graph-caption').textContent=x.name+(draftDirty?' · Xem trước bản nháp':' · Công thức hiện tại');
 const src=sources.items.find(s=>s.itemId===x.id),rel=src?.legacyRelations||{};
 const candidates=new Set([...(rel.fromLevel1||[]),...(rel.fromLevel2||[])]);
 for(const s of sources.items)if([...(s.legacyRelations?.toLevel2||[]),...(s.legacyRelations?.toLevel3||[])].includes(x.id))candidates.add(s.itemId);
 const upgrades=catalog.items.filter(y=>y.recipe.status==='verified'&&y.recipe.components.some(c=>c.itemId===x.id));
 const total=draft.reduce((sum,c)=>sum+item(c.itemId).price*(c.quantity||0),0);
 $('#detail').innerHTML=`<img class="hero" src="${esc(x.image)}"><h2>${esc(x.name)}</h2><p>${esc(x.id)} · ${x.price} vàng</p><h3>Vị trí</h3>${x.shopPositions.map((p,i)=>`<div class="position" data-p="${i}"><select data-field="group">${catalog.categories.map(g=>`<option ${g.name===p.group?'selected':''}>${esc(g.name)}</option>`).join('')}</select><div class="row"><label>Hàng <input type="number" min="0" data-field="row" value="${p.row??''}"></label><label>Cột <input type="number" min="0" data-field="column" value="${p.column??''}"></label><select data-field="variant"><option value="">Không có nhánh</option>${['Đại địa','Liệt hoả'].map(v=>`<option ${v===p.variant?'selected':''}>${v}</option>`).join('')}</select><button data-delete-position="${i}" ${x.shopPositions.length===1?'disabled':''}>Xóa</button></div></div>`).join('')}<button id="add-position">Thêm vị trí</button>
 <h3>Ghép từ · bản nháp</h3><select id="status">${[['unverified','Chưa xác nhận'],['none','Xác nhận không cần ghép'],['verified','Xác nhận công thức']].map(([v,t])=>`<option value="${v}" ${v===draftStatus?'selected':''}>${t}</option>`).join('')}</select><div id="recipe-drop">Kéo trang bị từ danh sách vào đây làm nguyên liệu</div><div>${draft.map((c,i)=>`<div class="component row"><span>${esc(item(c.itemId).name)}</span><input aria-label="Số lượng" data-quantity="${i}" type="number" min="1" step="1" value="${c.quantity??''}" placeholder="SL"><button data-remove="${i}">Bỏ</button></div>`).join('')}</div><p>Tổng giá nguyên liệu đang nhập: ${total} vàng.<br>Chênh lệch so với giá đích: <span class="${total>x.price?'warning':''}">${x.price-total}</span> vàng. Đây là đối chiếu, chưa xác nhận quy tắc phí ghép.</p><button class="primary" id="apply-recipe">Áp dụng công thức</button><p>Áp dụng rồi bấm Lưu JSON. Chọn “Không cần ghép” hoặc “Chưa xác nhận” yêu cầu danh sách nguyên liệu rỗng.</p>
 <h3>Gợi ý từ Excel</h3><p>Có thể gồm liên kết xuyên cấp. Bấm chọn ứng viên. Số lượng mặc định là 1; bạn có thể thay đổi.</p><div class="suggest">${[...candidates].filter(id=>item(id)&&id!==x.id).map(id=>`<button data-candidate="${id}">${esc(item(id).name)}</button>`).join('')||'Không có dữ liệu nguồn.'}</div>
 <h3>Nâng cấp thành · tự tính</h3>${upgrades.map(y=>`<button data-choose="${y.id}">${esc(y.name)}</button>`).join('')||'<p>Chưa có công thức đã xác nhận sử dụng món này.</p>'}<p>Danh sách sẽ tăng khi các công thức khác được xác nhận.</p>`;
}
function addComponent(id){if(id===selected)return notice('Không thể dùng chính món đang chọn.');if(draft.some(c=>c.itemId===id))return notice('Đã có nguyên liệu này; hãy tăng số lượng.');draft.push({itemId:id,quantity:1});draftStatus='verified';draftDirty=true;detail();}
document.addEventListener('dragstart',e=>{if(e.target.closest('.link-port')){e.preventDefault();return;}const el=e.target.closest('.mini');if(el){e.dataTransfer.setData('text/plain',JSON.stringify({id:el.dataset.id,position:el.dataset.position===undefined?null:Number(el.dataset.position)}));e.dataTransfer.effectAllowed='move';}});
document.addEventListener('dragover',e=>{const el=e.target.closest('.cell,#recipe-drop');if(el){e.preventDefault();el.classList.add('over');}});
document.addEventListener('dragleave',e=>e.target.closest('.cell,#recipe-drop')?.classList.remove('over'));
document.addEventListener('drop',e=>{const el=e.target.closest('.cell,#recipe-drop');if(!el||saving)return;e.preventDefault();el.classList.remove('over');try{const payload=JSON.parse(e.dataTransfer.getData('text/plain'));const x=item(payload.id);if(!x)return;if(el.id==='recipe-drop')return addComponent(x.id);const group=$('#group').value;let i=payload.position;if(i===null)i=x.shopPositions.findIndex(p=>p.group===group);checkpoint();const p={group,row:Number(el.dataset.row),column:Number(el.dataset.col),variant:$('#variant').value||x.shopPositions[i]?.variant||null};if(i<0)x.shopPositions.push(p);else x.shopPositions[i]=p;draw();if(selected===x.id)detail();}catch(err){notice(err.message);}});
document.addEventListener('click',e=>{
 const m=e.target.closest('.mini');if(m)return choose(m.dataset.id);
 const b=e.target.closest('button');if(!b||saving)return;
 if(b.dataset.choose)return choose(b.dataset.choose);
 if(b.dataset.candidate)return addComponent(b.dataset.candidate);
 if(b.dataset.remove!==undefined){draft.splice(Number(b.dataset.remove),1);draftDirty=true;return detail();}
 if(b.dataset.deletePosition!==undefined){checkpoint();item(selected).shopPositions.splice(Number(b.dataset.deletePosition),1);draw();return detail();}
 if(b.id==='add-position'){checkpoint();item(selected).shopPositions.push({group:$('#group').value,row:null,column:null,variant:null});draw();return detail();}
 if(b.id==='apply-recipe'){
  const candidate=structuredClone(catalog);candidate.items.find(x=>x.id===selected).recipe={status:draftStatus,components:structuredClone(draft)};
  try{validateCatalog(candidate);checkpoint();catalog=candidate;draftDirty=false;draw();detail();notice('Đã áp dụng công thức; bấm Lưu JSON để ghi file.');}catch(err){notice('Chưa áp dụng: '+err.message);}
 }
});
document.addEventListener('change',e=>{
 if(e.target.id==='status'){draftStatus=e.target.value;draftDirty=true;return detail();}
 if(e.target.dataset.quantity!==undefined){draft[Number(e.target.dataset.quantity)].quantity=e.target.value===''?null:Number(e.target.value);draftDirty=true;return detail();}
 if(e.target.dataset.field){const field=e.target.dataset.field,pindex=Number(e.target.closest('[data-p]').dataset.p),v=e.target.value;if(['row','column'].includes(field)&&v!==''&&(!Number.isInteger(Number(v))||Number(v)<0)){notice('Vị trí phải là số nguyên không âm.');return detail();}checkpoint();item(selected).shopPositions[pindex][field]=['row','column'].includes(field)?(v===''?null:Number(v)):v||null;draw();}
});
$('#search').oninput=draw;$('#group').onchange=draw;$('#variant').onchange=draw;$('#more').onclick=()=>{rows+=3;draw();};
$('#undo').onclick=()=>{if(!history.length)return;catalog=history.pop();dirty=true;draftDirty=false;const x=item(selected);draft=structuredClone(x.recipe.components);draftStatus=x.recipe.status;draw();detail();notice('Đã hoàn tác; chưa lưu.');};
$('#save').onclick=async()=>{
 if(draftDirty)return notice('Công thức đang chỉnh chưa được áp dụng. Bấm Áp dụng công thức trước.');
 saving=true;document.querySelector('main').inert=true;draw();try{
  validateCatalog(catalog);const res=await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify({revision,items:catalog.items})});const result=await res.json();if(!res.ok)throw Error(result.error);
  revision=result.revision;dirty=false;notice(`Đã lưu JSON + build + HTML. ${result.verified} công thức xác nhận. ${result.collisions.length} vị trí trùng. Bản sao: ${result.backup}`);
 }catch(err){notice('Không lưu được: '+err.message);}finally{saving=false;document.querySelector('main').inert=false;draw();}
};
window.addEventListener('beforeunload',e=>{if(dirty||draftDirty){e.preventDefault();e.returnValue='';}});
shopLinks=installShopLinks({state:()=>({items:catalog?.items||[],selected,draft,draftStatus,saving}),connect:(from,to)=>{if(saving)return;if(from===to)return notice('Không thể nối trang bị với chính nó.');if(selected!==to&&choose(to)===false)return;if(draft.some(c=>c.itemId===from))return notice('Đã có nguyên liệu này. Chỉnh số lượng trong công thức.');addComponent(from);notice('Đã nối bản nháp với số lượng 1. Bạn có thể đổi số lượng rồi áp dụng.');},apply:()=>$('#apply-recipe').click()});
try{const res=await fetch('/api/catalog');if(!res.ok)throw Error('Không kết nối được máy chủ');const data=await res.json();({catalog,sources,revision,token}=data);$('#group').innerHTML=catalog.categories.map(g=>`<option>${esc(g.name)}</option>`).join('');selected=catalog.items[0].id;choose(selected);notice('Sẵn sàng. Kéo thả hoặc chọn một trang bị để xác nhận công thức.');}catch(err){notice('Mở bằng Chay-bien-tap.cmd để bật chức năng lưu JSON. '+err.message);}
