import http from 'node:http';

import fs from 'node:fs/promises';

import path from 'node:path';

import crypto from 'node:crypto';

import {fileURLToPath} from 'node:url';

import {createItemService,validateCatalog} from './backend-items.mjs';

const root=process.env.EQUIPMENT_EDITOR_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');

const location=name=>name==='Xem-trang-bi.html'?path.join(root,'preview',name):path.join(root,'data',name==='nguon-du-lieu.json'?'trang-bi-nguon-du-lieu.json':name);

const token=crypto.randomBytes(32).toString('hex'), port=Number(process.env.PORT||8785);

const read=async name=>fs.readFile(location(name),'utf8');

const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

let saving=false;

const server=http.createServer(async(req,res)=>{

 const send=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};

 try {

  if(req.headers.host!==`127.0.0.1:${port}` && req.headers.host!==`localhost:${port}`)return send(403,{error:'Host không hợp lệ'});

  const url=new URL(req.url,`http://127.0.0.1:${port}`);

  if(req.method==='GET' && url.pathname==='/api/catalog'){

   const text=await read('trang-bi.json');return send(200,{catalog:JSON.parse(text),sources:JSON.parse(await read('nguon-du-lieu.json')),revision:hash(text),token});

  }

  if(req.method==='POST' && url.pathname==='/api/save'){

   if(req.headers['x-editor-token']!==token || ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return send(403,{error:'Yêu cầu lưu không hợp lệ'});

   if(saving)return send(409,{error:'Đang lưu, hãy thử lại'});

   saving=true;

   try {

    let body='';for await(const chunk of req){body+=chunk;if(body.length>4000000)throw Error('Dữ liệu quá lớn');}

    const input=JSON.parse(body),oldText=await read('trang-bi.json'),old=JSON.parse(oldText);

    if(input.revision!==hash(oldText))return send(409,{error:'JSON đã đổi ở nơi khác. Tải lại trang trước khi lưu để tránh ghi đè.'});

    if(!Array.isArray(input.items)||input.items.length!==old.items.length)throw Error('Danh sách trang bị không đầy đủ');

    const updates=new Map(input.items.map(x=>[x.id,x]));if(updates.size!==old.items.length)throw Error('Mã bị trùng');

    const catalog={...old,items:old.items.map(x=>{

     const u=updates.get(x.id);if(!u)throw Error('Thiếu mã '+x.id);

     return {...x,shopPositions:u.shopPositions.map(p=>({group:p.group,row:p.row,column:p.column,variant:p.variant})),recipe:{status:u.recipe.status,components:u.recipe.components.map(c=>({itemId:c.itemId,quantity:c.quantity}))}};

    })};

    validateCatalog(catalog);

    // No invented pricing rule: fees remain null until separately confirmed.

    const service=createItemService(catalog),api={schemaVersion:'2.0',categories:catalog.categories,items:service.listItems()};

    const stamp=new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomBytes(3).toString('hex');

    const backup=path.join(root,'program','backup','trang-bi',stamp);await fs.mkdir(backup,{recursive:true});

    for(const name of ['trang-bi.json','api-items.json','builds.json','Xem-trang-bi.html']){try{await fs.copyFile(location(name),path.join(backup,name));}catch(e){if(e.code!=='ENOENT')throw e;}}

    const builds={items:api.items.map(x=>({itemId:x.id,recipe:x.recipe,buildsInto:x.buildsInto,buildsIntoComplete:x.buildsIntoComplete}))};

    const catalogText=JSON.stringify(catalog,null,2);

    const files={'trang-bi.json':catalogText,'api-items.json':JSON.stringify(api,null,2),'builds.json':JSON.stringify(builds,null,2)};

    let gallery=await read('Xem-trang-bi.html');

    files['Xem-trang-bi.html']=gallery.replace(/(<script id="data" type="application\/json">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+JSON.stringify(api).replaceAll('<','\\u003c')+b);

    try{

     for(const [name,text] of Object.entries(files)){await fs.writeFile(location(name)+'.tmp',text);await fs.rename(location(name)+'.tmp',location(name));}

    }catch(e){for(const name of Object.keys(files)){try{await fs.copyFile(path.join(backup,name),location(name));}catch{}}throw e;}

    const collisions=[];const occupied=new Map();

    for(const x of catalog.items)for(const p of x.shopPositions){if(p.row===null||p.column===null)continue;const k=JSON.stringify(p);if(occupied.has(k))collisions.push([occupied.get(k),x.id]);else occupied.set(k,x.id);}

    return send(200,{revision:hash(catalogText),backup:'program/backup/trang-bi/'+stamp,collisions,verified:catalog.items.filter(x=>x.recipe.status==='verified').length});

   }finally{saving=false;}

  }

  if(req.method!=='GET')return send(405,{error:'Method not allowed'});

  const name=url.pathname==='/'?'preview/Bien-tap-trang-bi.html':decodeURIComponent(url.pathname.slice(1));

  const target=path.resolve(root,name);

  if(!target.startsWith(path.resolve(root)+path.sep)||name.startsWith('program/backup/')||!['.html','.js','.mjs','.json','.png','.jpg','.jpeg','.webp','.gif'].includes(path.extname(target)))return send(403,{error:'Không được truy cập'});

  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};

  const content=await fs.readFile(target);

  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);

 }catch(e){send(e.code==='ENOENT'?404:400,{error:e.message});}

});

server.listen(port,'127.0.0.1',()=>console.log(`Equipment editor http://127.0.0.1:${port}`));

