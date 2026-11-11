'use strict';
/**
 * Romo La Serena dentro del MISMO panel Uki — QA.
 * GET/POST dirigidos a un servicio de prueba protegido, nunca a tablas Uki.
 * Cualquier cambio es un BORRADOR de Romo: sin ventas ni publicación real.
 */
(function initRomoCartaQA(root){
 const STORE='romo:serena';
 const ENDPOINT='/api/romo-catalogo-qa';
 const MAX_ITEMS=300;
 const categories=[
  {key:'productos',title:'Productos'},
  {key:'promociones',title:'Promociones'},
  {key:'ingredientes',title:'Ingredientes'}
 ];
 const kinds={
  productos:['sushi','roll','handroll','gohan','burger','entrada','bebida','extra','otro'],
  promociones:['sushi','gohan','combo','otro'],
  ingredientes:['vegetal','proteina','envoltura','salsa','adicional']
 };
 let cache=null,loading=false;
 const el=id=>root.document?.getElementById(id);
 const text=(node,value)=>{if(node)node.textContent=String(value)};
 const create=(tag,css,textValue)=>{
  const x=root.document.createElement(tag);
  if(css)x.className=css;
  if(textValue!==undefined)x.textContent=String(textValue);
  return x;
 };
 function preview(){
  const host=String(root.location?.hostname||'').toLowerCase();
  return /^uki-sushi-inventario-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(host);
 }
 function itemState(item){
  if(item.visible===true)return item.available===false?'Agotado':'Publicado (edición bloqueada en QA)';
  return item.available===false?'Borrador no disponible':'Borrador no publicado';
 }
 function isRomoCatalog(response){
  return response&&response.ok===true&&response.storeId===STORE&&
   Number.isSafeInteger(response.revision)&&response.revision>=0&&
   response.catalog&&response.catalog.formato==='romo-catalogo-v1'&&
   response.catalog.sucursal===STORE&&categories.every(({key})=>
    Array.isArray(response.catalog[key])&&response.catalog[key].length<=MAX_ITEMS);
 }
 function renderCatalog(response){
  if(!isRomoCatalog(response))throw Error('Respuesta de otra sucursal o incompleta');
  const sections=response.catalog;
  const all=[...sections.productos,...sections.promociones,...sections.ingredientes];
  const ids=new Set();
  for(const item of all){
   if(!item||typeof item.sku!=='string'||!item.sku.startsWith('romo:')||
      ids.has(item.sku)||typeof item.name!=='string'||
      !Number.isSafeInteger(item.price)||item.price<0)throw Error('Registro Romo no verificado');
   ids.add(item.sku);
  }
  cache=structuredClone({revision:response.revision,catalog:sections,
   edit:response.edicionHabilitada===true});
  const canEdit=cache.edit&&preview();
  for(const {key,title} of categories){
   const area=el('romoQACategoria'+key);
   if(!area)continue;
   area.replaceChildren();
   area.appendChild(create('h3','',title+' ('+sections[key].length+')'));
   if(!sections[key].length){
    area.appendChild(create('p','muted','Sin registros todavía. No se han copiado datos de Uki.'));
    continue;
   }
   for(const item of sections[key]){
    const row=create('div','card romo-qa-item');
    row.append(
     create('strong','',item.name),
     create('p','muted',new Intl.NumberFormat('es-CL',{
      style:'currency',currency:'CLP',maximumFractionDigits:0
     }).format(item.price)+' · '+itemState(item))
    );
    if(key==='promociones'){
     row.appendChild(create('p','mini-help',
      'Piezas: '+Number(item.pieces||0)+' · Rolls: '+Number(item.rollCount||0)+
      ' · Salsas: '+Number(item.sauceCount||0)+' · Korokes: '+Number(item.korokes||0)));
     row.appendChild(create('p','muted',
      'Fotografía de la promoción: pendiente de verificar. No se publica desde QA.'));
    }
    if(canEdit&&item.visible===false){
     const button=create('button','sm','Editar borrador');
     button.type='button';
     button.addEventListener('click',()=>edit(key,item.sku));
     row.appendChild(button);
    }
    area.appendChild(row);
   }
  }
  const add=el('romoQACartaAgregar');
  if(add)add.hidden=!canEdit;
  const editor=el('romoQACartaEditor');
  if(editor)editor.hidden=true;
  text(el('romoQACartaEstado'),'Catálogo de Romo consultado (revisión '+response.revision+
   '). '+(canEdit?'Permite guardar borradores, sin publicarlos.':'Lectura únicamente; edición no habilitada.'));
 }
 function edit(section,sku){
  if(!cache?.edit||!preview())return false;
  const row=cache.catalog[section]?.find(x=>x.sku===sku);
  if(!row||row.visible!==false)return false;
  return editForm(section,row,'editar');
 }
 function addNew(){
  if(!cache?.edit||!preview())return false;
  const section=el('romoQAEditorSeccion')?.value||'productos';
  if(!kinds[section])return false;
  const row={sku:'',kind:kinds[section][0],name:'',description:'',
   price:0,visible:false,available:true};
  return editForm(section,row,'agregar');
 }
 function editForm(section,row,mode){
  const form=el('romoQACartaEditor');
  if(!form)return false;
  form.hidden=false;
  form.dataset.mode=mode;
  form.dataset.section=section;
  form.dataset.sku=row.sku||'';
  const choose=el('romoQAEditorSeccion');
  if(choose){choose.value=section;choose.disabled=mode==='editar'}
  const kind=el('romoQAEditorTipo');
  if(kind){
   kind.replaceChildren();
   for(const type of kinds[section]){const opt=create('option','',type);opt.value=type;kind.appendChild(opt)}
   kind.value=row.kind;
  }
  const values={
   romoQAEditorNombre:row.name,romoQAEditorDescripcion:row.description||'',
   romoQAEditorPrecio:row.price,romoQAEditorRolls:row.rollCount||0,
   romoQAEditorPorRoll:row.piecesPerRoll||12,
   romoQAEditorSalsas:row.sauceCount||0,romoQAEditorKorokes:row.korokes||0
  };
  for(const [id,value] of Object.entries(values)){const field=el(id);if(field)field.value=String(value)}
  const available=el('romoQAEditorDisponible');if(available)available.checked=row.available!==false;
  const extras=el('romoQAEditorPromoExtras');if(extras)extras.hidden=section!=='promociones';
  text(el('romoQAEditorEstado'),mode==='editar'?'Editando borrador · no aparecerá en la carta pública.':
   'Nuevo borrador · todavía no aparecerá en la carta pública.');
  return true;
 }
 function extractDraft(){
  const form=el('romoQACartaEditor');
  const section=form?.dataset.section;
  if(!cache?.edit||!preview()||!kinds[section])throw Error('Edición no habilitada');
  const mode=form.dataset.mode;
  const kind=String(el('romoQAEditorTipo')?.value||'');
  const name=String(el('romoQAEditorNombre')?.value||'').trim();
  const description=String(el('romoQAEditorDescripcion')?.value||'').trim();
  const price=Number(el('romoQAEditorPrecio')?.value);
  if(!kinds[section].includes(kind)||name.length<2||name.length>100||
    /pizzas?/i.test(name)||description.length>500||
    !Number.isSafeInteger(price)||price<(section==='ingredientes'?0:1)||price>1000000)
    throw Error('Revisa el tipo, nombre y precio.');
  let sku=form.dataset.sku;
  if(mode==='agregar'){
   const rand=root.crypto?.randomUUID?.();
   if(typeof rand!=='string')throw Error('El identificador seguro del navegador no está disponible');
   const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'item';
   sku='romo:'+slug+'-'+rand.slice(0,8);
  }else if(mode!=='editar'||!sku?.startsWith('romo:'))throw Error('Borrador inválido');
  const row={sku,kind,name,description,price,visible:false,
   available:el('romoQAEditorDisponible')?.checked===true};
  if(section==='promociones'){
   const rolls=Number(el('romoQAEditorRolls')?.value);
   const per=Number(el('romoQAEditorPorRoll')?.value);
   const sauces=Number(el('romoQAEditorSalsas')?.value);
   const korokes=Number(el('romoQAEditorKorokes')?.value);
   if(!Number.isSafeInteger(rolls)||rolls<0||rolls>20||
      ![10,12].includes(per)||!Number.isSafeInteger(sauces)||sauces<0||sauces>20||
      !Number.isSafeInteger(korokes)||korokes<0||korokes>30)
    throw Error('Revisa rolls, piezas, salsas y korokes.');
   const original=cache.catalog.promociones.find(x=>x.sku===sku);
   Object.assign(row,{pieces:rolls*per,rollCount:rolls,piecesPerRoll:per,
    sauceCount:sauces,korokes,payments:original?.payments||['efectivo','transferencia']});
  }
  return {section,row,mode};
 }
 async function request(method,payload){
  if(!preview())throw Error('Solo se permite esta conexión en la versión de pruebas de Romo');
  const token=await root.ukiInventarioToken?.();
  if(!token)throw Error('Inicia sesión con la misma cuenta Google del panel.');
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
   const response=await fetch(ENDPOINT,{
    method,cache:'no-store',credentials:'omit',signal:ctrl.signal,
    headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},
    ...(method==='POST'?{body:JSON.stringify(payload)}:{})
   });
   const json=await response.json().catch(()=>({}));
   if(!response.ok||json.ok!==true)
    throw Error(json.error||'El acceso seguro de Romo aún no está habilitado.');
   return json;
  }finally{clearTimeout(timer)}
 }
 async function consultar(){
  const status=el('romoQACartaEstado');
  if(!status)return false;
  if(!preview()){
   text(status,'La consulta está disponible únicamente en la versión protegida de pruebas de Romo.');
   return false;
  }
  if(loading)return false;
  loading=true;
  const button=el('romoQACartaConsultar');if(button)button.disabled=true;
  text(status,'Comprobando permiso de Romo…');
  try{const data=await request('GET');renderCatalog(data);return true}
  catch(e){text(status,(e?.message||'No se pudo consultar')+
   ' Pedidos, caja y carta comercial siguen intactos.');return false}
  finally{loading=false;if(button)button.disabled=false}
 }
 async function guardar(){
  const status=el('romoQAEditorEstado');
  if(loading)return false;
  try{
   const {section,row,mode}=extractDraft();
   if(!root.confirm?.('¿Guardar únicamente como borrador privado de Romo, sin publicar?'))
    return false;
   const draft=structuredClone(cache.catalog);
   if(mode==='agregar')draft[section].push(row);
   else{
    const index=draft[section].findIndex(x=>x.sku===row.sku);
    if(index<0||draft[section][index].visible!==false)throw Error('Actualiza la lista primero.');
    draft[section][index]={...draft[section][index],...row};
   }
   if(draft[section].length>MAX_ITEMS)throw Error('Se alcanzó el límite de borradores');
   loading=true;
   const save=el('romoQAEditorGuardar');if(save)save.disabled=true;
   text(status,'Guardando el borrador privado…');
   const result=await request('POST',{expectedRevision:cache.revision,catalog:draft});
   if(result.storeId!==STORE||!Number.isSafeInteger(result.revision))
    throw Error('Guardado no confirmado; revisa la carta antes de continuar');
   const updated=await consultarForSave();
   if(!updated)text(status,'Guardado confirmado, pero no se pudo actualizar la lista. Consulta la carta.');
   return true;
  }catch(e){
   text(status,e?.message||'No se pudo guardar el borrador');
   return false;
  }finally{
   loading=false;
   const save=el('romoQAEditorGuardar');if(save)save.disabled=false;
  }
 }
 async function consultarForSave(){
  try{const updated=await request('GET');renderCatalog(updated);return true}
  catch{return false}
 }
 function vista(){
  return '<section class="card" id="romoQACartaPanel" aria-label="Romo Carta y precios en preparación">'+
   '<h2>🧾 Carta y precios · Romo</h2>'+
   '<p class="muted">Misma administración del panel. Productos, promociones e ingredientes '+
     'independientes de Uki. Sólo borradores hasta completar las pruebas.</p>'+
   '<button type="button" class="sm" id="romoQACartaConsultar" onclick="ukiRomoCartaPanelConsultarQA()">Consultar catálogo Romo</button>'+
   '<p class="muted" id="romoQACartaEstado" role="status">Sin conexión autorizada todavía. No hay operaciones reales.</p>'+
   '<div id="romoQACategoriaproductos"></div>'+
   '<div id="romoQACategoriapromociones"></div>'+
   '<div id="romoQACategoriaingredientes"></div>'+
   '<button type="button" class="sm" id="romoQACartaAgregar" hidden onclick="ukiRomoCartaPanelAgregarQA()">＋ Agregar borrador</button>'+
   '<section class="card" id="romoQACartaEditor" hidden>'+
    '<h3>Editar o agregar borrador</h3>'+
    '<label for="romoQAEditorSeccion">Sección</label><select id="romoQAEditorSeccion">'+
     '<option value="productos">Productos</option><option value="promociones">Promociones</option>'+
     '<option value="ingredientes">Ingredientes</option></select>'+
    '<label for="romoQAEditorTipo">Tipo</label><select id="romoQAEditorTipo"></select>'+
    '<label for="romoQAEditorNombre">Nombre</label><input id="romoQAEditorNombre" maxlength="100">'+
    '<label for="romoQAEditorDescripcion">Descripción o qué incluye</label>'+
     '<textarea id="romoQAEditorDescripcion" rows="2" maxlength="500"></textarea>'+
    '<label for="romoQAEditorPrecio">Precio en pesos chilenos</label>'+
     '<input id="romoQAEditorPrecio" type="number" min="0" max="1000000" step="1" inputmode="numeric">'+
    '<label class="check"><input id="romoQAEditorDisponible" type="checkbox" checked> Disponible en inventario/catálogo</label>'+
    '<div id="romoQAEditorPromoExtras" hidden>'+
     '<label for="romoQAEditorRolls">Cantidad de rolls</label><input id="romoQAEditorRolls" type="number" min="0" max="20">'+
     '<label for="romoQAEditorPorRoll">Piezas por roll</label><select id="romoQAEditorPorRoll">'+
       '<option value="12">12</option><option value="10">10</option></select>'+
     '<label for="romoQAEditorSalsas">Salsas incluidas</label><input id="romoQAEditorSalsas" type="number" min="0" max="20">'+
     '<label for="romoQAEditorKorokes">Korokes incluidos</label><input id="romoQAEditorKorokes" type="number" min="0" max="30">'+
     '<p class="muted">Fotografía: pendiente de comprobar. El borrador NO se publica.</p>'+
    '</div>'+
    '<p class="muted" id="romoQAEditorEstado" role="status">Sin modificaciones.</p>'+
    '<button type="button" class="big" id="romoQAEditorGuardar" onclick="ukiRomoCartaPanelGuardarQA()">Guardar borrador privado</button>'+
   '</section>'+
   '<div class="card" id="romoQAInventarioPreparacion"><h3>📦 Inventario · Romo</h3>'+
    '<p class="muted">Inventario independiente pendiente de conexión. Recibido, existente, diferencia y mínimo para reponer. Sin movimientos de caja.</p></div>'+
  '</section>';
 }
 root.ukiRomoCartaPanelHTMLQA=vista;
 root.ukiRomoCartaPanelConsultarQA=consultar;
 root.ukiRomoCatalogoRenderQA=renderCatalog;
 root.ukiRomoCartaPanelEditarQA=edit;
 root.ukiRomoCartaPanelAgregarQA=addNew;
 root.ukiRomoCartaPanelGuardarQA=guardar;
})(window);
