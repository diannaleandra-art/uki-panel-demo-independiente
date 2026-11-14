/* Uki Sushi · Organización del inventario, informes, disponibilidad y precios.
   No modifica pedidos, caja, reportes de ventas ni cierres. */
(function(){
'use strict';
const QA_HOST=/^(?:uki-sushi-panel|uki-sushi-inventario)-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/;
// Los previews usan su propio servidor; nunca escriben en inventario ni carta real.
const BACKEND=QA_HOST.test(location.hostname)?location.origin:'https://uki-sushi-inventario.vercel.app';
const API=BACKEND+'/api/uki-carta-precios-live';
const STOCK_API=BACKEND+'/api/inventario-turno-live';
const PHOTO_API=BACKEND+'/api/uki-carta-fotos-live';
const state={tab:'inventario',branch:'',items:[],photos:{},query:'',group:'all',busy:false,ready:false,promocionesHabilitadas:false,categoriasDescuentosHabilitados:false,categorias:[]};
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
 '<div><label for="ukiPriceGroup">Filtrar por tipo o categoría</label><select id="ukiPriceGroup">',
 '<option value="all">Todos los productos</option><option value="pizza">Pizzas</option>',
 '<option value="dish">Entradas, gohan y burgers</option><option value="classic">Promos clásicas</option>',
 '<option value="premium">Premium</option>',
 '<option value="topping">Toppings</option><option value="extra">Salsas adicionales</option></select></div></div>',
 '<button class="sm" id="ukiPriceReload" type="button">Actualizar precios</button>',
 '<p id="ukiPriceMessage" role="status" class="muted">Carga los precios de la sucursal para comenzar.</p>',
 '<section id="ukiPromosResumen" style="padding:12px 14px;margin:13px 0;background:#fff6ed;border:1.5px solid #e8c49e;border-radius:14px" aria-label="Promociones del mes organizadas">',
 '<h3 style="margin:0 0 7px;color:#7c441a;font-size:17px">🎁 Promociones del mes</h3>',
 '<p class="mini-help" style="margin:0 0 8px">Nombre, precio y estado por sucursal. Ver detalles lleva al editor existente.</p>',
 '<div id="ukiPromosListaResumen"><p class="muted">Actualiza precios para consultar las promociones.</p></div></section>',
 '<details id="ukiCategoriesBox" class="card" style="margin:12px 0" hidden><summary>＋ Crear categoría</summary>',
 '<p class="mini-help">Organiza los productos de esta sucursal sin cambiar su preparación.</p>',
 '<input id="ukiCategoryNewName" maxlength="45" placeholder="Ej. Almuerzos">',
 '<button id="ukiCategoryCreate" class="sm" type="button">Guardar categoría</button>',
 '<div class="mini-help" id="ukiCategoriesList"></div></details>',
 '<div id="ukiPriceList"></div>',
 '<details id="ukiPriceAddBox" class="card" style="margin-top:15px">',
 '<summary style="cursor:pointer;font-weight:700">＋ Agregar producto a la carta</summary>',
 '<p class="muted">Aquí agregas un producto para vender, no un ingrediente de inventario. De momento admite pizzas en Regimiento Arica y entradas simples.</p>',
 '<label for="ukiPriceNewKind">Tipo de producto</label><select id="ukiPriceNewKind"><option value="pizza">Pizza</option><option value="dish">Entrada simple</option></select>',
 '<div id="ukiPriceNewCategoryBox" hidden><label for="ukiPriceNewCategory">Categoría que creaste (opcional)</label><select id="ukiPriceNewCategory"><option value="">Sin categoría propia</option></select></div>',
 '<label for="ukiPriceNewName">Nombre</label><input id="ukiPriceNewName" maxlength="100" placeholder="Ej. Pizza Cuatro Quesos">',
 '<label for="ukiPriceNewDesc">Descripción / ingredientes</label><textarea id="ukiPriceNewDesc" maxlength="500" rows="2" placeholder="Ingredientes del producto"></textarea>',
 '<label for="ukiPriceNewAmount">Precio en pesos chilenos</label><input id="ukiPriceNewAmount" type="number" min="1" max="1000000" inputmode="numeric" placeholder="10900">',
 '<button type="button" class="big" id="ukiPriceCreate">Agregar a la carta</button>',
 '</details>',
 '<details id="ukiPromoAddBox" class="card" style="margin-top:14px">',
 '<summary style="cursor:pointer;font-weight:700">＋ Agregar promoción de sushi con fotografía</summary>',
 '<p class="muted">La sucursal queda asignada automáticamente. Primero se guarda un borrador; solo aparece en la carta tras guardar su foto tipo banner.</p>',
 '<label for="ukiPromoName">Nombre de la promoción</label><input id="ukiPromoName" maxlength="100" placeholder="Ej. Promo especial 200 piezas">',
 '<label for="ukiPromoDescription">Qué incluye</label><textarea id="ukiPromoDescription" maxlength="500" rows="2" placeholder="Describe exactamente qué recibe el cliente"></textarea>',
 '<label for="ukiPromoType">Tipo de promoción</label><select id="ukiPromoType"><option value="sushi">Sushi por rolls/piezas · el cliente arma</option><option value="gohan">Gohan · preparación definida</option><option value="pizza">Pizza · preparación definida</option><option value="combo">Combo u otra promoción · sin armado</option></select>',
 '<p id="ukiPromoTypeHelp" class="mini-help">Solo las promociones de sushi requieren rolls y piezas.</p>',
 '<div id="ukiPromoSushiConfig">',
 '<div class="quick-grid"><div><label for="ukiPromoRollCount">Cantidad de rolls</label><input id="ukiPromoRollCount" type="number" inputmode="numeric" min="1" max="20" value="5"></div>',
 '<div><label for="ukiPromoPiecesPerRoll">Piezas por roll</label><select id="ukiPromoPiecesPerRoll"><option value="12">12 piezas</option><option value="10">10 piezas</option></select></div></div>',
 '<p id="ukiPromoPieceSummary" class="mini-help">5 rolls × 12 piezas = 60 piezas.</p>',
 '<div class="quick-grid"><div><label for="ukiPromoSauces">Salsas incluidas</label><input id="ukiPromoSauces" type="number" inputmode="numeric" min="0" max="20" value="5"></div>',
 '<div><label for="ukiPromoKorokes">Korokes incluidos</label><input id="ukiPromoKorokes" type="number" inputmode="numeric" min="0" max="30" value="0"></div></div>',
 '</div>',
 '<div id="ukiPromoComboSauceBox"><label for="ukiPromoComboSauce">Salsa incluida</label><select id="ukiPromoComboSauce"><option value="0">Sin salsa incluida</option><option value="1">1 salsa · el cliente elige soya o teriyaki</option></select></div>',
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
 // Mostrar faltantes e historial juntos, justo debajo del título.
 // Solo mueve elementos visuales; no modifica inventario, caja ni pedidos.
 if(state.tab==='reportes'){
  const header=$('ukiAdminViewHeader'),faltantes=$('ukiReponerPanel'),historial=$('ukiHistorial');
  if(header){
   if(historial)header.insertAdjacentElement('afterend',historial);
   if(faltantes)header.insertAdjacentElement('afterend',faltantes);
  }
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
  const element=$(id);if(!element)continue;
  const visible=(sections[state.tab]||[]).includes(id);
  element.style.display=visible?'':'none';
  // El historial nace oculto; restaurar su visibilidad al elegir reportes.
  if(id==='ukiHistorial')element.hidden=!visible;
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
 const wrap=document.createElement('details');
 wrap.style.cssText='width:100%;border:1px solid #ead6c4;border-radius:11px;padding:10px;margin-top:6px';
 const title=document.createElement('summary');title.textContent='📷 Foto · Ver o cambiar';wrap.append(title);
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
function tipoPromoSeleccionado(){return $('ukiPromoType')?.value||'sushi';}
function mostrarTipoPromo(){
 const kind=tipoPromoSeleccionado(),sushi=kind==='sushi',section=$('ukiPromoSushiConfig');
 if(section)section.hidden=!sushi;
 const comboSauce=$('ukiPromoComboSauceBox');if(comboSauce)comboSauce.hidden=sushi;
 const note=$('ukiPromoTypeHelp');if(note)note.textContent=sushi?
 'Rolls y piezas solo para sushi. El cliente podrá armar cada roll.':
 'Describe exactamente los productos incluidos. Puedes incluir una salsa a elección, sin rolls ni piezas.';
 const create=$('ukiPromoCreate');if(create)create.disabled=kind==='pizza'&&branch()==='serena';
}
function actualizaPiezasPromo(){
 const el=$('ukiPromoPieceSummary');if(!el)return;
 const rolls=numeroPromo('ukiPromoRollCount'),pieces=numeroPromo('ukiPromoPiecesPerRoll');
 el.textContent=Number.isSafeInteger(rolls)&&rolls>=1&&rolls<=20?
  rolls+' rolls × '+pieces+' piezas = '+(rolls*pieces)+' piezas.':'Indica una cantidad de rolls entre 1 y 20.';
}
async function crearPromo(){
 if(state.busy)return;
 const chosen=branch(),file=$('ukiPromoPhoto')?.files?.[0];
 const promoType=tipoPromoSeleccionado();
 const p={name:String($('ukiPromoName')?.value||'').trim(),promoType,customizable:promoType==='sushi',
  description:String($('ukiPromoDescription')?.value||'').trim(),
  price:numeroPromo('ukiPromoPrice'),rollCount:numeroPromo('ukiPromoRollCount'),
  piecesPerRoll:numeroPromo('ukiPromoPiecesPerRoll'),sauceCount:promoType==='sushi'?numeroPromo('ukiPromoSauces'):numeroPromo('ukiPromoComboSauce'),
  korokes:numeroPromo('ukiPromoKorokes'),payments:mediosPromo($('ukiPromoPayment')?.value)};
 if(!p.name||!file){info('ukiPriceMessage','Agrega nombre y una fotografía real para la promoción.');return;}
 if((promoType==='sushi'&&(p.rollCount<1||p.rollCount>20||![10,12].includes(p.piecesPerRoll)))||
   !Number.isSafeInteger(p.price)||p.price<1||!['sushi','gohan','pizza','combo'].includes(promoType)||
   (promoType==='pizza'&&chosen==='serena')||
   (promoType!=='sushi'&&p.description.length<2)){
  info('ukiPriceMessage','Revisa tipo de promoción, descripción y precio.');return;
 }
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
 const esPromoDelMes=price.kind==='monthly'&&price.custom;
 const estado=esPromoDelMes?price.estadoPublicacion:null;
 button.textContent=esPromoDelMes?
  (estado==='Borrador'?'✓ Publicar promoción':estado==='Retirada'?'↩ Volver a publicar promoción':'🗑 Eliminar promoción de la carta'):
  (price.visible===false?'↩ Restaurar en carta':'🗑 Retirar de carta');
 button.onclick=async()=>{
  if(state.busy)return;
  if(price.visible!==false){
   const pregunta=esPromoDelMes?
    '¿Eliminar la promoción «'+price.name+'» de la carta de '+(state.branch==='arica'?'Regimiento Arica':'La Serena')+' ahora? Ya no la podrán elegir los clientes. Los pedidos anteriores se conservan.':
    '¿Retirar «'+price.name+'» de la carta de esta sucursal? No se borrarán sus pedidos, precios históricos ni timbres.';
   if(!window.confirm(pregunta))return;
  }
  const chosen=state.branch,action=price.visible===false?
   (esPromoDelMes&&estado==='Borrador'?'publicar-promocion':'restaurar-producto'):'retirar-producto';
  state.busy=true;button.disabled=true;
  try{
   await request(API,action,{sku:price.sku,expected_version:price.version,
    expected_visibility_version:price.visibilityVersion},chosen);
   state.busy=false;await loadPrices(true);
   info('ukiPriceMessage',esPromoDelMes?
    (action==='retirar-producto'?'✓ Promoción retirada de la carta de esta sucursal. Ya no aparece a los clientes.':
     estado==='Borrador'?'✓ Promoción publicada por primera vez en esta sucursal.':'✓ Promoción publicada nuevamente en esta sucursal.'):
    (action==='retirar-producto'?'✓ Retirado del menú de esta sucursal.':'✓ Restaurado en la carta.'));
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
 const tipoLabel=document.createElement('label');tipoLabel.textContent='Tipo de promoción';
 const tipo=document.createElement('select');
 for(const [k,t] of [['sushi','Sushi · el cliente arma'],['gohan','Gohan · preparación definida'],['pizza','Pizza · preparación definida'],['combo','Combo u otra · sin armado']])tipo.add(new Option(t,k));
 tipo.value=price.config?.promoType||'sushi';tipoLabel.append(tipo);form.insertBefore(tipoLabel,rolls.parentElement);
 const syncEditor=()=>{const show=tipo.value==='sushi';
  for(const f of [rolls,korokes])f.parentElement.hidden=!show;
  per.parentElement.hidden=!show;
  sauces.parentElement.hidden=false;
  sauces.parentElement.firstChild.textContent=show?'Salsas incluidas':'Salsas incluidas (0 o 1)';
  sauces.max=show?'20':'1';
  if(!show&&Number(sauces.value)>1)sauces.value='1';
  save.disabled=tipo.value==='pizza'&&state.branch==='serena';
 };
 const label=document.createElement('label');label.textContent='Piezas por roll';
 const per=document.createElement('select');for(const n of [12,10])per.add(new Option(n+' piezas',String(n)));per.value=String(price.config?.piecesPerRoll||12);label.append(per);form.append(label);
 const paylabel=document.createElement('label');paylabel.textContent='Medios de pago';
 const pay=document.createElement('select');for(const [id,title] of [['normal','Efectivo y transferencia'],['edenred','Solo Edenred'],['todos','Todos los medios']])pay.add(new Option(title,id));
 pay.value=modoMediosPromo(price.config?.payments);paylabel.append(pay);form.append(paylabel);
 tipo.onchange=syncEditor;
 const save=document.createElement('button');save.type='button';save.className='sm ok';save.textContent='Guardar cambios de promoción';
 save.onclick=async()=>{
  if(state.busy)return;
  const chosen=state.branch;state.busy=true;save.disabled=true;
  try{
   const item={name:name.value,description:description.value,price:Number(amount.value),
    promoType:tipo.value,customizable:tipo.value==='sushi',
    rollCount:Number(rolls.value),piecesPerRoll:Number(per.value),sauceCount:Number(sauces.value),
    korokes:Number(korokes.value),payments:mediosPromo(pay.value)};
   await request(API,'editar-promocion',{sku:price.sku,expected_version:price.version,item},chosen);
   state.busy=false;await loadPrices(true);info('ukiPriceMessage','✓ Promoción actualizada para esta sucursal.');
  }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message))}
  finally{state.busy=false;save.disabled=false}
 };form.append(save);syncEditor();
 details.append(form);return details;
}
function extraProducto(precio){
 const box=document.createElement('details');box.style.cssText='width:100%;border:1px solid #ead6c4;padding:10px;border-radius:11px';
 const title=document.createElement('summary');title.textContent='Categoría y descuento (%)';box.append(title);
 const label=document.createElement('label');label.textContent='Categoría';
 const selector=document.createElement('select');selector.add(new Option('Sin categoría',''));
 for(const c of state.categorias)selector.add(new Option(c.nombre,c.slug));
 selector.value=precio.categoriaSlug||'';label.append(selector);box.append(label);
 const categoryButton=document.createElement('button');categoryButton.type='button';categoryButton.className='sm';categoryButton.textContent='Guardar categoría';
 categoryButton.onclick=async()=>{if(state.busy)return;state.busy=true;categoryButton.disabled=true;
  try{await request(API,'asignar-categoria',{sku:precio.sku,categoriaSlug:selector.value},state.branch);
   const categoria=state.categorias.find(c=>c.slug===selector.value)?.nombre||'Sin categoría';
   state.busy=false;await loadPrices(true);
   const message='✓ «'+precio.name+'» guardado en «'+categoria+'».';
   info('ukiPriceMessage',message);info('ukiCategoriesEstado',message);
  }catch(e){info('ukiPriceMessage','No se guardó la categoría: '+String(e.message))}
  finally{state.busy=false;categoryButton.disabled=false}};
 box.append(categoryButton);
 const percentLabel=document.createElement('label');percentLabel.textContent='Descuento (%)';
 const pct=document.createElement('input');pct.type='number';pct.inputMode='numeric';pct.min='0';pct.max='99';pct.step='1';
 pct.value=String(precio.descuentoPorcentaje||0);percentLabel.append(pct);box.append(percentLabel);
 const preview=document.createElement('p');preview.className='mini-help';box.append(preview);
 pct.oninput=()=>{const n=Number(pct.value),original=Number(precio.precioOriginal??precio.price);
  preview.textContent=Number.isSafeInteger(n)&&n>=0&&n<=99?'Precio original: '+peso(original)+' · Precio final: '+peso(Math.max(1,Math.round(original*(100-n)/100))):'Descuento entre 0 y 99%';};pct.oninput();
 const discountButton=document.createElement('button');discountButton.type='button';discountButton.className='sm';discountButton.textContent='Guardar descuento';
 discountButton.onclick=async()=>{const n=Number(pct.value);
  if(pct.value.trim()===''||!Number.isSafeInteger(n)||n<0||n>99){info('ukiPriceMessage','Ingresa un descuento entero de 0 a 99%.');return;}
  if(state.busy)return;state.busy=true;discountButton.disabled=true;
  try{await request(API,'guardar-descuento',{sku:precio.sku,porcentaje:n,expected_discount_version:Number(precio.descuentoVersion||0)},state.branch);
   state.busy=false;await loadPrices(true);
   const original=Number(precio.precioOriginal??precio.price);
   const final=Math.max(1,Math.round(original*(100-n)/100));
   info('ukiPriceMessage',n?
    '✓ «'+precio.name+'»: descuento '+n+'% guardado. Antes '+peso(original)+', ahora '+peso(final)+'.':
    '✓ «'+precio.name+'»: descuento eliminado. Precio '+peso(original)+'.');
  }catch(e){info('ukiPriceMessage','No se guardó el descuento: '+String(e.message))}
  finally{state.busy=false;discountButton.disabled=false}};
 box.append(discountButton);return box;
}
function renderCategoryAssignments(){
 const list=$('ukiCategoriaAsignaciones');if(!list)return;
 list.replaceChildren();
 if(!state.categoriasDescuentosHabilitados){
  const p=document.createElement('p');p.className='muted';
  p.textContent='Las categorías todavía no están activadas en esta versión del panel.';
  list.append(p);return;
 }
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
 const query=normalize($('ukiCategoriaBuscar')?.value).trim();
 const items=state.items.filter(x=>!query||normalize(x.name+' '+x.sku+' '+(x.categoriaNombre||'')).includes(query))
  .sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const limit=Math.max(18,Number(state.categoryVisibleLimit)||18);
 const count=document.createElement('p');count.className='mini-help';
 count.textContent=items.length+' productos para organizar en esta sucursal.';
 list.append(count);
 if(!items.length){const none=document.createElement('p');none.className='muted';none.textContent='No hay productos con ese nombre.';list.append(none);return;}
 for(const item of items.slice(0,limit)){
  const row=document.createElement('div');row.className='uki-category-assignment';
  row.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:11px 0;border-bottom:1px solid #ead9cc';
  const name=document.createElement('strong');name.textContent=item.name;name.style.cssText='font-size:13px;line-height:1.3;grid-column:1/-1';
  const selector=document.createElement('select');selector.setAttribute('aria-label','Categoría para '+item.name);
  selector.style.cssText='min-width:0;width:100%;font-size:13px';
  selector.add(new Option('Sin categoría',''));
  for(const category of state.categorias)selector.add(new Option(category.nombre,category.slug));
  selector.value=item.categoriaSlug||'';
  const save=document.createElement('button');save.type='button';save.className='sm';
  save.textContent='Guardar';save.disabled=true;
  selector.onchange=()=>save.disabled=state.busy||selector.value===(item.categoriaSlug||'');
  save.onclick=async()=>{
   if(state.busy)return;
   const chosen=state.branch;
   state.busy=true;save.disabled=true;
   try{
    await request(API,'asignar-categoria',{sku:item.sku,categoriaSlug:selector.value},chosen);
    const categoria=state.categorias.find(c=>c.slug===selector.value)?.nombre||'Sin categoría';
    state.busy=false;
    if(chosen!==branch())return;
    await loadPrices(true);
    const message='✓ «'+item.name+'» guardado en «'+categoria+'» ('+
     (chosen==='arica'?'Regimiento Arica':'La Serena')+').';
    info('ukiCategoriesEstado',message);info('ukiPriceMessage',message);
   }catch(e){info('ukiPriceMessage','No se guardó la categoría: '+String(e.message||e));save.disabled=false;}
   finally{state.busy=false;}
  };
  row.append(name,selector,save);list.append(row);
 }
 if(items.length>limit){
  const more=document.createElement('button');more.type='button';more.className='sm';
  more.textContent='Mostrar más productos ('+(items.length-limit)+' restantes)';
  more.onclick=()=>{state.categoryVisibleLimit=limit+18;renderCategoryAssignments();};
  list.append(more);
 }
}
// Todas las acciones trabajan sobre la sucursal de la sesión actual.
// Una asignación o una categoría nunca elimina el producto de la base.
async function actualizarOrganizacion(action,fields,mensaje){
 if(state.busy)return;
 const selected=state.branch;
 let guardado=false;
 state.busy=true;
 try{
  await request(API,action,fields,selected);
  guardado=true;state.busy=false;
  if(selected!==branch())return;
  await loadPrices(true);
  if(!state.ready){
   info('ukiCategoriesEstado','La operación se guardó en el servidor, pero no se pudo actualizar la lista. Pulsa «Actualizar precios», no repitas la operación.');
   return;
  }
  info('ukiCategoriesEstado','✓ '+mensaje);
  info('ukiPriceMessage','✓ '+mensaje);
 }catch(e){
  info('ukiCategoriesEstado',(guardado?'La operación se guardó, pero no se pudo confirmar la vista: ':'No se guardó: ')+String(e.message||e));
 }finally{state.busy=false;}
}
function renderCategories(){
 const box=$('ukiCategoriesBox');if(!box)return;
 box.hidden=!state.categoriasDescuentosHabilitados;
 const list=$('ukiCategoriesList');
 if(list&&typeof list.replaceChildren!=='function')list.textContent='Categorías guardadas: '+state.categorias.map(c=>c.nombre).join(', ');
 if(list&&typeof list.replaceChildren==='function'){
  list.replaceChildren();
  const h=document.createElement('strong');
  h.style.cssText='display:block;color:#503225;font-size:16px;margin:7px 0';
  h.textContent='Categorías guardadas ('+state.categorias.length+')';
  list.append(h);
  const help=document.createElement('p');help.className='mini-help';
  help.textContent='Abre cada categoría para editar su nombre, ver qué contiene, agregar o quitar productos y eliminarla sin borrar sus productos.';
  list.append(help);
  if(!state.categorias.length){
   const empty=document.createElement('p');empty.className='muted';
   empty.textContent='No hay categorías todavía. Crea una y organiza sus productos.';
   list.append(empty);
  }
  for(const category of state.categorias){
   const members=state.items.filter(item=>item.categoriaSlug===category.slug)
    .sort((a,b)=>a.name.localeCompare(b.name,'es-CL'));
   const details=document.createElement('details');
   details.className='uki-admin-categoria-ficha';
   details.dataset.categorySlug=category.slug;
   details.open=state.categoriaAbierta===category.slug;
   details.style.cssText='border:1.5px solid #e4bea3;border-left:5px solid #e88434;border-radius:14px;background:#fffdf8;padding:13px;margin:12px 0;box-shadow:0 3px 10px #74401912';
   const heading=document.createElement('summary');
   heading.style.cssText='cursor:pointer;font-size:15px;line-height:1.4;color:#513224;font-weight:800';
   heading.textContent=category.nombre+' · '+members.length+' '+(members.length===1?'producto':'productos');
   details.append(heading);
   details.addEventListener('toggle',()=>{
    if(details.open)state.categoriaAbierta=category.slug;
    else if(state.categoriaAbierta===category.slug)state.categoriaAbierta='';
   });
   const controls=document.createElement('div');
   controls.style.cssText='display:grid;gap:10px;padding:13px 0 0';
   const renameLabel=document.createElement('label');
   renameLabel.textContent='Editar nombre de esta categoría';
   renameLabel.style.cssText='font-weight:750;font-size:13px;color:#633b2a';
   const input=document.createElement('input');
   input.value=category.nombre;input.maxLength=45;input.type='text';
   input.setAttribute('aria-label','Nuevo nombre para '+category.nombre);
   input.style.cssText='display:block;width:100%;box-sizing:border-box;margin:6px 0 0;padding:10px;font-size:16px;border:1px solid #dbbba1;border-radius:10px';
   const save=document.createElement('button');
   save.type='button';save.className='sm';save.textContent='Guardar nombre';
   save.onclick=async()=>{
    const nuevo=input.value.trim();
    if(nuevo.length<2||nuevo.length>45){info('ukiCategoriesEstado','El nombre debe tener entre 2 y 45 caracteres.');return;}
    if(nuevo===category.nombre){info('ukiCategoriesEstado','El nombre no ha cambiado.');return;}
    state.categoriaAbierta=category.slug;
    await actualizarOrganizacion('editar-categoria',{categoriaSlug:category.slug,nombre:nuevo},
      'Categoría «'+category.nombre+'» renombrada a «'+nuevo+'». Los productos siguen asignados.');
   };
   renameLabel.append(input);controls.append(renameLabel,save);
   const sub=document.createElement('h4');sub.textContent='Productos dentro de '+category.nombre;
   sub.style.cssText='font-size:14px;margin:12px 0 0;color:#513224';
   controls.append(sub);
   if(!members.length){
    const empty=document.createElement('p');empty.className='mini-help';
    empty.textContent='Esta categoría está vacía. Busca un producto debajo para agregarlo.';
    controls.append(empty);
   }
   for(const member of members){
    const row=document.createElement('div');
    row.style.cssText='padding:10px;border:1px solid #ead7c6;border-radius:11px;background:white;display:grid;gap:7px';
    const title=document.createElement('strong');
    title.style.cssText='font-size:14px;overflow-wrap:anywhere';
    title.textContent=member.name+' · '+peso(member.precioFinal??member.price);
    const status=document.createElement('small');status.style.cssText='color:#796250';
    status.textContent=member.visible===false?'Retirado de la carta':member.available===false?'Agotado':'Disponible';
    const selector=document.createElement('select');selector.setAttribute('aria-label','Mover '+member.name+' a otra categoría');
    selector.add(new Option('Sin categoría',''));
    for(const cat of state.categorias)selector.add(new Option(cat.nombre,cat.slug));
    selector.value=category.slug;
    selector.style.cssText='width:100%;min-height:38px;font-size:14px;border-radius:8px';
    const actions=document.createElement('div');
    actions.style.cssText='display:flex;flex-wrap:wrap;gap:7px;align-items:center';
    const move=document.createElement('button');move.type='button';move.className='sm';
    move.textContent='Guardar cambio';move.disabled=true;
    selector.onchange=()=>move.disabled=selector.value===category.slug;
    move.onclick=async()=>{
     const target=selector.value;
     state.categoriaAbierta=category.slug;
     await actualizarOrganizacion('asignar-categoria',{sku:member.sku,categoriaSlug:target},
      '«'+member.name+'» '+(target?'asignado a «'+(state.categorias.find(c=>c.slug===target)?.nombre||target)+'».':'sin categoría.'));
    };
    const remove=document.createElement('button');remove.type='button';remove.className='sm';
    remove.textContent='Quitar de esta categoría';
    remove.style.cssText='border:1px solid #b8755d;color:#903e20';
    remove.onclick=async()=>{
     state.categoriaAbierta=category.slug;
     await actualizarOrganizacion('asignar-categoria',{sku:member.sku,categoriaSlug:''},
      '«'+member.name+'» quitado de «'+category.nombre+'». El producto sigue en la carta.');
    };
    const edit=document.createElement('button');edit.type='button';edit.className='sm';
    edit.textContent='✎ Editar producto completo';
    edit.onclick=()=>{
     // Abrir el editor ORIGINAL para modificar precio, foto, nombre y estado.
     window.ukiCartaSeleccion?.('productos');
     state.group='propia:'+category.slug;state.query=member.name;
     if($('ukiPriceSearch'))$('ukiPriceSearch').value=member.name;
     if($('ukiPriceGroup'))$('ukiPriceGroup').value=state.group;
     renderPrices();
     $('ukiPriceList')?.scrollIntoView({behavior:'smooth',block:'start'});
    };
    actions.append(move,remove,edit);row.append(title,status,selector,actions);controls.append(row);
   }
   const addHeading=document.createElement('h4');addHeading.textContent='Agregar productos a esta categoría';
   addHeading.style.cssText='font-size:14px;margin:12px 0 0;color:#513224';
   const search=document.createElement('input');search.type='search';
   search.placeholder='Buscar producto por nombre';
   search.setAttribute('aria-label','Buscar producto para agregar a '+category.nombre);
   search.style.cssText='width:100%;box-sizing:border-box;padding:11px;font-size:16px;border:1px solid #d5b99d;border-radius:10px';
   const matches=document.createElement('div');
   matches.style.cssText='display:grid;gap:6px';
   const renderMatches=()=>{
    matches.replaceChildren();
    const term=search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const results=state.items.filter(item=>item.categoriaSlug!==category.slug&&
      (!term||(item.name+' '+item.sku).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term)))
      .slice(0,8);
    if(!results.length){const empty=document.createElement('small');empty.textContent='No hay más productos para agregar.';matches.append(empty);}
    for(const item of results){
     const line=document.createElement('div');
     line.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap;padding:8px;border:1px solid #e8d5c4;border-radius:9px';
     const label=document.createElement('span');label.style.cssText='font-size:13px;flex:1 1 140px;overflow-wrap:anywhere';
     const owner=state.categorias.find(c=>c.slug===item.categoriaSlug)?.nombre;
     label.textContent=item.name+(owner?' · ahora en '+owner:'');
     const add=document.createElement('button');add.type='button';add.className='sm';add.textContent='＋ Agregar';
     add.onclick=async()=>{
      if(owner&&!window.confirm('¿Mover «'+item.name+'» desde «'+owner+'» a «'+category.nombre+'»?'))return;
      state.categoriaAbierta=category.slug;
      await actualizarOrganizacion('asignar-categoria',{sku:item.sku,categoriaSlug:category.slug},
       '«'+item.name+'» agregado a «'+category.nombre+'».');
     };
     line.append(label,add);matches.append(line);
    }
   };
   search.oninput=renderMatches;renderMatches();
   controls.append(addHeading,search,matches);
   const del=document.createElement('button');del.type='button';del.className='sm';
   del.textContent='🗑 Eliminar categoría';
   del.style.cssText='border:1.5px solid #bb685e;color:#9d3d36;background:#fff4f1;margin-top:10px';
   del.onclick=async()=>{
    const location=state.branch==='arica'?'Regimiento Arica':'La Serena';
    if(!window.confirm('¿Eliminar la categoría «'+category.nombre+'» de '+location+'?\n\n'+members.length+
     ' producto(s) quedarán SIN esta categoría, pero NO se borrarán de la carta, del carrito ni del historial de ventas.'))return;
    state.categoriaAbierta='';
    await actualizarOrganizacion('eliminar-categoria',{categoriaSlug:category.slug},
     'Categoría «'+category.nombre+'» eliminada. Sus productos no se borraron.');
   };
   controls.append(del);details.append(controls);list.append(details);
  }
 }
 const filter=$('ukiPriceGroup');
 if(filter){
  const previous=state.group;
  filter.querySelectorAll('[data-uki-categoria-propia]').forEach(el=>el.remove());
  if(state.categoriasDescuentosHabilitados&&state.categorias.length){
   const group=document.createElement('optgroup');group.label='Categorías creadas';
   group.dataset.ukiCategoriaPropia='1';
   for(const c of state.categorias)group.append(new Option(c.nombre,'propia:'+c.slug));
   filter.append(group);
  }
  if([...filter.options].some(o=>o.value===previous))filter.value=previous;
  else{state.group='all';filter.value='all';}
 }
 const newProductCategory=$('ukiPriceNewCategory'),categoryBox=$('ukiPriceNewCategoryBox');
 if(categoryBox)categoryBox.hidden=!state.categoriasDescuentosHabilitados;
 if(newProductCategory){
  const previous=newProductCategory.value;
  newProductCategory.replaceChildren(new Option('Sin categoría propia',''));
  for(const c of state.categorias)newProductCategory.add(new Option(c.nombre,c.slug));
  newProductCategory.value=state.categorias.some(c=>c.slug===previous)?previous:'';
  newProductCategory.disabled=!state.categoriasDescuentosHabilitados;
 }
 renderCategoryAssignments();
}
async function crearCategoria(){
 const nombre=$('ukiCategoryNewName').value.trim(),chosen=state.branch;
 const local=chosen==='arica'?'Regimiento Arica':'La Serena';
 if(nombre.length<2||nombre.length>45){info('ukiCategoriesEstado','Escribe un nombre de 2 a 45 caracteres.');return;}
 const existing=state.categorias.find(c=>c.nombre.toLocaleLowerCase('es-CL')===nombre.toLocaleLowerCase('es-CL'));
 if(existing){info('ukiCategoriesEstado','«'+existing.nombre+'» ya existe. Está en la lista de arriba.');return;}
 if(state.busy)return;state.busy=true;$('ukiCategoryCreate').disabled=true;
 info('ukiCategoriesEstado','Guardando «'+nombre+'»…');
 try{
  const result=await request(API,'crear-categoria',{nombre},chosen);
  $('ukiCategoryNewName').value='';state.busy=false;await loadPrices(true);
  if(chosen!==branch())return;
  const saved=state.categorias.find(c=>c.slug===result.item?.slug);
  if(!saved)throw Error('El servidor guardó la categoría, pero no apareció en la lista. Actualiza precios antes de intentar crearla otra vez.');
  const msg='✓ Categoría «'+saved.nombre+'» guardada en '+local+'. Ya aparece en la lista y en el filtro de Productos.';
  info('ukiCategoriesEstado',msg);info('ukiPriceMessage',msg);
  const box=$('ukiCategoriesBox');if(box)box.open=false;
 }catch(e){info('ukiCategoriesEstado','No se confirmó: '+String(e.message||e))}
 finally{state.busy=false;$('ukiCategoryCreate').disabled=false;}
}

function eliminarProductoControl(price){
 if(!state.categoriasDescuentosHabilitados||!price?.custom||
    price.visible!==false||!['dish','pizza','monthly'].includes(price.kind))return null;
 const button=document.createElement('button');
 button.type='button';button.className='sm';
 button.textContent='🗑 Eliminar definitivamente';
 button.style.cssText='display:block;margin:12px 0 0;border:1.5px solid #bc6358;color:#98372e;background:#fff5f1;font-weight:800';
 button.setAttribute('aria-label','Eliminar definitivamente '+price.name+' solo de esta sucursal');
 button.onclick=async()=>{
  if(state.busy)return;
  const selected=state.branch;
  const local=selected==='arica'?'Regimiento Arica':'La Serena';
  if(!window.confirm('¿Eliminar DEFINITIVAMENTE «'+price.name+'» de '+local+'?\n\nSe borrará de la lista del panel y de la carta. No se podrá restaurar. Los pedidos, ventas y cierres anteriores se conservan.'))return;
  state.busy=true;button.disabled=true;
  try{
   await request(API,'eliminar-producto',{
    sku:price.sku,expected_version:price.version,
    expected_visibility_version:price.visibilityVersion
   },selected);
   state.busy=false;
   if(selected!==branch())return;
   await loadPrices(true);
   info('ukiPriceMessage','✓ «'+price.name+'» eliminado definitivamente de la carta y lista de productos de '+local+'. Se conservaron las ventas anteriores.');
  }catch(e){info('ukiPriceMessage','No se eliminó: '+String(e.message||e))}
  finally{state.busy=false;button.disabled=false;}
 };
 return button;
}
function line(price,ocultarRetiro=false){
 const wrap=document.createElement('article');wrap.className='uki-producto-edicion-card';
 wrap.style.cssText='display:flex;flex-direction:column;gap:12px;padding:17px 15px;margin:16px 0 20px;background:#fffdfa;border:1.5px solid #e0b58e;border-left:5px solid #e88434;border-radius:16px;box-shadow:0 5px 15px #70432314;min-width:0;overflow-wrap:anywhere';
 const summary=document.createElement('header');summary.style.cssText='padding-bottom:10px;border-bottom:1px solid #f0dfd1';
 const name=document.createElement('b');name.textContent=price.name;name.style.cssText='display:block;font-size:17px;line-height:1.35;color:#41271a';
 const sub=document.createElement('small');sub.style.cssText='display:block;color:#756759;margin-top:5px;font-size:12px';
 const esPromo=price.kind==='monthly';
 const estado=esPromo?(price.custom?price.estadoPublicacion:(price.visible===false?'Retirada':'Publicada')):null;
 sub.textContent=(price.categoriaNombre||price.group||price.kind)+' · '+
  (price.visible===false?'Retirado de carta':price.available?'Disponible':'Agotado');
 summary.append(name,sub);
 if(esPromo&&estado){
  const indicador=document.createElement('span');
  indicador.textContent=estado+(price.available?'':' · Agotada');
  indicador.style.cssText='display:inline-block;margin-top:5px;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:800;'+
   (estado==='Publicada'?'background:#edf7ed;color:#287044':estado==='Borrador'?
    'background:#fff0df;color:#925210':'background:#f1edeb;color:#775e4d');
  indicador.setAttribute('aria-label','Estado de promoción: '+estado);
  summary.append(indicador);
 }
 const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='1';input.max='1000000';
 input.value=String(price.price);input.setAttribute('aria-label','Nuevo precio de '+price.name);
 input.style.cssText='width:100%;max-width:230px;min-width:0;min-height:44px;border:1.5px solid #d5b899;border-radius:10px;padding:9px;font-size:16px';
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
 const priceSection=document.createElement('section');
 priceSection.className='uki-producto-precio-bloque';
 priceSection.style.cssText='padding:12px;background:#fff4e9;border:1px solid #f0d8bf;border-radius:12px;display:grid;gap:8px';
 const discount=Number(price.descuentoPorcentaje||0),original=Number(price.precioOriginal??price.price);
 const final=Number(price.precioFinal??(discount>0?Math.max(1,Math.round(original*(100-discount)/100)):price.price));
 const current=document.createElement('strong');
 current.style.cssText='display:block;color:#85400e;font-size:20px;line-height:1.3';
 current.textContent='Precio actual: '+peso(final);
 priceSection.append(current);
 if(Number.isSafeInteger(discount)&&discount>0&&discount<=99&&original>final){
  const offer=document.createElement('div');offer.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px';
  const before=document.createElement('s');before.textContent='Antes '+peso(original);
  const badge=document.createElement('b');badge.textContent='-'+discount+'% de descuento';
  badge.style.cssText='padding:4px 8px;background:#d94c30;color:white;border-radius:8px';
  offer.append(before,badge);priceSection.append(offer);
 }
 const priceLabel=document.createElement('label');
 priceLabel.style.cssText='display:block;font-size:13px;font-weight:700;color:#5f4030';
 priceLabel.textContent='Editar precio normal ($)';
 priceLabel.append(input);
 save.style.cssText='align-self:start;min-height:42px;padding:8px 13px;font-weight:750';
 priceSection.append(priceLabel,save);
 wrap.append(summary,priceSection);
 if(state.categoriasDescuentosHabilitados)wrap.append(extraProducto(price));
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
    info('ukiPriceMessage','✓ «'+next+'»: nombre, descripción y precio '+peso(amount)+' guardados.');
   }catch(e){info('ukiPriceMessage','No se guardó: '+String(e.message));}
   finally{state.busy=false;button.disabled=false;}
  };
  details.append(name,description,button);wrap.append(details);
 }
 if(state.promocionesHabilitadas){
  if(price.kind==='monthly'&&price.custom)wrap.append(promoEditor(price));
  if(!ocultarRetiro){
   const actions=document.createElement('details');actions.style.cssText='width:100%;padding:9px 0;border-top:1px solid #ecd5c1';
   const heading=document.createElement('summary');heading.textContent='Retirar, restaurar o publicar';heading.style.cssText='cursor:pointer;font-size:13px;font-weight:750;color:#84481b';
   const vis=visibilityControl(price);vis.style.marginTop='11px';actions.append(heading,vis);
    const deleteButton=eliminarProductoControl(price);if(deleteButton)actions.append(deleteButton);
    wrap.append(actions);
  }
 }else if(price.custom){
  // Mantener el retiro/restauración que ya usaba Uki, sin tablas ni APIs nuevas.
  const retire=document.createElement('button');retire.type='button';retire.className='sm';
  retire.textContent=price.available?'🗑 Quitar producto de la carta':'↩ Volver a mostrar producto';
  retire.onclick=async()=>{
   if(state.busy)return;
   const chosen=state.branch,action=price.available?'retirar-producto':'restaurar-producto';
   if(price.available&&!window.confirm('¿Quitar «'+price.name+'» de la carta de esta sucursal? El historial se conserva.'))return;
   state.busy=true;retire.disabled=true;
   try{await request(API,action,{sku:price.sku,expected_version:price.version},chosen);
    state.busy=false;await loadPrices(true);
    info('ukiPriceMessage','✓ «'+price.name+'» '+(price.available?'retirado de':'restaurado en')+
     ' la carta de esta sucursal.');}
   catch(e){info('ukiPriceMessage','No se modificó: '+String(e.message))}
   finally{state.busy=false;retire.disabled=false;}
  };
  wrap.append(retire);
 }
 return wrap;
}
// Resumen de promociones sin controles nuevos de cobro ni publicación.
function renderPromoResumen(){
  const target=$('ukiPromosListaResumen');if(!target)return;
  target.replaceChildren();
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
  const query=normalize($('ukiPromoBuscar')?.value).trim();
  const promos=state.items.filter(item=>item.kind==='monthly'&&(!query||normalize(item.name).includes(query)))
   .sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const count=document.createElement('p');count.className='mini-help';
  count.textContent=promos.length+' promociones y productos especiales en esta sucursal.';
  target.append(count);
  if(!promos.length){
   const none=document.createElement('p');none.className='muted';
   none.textContent='No hay promociones que coincidan con tu búsqueda.';target.append(none);return;
  }
  // Cada promoción tiene su propia tarjeta plegada. Los controles existentes
  // siguen funcionando, pero no aparecen mezclados con la siguiente promoción.
  for(const promo of promos){
   const card=document.createElement('details');
   card.className='uki-promo-edicion-card';
   card.style.cssText='margin:12px 0;border:1.5px solid #e8d0b9;background:#fffaf6;border-radius:15px;overflow:hidden;box-shadow:0 2px 6px #784d2412';
   const head=document.createElement('summary');
   head.style.cssText='display:block;padding:16px;cursor:pointer;list-style:none';
   const title=document.createElement('strong');title.style.cssText='font-size:16px;display:block;color:#3c2b23;line-height:1.35';
   title.textContent=promo.name;
   const status=document.createElement('div');
   status.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:9px';
   const price=document.createElement('span');price.style.cssText='font-weight:750;font-size:16px;color:#834c27';
   price.textContent=String.fromCharCode(36)+Number(promo.price||0).toLocaleString('es-CL');
   const pill=document.createElement('span');pill.style.cssText='padding:4px 10px;border-radius:999px;font-size:12px;font-weight:750';
   const estado=promo.estadoPublicacion||(promo.visible===false?'Retirada':'Publicada');
   pill.textContent=estado;
   pill.style.background=estado==='Publicada'?'#e8f5ea':estado==='Borrador'?'#fff0df':'#f1edeb';
   pill.style.color=estado==='Publicada'?'#207344':estado==='Borrador'?'#93551f':'#705b4e';
   status.append(price,pill);
    const porcentaje=Number(promo.descuentoPorcentaje||0);
    if(Number.isSafeInteger(porcentaje)&&porcentaje>0&&porcentaje<=99){
     const offer=document.createElement('span');offer.className='uki-promo-descuento';
     offer.style.cssText='font-size:13px;font-weight:750;color:#176d48';
     offer.textContent=porcentaje+'% menos · '+String.fromCharCode(36)+Number(promo.precioFinal||promo.price).toLocaleString('es-CL')+' final';
     status.append(offer);
    }
   const hint=document.createElement('span');hint.style.cssText='display:block;margin-top:10px;font-weight:700;color:#945327;font-size:13px';
   hint.textContent='▸ Ver detalles / editar esta promoción';
   head.append(title,status,hint);
   const body=document.createElement('section');
   body.style.cssText='padding:4px 14px 16px;border-top:1px solid #ead7c7;background:white';
   body.append(line(promo,true));
   if(state.promocionesHabilitadas){
    const visibility=visibilityControl(promo);
    visibility.style.marginTop='12px';body.append(visibility);
   }else{
    const note=document.createElement('p');note.className='mini-help';
    note.textContent='La edición de promociones nuevas estará disponible cuando se publique el panel junto con la carta.';
    body.append(note);
   }
   card.append(head,body);target.append(card);
  }
 }
function renderPrices(){
 const target=$('ukiPriceList');if(!target)return;
 target.replaceChildren();
 const query=state.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filtered=state.items.filter(x=>(state.group==='all'?x.kind!=='monthly':
  state.group.startsWith('propia:')?x.categoriaSlug===state.group.slice(7):x.kind===state.group)&&
  (!query||(x.name+' '+x.sku+' '+(x.categoriaNombre||'')).normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)));
 const title=document.createElement('p');title.className='muted';title.textContent=filtered.length+' productos encontrados';target.append(title);
 for(const item of filtered)target.append(line(item));
 if(!filtered.length){
  const p=document.createElement('p');p.textContent=query&&state.group!=='all'?
   'No hay resultados en esta categoría. Prueba Todas las categorías.':'No hay productos en esta búsqueda.';
  target.append(p);
  if(query&&state.group!=='all'){
   const btn=document.createElement('button');btn.className='sm';btn.type='button';btn.textContent='Buscar en todas';
   btn.onclick=()=>{state.group='all';$('ukiPriceGroup').value='all';renderPrices();};target.append(btn);
  }
 }
}
async function loadPrices(force=false){
 if(state.busy)return;
 state.branch=branch();const selected=state.branch;
 info('ukiPriceMessage','Cargando carta de '+(selected==='arica'?'Regimiento Arica':'La Serena')+'…');
 try{
  const data=await request(API,'listar',{},selected);
  if(selected!==branch())return;
  state.items=Array.isArray(data.items)?data.items:[];
  state.promocionesHabilitadas=data.promocionesHabilitadas===true;
  state.categoriasDescuentosHabilitados=data.categoriasDescuentosHabilitados===true;
  state.categorias=Array.isArray(data.categorias)?data.categorias:[];
  renderCategories();
  const promoBox=$('ukiPromoAddBox');if(promoBox){promoBox.hidden=!state.promocionesHabilitadas;
   if(!state.promocionesHabilitadas)promoBox.open=false;}
  state.ready=true;await loadPhotos(selected);renderPrices();renderPromoResumen();
  info('ukiPriceMessage','✓ '+state.items.length+' productos y precios de esta sucursal.'+
   (state.promocionesHabilitadas?' Promociones dinámicas disponibles.':' Las promociones nuevas estarán disponibles tras la publicación conjunta.'));
 }catch(e){state.ready=false;state.items=[];
  info('ukiPriceMessage','No se pudo consultar: '+String(e.message));}
 const pizza=$('ukiPriceNewKind');
 if(pizza){const option=pizza.querySelector('option[value="pizza"]');if(option)option.disabled=selected!=='arica';
  if(selected!=='arica'&&pizza.value==='pizza')pizza.value='dish';}
}
async function create(){
 const selectedBranch=branch();
 const kind=$('ukiPriceNewKind').value;
 const categoriaSlug=state.categoriasDescuentosHabilitados?String($('ukiPriceNewCategory')?.value||''):'';
 const name=$('ukiPriceNewName').value.trim(),description=$('ukiPriceNewDesc').value.trim(),price=Number($('ukiPriceNewAmount').value);
 if(categoriaSlug&&!state.categorias.some(c=>c.slug===categoriaSlug)){
  info('ukiPriceMessage','La categoría ya no existe en esta sucursal. Actualiza la lista.');return;
 }
 if(name.length<2||!Number.isSafeInteger(price)||price<1||price>1000000){
  info('ukiPriceMessage','Escribe un nombre y un precio válido.');return;
 }
 if(state.busy)return;
 state.busy=true;$('ukiPriceCreate').disabled=true;info('ukiPriceMessage','Agregando producto…');
 let created=false,categoryError='';
 try{
  const result=await request(API,'crear-producto',{item:{kind,group:kind==='pizza'?'pizzas':'entradas',name,description,price}},selectedBranch);
  created=true;
  if(categoriaSlug){
   try{await request(API,'asignar-categoria',{sku:result.item.sku,categoriaSlug},selectedBranch);}
   catch(e){categoryError=String(e.message||e);}
  }
  $('ukiPriceNewName').value='';$('ukiPriceNewDesc').value='';$('ukiPriceNewAmount').value='';
  if($('ukiPriceNewCategory'))$('ukiPriceNewCategory').value='';
  state.busy=false;await loadPrices(true);
  if(selectedBranch===branch())info('ukiPriceMessage',categoryError?
   '✓ Producto «'+name+'» creado, pero su categoría no se guardó: '+categoryError+'. Asígnala desde Categorías; no vuelvas a agregar el producto.':
   '✓ «'+name+'» agregado'+(categoriaSlug?' con su categoría':'')+' a la carta de '+(selectedBranch==='arica'?'Regimiento Arica':'La Serena')+'.');
  $('ukiPriceAddBox').open=false;
 }catch(e){info('ukiPriceMessage',created?
  '✓ El producto se creó, pero no se pudo actualizar la lista. Pulsa Actualizar precios antes de intentar agregarlo otra vez: '+String(e.message||e):
  'No se agregó: '+String(e.message||e));}
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
  const comprar=short.filter(i=>Number(i.stock_qty)<Number(i.min_stock_qty)).length;
  const revisar=short.length-comprar;
  info('ukiReponerEstado',all.length+' artículos · '+comprar+' con faltantes · '+
   revisar+' en el mínimo · '+(all.length-configured.length)+' sin mínimo configurado.');
  const root=$('ukiReponerListado');if(!root)return;root.replaceChildren();
  const help=document.createElement('p');help.className='muted';
  help.textContent='Compra sugerida hasta el mínimo. Las llegadas y posibles diferencias de consumo aparecen en los inventarios guardados.';
  root.append(help);
  if(!short.length){
   const none=document.createElement('p');none.textContent='✓ No hay faltantes según los mínimos registrados.';
   root.append(none);return;
  }
  const search=document.createElement('input');search.type='search';
  search.placeholder='Buscar producto para reponer';search.setAttribute('aria-label','Buscar artículo para reponer');
  search.style.cssText='width:100%;padding:12px;border:1px solid #ddc7b3;border-radius:12px;margin:8px 0 12px';
  const listing=document.createElement('div'),more=document.createElement('button');
  more.type='button';more.className='sm';more.textContent='Mostrar 15 más';
  more.style.cssText='margin:12px 0;width:100%';
  root.append(search,listing,more);
  let limit=12;
  const itemCard=p=>{
   const amount=Math.max(0,Math.round((Number(p.min_stock_qty)-Number(p.stock_qty))*1000)/1000);
   const fmt=n=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:3});
   const unit=p.stock_unit||'un';
   const card=document.createElement('div');
   card.style.cssText='border:1px solid #e8cba9;border-left:5px solid #d0812f;border-radius:12px;background:#fffbf5;padding:12px;margin:9px 0';
   const name=document.createElement('strong');name.style.cssText='display:block;font-size:15px;color:#57361c';
   name.textContent=p.name;
   const figures=document.createElement('div');
   figures.style.cssText='display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px';
   for(const [label,value,bg] of [
    ['Hay',fmt(p.stock_qty)+' '+unit,'#f6f3ef'],
    ['Mínimo',fmt(p.min_stock_qty)+' '+unit,'#f6f3ef'],
    ['Pedir',amount>0?fmt(amount)+' '+unit:'Revisar','#fff0d7']
   ]){
    const cell=document.createElement('div');cell.style.cssText='padding:8px 5px;border-radius:9px;background:'+bg+';min-width:0';
    const heading=document.createElement('small');heading.style.cssText='display:block;font-size:11px;color:#835935';
    heading.textContent=label;const val=document.createElement('b');
    val.style.cssText='display:block;overflow-wrap:anywhere;font-size:13px;color:#633c1d';
    val.textContent=value;cell.append(heading,val);figures.append(cell);
   }
   card.append(name,figures);return card;
  };
  const render=()=>{
   listing.replaceChildren();
   const term=String(search.value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   const matches=short.filter(p=>String(p.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term));
   const notEnough=matches.filter(p=>Number(p.stock_qty)<Number(p.min_stock_qty));
   const atMinimum=matches.filter(p=>Number(p.stock_qty)>=Number(p.min_stock_qty));
   const buckets=[['🛒 Para comprar',notEnough],['⚠️ Mínimo alcanzado · revisar',atMinimum]];
   let left=limit;
   for(const [title,group] of buckets){
    if(!group.length||left<=0)continue;
    const h=document.createElement('h4');h.textContent=title+' ('+group.length+')';
    h.style.cssText='margin:13px 0 7px;color:#78451a;font-size:15px';listing.append(h);
    for(const p of group.slice(0,left))listing.append(itemCard(p));
    left-=Math.min(group.length,left);
   }
   if(!matches.length){const empty=document.createElement('p');empty.className='muted';
    empty.textContent='No hay artículos con ese nombre.';listing.append(empty);}
   more.hidden=matches.length<=limit;
   more.textContent='Mostrar 15 más · '+Math.max(0,matches.length-limit)+' pendientes de ver';
  };
  search.oninput=()=>{limit=12;render();};
  more.onclick=()=>{limit+=15;render();};
  render();
 }catch(e){info('ukiReponerEstado','No se pudo consultar: '+String(e.message));}
}
// Navegación compacta dentro de la función ya existente Carta y precios.
function organizarCarta(){
 const root=$('ukiPreciosPanel');if(!root||$('ukiCartaOrdenNav'))return;
 const nav=document.createElement('div');nav.id='ukiCartaOrdenNav';
 nav.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:14px 0 16px';
 const areas={};
 const choices=[
  ['productos','📋 Productos','#fff4e7','#d87928'],
  ['categorias','🗂 Categorías','#f3f0ff','#7560a4'],
  ['ingredientes','🌿 Ingredientes','#edf6ed','#448355'],
  ['promociones','🎁 Promociones','#fff2ed','#b15a3a']
 ];
 for(const [key,title,bg,border] of choices){
  const btn=document.createElement('button');btn.type='button';btn.dataset.ukiCartaArea=key;
  btn.className='sm';btn.textContent=title;
  btn.style.cssText='min-width:0;width:100%;font-size:13px;font-weight:750;padding:11px 5px;line-height:1.35;white-space:normal;border:1.5px solid '+border+';border-radius:12px;background:'+bg+';color:#40312b';
  nav.append(btn);
  const area=document.createElement('section');area.id='ukiCartaArea'+key[0].toUpperCase()+key.slice(1);
  area.style.cssText='border:1px solid #ead9cc;border-radius:14px;padding:12px;margin:10px 0;background:#fff';
  const head=document.createElement('h3');head.style.cssText='font-size:17px;margin:0 0 8px;color:#503225';head.textContent=title;area.append(head);
  areas[key]=area;
 }
 const move=(element,parent)=>{if(element)parent.append(element)};
 // Mover los controles existentes sin recrear entradas ni manejadores.
 move($('ukiPriceSearch')?.closest('.quick-grid'),areas.productos);
 for(const id of ['ukiPriceReload','ukiPriceMessage','ukiPriceAddBox','ukiPriceList'])move($(id),areas.productos);
 const categoryHelp=document.createElement('p');categoryHelp.className='mini-help';
 categoryHelp.textContent='Crea categorías y asigna productos aquí mismo. No modifica el armado ni los precios. Cada sucursal es independiente.';
 areas.categorias.append(categoryHelp);
 const estadoCategorias=document.createElement('p');estadoCategorias.id='ukiCategoriesEstado';
 estadoCategorias.setAttribute('role','status');estadoCategorias.setAttribute('aria-live','polite');
 estadoCategorias.style.cssText='font-weight:750;color:#246247;margin:8px 0 14px';
 areas.categorias.append(estadoCategorias);
 // La lista es independiente del formulario plegable «Crear».
 move($('ukiCategoriesList'),areas.categorias);
 move($('ukiCategoriesBox'),areas.categorias);
 const categorySearchLabel=document.createElement('label');categorySearchLabel.textContent='Buscar producto para asignar categoría';
 categorySearchLabel.htmlFor='ukiCategoriaBuscar';
 const categorySearch=document.createElement('input');categorySearch.id='ukiCategoriaBuscar';categorySearch.type='search';
 categorySearch.placeholder='Ej. 24 piezas, gohan o promo';
 categorySearch.oninput=()=>{state.categoryVisibleLimit=18;renderCategoryAssignments();};
 const categoryAssignments=document.createElement('div');categoryAssignments.id='ukiCategoriaAsignaciones';
 const advanced=document.createElement('details');
 advanced.id='ukiCategoriaBuscadorGlobal';
 advanced.style.cssText='border:1px solid #e0cdbb;border-radius:12px;padding:11px;margin-top:15px;background:#fffaf3';
 const advancedHeading=document.createElement('summary');
 advancedHeading.textContent='Buscar y asignar entre todos los productos (opcional)';
 advancedHeading.style.cssText='cursor:pointer;font-weight:750;color:#764225';
 advanced.append(advancedHeading,categorySearchLabel,categorySearch,categoryAssignments);
 areas.categorias.append(advanced);
 // Promociones en dos bloques independientes, sin cambiar ningún manejador.
 const crearArea=document.createElement('section');crearArea.id='ukiPromoNuevaZona';
 crearArea.style.cssText='border:1.5px solid #e2c6ad;border-radius:14px;padding:13px;background:#fff8f0;margin-bottom:15px';
 const nuevaAyuda=document.createElement('p');nuevaAyuda.className='muted';
 nuevaAyuda.textContent='Nueva promoción. Abre el formulario solo para crear; las existentes están separadas abajo.';
 crearArea.append(nuevaAyuda);move($('ukiPromoAddBox'),crearArea);
 const existentes=document.createElement('section');existentes.id='ukiPromoExistentesZona';
 existentes.style.cssText='border:1.5px solid #e2c6ad;border-radius:14px;padding:13px;background:#fff;margin-bottom:12px';
 const listaTitulo=document.createElement('h4');listaTitulo.style.cssText='font-size:17px;color:#783b24;margin:0 0 5px';
 listaTitulo.textContent='Promociones existentes · Ver o editar';existentes.append(listaTitulo);
 const searchLabel=document.createElement('label');searchLabel.textContent='Buscar promoción por nombre';
 searchLabel.htmlFor='ukiPromoBuscar';
 const search=document.createElement('input');search.id='ukiPromoBuscar';search.type='search';
 search.placeholder='Ej. 60 piezas o Edenred';
 search.addEventListener('input',()=>renderPromoResumen());
 existentes.append(searchLabel,search);move($('ukiPromosResumen'),existentes);
 areas.promociones.append(crearArea,existentes);
 const clean=document.createElement('button');clean.type='button';clean.className='sm';
 clean.textContent='Limpiar búsqueda y categoría';
 clean.addEventListener('click',()=>{
  state.query='';state.group='all';
  if($('ukiPriceSearch'))$('ukiPriceSearch').value='';
  if($('ukiPriceGroup'))$('ukiPriceGroup').value='all';
  renderPrices();
 });
 const list=$('ukiPriceList');if(list)areas.productos.insertBefore(clean,list);
 root.append(nav,areas.productos,areas.categorias,areas.ingredientes,areas.promociones);
 const choose=key=>{
  if(!areas[key])return;
  state.cartaArea=key;
  for(const [name,title,bg,border] of choices){
   areas[name].hidden=name!==key;
   const btn=nav.querySelector('[data-uki-carta-area="'+name+'"]');
   if(btn){btn.setAttribute('aria-pressed',String(name===key));
    btn.style.boxShadow=name===key?'inset 0 0 0 2px '+border:'none';}
  }
  // La lista de ingredientes se carga desde su propio módulo, sin duplicación.
  if(key==='ingredientes'){
   const editor=$('ukiArmadoIngredientes');if(editor&&!editor.open)editor.open=true;
  }
 };
 nav.querySelectorAll('button').forEach(btn=>btn.onclick=()=>choose(btn.dataset.ukiCartaArea));
 window.ukiCartaSeleccion=choose;
 choose(state.cartaArea||'productos');
 renderCategoryAssignments();
}
function mount(){
 prevMount();if(!$('ukiInvTabs'))return;
 organizarCarta();
 const selectedBranch=branch();
 if(state.branch!==selectedBranch){state.items=[];state.photos={};state.ready=false;state.query='';state.group='all';state.categoryVisibleLimit=18;state.categoriaAbierta='';state.tab='inventario';}
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
 $('ukiCategoryCreate').onclick=()=>void crearCategoria();
 $('ukiPromoCreate').onclick=()=>void crearPromo();
 $('ukiPromoType').onchange=mostrarTipoPromo;mostrarTipoPromo();
 for(const id of ['ukiPromoRollCount','ukiPromoPiecesPerRoll'])
   $(id).oninput=actualizaPiezasPromo;
 actualizaPiezasPromo();
 $('ukiReponerReload').onclick=()=>void loadReponer();
 const invBranch=$('invBranch');
 if(invBranch&&!invBranch.dataset.ukiPrecioObservador){
  invBranch.dataset.ukiPrecioObservador='1';
  invBranch.addEventListener('change',()=>{state.branch=branch();state.ready=false;state.items=[];state.categoriaAbierta='';
   if(state.tab==='precios')void loadPrices(true);
   if(state.tab==='reportes')void loadReponer();
  });
 }
 showTab();
}
window.ukiInventarioMontar=mount;
})();
