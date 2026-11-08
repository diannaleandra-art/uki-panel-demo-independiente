/* Uki Sushi · Organización del inventario, informes, disponibilidad y precios.
   No modifica pedidos, caja, reportes de ventas ni cierres. */
(function(){
'use strict';
const API='https://uki-sushi-inventario.vercel.app/api/uki-carta-precios-live';
const STOCK_API='https://uki-sushi-inventario.vercel.app/api/inventario-turno-live';
const PHOTO_API='https://uki-sushi-inventario.vercel.app/api/uki-carta-fotos-live';
const state={tab:'inventario',branch:'',items:[],photos:{},query:'',group:'all',busy:false,ready:false};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const peso=n=>'$'+Number(n).toLocaleString('es-CL');
const units={un:'unidades',kg:'kg',g:'g',l:'litros',ml:'ml',porciones:'porciones'};
const menu=[
 ['precios','Carta y precios','Agregar productos y editar precios'],
 ['disponibilidad','Disponible / Agotado','Control manual de lo que puede pedir el cliente'],
 ['inventario','Inventario','Existencias, unidades y nuevos insumos'],
 ['reportes','Revisiones y compras','Faltantes para reponer y conteos del personal']
];
const prevPanel=window.ukiInventarioPanelHTML,prevMount=window.ukiInventarioMontar;
if(typeof prevPanel!=='function'||typeof prevMount!=='function')return;
const nav='<style id="ukiAdminTabsStyle">#ukiInvTabButtons button[aria-pressed="true"]{border:2px solid #d47109!important;background:#fff0de!important;box-shadow:inset 0 0 0 1px #d47109}#ukiInvTabButtons button:focus-visible{outline:3px solid #d47109;outline-offset:2px}#ukiAdminViewHeader{border-left:4px solid #ef820e!important}</style>'+
'<div class="card" id="ukiInvTabs"><h2>Administrar Uki Sushi</h2>'+
'<p class="muted">Elige una función. Se mostrará solamente esa sección y la sucursal con la que ingresaste.</p>'+
'<p id="ukiInvSucursalActiva" class="mini-help" role="status"></p>'+
'<div class="quick-grid" id="ukiInvTabButtons">'+menu.map(([id,label,description])=>
'<button type="button" class="quick" data-uki-tab="'+id+'" aria-pressed="false" style="height:auto;min-height:95px;display:block;text-align:left">'+
'<strong>'+label+'</strong><small style="display:block;font-size:12px;margin-top:6px;line-height:1.35">'+description+'</small></button>').join('')+'</div></div>'+
'<section class="card" id="ukiAdminViewHeader" style="scroll-margin-top:130px;padding:14px 16px">'+
'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
'<div><small style="font-weight:700;color:#9b632d">FUNCIÓN SELECCIONADA</small>'+
'<h2 id="ukiAdminCurrentTitle" style="margin:4px 0">Inventario</h2>'+
'<p id="ukiAdminCurrentDescription" class="muted" style="margin:0"></p></div>'+
'<button type="button" id="ukiAdminCambiar" class="sm">↑ Cambiar función</button>'+
'</div></section>';
const pricesPanel=[
 '<div class="card" id="ukiPreciosPanel"><h2>🧾 Carta y precios</h2>',
 '<p class="mini-help">Estos son los productos que vendes, no los artículos del inventario. Los cambios serán independientes por sucursal. Solo administración Google.</p>',
 '<div class="quick-grid"><div><label for="ukiPriceSearch">Buscar producto</label><input id="ukiPriceSearch" type="search" placeholder="Pizza, gohan, 24 piezas…"></div>',
 '<div><label for="ukiPriceGroup">Categoría</label><select id="ukiPriceGroup">',
 '<option value="all">Todas las categorías</option><option value="pizza">Pizzas</option>',
 '<option value="dish">Entradas, gohan y burgers</option><option value="classic">Promos clásicas</option>',
 '<option value="premium">Premium</option><option value="monthly">Promos del mes</option>',
 '<option value="topping">Toppings</option><option value="extra">Salsas adicionales</option></select></div></div>',
 '<button class="sm" id="ukiPriceReload" type="button">Actualizar precios</button>',
 '<p id="ukiPriceMessage" role="status" class="muted">Carga los precios de la sucursal para comenzar.</p>',
 '<div id="ukiPriceList"></div>',
 '<details id="ukiPriceAddBox" class="card" style="margin-top:15px">',
 '<summary style="cursor:pointer;font-weight:700">＋ Agregar producto a la carta</summary>',
 '<p class="muted">Aquí agregas un producto para vender, no un ingrediente de inventario. De momento admite pizzas en Regimiento Arica y entradas simples.</p>',
 '<label for="ukiPriceNewKind">Categoría</label><select id="ukiPriceNewKind"><option value="pizza">Pizzas</option><option value="dish">Entradas simples</option></select>',
 '<label for="ukiPriceNewName">Nombre</label><input id="ukiPriceNewName" maxlength="100" placeholder="Ej. Pizza Cuatro Quesos">',
 '<label for="ukiPriceNewDesc">Descripción / ingredientes</label><textarea id="ukiPriceNewDesc" maxlength="500" rows="2" placeholder="Ingredientes del producto"></textarea>',
 '<label for="ukiPriceNewAmount">Precio en pesos chilenos</label><input id="ukiPriceNewAmount" type="number" min="1" max="1000000" inputmode="numeric" placeholder="10900">',
 '<button type="button" class="big" id="ukiPriceCreate">Agregar a la carta</button>',
 '</details>',
 '<details id="ukiPromoAddBox" class="card" style="margin-top:14px">',
 '<summary style="cursor:pointer;font-weight:700">＋ Agregar promoción de sushi con fotografía</summary>',
 '<p class="muted">La sucursal queda asignada automáticamente. Primero se guarda un borrador; solo aparece en la carta tras guardar su foto tipo banner.</p>',
 '<label for="ukiPromoName">Nombre de la promoción</label><input id="ukiPromoName" maxlength="100" placeholder="Ej. Promo especial 200 piezas">',
 '<label for="ukiPromoDescription">Qué incluye</label><textarea id="ukiPromoDescription" maxlength="500" rows="2" placeholder="Pollo, kanikama, envolturas y condiciones">',
 '<div class="quick-grid"><div><label for="ukiPromoRollCount">Cantidad de rolls</label><input id="ukiPromoRollCount" type="number" inputmode="numeric" min="1" max="20" value="5"></div>',
 '<div><label for="ukiPromoPiecesPerRoll">Piezas por roll</label><select id="ukiPromoPiecesPerRoll"><option value="12">12 piezas</option><option value="10">10 piezas</option></select></div></div>',
 '<p id="ukiPromoPieceSummary" class="mini-help">5 rolls × 12 piezas = 60 piezas.</p>',
 '<div class="quick-grid"><div><label for="ukiPromoSauces">Salsas incluidas</label><input id="ukiPromoSauces" type="number" inputmode="numeric" min="0" max="20" value="5"></div>',
 '<div><label for="ukiPromoKorokes">Korokes incluidos</label><input id="ukiPromoKorokes" type="number" inputmode="numeric" min="0" max="30" value="0"></div></div>',
 '<label for="ukiPromoPayment">Medios de pago</label><select id="ukiPromoPayment"><option value="normal">Efectivo y transferencia</option><option value="edenred">Solo Edenred</option><option value="todos">Efectivo, transferencia, tarjetas y Edenred</option></select>',
 '<label for="ukiPromoPrice">Precio de venta ($)</label><input id="ukiPromoPrice" type="number" inputmode="numeric" min="1" max="1000000" placeholder="16000">',
 '<label for="ukiPromoPhoto">Foto real o banner de la promoción</label><input id="ukiPromoPhoto" type="file" accept="image/*">',
 '<p class="muted">Si falla la fotografía, la promoción queda como borrador NO visible para clientes.</p>',
 '<button type="button" id="ukiPromoCreate" class="big">Guardar promoción y publicar con foto</button>',
 '</details></div>',
 '<div class="card" id="ukiReponerPanel"><h2>🛒 Qué comprar</h2>',
 '<p class="muted">Resumen por sucursal según el último saldo registrado y los mínimos configurados.</p>',
 '<button type="button" class="sm" id="ukiReponerReload">Actualizar faltantes</button>',
 '<p id="ukiReponerEstado" role="status">Consulta el inventario para ver los faltantes.</p>',
 '<div id="ukiReponerListado"></div>',
 '<p class="mini-help">Los faltantes no marcan productos como Agotados. La disponibilidad se cambia manualmente.</p>',
 '</div>'
].join('');
window.ukiInventarioPanelHTML=()=>nav+prevPanel()+pricesPanel;
function branch(){const active=$('invBranch')?.value||'';return ['arica','serena'].includes(active)?active:'';}
function info(id,message){const el=$(id);if(el)el.textContent=message;}
async function request(api,action,fields={},atBranch=state.branch){
 // Capturar la sucursal ANTES de esperar el token Google: nunca cruzar precios entre locales.
 if(!['arica','serena'].includes(atBranch))throw Error('Selecciona una sucursal válida.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Inicia sesión con Google como administradora de Uki Sushi.');
 const response=await fetch(api,{method:'POST',cache:'no-store',mode:'cors',
  credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({...fields,action,branch:atBranch})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw Error(data.error||'No se pudo consultar o guardar');
 return data;
}
function showTab(){
 const selected=menu.find(([id])=>id===state.tab)||menu[2];
 state.tab=selected[0];
 info('ukiInvSucursalActiva','Sucursal actual: '+(branch()==='serena'?'Uki La Serena':'Uki Regimiento Arica')+'. Para cambiar de local, utiliza «Salir».');
 info('ukiAdminCurrentTitle',selected[1]);
 info('ukiAdminCurrentDescription',selected[2]);
 for(const [id,label] of menu){
  const btn=document.querySelector('[data-uki-tab="'+id+'"]');
  if(!btn)continue;
  const current=state.tab===id;
  btn.setAttribute('aria-pressed',String(current));
  if(current)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
  const title=btn.querySelector('strong');if(title)title.textContent=(current?'✓ ':'')+label;
 }
 const sections={
  precios:['ukiPreciosPanel'],
  disponibilidad:['ukiCartaDisponibilidad'],
  inventario:['ukiInvSectionHead','invRoot','invAdmin','invNewBox','ukiInvWorkerAccess','ukiMiniInventario'],
  reportes:['ukiReponerPanel','ukiHistorial']
 };
 const ids=['ukiInvSectionHead','invRoot','invAdmin','invNewBox','ukiInvWorkerAccess',
  'ukiCartaDisponibilidad','ukiPreciosPanel','ukiReponerPanel','ukiMiniInventario','ukiHistorial','invReportsBox'];
 for(const id of ids){
  const element=$(id);if(element)element.style.display=(sections[state.tab]||[]).includes(id)?'':'none';
 }
 if(state.tab==='precios'&&!state.ready)void loadPrices();
 if(state.tab==='reportes')void loadReponer();
}
// Fotos optimizadas: el mismo menú de Uki, sin servicios adicionales.
function photoUrl(sku,chosen=state.branch){return PHOTO_API+'?branch='+encodeURIComponent(chosen)+'&sku='+encodeURIComponent(sku);}
async function loadPhotos(chosen){
 try{
  const response=await fetch(PHOTO_API+'?branch='+encodeURIComponent(chosen),{cache:'no-store',mode:'cors',credentials:'omit',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return;
  const json=await response.json();if(!json.ok||json.branch!==chosen||!Array.isArray(json.items))return;
  if(chosen===branch())state.photos=Object.fromEntries(json.items.map(x=>[x.sku,x]));
 }catch{/* Un servicio de fotos desconectado no bloquea precios, ingredientes ni ventas. */}
}
function reduceImage(file){
 if(!file||!/^image\//.test(file.type)||file.size>15*1024*1024)return Promise.reject(Error('Elige una fotografía de hasta 15 MB.'));
 return new Promise((resolve,reject)=>{
  const photo=new Image(),url=URL.createObjectURL(file);
  photo.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo abrir la imagen.'))};
  photo.onload=()=>{
   URL.revokeObjectURL(url);
   try{
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Este navegador no admite el ajuste de fotos.');
    for(const side of [1100,900,720,600,480]){
     const ratio=Math.min(1,side/Math.max(photo.naturalWidth,photo.naturalHeight));
     canvas.width=Math.max(1,Math.round(photo.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(photo.naturalHeight*ratio));
     ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(photo,0,0,canvas.width,canvas.height);
     for(const q of [0.8,0.65,0.5,0.35]){
      const jpg=canvas.toDataURL('image/jpeg',q),data=jpg.split(',')[1]||'';
      if(data.length<=340000){resolve({mime:'image/jpeg',data_base64:data});return;}
     }
    }
    reject(Error('No se pudo reducir la fotografía. Elige una imagen más pequeña.'));
   }catch(e){reject(e)}
  };
  photo.src=url;
 });
}
function photoControls(price){
 const wrap=document.createElement('div');wrap.style.cssText='width:100%;border-top:1px dashed #eee0d3;padding-top:8px;margin-top:5px';
 const title=document.createElement('b');title.textContent='📷 Fotografía de la carta';wrap.append(title);
 const current=state.photos[price.sku];
 if(current){
  const img=document.createElement('img');img.src=photoUrl(price.sku)+'&v='+Number(current.version);img.alt='Foto de '+price.name;
  img.style.cssText='display:block;width:125px;height:90px;object-fit:cover;border-radius:10px;margin:8px 0';wrap.append(img);
 }
 const file=document.createElement('input');file.type='file';file.accept='image/jpeg,image/png,image/webp,image/heic,image/heif';
 file.style.cssText='margin:7px 0';file.setAttribute('aria-label','Elegir foto de '+price.name);
 const upload=document.createElement('button');upload.type='button';upload.className='sm ok';upload.textContent=current?'Cambiar foto':'Cargar foto';
 upload.onclick=async()=>{
  if(state.busy)return;
  if(!file.files?.length){info('ukiPriceMessage','Primero selecciona una fotografía desde tu iPhone.');return;}
  const chosen=state.branch;state.busy=true;upload.disabled=true;info('ukiPriceMessage','Reduciendo y guardando foto de '+price.name+'…');
  try{
   const pic=await reduceImage(file.files[0]);
   await request(PHOTO_API,'subir',{sku:price.sku,expected_version:Number(current?.version||0),...pic},chosen);
   state.busy=false;await loadPhotos(chosen);renderPrices();
   if(chosen===branch())info('ukiPriceMessage','✓ Fotografía guardada para '+price.name+'.');
  }catch(e){info('ukiPriceMessage','La foto no se cambió: '+String(e.message));}
  finally{state.busy=false;upload.disabled=false;}
 };
 wrap.append(file,upload);
 if(current){
  const remove=document.createElement('button');remove.type='button';remove.className='sm';remove.style.marginLeft='6px';remove.textContent='Quitar foto';
  remove.onclick=async()=>{
   if(state.busy||!window.confirm('¿Quitar la foto de «'+price.name+'»? La promoción y sus ventas no se eliminan.'))return;
   const chosen=state.branch;state.busy=true;remove.disabled=true;
   try{
    await request(PHOTO_API,'quitar',{sku:price.sku,expected_version:Number(current.version)},chosen);
    state.busy=false;await loadPhotos(chosen);renderPrices();info('ukiPriceMessage','✓ Foto quitada. La promoción sigue disponible.');
   }catch(e){info('ukiPriceMessage','No se quitó la foto: '+String(e.message));}
   finally{state.busy=false;remove.disabled=false;}
  };wrap.append(remove);
 }
 return wrap;
}
function mediosPromo(valor){
 return valor==='edenred'?['edenred']:valor==='todos'?
  ['efectivo','transferencia','debito','credito','edenred']:['efectivo','transferencia'];
}
function modoMediosPromo(pagos){
 const p=Array.isArray(pagos)?pagos:[];
 if(p.length===1&&p[0]==='edenred')return 'edenred';
 if(p.length>2)return 'todos';
 return 'normal';
}
function numeroPromo(id){return Number($(id)?.value);}
function actualizaPiezasPromo(){
 const el=$('ukiPromoPieceSummary');if(!el)return;
 const rolls=numeroPromo('ukiPromoRollCount'),pieces=numeroPromo('ukiPromoPiecesPerRoll');
 el.textContent=Number.isSafeInteger(rolls)&&rolls>=1&&rolls<=20?
  rolls+' rolls × '+pieces+' piezas = '+(rolls*pieces)+' piezas.':'Indica una cantidad de rolls entre 1 y 20.';
}
async function crearPromo(){
 if(state.busy)return;
 const chosen=branch(),file=$('ukiPromoPhoto')?.files?.[0];
 const p={name:String($('ukiPromoName')?.value||'').trim(),
  description:String($('ukiPromoDescription')?.value||'').trim(),
  price:numeroPromo('ukiPromoPrice'),rollCount:numeroPromo('ukiPromoRollCount'),
  piecesPerRoll:numeroPromo('ukiPromoPiecesPerRoll'),sauceCount:numeroPromo('ukiPromoSauces'),
  korokes:numeroPromo('ukiPromoKorokes'),payments:mediosPromo($('ukiPromoPayment')?.value)};
 if(!p.name||!file){info('ukiPriceMessage','Agrega nombre y una fotografía real para la promoción.');return;}
 if(p.rollCount<1||p.rollCount>20||![10,12].includes(p.piecesPerRoll)||
   !Number.isSafeInteger(p.price)||p.price<1){info('ukiPriceMessage','Revisa rolls, piezas y precio.');return;}
 state.busy=true;const button=$('ukiPromoCreate');button.disabled=true;
 let created=null,notice='';
 try{
  // Reducir antes de guardar en Neon. Si falla, no se crea producto alguno.
  const pic=await reduceImage(file);
  const result=await request(API,'crear-promocion',{item:p},chosen);
  created=result.item;
  await request(PHOTO_API,'subir',{sku:created.sku,expected_version:0,...pic},chosen);
  await request(API,'publicar-promocion',{sku:created.sku,expected_version:Number(created.version)},chosen);
  notice='✓ Promoción publicada con foto para '+(chosen==='arica'?'Regimiento Arica':'La Serena')+'.';
  $('ukiPromoAddBox').open=false;
  for(const id of ['ukiPromoName','ukiPromoDescription','ukiPromoPrice'])$(id).value='';
  $('ukiPromoPhoto').value='';
 }catch(e){
  notice=(created?'La promoción quedó en borrador, NO aparece a clientes. ':'No se creó la promoción. ')+String(e.message||e);
 }finally{
  state.busy=false;button.disabled=false;
  await loadPrices(true);info('ukiPriceMessage',notice);
 }
}
function visibilityControl(price){
 const button=document.createElement('button');button.type='button';button.className='sm';
 button.style.cssText=price.visible===false?'border:1px solid #61a18b;color:#176d48':'border:1px solid #bb7060;color:#973729';
 button.textContent=price.visible===false?'↩ Restaurar en carta':'🗑 Retirar de carta';
 button.onclick=async()=>{
  if(state.busy)return;
  if(price.visible!==false&&!window.confirm('¿Retirar «'+price.name+'» de la carta de esta sucursal? No se borrarán sus pedidos, precios históricos ni timbres.'))return;
  const chosen=state.branch,action=price.visible===false?'restaurar-producto':'retirar-producto';
  state.busy=true;button.disabled=true;
  try{
   await request(API,action,{sku:price.sku,expected_version:price.version,
    expected_visibility_version:price.visibilityVersion},chosen);
   state.busy=false;await loadPrices(true);
   info('ukiPriceMessage',action==='retirar-producto'?'✓ Retirado del menú de esta sucursal.':'✓ Restaurado en la carta.');
  }catch(e){info('ukiPriceMessage','No se modificó: '+String(e.message||e))}
  finally{state.busy=false;button.disabled=false}
 };
 return button;
}
function promoEditor(price){
 const details=document.createElement('details');details.style.cssText='width:100%;padding:8px 0';
 const summary=document.createElement('summary');summary.textContent='Editar promoción y su armado';details.append(summary);
 const form=document.createElement('div');form.style.cssText='display:grid;gap:8px;margin-top:10px';
 const field=(label,value,type='text',min,max)=>{
  const wrap=document.createElement('label');wrap.textContent=label;
  const inp=document.createElement('input');inp.type=type;inp.value=String(value??'');
  if(type==='number'){inp.inputMode='numeric';inp.min=String(min);inp.max=String(max)}
  wrap.append(inp);form.append(wrap);return inp;
 };
 const name=field('Nombre',price.name),description=field('Descripción',price.description||''),
   rolls=field('Rolls',price.config?.rollCount,'number',1,20),
   sauces=field('Salsas',price.config?.sauceCount,'number',0,20),
   korokes=field('Korokes',price.config?.korokes,'number',0,30),
   amount=field('Precio ($)',price.price,'number',1,1000000);
 name.maxLength=100;description.maxLength=500;
 const label=document.createElement('label');label.textContent='Piezas por roll';
 const per=document.createElement('select');for(const n of [12,10])per.add(new Option(n+' piezas',String(n)));per.value=String(price.config?.piecesPerRoll||12);label.append(per);form.append(label);
 const paylabel=document.createElement('label');paylabel.textContent='Medios de pago';
 const pay=document.createElement('select');for(const [id,title] of [['normal','Efectivo y transferencia'],['edenred','Solo Edenred'],['todos','Todos los medios']])pay.add(new Option(title,id));
 pay.value=modoMediosPromo(price.config?.payments);paylabel.append(pay);form.append(paylabel);
 const save=document.createElement('button');save.type='button';save.className='sm ok';save.textContent='Guardar cambios de promoción';
 save.onclick=async()=>{
  if(state.busy)return;
  const chosen=state.branch;state.busy=true;save.disabled=true;
  try{
   const item={name:name.value,description:description.value,price:Number(amount.value),
    rollCount:Number(rolls.value),piecesPerRoll:Number(per.value),sauceCount:Number(sauces.value),
    korokes:Number(korokes.value),payments:mediosPromo(pay.value)};
   await request(API,'editar-promocion',{sku:price.sku,expected_version:price.version,item},chosen);
   state.busy=false;await loadPrices(true);info('ukiPriceMessage','✓ Promoción actualizada para esta sucursal.');
  }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message))}
  finally{state.busy=false;save.disabled=false}
 };form.append(save);
 details.append(form);return details;
}
function line(price){
 const wrap=document.createElement('div');wrap.className='row';wrap.style.cssText='align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid #eee0d3;flex-wrap:wrap';
 const summary=document.createElement('div');summary.style.flex='1 1 130px';
 const name=document.createElement('b');name.textContent=price.name;
 const sub=document.createElement('small');sub.style.cssText='display:block;color:#756759';
 sub.textContent=(price.group||price.kind)+' · '+peso(price.price)+' · '+
   (price.visible===false?'Retirado de carta':price.available?'Disponible':'Agotado');
 summary.append(name,sub);
 const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='1000000';
 input.value=String(price.price);input.setAttribute('aria-label','Nuevo precio de '+price.name);
 input.style.cssText='width:115px;max-width:35%;flex:0 0 115px';
 const save=document.createElement('button');save.type='button';save.className='sm';save.textContent='Guardar precio';
 save.disabled=state.busy;
 save.onclick=async()=>{
  const amount=Number(input.value);
  if(!Number.isSafeInteger(amount)||amount<1||amount>1000000){info('ukiPriceMessage','Ingresa un precio válido en pesos.');return;}
  if(amount===Number(price.price)){info('ukiPriceMessage','El precio no ha cambiado.');return;}
  if(state.busy)return;
  const selectedBranch=state.branch;
  state.busy=true;save.disabled=true;info('ukiPriceMessage','Guardando '+price.name+'…');
  try{
   await request(API,'editar-precio',{sku:price.sku,expected_version:price.version,price:amount},selectedBranch);
   if(selectedBranch!==branch())return;
   state.busy=false;await loadPrices(true);
   info('ukiPriceMessage','✓ Precio de '+price.name+' actualizado a '+peso(amount)+' en '+(selectedBranch==='arica'?'Regimiento Arica':'La Serena')+'.');
  }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message));}
  finally{state.busy=false;save.disabled=false;}
 };
 wrap.append(summary,input,save);
 if(['monthly','classic','premium','dish','pizza'].includes(price.kind))wrap.append(photoControls(price));
 if(price.custom&&price.kind!=='monthly'){
  const details=document.createElement('details');details.style.cssText='width:100%;padding:7px 0 0';
  const title=document.createElement('summary');title.textContent='Editar nombre y descripción';details.append(title);
  const name=document.createElement('input');name.value=price.name;name.maxLength=100;
  name.setAttribute('aria-label','Nombre de '+price.name);
  const description=document.createElement('textarea');description.value=price.description||'';description.maxLength=500;description.rows=2;
  description.setAttribute('aria-label','Descripción de '+price.name);
  const button=document.createElement('button');button.className='sm';button.type='button';button.textContent='Guardar producto';
  button.onclick=async()=>{
   const next=name.value.trim(),amount=Number(input.value);
   if(next.length<2||!Number.isSafeInteger(amount)||amount<1||amount>1000000){
    info('ukiPriceMessage','Revisa nombre y precio.');return;
   }
   if(state.busy)return;state.busy=true;button.disabled=true;
   try{
    await request(API,'editar-producto',{sku:price.sku,expected_version:price.version,
     name:next,description:description.value.trim(),price:amount},state.branch);
    state.busy=false;await loadPrices(true);
    info('ukiPriceMessage','✓ Producto actualizado.');
   }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message));}
   finally{state.busy=false;button.disabled=false;}
  };
  details.append(name,description,button);wrap.append(details);
 }
 if(price.kind==='monthly'&&price.custom)wrap.append(promoEditor(price));
 const vis=visibilityControl(price);
 vis.style.marginTop='6px';wrap.append(vis);
 return wrap;
}
function renderPrices(){
 const target=$('ukiPriceList');if(!target)return;
 target.replaceChildren();
 const query=state.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filtered=state.items.filter(x=>(state.group==='all'||x.kind===state.group)&&
  (!query||(x.name+' '+x.sku).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)));
 const title=document.createElement('p');title.className='muted';title.textContent=filtered.length+' productos encontrados';target.append(title);
 for(const item of filtered)target.append(line(item));
 if(!filtered.length){const p=document.createElement('p');p.textContent='No hay productos en esta búsqueda.';target.append(p);}
}
async function loadPrices(force=false){
 if(state.busy)return;
 state.branch=branch();const selected=state.branch;
 info('ukiPriceMessage','Cargando carta de '+(selected==='arica'?'Regimiento Arica':'La Serena')+'…');
 try{
  const data=await request(API,'listar',{},selected);
  if(selected!==branch())return;
  state.items=Array.isArray(data.items)?data.items:[];state.ready=true;await loadPhotos(selected);renderPrices();
  info('ukiPriceMessage','✓ '+state.items.length+' productos y precios de esta sucursal.');
 }catch(e){state.ready=false;state.items=[];
  info('ukiPriceMessage','No se pudo consultar: '+String(e.message));}
 const pizza=$('ukiPriceNewKind');
 if(pizza){const option=pizza.querySelector('option[value="pizza"]');if(option)option.disabled=selected!=='arica';
  if(selected!=='arica'&&pizza.value==='pizza')pizza.value='dish';}
}
async function create(){
 const selectedBranch=branch();
 const kind=$('ukiPriceNewKind').value;
 const name=$('ukiPriceNewName').value.trim(),description=$('ukiPriceNewDesc').value.trim(),price=Number($('ukiPriceNewAmount').value);
 if(name.length<2||!Number.isSafeInteger(price)||price<1||price>1000000){
  info('ukiPriceMessage','Escribe un nombre y un precio válido.');return;
 }
 if(state.busy)return;
 state.busy=true;$('ukiPriceCreate').disabled=true;info('ukiPriceMessage','Agregando producto…');
 try{
  const result=await request(API,'crear-producto',{item:{kind,group:kind==='pizza'?'pizzas':'entradas',name,description,price}},selectedBranch);
  $('ukiPriceNewName').value='';$('ukiPriceNewDesc').value='';$('ukiPriceNewAmount').value='';
  state.busy=false;await loadPrices(true);
  if(selectedBranch===branch())info('ukiPriceMessage','✓ «'+name+'» agregado a la carta de '+(selectedBranch==='arica'?'Regimiento Arica':'La Serena')+'.');
  $('ukiPriceAddBox').open=false;
 }catch(e){info('ukiPriceMessage','No se agregó: '+String(e.message));}
 finally{state.busy=false;$('ukiPriceCreate').disabled=false;}
}
async function loadReponer(){
 const selected=branch();state.branch=selected;
 info('ukiReponerEstado','Consultando faltantes…');
 try{
  const data=await request(STOCK_API,'articulos',{},selected);
  if(selected!==branch())return;
  const all=data.items||[],configured=all.filter(i=>Number(i.min_stock_qty)>0);
  const short=configured.filter(i=>Number(i.stock_qty)<=Number(i.min_stock_qty))
    .sort((a,b)=>a.name.localeCompare(b.name,'es'));
  info('ukiReponerEstado',all.length+' artículos · '+short.length+' para reponer · '+
   (all.length-configured.length)+' sin mínimo configurado.');
  const root=$('ukiReponerListado');if(!root)return;root.replaceChildren();
  if(!short.length){root.textContent='✓ No hay faltantes según los mínimos registrados.';return;}
  for(const p of short){
   const row=document.createElement('p');row.style.cssText='padding:10px 0;border-bottom:1px solid #eee0d3;margin:0';
   const delta=Math.max(0,Number(p.min_stock_qty)-Number(p.stock_qty));
   row.textContent=p.name+' · Quedan '+Number(p.stock_qty).toLocaleString('es-CL')+' '+(units[p.stock_unit]||p.stock_unit)+
    ' · mínimo '+Number(p.min_stock_qty).toLocaleString('es-CL')+
    ' · '+(delta===0?'Mínimo alcanzado, comprar':('Faltan al menos '+delta.toLocaleString('es-CL')+' '+p.stock_unit));
   root.append(row);
  }
 }catch(e){info('ukiReponerEstado','No se pudo consultar: '+String(e.message));}
}
function mount(){
 prevMount();if(!$('ukiInvTabs'))return;
 const selectedBranch=branch();
 if(state.branch!==selectedBranch){state.items=[];state.photos={};state.ready=false;state.query='';state.group='all';state.tab='inventario';}
 state.branch=selectedBranch;
 const scrollOffset=()=>Math.ceil((document.querySelector('header')?.getBoundingClientRect().height||110)+16)+'px';
 document.querySelectorAll('[data-uki-tab]').forEach(btn=>btn.onclick=()=>{
  state.tab=btn.dataset.ukiTab;showTab();
  const view=$('ukiAdminViewHeader');
  if(view){view.style.scrollMarginTop=scrollOffset();view.scrollIntoView({behavior:'smooth',block:'start'});}
 });
 $('ukiAdminCambiar').onclick=()=>{
  const nav=$('ukiInvTabs');
  if(nav){nav.style.scrollMarginTop=scrollOffset();nav.scrollIntoView({behavior:'smooth',block:'start'});}
 };
 const input=$('ukiPriceSearch'),select=$('ukiPriceGroup');
 if(input){input.value=state.query;input.oninput=e=>{state.query=e.target.value;renderPrices();};}
 if(select){select.value=state.group;select.onchange=e=>{state.group=e.target.value;renderPrices();};}
 $('ukiPriceReload').onclick=()=>void loadPrices(true);
 $('ukiPriceCreate').onclick=()=>void create();
 $('ukiPromoCreate').onclick=()=>void crearPromo();
 for(const id of ['ukiPromoRollCount','ukiPromoPiecesPerRoll'])
   $(id).oninput=actualizaPiezasPromo;
 actualizaPiezasPromo();
 $('ukiReponerReload').onclick=()=>void loadReponer();
 const invBranch=$('invBranch');
 if(invBranch&&!invBranch.dataset.ukiPrecioObservador){
  invBranch.dataset.ukiPrecioObservador='1';
  invBranch.addEventListener('change',()=>{state.branch=branch();state.ready=false;state.items=[];
   if(state.tab==='precios')void loadPrices(true);
   if(state.tab==='reportes')void loadReponer();
  });
 }
 showTab();
}
window.ukiInventarioMontar=mount;
})();
