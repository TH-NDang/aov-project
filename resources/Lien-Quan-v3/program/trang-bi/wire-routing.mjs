// Orthogonal visibility grid. Every segment is checked against every card.
export function crossesCard(a,b,r){
 return a.x===b.x ? a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom
 : a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right;
}
export function routeWire(source,target,cards,lane=0){
 const gap=6+(lane%5)*5;
 const sameColumn=Math.abs(source.left-target.left)<4;
 const start={x:sameColumn?source.left:source.right,y:(source.top+source.bottom)/2};
 const end={x:target.left,y:(target.top+target.bottom)/2};
 const a={x:start.x+(sameColumn?-gap:gap),y:start.y},b={x:end.x-gap,y:end.y};
 const obstacles=cards.map(r=>({left:r.left-(gap-2),right:r.right+(gap-2),top:r.top-(gap-2),bottom:r.bottom+(gap-2)}));
 const xs=[...new Set([a.x,b.x,...obstacles.flatMap(r=>[r.left-2,r.right+2])])].sort((x,y)=>x-y);
 const ys=[...new Set([a.y,b.y,...obstacles.flatMap(r=>[r.top-2,r.bottom+2])])].sort((x,y)=>x-y);
 const key=(x,y)=>y*xs.length+x,point=k=>({x:xs[k%xs.length],y:ys[Math.floor(k/xs.length)]});
 const first=key(xs.indexOf(a.x),ys.indexOf(a.y)),last=key(xs.indexOf(b.x),ys.indexOf(b.y));
 const dist=new Map([[first,0]]),prev=new Map(),queue=[{k:first,cost:0}],closed=new Set();
 while(queue.length){queue.sort((u,v)=>v.cost-u.cost);const {k}=queue.pop();if(closed.has(k))continue;if(k===last)break;closed.add(k);
  const ix=k%xs.length,iy=Math.floor(k/xs.length),p=point(k);
  for(const [x,y] of [[ix-1,iy],[ix+1,iy],[ix,iy-1],[ix,iy+1]]){
   if(x<0||y<0||x>=xs.length||y>=ys.length)continue;const n=key(x,y),q=point(n);
   if(obstacles.some(r=>crossesCard(p,q,r)))continue;
   const d=dist.get(k)+Math.abs(p.x-q.x)+Math.abs(p.y-q.y);
   if(d<(dist.get(n)??Infinity)){dist.set(n,d);prev.set(n,k);queue.push({k:n,cost:d+Math.abs(q.x-b.x)+Math.abs(q.y-b.y)});}
  }
 }
 if(!dist.has(last))return null; // Never fall back to a line through a card.
 const path=[];for(let k=last;k!==undefined;k=prev.get(k))path.push(point(k));path.reverse();
 const points=[start,...path,end],clean=[];
 for(const p of points){while(clean.length>1){const u=clean.at(-2),v=clean.at(-1);if((u.x===v.x&&v.x===p.x)||(u.y===v.y&&v.y===p.y))clean.pop();else break;}clean.push(p);}
 return clean;
}
