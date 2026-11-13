/**
 * Romo La Serena en el MISMO editor original de Uki: consulta real SOLO LECTURA.
 * No reemplaza los formularios ni habilita pedidos, cajas, cambios o ventas.
 * Solo consulta la base exclusiva Romo a través de un backend que valida JWT
 * Firebase Google y el rol activo de la dueña en Neon.
 */
const STORE='romo:serena';
const API='https://uki-sushi-inventario.vercel.app/api/romo-estado-operativo-qa';
const AREAS=new Set(['catalog','inventory']);
const jsonHeaders=(token)=>Object.freeze({Authorization:'Bearer '+token});
function checked(result,area){
 if(!result||result.ok!==true||result.storeId!==STORE||result.area!==area||
    !Number.isSafeInteger(result.revision)||result.revision<0||
    result.ventasHabilitadas!==false)
  throw Error('Los datos recibidos no corresponden a Romo La Serena');
 if(area==='catalog'){
  const c=result.catalog;
  if(!c||c.storeId!==STORE||c.brand!=='romo'||c.revision!==result.revision||
    !['products','ingredients','promotions'].every(k=>Array.isArray(c[k]))||
    [...c.products,...c.promotions,...c.ingredients].some(x=>
      typeof x.name!=='string'||x.name.length>100||/pizza/i.test(x.name)))
    throw Error('Catálogo Romo inválido o sin confirmar');
 }else if(!result.inventory||result.inventory.sucursal!==STORE||
    !Array.isArray(result.inventory.items)||result.inventory.items.length>600)
   throw Error('Inventario Romo inválido');
 return result;
}
export async function consultarRomoSoloLecturaQA({
 area,getToken=()=>window.ukiInventarioToken?.(),fetchFn=fetch
}={}){
 if(!AREAS.has(area))throw Error('Área Romo no reconocida');
 if(typeof getToken!=='function'||typeof fetchFn!=='function')
  throw Error('Google del panel no disponible');
 const token=await getToken();
 if(typeof token!=='string'||token.length<30||token.length>12000)
  throw Error('Entra con el Google habitual de Uki para revisar Romo');
 const url=API+'?area='+area;
 const response=await fetchFn(url,{method:'GET',mode:'cors',credentials:'omit',
  cache:'no-store',headers:jsonHeaders(token)});
 if(!response?.ok){
  if(response?.status===403)throw Error('Google sin acceso a Romo: revisa el permiso de dueña');
  if(response?.status===503)throw Error('Lectura de Romo pendiente de activación segura');
  throw Error('No fue posible consultar esta área de Romo');
 }
 return checked(await response.json(),area);
}
function money(value){return Number.isSafeInteger(value)?'$'+value.toLocaleString('es-CL'):'Precio por revisar'}
function section(document,id,title){
 const node=document.createElement('section');node.id=id;node.className='card';
 const strong=document.createElement('h3');strong.textContent=title;node.append(strong);
 return node;
}
function textRow(document,root,value){
 const p=document.createElement('p');p.className='muted';p.textContent=value;root.append(p);
}
function listCatalog(document,root,catalog){
 const overview=section(document,'romoConsultaResultadosQA','Catálogo propio de Romo');
 textRow(document,overview,catalog.products.length+' productos · '+
  catalog.promotions.length+' promociones · '+catalog.ingredients.length+' ingredientes');
 for(const [title,items] of [['Productos',catalog.products],['Promociones',catalog.promotions]]){
  const h=document.createElement('h4');h.textContent=title;overview.append(h);
  for(const item of items){
   const off=item.discountPercent>0?Math.round(item.price*(100-item.discountPercent)/100):item.price;
   textRow(document,overview,item.name+' · '+money(off)+(item.discountPercent>0?' (antes '+money(item.price)+')':'')+
    ' · '+(item.visible===false?'Borrador oculto':item.available===false?'Agotado':'Visible'));
  }
 }
 const h=document.createElement('h4');h.textContent='Ingredientes';overview.append(h);
 for(const item of catalog.ingredients)textRow(document,overview,item.name+' · '+(item.visible===false?'Borrador':'Disponible'));
 root.append(overview);
}
function listInventory(document,root,result){
 const overview=section(document,'romoConsultaInventarioResultadosQA','Inventario exclusivo de Romo');
 textRow(document,overview,result.inventory.items.length===0?
  'Todavía no se han registrado existencias de Romo.':result.inventory.items.length+' insumos guardados.');
 for(const item of result.inventory.items){
  textRow(document,overview,item.name+' · '+item.hay+' '+item.unit);
 }
 root.append(overview);
}

/**
 * Vista ROMO en las LISTAS originales del editor Uki, sin segundo formulario.
 * No llama a guardar, no cambia estados, no publica borradores.
 * Los datos proceden solamente de la lectura autenticada y aislada de Romo.
 */
export function poblarEditorRomoSoloLecturaQA({document,catalogo,busqueda='',categoria='all',
 disponibilidadBusqueda='',disponibilidadTipo='all'}={}){
 if(!document?.body?.classList?.contains('romo-qa')||
    !document.getElementById('romoLaSerenaPreparacionQA')||
    !document.getElementById('ukiPriceList')||
    !document.getElementById('ukiPromosListaResumen'))throw Error('Editor de Romo no está montado');
 const verified=checked({ok:true,storeId:STORE,area:'catalog',revision:catalogo?.revision,
  catalog:catalogo,ventasHabilitadas:false},'catalog').catalog;
 if(verified.brand!=='romo'||[...verified.products,...verified.promotions,...verified.ingredients].some(
  item=>typeof item.sku!=='string'||!item.sku.startsWith('romo:')||
    !Number.isSafeInteger(item.version)||item.version<1))
  throw Error('Catálogo de otra sucursal o datos Romo inválidos');
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=(item,search)=>!search||norm(item.name).includes(norm(search));
 const create=(tag,cls,text)=>{const el=document.createElement(tag);
  if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el};
 const status=item=>item.visible===false?'No publicado':item.available===false?'Agotado':'Disponible';
 const price=item=>money(item.price);
 const list=document.getElementById('ukiPriceList');
 const promos=document.getElementById('ukiPromosListaResumen');
 const visibleItems=[...verified.products,...verified.promotions].filter(item=>
  matches(item,busqueda)&&(categoria==='all'||(item.categoriaSlug||item.group||'')===categoria));
 const listFrag=document.createDocumentFragment();
 for(const item of visibleItems){
  const card=create('article','card romo-producto-consulta-qa');
  card.dataset.romoSku=item.sku;card.dataset.readonly='true';
  card.append(create('strong','',item.name));
  const detail=create('p','muted',price(item)+' · '+status(item));
  card.append(detail);
  if(typeof item.description==='string'&&item.description.trim())
   card.append(create('p','mini-help',item.description));
  if(verified.promotions.some(p=>p.sku===item.sku)){
   const ext=[];
   if(Number.isInteger(item.rollCount)&&Number.isInteger(item.piecesPerRoll))
    ext.push((item.rollCount*item.piecesPerRoll)+' piezas');
   if(Number.isInteger(item.sauceCount))ext.push(item.sauceCount+' salsa(s)');
   if(Number.isInteger(item.korokes)&&item.korokes>0)ext.push(item.korokes+' korokes');
   if(ext.length)card.append(create('p','mini-help',ext.join(' · ')));
  }
  listFrag.append(card);
 }
 if(!visibleItems.length)listFrag.append(create('p','muted',
  'No hay productos de Romo con ese filtro. Los borradores continúan guardados.'));
 list.replaceChildren(listFrag);
 const promosFrag=document.createDocumentFragment();
 if(!verified.promotions.length)promosFrag.append(create('p','muted','Romo no tiene promociones guardadas.'));
 for(const item of verified.promotions){
  const p=create('p','mini-help',item.name+' · '+price(item)+' · '+status(item));
  promosFrag.append(p);
 }
 promos.replaceChildren(promosFrag);
 const availability=document.getElementById('ukiDispLista');
 if(availability){
  const items=[...verified.products,...verified.promotions,...verified.ingredients]
   .filter(item=>matches(item,disponibilidadBusqueda)&&
    (disponibilidadTipo==='all'||(disponibilidadTipo==='product'?
     [...verified.products,...verified.promotions].some(p=>p.sku===item.sku):
     verified.ingredients.some(p=>p.sku===item.sku))));
  const frag=document.createDocumentFragment();
  for(const item of items){
   const line=create('p','card romo-disponibilidad-consulta-qa',
    item.name+' · '+status(item)+(Number.isSafeInteger(item.surcharge)&&item.surcharge>0?
     ' · adicional '+money(item.surcharge):''));
   line.dataset.romoSku=item.sku;line.dataset.readonly='true';frag.append(line);
  }
  if(!items.length)frag.append(create('p','muted','Sin ingredientes o productos con ese filtro.'));
  availability.replaceChildren(frag);
 }
 const availabilityStatus=document.getElementById('ukiDispMensaje');
 if(availabilityStatus)availabilityStatus.textContent=
  'Disponibilidad Romo · '+verified.ingredients.length+' ingredientes · solo consulta, sin cambios.';
 return Object.freeze({storeId:STORE,revision:verified.revision,productos:verified.products.length,
  promociones:verified.promotions.length,ingredientes:verified.ingredients.length,
  mostrados:visibleItems.length,soloLectura:true});
}
export function montarCatalogoEnEditorRomoQA({document,consultar=()=>consultarRomoSoloLecturaQA({area:'catalog'}),
 cargarAlAbrir=true}={}){
 const list=document?.getElementById?.('ukiPriceList'),promos=document?.getElementById?.('ukiPromosListaResumen');
 const refresh=document?.getElementById?.('ukiPriceReload'),search=document?.getElementById?.('ukiPriceSearch');
 const group=document?.getElementById?.('ukiPriceGroup');
 if(!list||!promos||!refresh||!document.body.classList.contains('romo-qa')||
    !document.getElementById('romoLaSerenaPreparacionQA'))return false;
 let last=null,busy=false;
 // Solo consulta y filtros; todos los demás controles de la plantilla siguen bloqueados.
 refresh.disabled=false;
 refresh.textContent='Actualizar catálogo Romo';
 if(search)search.disabled=false;
 if(group){
  group.disabled=false;
  for(const [value,label] of [['piezas','Piezas de sushi Romo'],['promociones','Promociones Romo']]){
   if(!Array.from(group.options).some(o=>o.value===value)){
    const opt=document.createElement('option');opt.value=value;opt.textContent=label;group.append(opt);
   }
  }
 }
 const availabilitySearch=document.getElementById('ukiDispBuscar');
 const availabilityType=document.getElementById('ukiDispTipo');
 const availabilityRefresh=document.getElementById('ukiDispRefrescar');
 for(const n of [availabilitySearch,availabilityType,availabilityRefresh])if(n)n.disabled=false;
 const status=document.getElementById('ukiPriceMessage');
 const render=()=>{
  if(!last)return;
  if(!list.isConnected||!document.body.classList.contains('romo-qa'))return;
  poblarEditorRomoSoloLecturaQA({document,catalogo:last,
   busqueda:search?.value||'',categoria:group?.value||'all',
   disponibilidadBusqueda:availabilitySearch?.value||'',
   disponibilidadTipo:availabilityType?.value||'all'});
 };
 const load=async()=>{
  if(busy)return;
  busy=true;refresh.disabled=true;
  if(status)status.textContent='Consultando el catálogo independiente de Romo…';
  try{
   const response=await consultar();
   if(!list.isConnected||!document.body.classList.contains('romo-qa'))return;
   const cat=checked(response,'catalog').catalog;
   last=cat;render();
   if(status)status.textContent='Romo La Serena · revisión '+cat.revision+
    ' · '+cat.products.length+' productos · '+cat.promotions.length+
    ' promociones · '+cat.ingredients.length+' ingredientes. Solo consulta.';
  }catch(error){
   last=null;list.replaceChildren();promos.replaceChildren();
   if(status)status.textContent=String(error?.message||'Catálogo Romo no disponible');
  }finally{busy=false;if(list.isConnected)refresh.disabled=false}
 };
 refresh.addEventListener('click',()=>void load());
 for(const n of [search,group,availabilitySearch,availabilityType])
  n?.addEventListener(n===search||n===availabilitySearch?'input':'change',render);
 availabilityRefresh?.addEventListener('click',()=>void load());
 if(cargarAlAbrir)void load();
 return true;
}

export function prepararConsultaRomoQA({document,storeId,qaOnly=false}={}){
 if(qaOnly!==true||storeId!==STORE||
  !document?.body?.classList?.contains('romo-qa')||
  !document.getElementById('romoLaSerenaPreparacionQA'))
  return false;
 const setup=(area,hostId,resultId)=>{
  const host=document.getElementById(hostId);
  if(!host||document.getElementById('romoConsultaBoton'+area))return;
  const card=section(document,'romoConsultaBoton'+area,
   area==='catalog'?'Consulta del catálogo de Romo':'Consulta del inventario de Romo');
  const status=document.createElement('p');
  status.className='muted';
  status.setAttribute('role','status');
  status.textContent='Solo lectura. No guarda ni vende.';
  const button=document.createElement('button');button.type='button';
  button.className='big romo-consulta-qa';
  button.textContent='Consultar datos de Romo';
  button.disabled=false;
  card.append(button,status);host.prepend(card);
  button.addEventListener('click',async()=>{
   button.disabled=true;
   status.textContent='Comprobando acceso Google y datos de Romo…';
   try{
    const data=await consultarRomoSoloLecturaQA({area});
    const old=document.getElementById(resultId);
    old?.remove();
    if(area==='catalog')listCatalog(document,card,data.catalog);
    else listInventory(document,card,data);
    status.textContent='Información de Romo confirmada · revisión '+data.revision+'. Sin ventas activas.';
   }catch(e){
    status.textContent=String(e?.message||'No se pudo consultar Romo');
   }finally{button.disabled=false}
  });
 };
 // En el editor completo usar los campos ORIGINALES en lugar de crear
 // una segunda lista; el montaje reducido de pruebas conserva su consulta.
 if(!montarCatalogoEnEditorRomoQA({document}))
  setup('catalog','ukiPreciosPanel','romoConsultaResultadosQA');
 setup('inventory','invRoot','romoConsultaInventarioResultadosQA');
 return true;
}
if(typeof window!=='undefined'){
 window.ukiRomoConsultaPrepararQA=prepararConsultaRomoQA;
}
