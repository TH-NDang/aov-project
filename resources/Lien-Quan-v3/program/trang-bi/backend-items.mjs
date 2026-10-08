// Reference module: import these functions into your backend; no server required.
export function validateCatalog(catalog) {
  const items = catalog.items;
  const byId = new Map(items.map(x => [x.id, x]));
  if (byId.size !== items.length) throw Error('Duplicate item id');
  const groups = new Set(catalog.categories.map(x => x.name));
  for (const x of items) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.id)) throw Error('Invalid id: '+x.id);
    if (!Number.isInteger(x.price) || x.price < 0) throw Error('Invalid price: '+x.id);
    if (![1,2,3].includes(x.tier)) throw Error('Invalid tier: '+x.id);
    if (!Array.isArray(x.shopPositions) || !x.shopPositions.length) throw Error('Missing positions: '+x.id);
    for (const p of x.shopPositions) {
      if (!groups.has(p.group)) throw Error('Unknown group: '+x.id);
      for (const k of ['row','column']) if (p[k] !== null && (!Number.isInteger(p[k]) || p[k]<0)) throw Error('Invalid position: '+x.id);
      if (p.variant !== null && typeof p.variant !== 'string') throw Error('Invalid variant: '+x.id);
    }
    const r=x.recipe;
    if (!['none','unverified','verified'].includes(r.status) || !Array.isArray(r.components)) throw Error('Invalid recipe: '+x.id);
    if (r.status !== 'verified' && r.components.length) throw Error('Unverified components must stay in source data: '+x.id);
    if (r.status === 'verified' && !r.components.length) throw Error('Verified recipe must have components: '+x.id);
    const seen=new Set();
    for (const c of r.components) {
      if (!byId.has(c.itemId)) throw Error('Unknown component: '+c.itemId);
      if (seen.has(c.itemId)) throw Error('Duplicate component; use quantity: '+c.itemId);
      seen.add(c.itemId);
      if (!Number.isInteger(c.quantity) || c.quantity<=0) throw Error('Invalid quantity: '+x.id);
    }
  }
  const done=new Set(), active=new Set();
  function visit(id) {
    if (active.has(id)) throw Error('Recipe cycle: '+id);
    if (done.has(id)) return;
    active.add(id);
    for (const c of byId.get(id).recipe.components) visit(c.itemId);
    active.delete(id); done.add(id);
  }
  items.forEach(x=>visit(x.id));
  return byId;
}

// additivePricing must be enabled only after confirming the game's pricing rule.
export function createItemService(catalog, {additivePricing=false}={}) {
  const byId=validateCatalog(catalog), reverse=new Map(catalog.items.map(x=>[x.id,[]]));
  const brief=x=>({itemId:x.id,name:x.name,image:x.image,price:x.price});
  for (const x of catalog.items) for (const c of x.recipe.components) reverse.get(c.itemId).push(brief(x));
  return {
    getItem(id) {
      const x=byId.get(id);
      if (!x) return null; // HTTP adapter should return 404.
      const components=x.recipe.components.map(c=>({...brief(byId.get(c.itemId)),quantity:c.quantity}));
      let combineCost=null;
      if (x.recipe.status==='verified' && additivePricing) {
        combineCost=x.price-components.reduce((sum,c)=>sum+c.price*c.quantity,0);
        if (combineCost<0) throw Error('Negative combine cost: '+id);
      }
      return {...structuredClone(x),recipe:{status:x.recipe.status,combineCost,components},
        buildsInto:structuredClone(reverse.get(id)),buildsIntoComplete:catalog.items.every(i=>i.recipe.status!=='unverified')};
    },
    listItems() {return catalog.items.map(x=>this.getItem(x.id));}
  };
}
