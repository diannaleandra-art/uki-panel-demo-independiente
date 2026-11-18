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
 function previewPanel(){
  const container=panel('🔎 Carta y carrito de prueba antes de publicar');
  container.append(info('Vista exclusiva de dueños. Los productos, categorías y descuentos se toman de Neon Romo QA. El carrito calcula solo importes base; no registra ni envía pedidos.'));
  const content=E('div'),message=info('Pulsa «Comprobar vista previa» para cargar la carta.');
  let projection=null,requestSerial=0;
  const selected=new Map(),configuredPromos=new Map();
  const paymentSelect=select('Medio de pago de prueba',
   [['efectivo','Efectivo'],['transferencia','Transferencia'],['debito','Débito'],
    ['credito','Crédito'],['edenred','Edenred'],['junaeb','Junaeb']],'efectivo');
  const cartBox=css(E('div'),'border:1px solid #ddc9d0;border-radius:12px;padding:12px;margin:12px 0;background:#fff');
  const cartTitle=E('h3','🛒 Carrito privado de pruebas');
  css(cartTitle,'font-size:16px;margin:0 0 6px');
  const cartLines=E('div'),cartStatus=info('Carrito QA vacío. No admite envíos, cobros ni pedidos reales.');
  cartStatus.setAttribute('role','status');
  cartBox.append(cartTitle,info('Los precios mixtos se recalculan en Neon Romo. Nunca se cobran ni generan pedidos.'),paymentSelect.wrap,cartLines,cartStatus);
  paymentSelect.input.onchange=()=>{void quoteCart();};
  async function quoteCart(){
   const requestNumber=++requestSerial;
   if(!projection||(selected.size===0&&configuredPromos.size===0)){
    cartStatus.textContent='Carrito QA vacío. No existe ninguna solicitud comercial.';
    return;
   }
   cartStatus.textContent='Comprobando precios y disponibilidad en el servidor de Romo…';
   try{
    const token=await window.ukiInventarioToken?.();
    if(!token)throw Error('Ingresa con tu sesión Google de dueños');
    const body={action:'simularMixto',
     revisionComercial:projection.revisionComercial,
     revisionAdministracion:projection.revisionAdministracion,
     payment:paymentSelect.input.value,
     items:[...selected].map(([sku,qty])=>({sku,qty})).concat(
      [...configuredPromos.values()].map(p=>({sku:p.sku,qty:p.qty,config:p.config}))
     )
    };
    const res=await fetch('/api/romo-carta-vista-previa-admin-qa',{
     method:'POST',cache:'no-store',credentials:'same-origin',
     headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},
     body:JSON.stringify(body),signal:AbortSignal.timeout(15000)
    });
    const result=await res.json().catch(()=>null);
    if(requestNumber!==requestSerial)return;
    if(!res.ok||result?.ok!==true||result.storeId!==STORE||
       result.simulacion!==true||result.canSendOrder!==false||
       result.countsAsSale!==false||
       result.revisionComercial!==projection.revisionComercial||
       result.revisionAdministracion!==projection.revisionAdministracion)
     throw Error(result?.error||'El carrito no se pudo comprobar');
    cartStatus.textContent='✓ Subtotal de prueba: '+money(result.subtotalProductos)+
      ' · '+result.qtyTotal+' unidades · revisión '+result.revisionAdministracion+
      '. No incluye armado, adicionales ni delivery. No se puede enviar o cobrar.';
   }catch(error){
    if(requestNumber!==requestSerial)return;
    cartStatus.textContent='No se confirmó la simulación: '+String(error.message||error)+
     '. Actualiza la vista previa antes de reintentar.';
   }
  }
  function drawCart(){
   clear(cartLines);
   if(!projection||(selected.size===0&&configuredPromos.size===0)){
    cartLines.append(info('Selecciona productos de la lista para comprobar el subtotal.'));
   }else{
    const bySku=new Map(projection.products.map(p=>[p.sku,p]));
    for(const [sku,qty] of selected){
     const product=bySku.get(sku);
     if(!product)continue;
     const line=css(E('div'),'display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:1px solid #f0e1e5;padding:8px 0');
     const detail=css(E('span',product.name+' · '+qty+' × '+money(product.precioFinal)),'flex:1;min-width:150px;font-size:13px');
     const minus=button('−',()=>{
      if(qty<=1)selected.delete(sku);else selected.set(sku,qty-1);
      drawCart();
     },true);
     const plus=button('+',()=>{
      if(qty>=20)return;
      selected.set(sku,qty+1);drawCart();
     },true);
     minus.disabled=false;plus.disabled=qty>=20;
     line.append(detail,minus,plus);cartLines.append(line);
    }
    for(const [sku,p] of configuredPromos){
     const product=bySku.get(sku);
     if(!product)continue;
     const line=css(E('div'),'display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #f0e1e5;padding:8px 0');
     const desc=css(E('span',product.name+' · '+p.qty+' × '+money(product.precioFinal)+
      ' · '+(product.promoType==='sushi'?'armado configurado':'oferta fija sin armado')),
      'flex:1;min-width:180px;font-size:13px');
     const del=button('Quitar promoción',()=>{
      configuredPromos.delete(sku);drawCart();
     },true);
     del.disabled=false;line.append(desc,del);cartLines.append(line);
    }
    const clearButton=button('Vaciar carrito de prueba',()=>{
     selected.clear();configuredPromos.clear();drawCart();
    },true);
    clearButton.disabled=false;cartLines.append(clearButton);
   }
   void quoteCart();
  }
  function cartaClienteQA(){
   const frameOrigin='https://romos-sushi-carta-qa-git-release-romo-357bb1-diannaleandra-7046.vercel.app';
   const card=panel('🍣 Ver carta original de Romo como cliente · solo QA');
   card.append(info('Misma presentación y carrito de Romo. Los precios, promociones y categorías se cargan desde esta sesión de dueños. No envía WhatsApp, cobra ni registra pedidos.'));
   const statusText=info('Abre la carta privada para revisar el menú como lo vería un cliente.');
   const stage=E('div');stage.style.cssText='width:100%;overflow:hidden;margin-top:9px';
   const buttonView=button('Mostrar carta real de prueba',()=>{
    if(!projection){statusText.textContent='Primero comprueba la vista previa de Romo.';return;}
    clear(stage);
    buttonView.disabled=true;
    statusText.textContent='Conectando la carta original con la revisión privada de Romo…';
    const frame=E('iframe');
    frame.title='Romo Sushi · Carta visual de pruebas sin pedidos';
    frame.src=frameOrigin+'/api/romo-vista-cliente-privada-qa';
    frame.setAttribute('sandbox','allow-scripts allow-forms allow-same-origin');
    frame.setAttribute('loading','eager');
    css(frame,'display:block;width:100%;height:720px;border:1px solid #d4b3bd;border-radius:12px;background:#141114');
    async function messenger(ev){
     if(ev.source!==frame.contentWindow||ev.origin!==frameOrigin||
      ev.data?.storeId!==STORE)return;
     if(ev.data.type==='romo-qa-owner-ready'){
      try{
       if(!projection)throw Error('La revisión privada caducó');
       const photos={};
       const wanted=projection.products.filter(p=>p.photoVersion>0);
       // Fotos en la propia sesión autenticada: nunca enviar el token al iframe.
       for(let start=0;start<Math.min(wanted.length,40);start+=4){
        const chunk=wanted.slice(start,start+4);
        const done=await Promise.allSettled(chunk.map(async p=>{
         const image=await photoRequest('GET',null,p.sku);
         if(image.sku===p.sku&&image.version===p.photoVersion&&
            image.draftOnly===true&&typeof image.image==='string'&&
            /^data:image\/jpeg;base64,/.test(image.image)&&image.image.length<1400000)
          photos[p.sku]=image.image;
        }));
        if(done.some(x=>x.status==='rejected'))
         statusText.textContent='Se omitió una fotografía de prueba no disponible.';
       }
       if(!frame.isConnected)return;
       frame.contentWindow.postMessage({type:'romo-qa-owner-data',storeId:STORE,
        projection,photos},frameOrigin);
      }catch(err){
       statusText.textContent='No se pudo conectar la carta: '+String(err.message||err);
      }
     }else if(ev.data.type==='romo-qa-owner-loaded'){
      statusText.textContent='✓ Carta real cargada en modo pruebas · '+
       ev.data.products+' productos. Los pedidos están bloqueados.';
     }else if(ev.data.type==='romo-qa-owner-error'){
      statusText.textContent='No se pudo validar la carta real. No se ha habilitado ningún pedido.';
     }
    }
    window.addEventListener('message',messenger);
    const close=button('Cerrar carta de prueba',()=>{
     window.removeEventListener('message',messenger);
     frame.remove();clear(stage);buttonView.disabled=false;
     statusText.textContent='La carta de pruebas está cerrada. Puedes volver a abrirla.';
    },true);
    close.disabled=false;stage.append(close,frame);
   },true);
   buttonView.disabled=false;card.append(buttonView,statusText,stage);return card;
  }
  function publicationCheck(){
   const card=panel('📋 Comprobar compatibilidad con carta pública · sin publicar');
   card.append(info('Analiza categorías, precios, productos propios y promociones. Detecta funciones pendientes, pero no publica ni modifica la carta comercial.'));
   const result=info('La publicación requiere comprobación final de dueños.');
   const list=E('div');
   const buttonReview=button('Revisar diferencias y requisitos',async()=>{
    if(!projection)return;
    result.textContent='Comparando la carta aprobada con los borradores de Romo…';
    clear(list);
    try{
     const token=await window.ukiInventarioToken?.();
     if(!token)throw Error('Debes ingresar como dueña de Romo');
     const response=await fetch('/api/romo-carta-vista-previa-admin-qa',{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{Authorization:'Bearer '+token,Accept:'application/json',
       'Content-Type':'application/json'},
      body:JSON.stringify({action:'revisarPrepublicacion',
       revisionComercial:projection.revisionComercial,
       revisionAdministracion:projection.revisionAdministracion}),
      signal:AbortSignal.timeout(18000)
     });
     const json=await response.json().catch(()=>null);
     if(!response.ok||json?.ok!==true||json.storeId!==STORE||
       json.readOnly!==true||json.publishable!==false||
       !Array.isArray(json.items)||!Array.isArray(json.pendientes))
      throw Error(json?.error||'No se pudo confirmar la compatibilidad');
     result.textContent='✓ Revisión técnica realizada · '+json.summary.productos+
      ' productos · '+json.summary.nuevos+' propios nuevos · '+
      json.summary.categorias+' categorías. No se publicó nada.';
     for(const pending of json.pendientes){
      const line=info('• '+pending);
      list.append(line);
     }
    }catch(error){
     result.textContent='No se pudo confirmar la revisión: '+String(error.message||error);
    }
   },true);
   buttonReview.disabled=false;
   card.append(buttonReview,result,list);
   return card;
  }
  function gohanSimulator(){
   const card=panel('🍚 Gohan personalizado · simulación privada');
   const ids=['gohan-vegetariano','gohan-pollo','gohan-camaron','gohan-salmon'];
   const all=ids.map(id=>projection.products.find(p=>p.sku==='dish:'+id))
    .filter(p=>p&&p.available===true);
   if(!all.length){card.append(info('No hay gohan disponibles en esta revisión.'));return card;}
   const opts=(projection.ingredients||[]).filter(i=>
    ['Vegetales','vegetal'].includes(i.category)&&i.name!=='Palta'&&
    i.available!==false&&(i.draftOnly?i.surfaces?.includes('gohan'):
     Number.isSafeInteger(i.contexts?.clasicas)));
   const selected=select('Gohan',all.map(p=>[p.sku.slice(5),p.name]),all[0].sku.slice(5));
   const veg1=select('Vegetal',opts.map(i=>[i.name,i.name]),opts[0]?.name||'');
   const veg2=select('Segundo vegetal para vegetariano',
    opts.map(i=>[i.name,i.name]),opts[1]?.name||opts[0]?.name||'');
   const sauce=select('Salsa',[['Soya','Soya'],['Teriyaki','Teriyaki']],'Soya');
   const qty=field('Cantidad',1,'number');qty.input.min='1';qty.input.max='20';
   const statusText=info('El gohan se calcula usando el motor original de Romo y los ingredientes de Neon QA.');
   const toggle=()=>{veg2.wrap.hidden=selected.input.value!=='gohan-vegetariano';};
   selected.input.onchange=toggle;toggle();
   const validate=button('Calcular gohan de prueba',async()=>{
    statusText.textContent='Verificando preparación y precio del gohan…';
    try{
     const token=await window.ukiInventarioToken?.();
     if(!token)throw Error('Ingresa con tu cuenta de dueños');
     const item={kind:'dish',productId:selected.input.value,
      qty:Number(qty.input.value),vegetables:[veg1.input.value,
       ...(selected.input.value==='gohan-vegetariano'?[veg2.input.value]:[])],
      sauce:sauce.input.value};
     const r=await fetch('/api/romo-carta-vista-previa-admin-qa',{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{Authorization:'Bearer '+token,Accept:'application/json',
       'Content-Type':'application/json'},
      body:JSON.stringify({action:'simularArmado',item,
       revisionComercial:projection.revisionComercial,
       revisionAdministracion:projection.revisionAdministracion}),
      signal:AbortSignal.timeout(18000)
     });
     const x=await r.json().catch(()=>null);
     if(!r.ok||x?.ok!==true||x.storeId!==STORE||
       x.canSendOrder!==false||x.canPay!==false||
       x.countsAsSale!==false||x.totalComercial!==null)
      throw Error(x?.error||'No se confirmó el gohan');
     statusText.textContent='✓ '+x.name+' · precio base '+money(x.precioBaseConDescuento)+
      ' · recargos validados '+money(x.recargosArmado)+
      ' · subtotal de prueba '+money(x.subtotalProductos)+
      '. Sin cobro, delivery ni pedido.';
    }catch(e){statusText.textContent='Gohan no confirmado: '+String(e.message||e);}
   },true);validate.disabled=false;
   const inner=stack();inner.append(selected.wrap,veg1.wrap,veg2.wrap,sauce.wrap,
    qty.wrap,validate,statusText);card.append(inner);return card;
  }
  function modalidadSimulator(){
   const card=panel('🛵 Delivery, retiro y consumo · simulación');
   card.append(info('El delivery real exige una ruta por calles. Las distancias siguientes son escenarios para probar la tarifa, no recorridos ni direcciones reales.'));
   const mode=select('Modalidad',[['delivery','Delivery'],['retiro','Retiro en local'],
    ['consumo','Consumo en local']],'retiro');
   const km=select('Distancia hipotética para la prueba',[
    ['','Sin ruta verificada'],['1','1 km de prueba'],['2','2 km de prueba'],
    ['3','3 km de prueba'],['4.5','4,5 km de prueba'],['5','5 km de prueba'],
    ['6','6 km de prueba'],['8','8 km de prueba'],['9','9 km: consultar']
   ],'');
   const statusText=info('Añade al carrito un producto sencillo o una promoción configurada para probar la modalidad.');
   const toggle=()=>{km.wrap.hidden=mode.input.value!=='delivery';};
   mode.input.onchange=toggle;toggle();
   const run=button('Comprobar modalidad QA',async()=>{
    statusText.textContent='Verificando modalidad y pago en el servidor de Romo…';
    try{
     if(!projection||(!selected.size&&!configuredPromos.size))
      throw Error('Primero añade un producto al carrito de prueba');
     const token=await window.ukiInventarioToken?.();
     if(!token)throw Error('Ingresa con Google como dueña de Romo');
     const body={action:'simularModalidad',mode:mode.input.value,
      payment:paymentSelect.input.value,
      revisionComercial:projection.revisionComercial,
      revisionAdministracion:projection.revisionAdministracion,
      items:[...selected].map(([sku,qty])=>({sku,qty})).concat(
       [...configuredPromos.values()].map(x=>({sku:x.sku,qty:x.qty,config:x.config}))),
      ...(mode.input.value==='delivery'&&km.input.value
       ?{kmEscenario:Number(km.input.value)}:{})
     };
     const response=await fetch('/api/romo-carta-vista-previa-admin-qa',{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{Authorization:'Bearer '+token,Accept:'application/json',
       'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:AbortSignal.timeout(18000)
     });
     const result=await response.json().catch(()=>null);
     if(!response.ok||result?.ok!==true||result.storeId!==STORE||
       result.canSendOrder!==false||result.countsAsSale!==false||
       result.totalComercial!==null||result.deliveryFee!==null)
      throw Error(result?.error||'No se confirmó la modalidad');
     statusText.textContent='✓ '+mode.input.value+
      ' · productos '+money(result.productos)+
      (result.tarifaEscenario===null?' · delivery pendiente de ruta real':
       ' · escenario de reparto '+money(result.tarifaEscenario))+
      (result.referenciaSinCobro===null?' · sin total confirmado':
       ' · referencia de prueba '+money(result.referenciaSinCobro))+
      '. No se registró ningún pedido ni cobro.';
    }catch(e){statusText.textContent='Modalidad no confirmada: '+String(e.message||e);}
   },true);run.disabled=false;
   const inner=stack();inner.append(mode.wrap,km.wrap,run,statusText);
   card.append(inner);return card;
  }
  function assembledExamples(){
   const card=panel('🍣 Simular armado original de Romo (solo prueba)');
   const options=[
    ['classic:24','24 piezas clásicas · 2 rolls'],
    ['classic:24:extra','24 piezas · envoltura palta y salsa extra'],
    ['monthly:handroll-individual','Handroll individual'],
    ['dish:papitas','Papitas fritas']
   ];
   const chooser=select('Ejemplo de armado a revisar',options);
   const result=info('Utiliza el motor original de Romo, pero no permite enviar pedidos.');
   const available=(category,context)=>{
    const all=(projection?.ingredients||[]).filter(item=>{
     const valid=category==='Proteínas'?['Proteínas','proteina'].includes(item.category):
      category==='Vegetales'?['Vegetales','vegetal'].includes(item.category):
      ['Envolturas','envoltura'].includes(item.category);
     return valid&&item.available!==false&&
      (item.draftOnly===true?item.surfaces?.includes('classic'):
       Number.isSafeInteger(item.contexts?.[context]));
    });
    return all.map(item=>[item.name,item.name+
     (item.draftOnly?' · nuevo':'')+
     (Number((item.draftOnly?item.surcharge:item.contexts?.[context])||0)>0
       ?' · +'+money(item.draftOnly?item.surcharge:item.contexts[context]):'')]);
   };
   const protein=select('Proteína del clásico',available('Proteínas','clasicas'),'Pollo');
   const vegetable=select('Vegetal del clásico',available('Vegetales','clasicas'),'Palta');
   const wrap=select('Envoltura del clásico',available('Envolturas','clasicas'),'Panko');
   const ingredientsBox=stack();
   ingredientsBox.append(info('Prueba ingredientes disponibles o recién creados en el panel. Los tres selectores se aplican al ejemplo «24 piezas clásicas».'),
      protein.wrap,vegetable.wrap,wrap.wrap);
   function sample(key){
    const roll=()=>({protein:'Pollo',vegetable:'Palta',wrap:'Panko',vegetariano:false});
    const selected=()=>({
     protein:protein.input.value||'Pollo',
     vegetable:vegetable.input.value||'Palta',
     wrap:wrap.input.value||'Panko',
     vegetariano:false
    });
    if(key==='dish:papitas')return {kind:'dish',productId:'papitas',qty:1};
    if(key==='monthly:handroll-individual')return {kind:'monthly',productId:'handroll-individual',
     qty:1,rolls:[roll()],sauces:['Soya'],toppings:[]};
    if(key==='classic:24:extra')return {kind:'classic',size:24,qty:1,
     rolls:[{...roll(),wrap:'Palta'},roll()],sauces:['Soya'],
     extraSauces:[{name:'Soya',qty:1}],toppings:[]};
    return {kind:'classic',size:24,qty:1,rolls:[selected(),selected()],
     sauces:['Soya'],extraSauces:[],toppings:[]};
   }
   const run=button('Comprobar armado completo QA',async()=>{
    if(!projection)return;
    result.textContent='Calculando el armado con el motor original de Romo…';
    try{
     const token=await window.ukiInventarioToken?.();
     if(!token)throw Error('Ingresa con Google como dueña de Romo');
     const item=sample(chooser.input.value);
     const res=await fetch('/api/romo-carta-vista-previa-admin-qa',{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({action:'simularArmado',item,
       revisionComercial:projection.revisionComercial,
       revisionAdministracion:projection.revisionAdministracion}),
      signal:AbortSignal.timeout(18000)
     });
     const q=await res.json().catch(()=>null);
     if(!res.ok||q?.ok!==true||q.storeId!==STORE||
       q.simulacion!==true||q.countsAsSale!==false||
       q.canSendOrder!==false||q.totalComercial!==null)
      throw Error(q?.error||'El motor de Romo rechazó el armado');
     const diff=Number(q.variacionIngredientes||0);
     result.textContent='✓ '+q.name+' · base '+money(q.precioBaseConDescuento)+
       ' · recargos del armado '+money(q.recargosArmado)+
       (diff?' · diferencia por ingredientes '+(diff>0?'+':'−')+money(Math.abs(diff)):'')+
       ' · subtotal de prueba '+money(q.subtotalProductos)+
       '. No incluye delivery ni pagos. No es un pedido.';
    }catch(e){
     result.textContent='Armado no confirmado: '+String(e.message||e)+
      '. No se ha registrado ningún pedido.';
    }
   },true);
   run.disabled=false;
   const wrapper=stack();wrapper.append(chooser.wrap,ingredientsBox,run,result);card.append(wrapper);return card;
  }
  function promotionBuilder(){
   const card=panel('🎁 Configurar promoción nueva de Romo · solo QA');
   const promos=(projection?.products||[]).filter(p=>
     p.kind==='monthly'&&p.draftOnly===true&&
     ['sushi','combo','gohan'].includes(p.promoType)&&p.available===true);
   if(!promos.length){
    card.append(info('No hay promociones nuevas configurables. Las aprobadas conservan su armado original.'));
    return {card,open:()=>{card.open=true;}};
   }
   const choose=select('Promoción nueva',promos.map(p=>[p.sku,p.name+
     ' · '+(p.promoType==='sushi'?p.rollCount+' rolls':'oferta fija')+
     ' · '+money(p.precioFinal)]),promos[0].sku);
   const form=stack(),result=info('Completa rolls, salsas y medio de pago; el cálculo se realiza en Neon Romo QA.');
   card.append(info('Solo muestra un subtotal de referencia: no envía pedidos ni cobra.'),choose.wrap,form,result);
   const options=(category)=>{
    return (projection.ingredients||[]).filter(i=>{
     const is=category==='proteina'?['proteina','Proteínas'].includes(i.category):
      category==='vegetal'?['vegetal','Vegetales'].includes(i.category):
      ['envoltura','Envolturas'].includes(i.category);
     return is&&i.available!==false&&(i.draftOnly===true?
      i.surfaces?.includes('monthly'):
      category==='vegetal'?i.contexts?.clasicas!==undefined:
       i.contexts?.clasicas!==undefined||i.contexts?.mensual_extra!==undefined);
    }).map(i=>[i.name,i.name+(i.draftOnly?' · añadido':'')]);
   };
   const fill=()=>{
    clear(form);result.textContent='Configura la promoción de prueba sin modificar la carta comercial.';
    const p=promos.find(q=>q.sku===choose.input.value);
    if(!p)return;
    const qty=field('Cantidad de promociones',1,'number');qty.input.min='1';qty.input.max='20';
    form.append(qty.wrap);
    if(p.promoType!=='sushi'){
     form.append(info('Oferta fija '+p.promoType+': no tiene rolls ni salsas personalizables en su ficha. No sustituye un gohan armado.'));
     const fixedPay=select('Medio de pago permitido',
      (p.payments||[]).map(x=>[x,x.charAt(0).toUpperCase()+x.slice(1)]),p.payments?.[0]||'');
     form.append(fixedPay.wrap);
     const addFixed=button('Incluir oferta fija en carrito QA',()=>{
      if(configuredPromos.size+selected.size>=35&&!configuredPromos.has(p.sku)){
       result.textContent='El carrito admite como máximo 35 productos.';return;
      }
      const q=Number(qty.input.value);
      if(!Number.isSafeInteger(q)||q<1||q>20){
       result.textContent='Cantidad fuera del rango de pruebas.';return;
      }
      paymentSelect.input.value=fixedPay.input.value;
      configuredPromos.set(p.sku,{sku:p.sku,qty:q,config:{}});
      result.textContent='Oferta fija incorporada a la simulación, pendiente de validación por servidor.';
      drawCart();
     },true);
     addFixed.disabled=false;form.append(addFixed);
     return;
    }
    const rolls=[];
    for(let j=0;j<p.rollCount;j++){
     const panelRoll=panel('Roll '+(j+1)+' · '+p.piecesPerRoll+' piezas');
     const protein=select('Proteína',options('proteina'),'Pollo');
     const veg=select('Vegetal',options('vegetal'),'Palta');
     const veg2=select('Segundo vegetal (vegetariano)',options('vegetal'),'Cebollín');
     const wrap=select('Envoltura',options('envoltura'),'Panko');
     const vegetarian=field('Vegetariano · dos vegetales',false,'checkbox');
     const sinNori=field('Sin nori',false,'checkbox');
     const sinQueso=field('Sin queso crema',false,'checkbox');
     const base=stack();base.append(vegetarian.wrap,protein.wrap,veg.wrap,veg2.wrap,
      wrap.wrap,sinNori.wrap,sinQueso.wrap);
     const toggle=()=>{
      veg2.wrap.hidden=!vegetarian.input.checked;
      protein.wrap.hidden=vegetarian.input.checked;
     };
     vegetarian.input.onchange=toggle;toggle();panelRoll.append(base);
     form.append(panelRoll);
     rolls.push({protein,veg,veg2,wrap,vegetarian,sinNori,sinQueso});
    }
    const sauces=[];
    for(let i=0;i<p.sauceCount;i++){
     const sauce=select('Salsa incluida '+(i+1),
       [['Soya','Soya'],['Teriyaki','Teriyaki']],'Soya');
     sauces.push(sauce);form.append(sauce.wrap);
    }
    const payment=select('Medio de pago permitido (solo simulación)',
     (p.payments||[]).map(x=>[x,x.charAt(0).toUpperCase()+x.slice(1)]),p.payments?.[0]||'');
    form.append(payment.wrap);
    const run=button('Calcular promoción configurada · QA',async()=>{
     result.textContent='Verificando armado y precio en el servidor de Romo…';
     try{
      const token=await window.ukiInventarioToken?.();
      if(!token)throw Error('Inicia sesión Google como dueña de Romo');
      const item=rolls.map(x=>({
       protein:x.vegetarian.input.checked?'':x.protein.input.value,
       vegetable:x.veg.input.value,
       ...(x.vegetarian.input.checked?{vegetable2:x.veg2.input.value}:{}),
       wrap:x.wrap.input.value,
       vegetariano:x.vegetarian.input.checked,
       sinNori:x.sinNori.input.checked,
       sinQueso:x.sinQueso.input.checked
      }));
      const response=await fetch('/api/romo-carta-vista-previa-admin-qa',{
       method:'POST',cache:'no-store',credentials:'same-origin',
       headers:{Authorization:'Bearer '+token,Accept:'application/json',
        'Content-Type':'application/json'},
       body:JSON.stringify({action:'simularPromocion',sku:p.sku,
        qty:Number(qty.input.value),rolls:item,sauces:sauces.map(x=>x.input.value),
        payment:payment.input.value,
        revisionComercial:projection.revisionComercial,
        revisionAdministracion:projection.revisionAdministracion}),
       signal:AbortSignal.timeout(18000)
      });
      const data=await response.json().catch(()=>null);
      if(!response.ok||data?.ok!==true||data.storeId!==STORE||
       data.simulacion!==true||data.canSendOrder!==false||
       data.countsAsSale!==false||data.totalComercial!==null||
       data.sku!==p.sku)throw Error(data?.error||'No se confirmó la promoción');
      result.textContent='✓ '+p.name+' · '+data.piezas+' piezas · '+
       p.korokes+' korokes · precio base '+money(data.baseConDescuento)+
       ' · recargos '+money(data.recargosArmado)+
       ' · subtotal de prueba '+money(data.subtotalProductos)+
       ' · pago permitido '+data.paymentValidated+
       '. Nada se envía a clientes.';
      if(configuredPromos.size+selected.size>=35&&!configuredPromos.has(p.sku)){
       result.textContent+=' No se agregó al carrito porque llegó a 35 productos.';
       return;
      }
      paymentSelect.input.value=payment.input.value;
      configuredPromos.set(p.sku,{sku:p.sku,qty:Number(qty.input.value),
       config:{rolls:item,sauces:sauces.map(x=>x.input.value)}});
      drawCart();
     }catch(error){result.textContent='Promoción no confirmada: '+String(error.message||error);}
    },true);
    run.disabled=false;form.append(run);
   };
   choose.input.onchange=fill;fill();
   return {card,open:sku=>{
    if(promos.some(p=>p.sku===sku)){choose.input.value=sku;fill();}
    card.open=true;
   }};
  }
  async function fetchPreview(){
   message.textContent='Comprobando proyección privada de Romo…';
   clear(content);projection=null;selected.clear();configuredPromos.clear();++requestSerial;
   try{
    const token=await window.ukiInventarioToken?.();
    if(!token)throw Error('Inicia sesión como dueña de Romo');
    const response=await fetch('/api/romo-carta-vista-previa-admin-qa',{
     method:'GET',cache:'no-store',credentials:'same-origin',
     headers:{Authorization:'Bearer '+token,Accept:'application/json'},
     signal:AbortSignal.timeout(15000)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.ok!==true||data.storeId!==STORE||
       data.draftOnly!==true||data.publishable!==false||
       !Array.isArray(data.products)||data.products.length<40)
     throw Error(data?.error||'La vista previa no está confirmada');
    projection=data;
    const p=data.summary;
    message.textContent='✓ Vista previa privada comprobada. Ningún pedido ni cambio está publicado para clientes.';
    const summary=css(E('div'),'background:#faf5f6;border-radius:10px;padding:11px;line-height:1.8;font-size:13px');
    summary.textContent='Revisión comercial '+data.revisionComercial+
     ' · revisión administrativa '+data.revisionAdministracion+
     ' · '+p.totalProducts+' productos ('+p.baseProducts+' originales, '+
     p.newProducts+' nuevos y '+p.newPromotions+' promociones nuevas) · '+
     p.ingredients+' ingredientes · '+p.categories+' categorías · '+
     p.discounts+' descuentos · '+p.photos+' fotografías.';
    const promoWidget=promotionBuilder();
    content.append(summary,cartaClienteQA(),publicationCheck(),assembledExamples(),gohanSimulator(),promoWidget.card,cartBox,modalidadSimulator());
    drawCart();
    const search=field('Buscar productos en la vista previa');
    search.input.type='search';search.input.placeholder='Producto o categoría';
    content.append(search.wrap);
    const list=E('div');content.append(list);
    const draw=()=>{
     clear(list);
     const filter=norm(search.input.value);
     const cats=new Map(data.categories.map(c=>[c.slug,c.nombre]));
     const found=data.products.filter(product=>norm(product.name+' '+(cats.get(product.categoriaSlug)||'')+' '+product.sku).includes(filter));
     list.append(info(found.length+' productos encontrados, con precios proyectados.'));
     for(const product of found.slice(0,90)){
      const item=css(E('div'),'padding:10px 0;border-bottom:1px solid #e9dce1;display:flex;gap:8px;align-items:center;flex-wrap:wrap');
      const details=css(E('div'),'flex:1;min-width:160px');
      const name=E('strong',product.name);name.style.cssText='display:block;font-size:13px';
      const extra=E('small',(cats.get(product.categoriaSlug)||'Sin categoría')+
       ' · '+money(product.precioOriginal)+
       (product.descuentoPorcentaje>0?' → '+money(product.precioFinal)+
        ' (-'+product.descuentoPorcentaje+'%)':'')+
       ' · '+(product.available?'Disponible':'Agotado')+
       (product.pendingChanges?' · cambio pendiente':'')+
       (product.photoVersion>0?' · foto v'+product.photoVersion:''));
      extra.style.cssText='display:block;color:#666;font-size:12px;line-height:1.45';
      details.append(name,extra);
      if(product.photoVersion>0){
       const photoButton=button('Ver foto privada QA',async()=>{
        photoButton.disabled=true;
        const note=info('Consultando fotografía de Romo…');details.append(note);
        try{
         const image=await photoRequest('GET',null,product.sku);
         if(!image.image||image.sku!==product.sku||
            image.version!==product.photoVersion||image.draftOnly!==true)
          throw Error('La fotografía cambió. Actualiza la carta de pruebas.');
         const img=E('img');img.src=image.image;img.alt='Fotografía de '+product.name;
         css(img,'max-width:150px;width:100%;height:auto;display:block;border-radius:10px;margin-top:7px');
         details.append(img);note.textContent='Fotografía privada, no publicada a clientes.';
        }catch(error){
         note.textContent='No se confirmó la fotografía: '+String(error.message||error);
         photoButton.disabled=false;
        }
       },true);
       photoButton.disabled=false;details.append(photoButton);
      }
      const promoCustom=product.kind==='monthly'&&product.draftOnly===true;
      const promoUnsupported=promoCustom&&!['sushi','combo','gohan'].includes(product.promoType);
      const originalArmado=!promoCustom&&(
       ['classic','premium','monthly'].includes(product.kind)||
       (product.kind==='dish'&&/^dish:(gohan-|sushi-burger)/.test(product.sku)));
      const addButton=button(promoUnsupported?'Pendiente: tipo de promoción':
       originalArmado?'Armado original separado':
       promoCustom?'Configurar promoción QA':'Añadir a prueba',()=>{
       if(promoUnsupported||originalArmado)return;
       if(promoCustom){promoWidget.open(product.sku);return;}
       const qty=selected.get(product.sku)||0;
       if(selected.size+configuredPromos.size>=35&&!selected.has(product.sku)){
        cartStatus.textContent='El carrito de pruebas admite como máximo 35 productos.';return;
       }
       if(qty>=20)return;
       selected.set(product.sku,qty+1);drawCart();
      },true);
      addButton.disabled=product.available!==true||promoUnsupported||originalArmado;
      item.append(details,addButton);list.append(item);
     }
     if(found.length>90)list.append(info('Usa el buscador para encontrar otros productos.'));
    };
    search.input.oninput=draw;draw();
   }catch(error){
    message.textContent='No se pudo verificar la vista previa. '+String(error.message||error);
    clear(content);
   }
  }
  const refresh=button('Comprobar carta y carrito QA',()=>void fetchPreview(),true);
  refresh.disabled=false;container.append(refresh,message,content);
  return container;
 }
 function renderProducts(){
  const target=host('productos');if(!target)return;clear(target);
  target.append(E('h3','Gestión completa de productos'),cardNote(),previewPanel());
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
    const percent=Number(state.admin.data.discounts?.[p.sku]||0);
    const finalPrice=percent?Math.max(1,Math.round(p.price*(100-percent)/100)):p.price;
    const item=panel(p.name+' · '+(percent?money(p.price)+' → '+money(finalPrice):money(p.price))+(p._base?' · Carta aprobada':' · Borrador'));
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
   area.append(info('Productos dentro de la categoría ('+members.length+'):'));
   for(const product of members){
    const assignment=row(),label=css(E('span',product.name),'font-size:13px;flex:1;min-width:130px');
    const pick=select('Mover a',categoryOptions(),product.categoriaSlug);
    pick.wrap.style.flex='1 1 170px';
    assignment.append(label,pick.wrap,button('Guardar',()=>{
     void save('category-assign',{id:product.sku,category:pick.input.value},
      'Mover '+product.name+' de categoría');
    },true));
    assignment.append(button('Quitar',()=>{
     void save('category-assign',{id:product.sku,category:''},
      'Quitar '+product.name+' de categoría');
    },true));
    area.append(assignment);
   }
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
  const config=()=>{
   const fixed=type.input.value!=='sushi';
   if(fixed){
    rolls.input.value='0';sauces.input.value='0';
   }else if(Number(rolls.input.value)===0&&create){
    rolls.input.value='2';sauces.input.value='1';
   }
   rolls.input.disabled=fixed;pieces.input.disabled=fixed;sauces.input.disabled=fixed;
   rolls.wrap.title=fixed?'Solo ofertas fijas: sin rolls':'';
  };
  type.input.onchange=config;config();
  if(type.input.value!=='sushi'&&create)
   box.append(info('Gohan y combo: solo ofertas fijas sin personalización de ingredientes. Las recetas armables aún no están disponibles.'));
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
  newCard.append(info('Tipos de Romo: sushi personalizable, gohan fijo o combo fijo; no pizzas. Las fotos permanecen privadas hasta publicar la versión aprobada.'));
  newCard.append(promotionForm(null,true));target.append(newCard);
  const search=field('Buscar promoción por nombre');search.input.type='search';
  target.append(search.wrap);
  const list=E('div');target.append(list);
  const draw=()=>{
   clear(list);const found=promos().filter(p=>norm(p.name).includes(norm(search.input.value)));
   list.append(info(found.length+' promociones disponibles en administración.'));
   for(const p of found){
    const percent=Number(state.admin.data.discounts?.[p.sku]||0);
    const finalPrice=percent?Math.max(1,Math.round(p.price*(100-percent)/100)):p.price;
    const item=panel(p.name+' · '+(percent?money(p.price)+' → '+money(finalPrice):money(p.price))+(p._base?' · Carta aprobada':' · Borrador'));
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
