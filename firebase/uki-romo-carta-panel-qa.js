'use strict';
/**
 * Misma pantalla de Uki, vista exclusiva de Romo's Sushi en QA.
 * Ningún acceso comercial ni escritura. No solicita otra clave, correo ni PIN.
 * Para conectar el backend es necesaria configuración explícita posterior.
 */
(function initRomoCartaQA(root){
 const STORE='romo:serena';
 const ENDPOINT=''; // Inactivo hasta origen privado + permisos reales aprobados.
 const MAX_ITEMS=300;
 const categories=[
  {key:'productos',title:'Productos',kind:'producto'},
  {key:'promociones',title:'Promociones',kind:'promocion'},
  {key:'ingredientes',title:'Ingredientes',kind:'ingrediente'}
 ];
 const statusLabel=(item)=>item.visible===true?(item.available===false?'Agotado':'Visible'):
  item.available===false?'Retirado / agotado':'Borrador / no publicado';
 const el=(id)=>root.document?.getElementById(id);
 const text=(node,value)=>{if(node)node.textContent=String(value)};
 const create=(tag,css,textValue)=>{
  const x=root.document.createElement(tag);
  if(css)x.className=css;
  if(textValue!==undefined)x.textContent=String(textValue);
  return x;
 };
 function isRomoCatalog(response){
  return response&&response.ok===true&&response.storeId===STORE&&
   Number.isSafeInteger(response.revision)&&response.revision>=0&&
   response.catalog&&response.catalog.formato==='romo-catalogo-v1'&&
   response.catalog.sucursal===STORE&&categories.every(({key})=>
    Array.isArray(response.catalog[key])&&response.catalog[key].length<=MAX_ITEMS);
 }
 function renderCatalog(response){
  if(!isRomoCatalog(response))throw Error('Respuesta de otra sucursal o incompleta');
  const c=response.catalog;
  for(const {key,title} of categories){
   const area=el('romoQACategoria'+key);
   if(!area)continue;
   area.replaceChildren();
   const heading=create('h3','',title+' ('+c[key].length+')');
   area.appendChild(heading);
   if(!c[key].length){
    area.appendChild(create('p','muted','Sin registros todavía. No se importaron productos de Uki.'));
    continue;
   }
   for(const item of c[key]){
    if(!item||typeof item.sku!=='string'||!item.sku.startsWith('romo:')||
       typeof item.name!=='string'||!Number.isSafeInteger(item.price)||item.price<0)
     throw Error('Catálogo contiene un registro no verificado');
    const row=create('div','card romo-qa-item');
    const name=create('strong','',item.name);
    const detail=create('p','muted',
     'Precio: '+new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(item.price)
     +' · '+statusLabel(item));
    row.append(name,detail);
    if(key==='promociones'){
     const info=create('p','mini-help',
      'Piezas: '+Number(item.pieces||0)+' · Rolls: '+Number(item.rollCount||0)+
      ' · Salsas: '+Number(item.sauceCount||0)+' · Korokes: '+Number(item.korokes||0));
     row.appendChild(info);
    }
    area.appendChild(row);
   }
  }
  text(el('romoQACartaEstado'),'Catálogo Romo consultado. Revisión '+response.revision+
   '. Lectura únicamente: no se han cambiado precios ni publicado promociones.');
 }
 async function consultar(){
  const state=el('romoQACartaEstado');
  if(!state)return false;
  const button=el('romoQACartaConsultar');
  if(!ENDPOINT){
   text(state,'La conexión segura del catálogo de Romo todavía no está habilitada. '+
    'No se modificaron datos ni se consultó la base de Uki.');
   return false;
  }
  if(!/^https:\/\/[a-z0-9.-]+\.vercel\.app\/api\/romo-catalogo-qa$/.test(ENDPOINT)){
   text(state,'URL de pruebas no autorizada.');
   return false;
  }
  if(button)button.disabled=true;
  text(state,'Verificando acceso autorizado a Romo…');
  try{
   const token=await root.ukiInventarioToken?.();
   if(!token)throw Error('Debes tener iniciada tu sesión Google habitual.');
   const ac=new AbortController();
   const timer=setTimeout(()=>ac.abort(),12000);
   let response;
   try{
    response=await fetch(ENDPOINT,{method:'GET',headers:{Authorization:'Bearer '+token},
     credentials:'omit',cache:'no-store',signal:ac.signal});
   }finally{clearTimeout(timer)}
   if(!response.ok)throw Error('El acceso privado de Romo aún no está habilitado.');
   const json=await response.json();
   renderCatalog(json);
   return true;
  }catch(error){
   text(state,String(error?.message||'No se pudo consultar Romo.')+
    ' Los pedidos y la caja siguen bloqueados.');
   return false;
  }finally{if(button)button.disabled=false;}
 }
 function vista(){
  return '<section class="card" id="romoQACartaPanel" aria-label="Romo Carta y precios en preparación">'+
    '<h2>🧾 Carta y precios · Romo</h2>'+
    '<p class="muted">Misma administración del panel, con productos y promociones propios. '+
      'Por seguridad esta vista está en modo consulta hasta conectar permisos y precios definitivos.</p>'+
    '<button type="button" class="sm" id="romoQACartaConsultar" onclick="ukiRomoCartaPanelConsultarQA()">Consultar catálogo Romo</button>'+
    '<p class="muted" id="romoQACartaEstado" role="status">El catálogo aún no está conectado. Sin operaciones reales.</p>'+
    '<div id="romoQACategoriaproductos"></div>'+
    '<div id="romoQACategoriapromociones"></div>'+
    '<div id="romoQACategoriaingredientes"></div>'+
    '<div class="card" id="romoQAInventarioPreparacion"><h3>📦 Inventario · Romo</h3>'+
      '<p class="muted">Inventario independiente en preparación. Cantidad recibida, cantidad existente, diferencia y mínimo para reponer. Sin movimientos reales ni conexión a caja.</p></div>'+
    '</section>';
 }
 root.ukiRomoCartaPanelHTMLQA=vista;
 root.ukiRomoCartaPanelConsultarQA=consultar;
 root.ukiRomoCatalogoRenderQA=renderCatalog; // Contrato para pruebas sin servidor.
})(window);
