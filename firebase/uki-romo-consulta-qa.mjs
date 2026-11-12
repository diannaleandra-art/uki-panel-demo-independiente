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
 setup('catalog','ukiPreciosPanel','romoConsultaResultadosQA');
 setup('inventory','invRoot','romoConsultaInventarioResultadosQA');
 return true;
}
if(typeof window!=='undefined'){
 window.ukiRomoConsultaPrepararQA=prepararConsultaRomoQA;
}
