const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Each occurrence stays in its own branch: a direct ingredient is not merged
// with the same ingredient required by an intermediate item.
export function buildRecipeGraph(items,rootId,override){
 const byId=new Map(items.map(x=>[x.id,x])),nodes=[],edges=[];let leaf=0,maxDepth=0;
 function visit(id,quantity,depth,ancestors){
  const x=byId.get(id);if(!x)throw Error('Không tìm thấy trang bị: '+id);
  if(ancestors.has(id))throw Error('Công thức tạo vòng lặp tại '+x.name);
  if(nodes.length>=1000)throw Error('Cây quá lớn để hiển thị.');
  const recipe=depth===0&&override?override:x.recipe;
  const n={key:nodes.length,itemId:id,name:x.name,image:x.image,tier:x.tier,quantity,status:recipe.status,depth};nodes.push(n);maxDepth=Math.max(maxDepth,depth);
  const next=new Set(ancestors);next.add(id);
  const children=recipe.status==='verified'?recipe.components.map(c=>visit(c.itemId,c.quantity,depth+1,next)):[];
  n.y=children.length?(children[0].y+children.at(-1).y)/2:leaf++*108;
  children.forEach(c=>edges.push({from:c.key,to:n.key}));return n;
 }
 visit(rootId,1,0,new Set());nodes.forEach(n=>n.x=(maxDepth-n.depth)*244+20);
 return {nodes,edges,width:(maxDepth+1)*244+20,height:Math.max(108,leaf*108)+20};
}
export function renderRecipeGraph(items,rootId,override){
 try{
  const g=buildRecipeGraph(items,rootId,override);
  const lines=g.edges.map(e=>{const a=g.nodes[e.from],b=g.nodes[e.to],x=a.x+194,y=a.y+48,bx=b.x,by=b.y+48,m=(x+bx)/2;return `<path d="M${x},${y} H${m} V${by} H${bx}"/>`;}).join('');
  const cards=g.nodes.map(n=>`<button class="graph-node ${n.depth===0?'graph-root':''}" data-choose="${escape(n.itemId)}" style="left:${n.x}px;top:${n.y+8}px" title="Mở ${escape(n.name)}"><img src="${escape(n.image)}" alt=""><span><strong>${escape(n.name)}</strong><small>Cấp ${n.tier}${n.depth?' · ×'+(n.quantity??'?'):''}</small><small>${n.status==='none'?'Không cần ghép':n.status==='unverified'?'Chưa xác nhận':n.depth?'Theo công thức':'Trang bị đang chọn'}</small></span></button>`).join('');
  return `<div class="graph-canvas" style="width:${g.width}px;height:${g.height}px"><svg width="${g.width}" height="${g.height}" aria-hidden="true"><defs><marker id="recipe-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#86bfff" stroke="none"/></marker></defs><g fill="none" stroke="#86bfff" stroke-width="2" marker-end="url(#recipe-arrow)">${lines}</g></svg>${cards}</div>`;
 }catch(e){return `<p class="warning">${escape(e.message)}</p>`;}
}
