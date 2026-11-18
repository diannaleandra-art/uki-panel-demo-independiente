/* Romo QA: gestión de carta en Neon propio, SIN publicar borradores ni usar Uki. */
(function(){
 'use strict';
 const API='/api/romo-carta-administracion-qa',STORE='romo:serena';
 const state={root:null,base:null,admin:null,busy:false,requestId:0,limit:16};
 const E=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const money=x=>'$'+Number(x||0).toLocaleString('es-CL');
 const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
 const clear=x=>x&&x.replaceChildren();
 const add=(parent,...children)=>{parent.append(...children);return parent;};
 const css=(x,s)=>{x.style.cssText=s;return x;};
 const info=x=>css(E('p',x),'font-size:13px;color:#62555a;line-height:1.5;margin:7px 0');
 const field=(label,value='',type='text')=>{
  const wrap=css(E('label',label),'display:grid;gap:5px;font-size:13px;font-weight:650;min-width:0');
  const input=E('input');input.type=type;
  if(type==='checkbox')input.checked=Boolean(value);
  else input.value=String(value??'');
  if(type==='number'){input.min='0';input.max='1000000';input.step='1';input.inputMode='numeric';}
  css(input,'box-sizing:border-box;width:100%;min-height:42px;border-radius:10px;border:1px solid #d6c8cc;padding:10px;background:white;color:#241e21;font-size:16px');
  wrap.append(input);return {wrap,input};
 };
 const select=(label,options,value='')=>{
  const wrap=css(E('label',label),'display:grid;gap:5px;font-size:13px;font-weight:650');
  const input=css(E('select'),'width:100%;min-height:42px;border-radius:10px;border:1px solid #d6c8cc;background:#fff;color:#241e21;font-size:16px;padding:8px');
  for(const [v,t] of options)input.add(new Option(t,v));
  input.value=String(value??'');wrap.append(input);return {wrap,input};
 };
 const button=(label,handler,secondary=false)=>{
  const b=css(E('button',label),'border-radius:11px;padding:11px 13px;min-height:42px;font-size:14px;font-weight:750;border:1px solid '+(secondary?'#9e1a32':'#a00e28')+';background:'+(secondary?'white':'#a00e28')+';color:'+(secondary?'#a00e28':'white')+';cursor:pointer;max-width:100%');
  b.type='button';b.disabled=!canWrite();b.onclick=handler;return b;
 };
 const panel=(title)=>{const d=css(E('details'),'border:1px solid #ead8de;border-radius:13px;padding:12px;margin:10px 0;background:#fff');const h=css(E('summary',title),'font-weight:800;cursor:pointer;color:#281e22;font-size:15px');d.append(h);return d;};
 const stack=()=>css(E('div'),'display:grid;gap:10px;margin:13px 0');
 const row=()=>css(E('div'),'display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:9px 0');
 const canWrite=()=>state.admin?.edicionHabilitada===true;
 const statuses=()=>state.root?Array.from(state.root.querySelectorAll('[data-romo-admin-status]')):[];
 function status(message){for(const e of statuses())e.textContent=message;}
 function categories(){
  const data=state.admin?.data||{},base=state.base||{};
  const list=[...(base.categories||[]),...(data.categories||[])];
  return list.filter(c=>!(data.categoryHidden||[]).includes(c.slug))
   .map(c=>({slug:c.slug,nombre:data.categoryNames?.[c.slug]||c.nombre,original:(base.categories||[]).some(b=>b.slug===c.slug)}));
 }
 function categoryOptions(){return [['','Sin categoría'],...categories().map(c=>[c.slug,c.nombre])];}
 function products(){
  const data=state.admin?.data||{},cats=categories(),validCats=new Set(cats.map(c=>c.slug));
  const base=(state.base?.products||[]).map(p=>({
   ...p,...(data.baseProductOverrides?.[p.sku]||{}),
   categoriaSlug:data.assignments?.[p.sku]??(validCats.has(p.categoriaSlug)?p.categoriaSlug:''),
   _base:true,_original:p
  }));
  const created=(data.products||[]).map(p=>({
   ...p,categoriaSlug:data.assignments?.[p.sku]??p.categoriaSlug,_base:false,_original:null
  }));
  return [...base,...created];
 }
 function ingredients(){
  const data=state.admin?.data||{};
  const base=(state.base?.ingredients||[]).map(i=>({
   ...i,...(data.ingredientOverrides?.[i.sku]||{}),
   contexts:{...(i.contexts||{}),...((data.ingredientOverrides||{})[i.sku]?.contexts||{})},
   _base:true
  }));
  const more=(data.ingredients||[]).map(i=>({...i,_base:false}));
  return [...base,...more];
 }
 function promos(){
  const data=state.admin?.data||{};
  const originals=products().filter(p=>p._base&&
    ((p.kind==='monthly'&&p.sourceId!=='handroll-individual')||
     (p.categoriaSlug==='mensual'&&p.kind!=='monthly'))).map(p=>({...p,_base:true}));
  return [...originals,...(data.promotions||[]).map(p=>({...p,_base:false}))];
 }
 async function request(method,payload){
  const token=await window.ukiInventarioToken?.();
  if(!token)throw Error('Ingresa con Google como dueña de Romo');
  const res=await fetch(API,{method,cache:'no-store',credentials:'same-origin',
   headers:{Authorization:'Bearer '+token,Accept:'application/json',
    ...(method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify(payload)}:{}),
   signal:AbortSignal.timeout(15000)
  });
  const value=await res.json().catch(()=>null);
  if(!res.ok||value?.ok!==true||value.storeId!==STORE)
   throw Error(value?.error||'El servidor no confirmó la operación');
  return value;
 }
 async function load(){
  if(!state.root||!state.root.isConnected)return;
  const id=++state.requestId;
  try{
   const data=await request('GET');
   if(id!==state.requestId||!state.root?.isConnected)return;
   if(data.draftOnly!==true||data.readOnly!==true||
      !data.data||!Number.isSafeInteger(data.revision))
    throw Error('No se confirmó el aislamiento de Romo');
   state.admin=data;render();
   status(canWrite()?'Gestión QA activa: se guardan borradores auditados, sin publicarlos a clientes.':
    'Gestión QA de solo lectura: formularios preparados. No se pueden guardar cambios.');
  }catch(e){
   if(id!==state.requestId)return;
   state.admin=null;
   legacy(true);
   status('La gestión avanzada no está disponible: '+String(e.message||e));
  }
 }
 async function save(action,fields,description,confirmText){
  if(state.busy||!canWrite())return;
  if(confirmText&&!window.confirm(confirmText))return;
  const rev=state.admin.revision;
  state.busy=true;status('Guardando el borrador en Neon Romo…');
  try{
   const done=await request('POST',{
    action,expectedRevision:rev,fields,motivo:'Gestión manual QA Romo: '+description
   });
   if(done.guardado!==true||done.auditado!==true||done.draftOnly!==true||
      done.revision!==rev+1)throw Error('El servidor no confirmó la auditoría');
   state.busy=false;await load();
   status('✓ '+description+'. Guardado solo en Romo QA; pendiente de publicar a clientes.');
  }catch(e){
   status('No se confirmó el guardado. No repitas la acción sin actualizar. '+String(e.message||e));
  }finally{state.busy=false;}
 }
 function host(name){
  const area=state.root?.querySelector('[data-romo-area="'+name+'"]');
  if(!area)return null;
  let target=area.querySelector('[data-romo-admin="'+name+'"]');
  if(!target){target=E('div');target.dataset.romoAdmin=name;area.append(target);}
  return target;
 }
 function cardNote(){
  const b=css(E('div'),'background:#f7f2f3;border:1px solid #e8dadd;border-radius:11px;padding:11px;margin:10px 0');
  b.append(info('Los cambios que guardes aquí quedan como BORRADOR en Neon Romo QA. No se envían a clientes ni a Uki.'));
  if(!canWrite())b.append(info('Guardado desactivado hasta completar la validación de permisos y pruebas.'));
  const m=E('p');m.dataset.romoAdminStatus='1';m.setAttribute('role','status');
  m.style.fontSize='13px';b.append(m);return b;
 }
 async function jpegBase64(file){
  if(!file||file.size>15000000)throw Error('El archivo es demasiado grande');
  return new Promise((resolve,reject)=>{
   const src=URL.createObjectURL(file),img=new Image();
   const clean=()=>URL.revokeObjectURL(src);
   img.onload=()=>{
    try{
     const ratio=Math.min(1,1100/Math.max(img.naturalWidth,img.naturalHeight));
     if(!Number.isFinite(ratio)||ratio<=0)throw Error('Imagen inválida');
     let w=Math.max(1,Math.round(img.naturalWidth*ratio));
     let h=Math.max(1,Math.round(img.naturalHeight*ratio));
     const canvas=document.createElement('canvas'),context=canvas.getContext('2d');
     if(!context)throw Error('No se pudo procesar la imagen');
     let base64='';
     for(let tries=0;tries<7;tries++){
      canvas.width=w;canvas.height=h;context.drawImage(img,0,0,w,h);
      const url=canvas.toDataURL('image/jpeg',Math.max(.35,.76-tries*.07));
      base64=url.split(',')[1]||'';
      if(base64.length>1400&&base64.length<400000)break;
      w=Math.round(w*.84);h=Math.round(h*.84);
     }
     if(base64.length<1400||base64.length>400000||!base64.startsWith('/9j/'))
      throw Error('La fotografía no se pudo reducir lo suficiente');
     clean();resolve(base64);
    }catch(error){clean();reject(error);}
   };
   img.onerror=()=>{clean();reject(Error('No se pudo leer la foto. Prueba una imagen JPEG.'));};
   img.src=src;
  });
 }
 async function photoRequest(method,payload,sku){
  const token=await window.ukiInventarioToken?.();
  if(!token)throw Error('Debes iniciar sesión como dueña de Romo');
  const url='/api/romo-carta-fotos-qa'+(method==='GET'?'?sku='+encodeURIComponent(sku):'');
  const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',
   headers:{Authorization:'Bearer '+token,Accept:'application/json',
    ...(method==='POST'?{'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify(payload)}:{}),
   signal:AbortSignal.timeout(20000)
  });
  const data=await r.json().catch(()=>null);
  if(!r.ok||data?.ok!==true||data.storeId!==STORE)throw Error(data?.error||'La foto no se confirmó');
  return data;
 }
 function photoPanel(sku){
  const details=panel('📷 Fotografía · Ver o cambiar (solo Romo QA)');
  const box=stack(),preview=E('div'),statusP=info('Abre esta sección para consultar la fotografía.');
  const file=E('input');file.type='file';
  file.accept='image/jpeg,image/png,image/webp,image/heic,image/heif,image/*';
  const upload=button('Guardar fotografía de prueba',async()=>{
   if(state.busy||!file.files?.length){statusP.textContent='Selecciona primero una fotografía';return;}
   state.busy=true;upload.disabled=true;statusP.textContent='Preparando fotografía…';
   try{
    const base64=await jpegBase64(file.files[0]);
    const result=await photoRequest('POST',{action:'save',sku,base64,expectedVersion:version},sku);
    if(result.guardado!==true||result.auditado!==true||result.draftOnly!==true)
     throw Error('No se confirmó auditoría de fotografía');
    statusP.textContent='✓ Fotografía guardada en Romo QA; aún no publicada a clientes.';
    await loadPhoto();
   }catch(e){statusP.textContent='No se confirmó la foto. '+String(e.message||e);}
   finally{state.busy=false;upload.disabled=!canWrite();}
  });
  const remove=button('Quitar fotografía',async()=>{
   if(state.busy||version<1||!window.confirm('¿Quitar esta foto de prueba en Romo?'))return;
   state.busy=true;remove.disabled=true;
   try{
    const result=await photoRequest('POST',{action:'remove',sku,expectedVersion:version},sku);
    if(result.guardado!==true||result.auditado!==true)throw Error('No se confirmó el retiro');
    await loadPhoto();statusP.textContent='✓ Foto quitada del borrador Romo.';
   }catch(e){statusP.textContent='No se confirmó el retiro. '+String(e.message||e);}
   finally{state.busy=false;remove.disabled=!canWrite()||version<1;}
  },true);
  let version=0,loaded=false;
  const loadPhoto=async()=>{
   try{
    const result=await photoRequest('GET',null,sku);
    version=result.version||0;clear(preview);
    if(result.image){
     const img=E('img');img.src=result.image;img.alt='Fotografía privada de Romo';
     css(img,'display:block;max-width:230px;width:100%;height:auto;border-radius:10px');
     preview.append(img);
    }else preview.append(info('Este producto todavía no tiene fotografía guardada en Romo QA.'));
    statusP.textContent='Fotografía consultada en Romo · versión '+version+'.';
    remove.disabled=!canWrite()||version<1;
   }catch(e){statusP.textContent='No se pudo consultar la foto: '+String(e.message||e);}
  };
  details.addEventListener('toggle',()=>{
   if(details.open&&!loaded){loaded=true;void loadPhoto();}
  });
  box.append(preview,statusP,file,upload,remove);details.append(box);return details;
 }
 function renderProducts(){
  const target=host('productos');if(!target)return;clear(target);
  target.append(E('h3','Gestión completa de productos'),cardNote());
  const newCard=panel('＋ Agregar producto a Romo');
  const name=field('Nombre'),price=field('Precio en pesos','', 'number'),description=field('Descripción'),
   cat=select('Categoría',categoryOptions()), available=field('Disponible',true,'checkbox');
  const form=stack();add(form,name.wrap,price.wrap,description.wrap,cat.wrap,available.wrap);
  form.append(button('Agregar producto',()=>{
   const n=Number(price.input.value);
   if(!name.input.value.trim()||!Number.isSafeInteger(n)||n<1){status('Ingresa nombre y precio válido');return;}
   void save('product-create',{item:{
    name:name.input.value.trim(),price:n,description:description.input.value.trim(),
    categoriaSlug:cat.input.value,available:available.input.checked
   }},'Producto agregado como borrador');
  }));
  newCard.append(form);target.append(newCard);
  const search=field('Buscar producto');search.input.type='search';
  search.input.placeholder='Sushi, gohan, promoción…';target.append(search.wrap);
  const container=E('div');target.append(container);
  const draw=()=>{
   clear(container);
   const items=products().filter(p=>norm(p.name+' '+p.sku).includes(norm(search.input.value)));
   container.append(info(items.length+' productos disponibles en administración ('+(state.base?.products?.length||0)+' aprobados).'));
   for(const p of items.slice(0,state.limit)){
    const item=panel(p.name+' · '+money(p.price)+(p._base?' · Carta aprobada':' · Borrador'));
    const form=stack();
    const n=field('Nombre',p.name),price=field('Precio',p.price,'number'),
     desc=field('Descripción',p.description||''),
     cat=select('Categoría',categoryOptions(),p.categoriaSlug),
     av=field('Disponible',p.available!==false,'checkbox');
    if(p._base&&['classic','premium','extra'].includes(p.kind))n.input.disabled=true;
    if(p._base&&['classic','premium','topping','extra'].includes(p.kind))desc.input.disabled=true;
    form.append(n.wrap,price.wrap,desc.wrap,cat.wrap,av.wrap);
    const pct=field('Descuento de prueba (%)',state.admin.data.discounts?.[p.sku]||0,'number');
    pct.input.min='0';pct.input.max='99';form.append(pct.wrap);
    const actions=row();
    actions.append(button('Guardar producto',()=>{
     const amount=Number(price.input.value);
     if(!Number.isSafeInteger(amount)||amount<1){status('Precio inválido');return;}
     const baseFields={name:n.input.value.trim(),price:amount,description:desc.input.value.trim(),available:av.input.checked};
     const action=p._base?'product-base-edit':'product-edit';
     const fields=p._base?{id:p.sku,item:baseFields}:
       {id:p.sku,item:{...baseFields,categoriaSlug:cat.input.value}};
     void save(action,fields,'Edición de '+p.name);
    }));
    actions.append(button('Guardar categoría',()=>{
      void save('category-assign',{id:p.sku,category:cat.input.value},'Categoría de '+p.name);
    },true));
    actions.append(button('Aplicar descuento QA',()=>{
     const x=Number(pct.input.value);if(!Number.isSafeInteger(x)||x<0||x>99){status('Descuento entre 0 y 99%');return;}
     void save('discount-set',{id:p.sku,percent:x},'Descuento de '+p.name);
    },true));
    if(!p._base)actions.append(button('Eliminar producto',()=>{
      void save('product-delete',{id:p.sku},'Eliminación de '+p.name,
       '¿Eliminar el producto de los borradores de Romo? No modifica ventas anteriores.');
    },true));
    form.append(actions);item.append(form,photoPanel(p.sku));container.append(item);
   }
   if(items.length>state.limit){
    const more=button('Mostrar más ('+(items.length-state.limit)+')',()=>{state.limit+=16;draw();},true);
    more.disabled=false;container.append(more);
   }
  };
  search.input.oninput=()=>{state.limit=16;draw();};draw();
 }
 function renderCategories(){
  const target=host('categorias');if(!target)return;clear(target);
  target.append(cardNote(),info('Crea, renombra, elimina y asigna productos. Eliminar una categoría no borra productos.'));
  const create=panel('＋ Crear categoría'),n=field('Nombre de la categoría'),f=stack();
  f.append(n.wrap,button('Guardar categoría',()=>void save('category-create',{name:n.input.value.trim()},'Nueva categoría')));
  create.append(f);target.append(create);
  const items=products(),cats=categories();
  const find=field('Buscar producto para asignar');find.input.type='search';target.append(find.wrap);
  const assignments=E('div');target.append(assignments);
  const draw=()=>{
   clear(assignments);
   for(const p of items.filter(p=>norm(p.name).includes(norm(find.input.value))).slice(0,20)){
    const r=row(),title=css(E('strong',p.name),'flex:1;min-width:140px;font-size:13px');
    const c=select('Categoría',categoryOptions(),p.categoriaSlug);
    c.wrap.style.flex='1 1 180px';
    const saveButton=button('Guardar',()=>void save('category-assign',
      {id:p.sku,category:c.input.value},'Asignación de '+p.name),true);
    r.append(title,c.wrap,saveButton);assignments.append(r);
   }
  };
  find.input.oninput=draw;draw();
  for(const c of cats){
   const members=items.filter(p=>p.categoriaSlug===c.slug);
   const card=panel(c.nombre+' · '+members.length+' productos'),rename=field('Editar nombre',c.nombre),area=stack();
   area.append(rename.wrap,button('Guardar nombre',()=>{
    void save('category-rename',{id:c.slug,name:rename.input.value.trim()},'Categoría renombrada '+c.nombre);
   }));
   area.append(info('Productos dentro de la categoría: '+(members.length?members.map(p=>p.name).join(', '):'ninguno')));
   area.append(button('Eliminar categoría',()=>{
    void save('category-delete',{id:c.slug},'Eliminar categoría '+c.nombre,
      '¿Eliminar la categoría «'+c.nombre+'» del borrador de Romo? Sus productos se conservan.');
   },true));
   card.append(area);target.append(card);
  }
 }
 function renderIngredients(){
  const target=host('ingredientes');if(!target)return;clear(target);
  target.append(cardNote(),info('Vegetales, proteínas y envolturas. Cada recargo puede variar según la preparación.'));
  const kinds=[['vegetal','Vegetal'],['proteina','Proteína'],['envoltura','Envoltura']];
  const surfaces=[['classic','Sushi clásico'],['premium','Premium'],['monthly','Promociones'],['handroll','Handroll'],['burger','Burger'],['gohan','Gohan']];
  const create=panel('＋ Agregar ingrediente al armado'),form=stack();
  const n=field('Nombre'),kind=select('Tipo',kinds),price=field('Recargo en pesos (0 = incluido)',0,'number'),
    available=field('Disponible',true,'checkbox');
  form.append(n.wrap,kind.wrap,price.wrap,available.wrap);
  const checks=E('fieldset');checks.append(E('legend','Aparece en'));
  const surfaceInputs={};
  for(const [key,label] of surfaces){
   const box=field(label,key==='classic','checkbox');
   box.wrap.style.display='flex';box.wrap.style.alignItems='center';box.input.style.width='auto';
   surfaceInputs[key]=box.input;checks.append(box.wrap);
  }
  form.append(checks,button('Agregar ingrediente',()=>{
   void save('ingredient-create',{item:{name:n.input.value.trim(),category:kind.input.value,
    surcharge:Number(price.input.value),
    available:available.input.checked,
    surfaces:Object.keys(surfaceInputs).filter(k=>surfaceInputs[k].checked)
   }},'Agregar ingrediente '+n.input.value.trim());
  }));
  create.append(form);target.append(create);
  const search=field('Buscar ingrediente');search.input.type='search';target.append(search.wrap);
  const list=E('div');target.append(list);
  const draw=()=>{
   clear(list);
   const data=ingredients().filter(p=>norm(p.name+' '+p.category).includes(norm(search.input.value)));
   list.append(info(data.length+' ingredientes disponibles en administración.'));
   for(const p of data){
    const item=panel(p.name+' · '+p.category+(p._base?' · Receta aprobada':' · Borrador'));
    const f=stack();
    if(p._base){
      const contextInputs={};
      for(const [key,price] of Object.entries(p.contexts||{})){
       const input=field('Recargo · '+key,price,'number');f.append(input.wrap);contextInputs[key]=input.input;
      }
      const av=field('Disponible',p.available!==false,'checkbox');f.append(av.wrap);
      f.append(button('Guardar recargos QA',()=>{
       void save('ingredient-base-edit',{id:p.sku,available:av.input.checked,
        contexts:Object.fromEntries(Object.entries(contextInputs).map(([k,x])=>[k,Number(x.value)]))
       },'Recargos de '+p.name);
      }));
    }else{
      const n=field('Nombre',p.name),cat=select('Tipo',kinds,p.category),
       cost=field('Recargo',p.surcharge,'number'),av=field('Disponible',p.available!==false,'checkbox');
      f.append(n.wrap,cat.wrap,cost.wrap,av.wrap);
      const checks=E('fieldset');checks.append(E('legend','Aparece en'));
      const enabled={};
      for(const [key,label] of surfaces){
       const x=field(label,p.surfaces?.includes(key)||false,'checkbox');
       x.wrap.style.display='flex';x.input.style.width='auto';enabled[key]=x.input;checks.append(x.wrap);
      }
      f.append(checks,button('Guardar ingrediente',()=>{
       void save('ingredient-edit',{id:p.sku,item:{
        name:n.input.value.trim(),category:cat.input.value,surcharge:Number(cost.input.value),
        surfaces:Object.keys(enabled).filter(k=>enabled[k].checked),available:av.input.checked
       }},'Editar ingrediente '+p.name);
      }));
      f.append(button(p.available?'Marcar agotado':'Restaurar ingrediente',()=>{
       void save('ingredient-availability',{id:p.sku,available:p.available===false},
        'Disponibilidad de '+p.name);
      },true));
    }
    item.append(f);list.append(item);
   }
  };
  search.input.oninput=draw;draw();
 }
 function promotionForm(p,create=false){
  const box=stack(),name=field('Nombre',p?.name||''),price=field('Precio',p?.price||'','number'),
   desc=field('Descripción',p?.description||''),type=select('Tipo',
   [['sushi','Sushi personalizable'],['gohan','Gohan'],['combo','Combo sin armado']],p?.promoType||'sushi'),
   rolls=field('Cantidad de rolls',p?.rollCount??2,'number'),
   pieces=select('Piezas por roll',[['12','12'],['10','10']],String(p?.piecesPerRoll||12)),
   sauces=field('Salsas incluidas',p?.sauceCount??1,'number'),
   korokes=field('Korokes incluidos',p?.korokes??0,'number'),
   available=field('Disponible',p?.available!==false,'checkbox');
  box.append(name.wrap,price.wrap,desc.wrap,type.wrap,rolls.wrap,pieces.wrap,sauces.wrap,korokes.wrap,available.wrap);
  const pays=E('fieldset');pays.append(E('legend','Medios de pago'));
  const payments={},payOpts=[['efectivo','Efectivo'],['transferencia','Transferencia'],['debito','Tarjeta'],['edenred','Edenred'],['junaeb','Junaeb']];
  for(const [key,label] of payOpts){
   const checked=p?.payments?p.payments.includes(key):['efectivo','transferencia'].includes(key);
   const entry=field(label,checked,'checkbox');
   entry.wrap.style.display='flex';entry.input.style.width='auto';payments[key]=entry.input;pays.append(entry.wrap);
  }
  box.append(pays);
  const make=()=>({name:name.input.value.trim(),price:Number(price.input.value),
   description:desc.input.value.trim(),promoType:type.input.value,
   rollCount:Number(rolls.input.value),piecesPerRoll:Number(pieces.input.value),
   sauceCount:Number(sauces.input.value),korokes:Number(korokes.input.value),
   payments:Object.keys(payments).filter(k=>payments[k].checked),available:available.input.checked});
  const saveAction=create?'promotion-create':'promotion-edit';
  box.append(button(create?'Crear promoción borrador':'Guardar promoción',
    ()=>void save(saveAction,create?{item:make()}:{id:p.sku,item:make()},
     (create?'Crear promoción ':'Editar promoción ')+name.input.value.trim())));
  return box;
 }
 function renderPromos(){
  const target=host('promociones');if(!target)return;clear(target);
  target.append(cardNote());
  const newCard=panel('＋ Nueva promoción de Romo');
  newCard.append(info('Tipos de Romo: sushi, gohan o combo; no pizzas. Las fotos y publicación comercial se conectarán después de la prueba del guardado.'));
  newCard.append(promotionForm(null,true));target.append(newCard);
  const search=field('Buscar promoción por nombre');search.input.type='search';
  target.append(search.wrap);
  const list=E('div');target.append(list);
  const draw=()=>{
   clear(list);const found=promos().filter(p=>norm(p.name).includes(norm(search.input.value)));
   list.append(info(found.length+' promociones disponibles en administración.'));
   for(const p of found){
    const item=panel(p.name+' · '+money(p.price)+(p._base?' · Carta aprobada':' · Borrador'));
    if(!p._base){
     item.append(promotionForm(p,false));
     item.append(button('Eliminar promoción de borrador',()=>{
      void save('promotion-delete',{id:p.sku},'Eliminar promoción '+p.name,
       '¿Eliminar esta promoción de pruebas? Se conserva la auditoría.');
     },true));
    }else{
     item.append(info('Promoción aprobada. Puedes preparar un cambio de precio, descripción o disponibilidad sin alterar todavía la carta comercial.'));
     const f=stack(),name=field('Nombre',p.name),price=field('Precio',p.price,'number'),
       desc=field('Descripción',p.description||''),av=field('Disponible',p.available!==false,'checkbox');
     f.append(name.wrap,price.wrap,desc.wrap,av.wrap);
     f.append(button('Guardar cambios QA',()=>void save('product-base-edit',{
      id:p.sku,item:{name:name.input.value.trim(),price:Number(price.input.value),
       description:desc.input.value.trim(),available:av.input.checked}
     },'Editar promoción aprobada '+p.name)));
     const discount=field('Descuento (%)',state.admin.data.discounts?.[p.sku]||0,'number');f.append(discount.wrap);
     f.append(button('Guardar descuento QA',()=>{
      void save('discount-set',{id:p.sku,percent:Number(discount.input.value)},'Descuento de '+p.name);
     },true));
     item.append(f);
    }
    item.append(photoPanel(p.sku));list.append(item);
   }
  };
  search.input.oninput=draw;draw();
 }
 function legacy(show){
  if(!state.root)return;
  for(const selector of ['[data-romo-carta-list]','[data-romo-carta-form]']){
   const node=state.root.querySelector(selector);
   if(node)node.hidden=!show;
  }
  const search=state.root.querySelector('[data-romo-carta-search]');
  const group=search?.parentElement;
  if(group)group.hidden=!show;
  for(const selector of ['[data-romo-categories-list]','[data-romo-ingredients-list]','[data-romo-promos-list]']){
   const node=state.root.querySelector(selector);
   if(node)node.hidden=!show;
  }
 }
 function render(){
  if(!state.root?.isConnected||!state.admin)return;
  legacy(false);
  renderProducts();renderCategories();renderIngredients();renderPromos();
 }
 window.romoMontarGestionCartaQA=function({container,base}={}){
  if(!container||!container.isConnected||base?.storeId!==STORE)return false;
  state.root=container;state.base=base;state.admin=null;state.limit=16;
  legacy(true);
  for(const name of ['productos','categorias','ingredientes','promociones']){
   const target=host(name);if(target)clear(target);
  }
  void load();return true;
 };
})();
