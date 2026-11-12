'use strict';
/**
 * Romo La Serena — inventario en la misma vista del panel, SOLO SIMULACIÓN QA.
 * Los registros viven en memoria: NO se guardan, comparten o envían al servidor.
 * No toca inventario, pedidos ni caja de Uki ni de Romo.
 */
(function (root){
 const STORE='romo:serena';
 const UNITS=Object.freeze(['unidad','g','kg','ml','l']);
 const MAX=500;
 let items=[],filter='',modo='todos',editingId=null;
 const ENDPOINT='/api/romo-catalogo-qa?origen=inventario';
 let remoteRevision=null,remoteWritable=false,remoteDirty=false,remoteBusy=false;
 const preview=()=>/^uki-sushi-inventario-[a-z0-9-]+-diannaleandra-7046\.vercel\.app$/.test(
  String(root.location?.hostname||'').toLowerCase()
 );
 function markDirty(){
  if(remoteRevision!==null){
   remoteDirty=true;
   text(el('romoQAInventarioRemotoEstado'),'Cambios locales sin guardar en Romo. Debes pulsar Guardar aparte.');
  }
 }

 const unidadesMostrar=Object.freeze({unidad:'unidad',g:'gramos',kg:'kilos',ml:'mililitros',l:'litros'});
 const el=id=>root.document?.getElementById(id);
 const text=(node,content)=>{if(node)node.textContent=String(content)};
 const create=(tag,cls,content)=>{
  const n=root.document.createElement(tag);if(cls)n.className=cls;
  if(content!==undefined)n.textContent=String(content);
  return n;
 };
 function number(raw){
  const v=String(raw??'').trim().replace(',','.');
  if(!/^(?:\d{1,7})(?:\.\d{1,3})?$/.test(v))return null;
  const val=Number(v);
  if(!Number.isFinite(val)||val<0||val>10000000)return null;
  return val;
 }
 function validate(row){
  if(!row||typeof row.name!=='string'||row.name.trim().length<2||row.name.trim().length>100||
    !UNITS.includes(row.unit)||![row.recibido,row.hay,row.minimo].every(x=>
      typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=10000000))
    throw Error('Revisa artículo, unidad y cantidades');
  return {name:row.name.trim(),unit:row.unit,
   recibido:row.recibido,hay:row.hay,minimo:row.minimo,
   disponible:row.disponible!==false};
 }
 const diff=row=>Number((row.recibido-row.hay).toFixed(3));
 const falta=row=>Number(Math.max(0,row.minimo-row.hay).toFixed(3));
 function estado(){
  return {sucursal:STORE,modo:'simulacion-sin-guardar',articulos:items.length,
   porReponer:items.filter(x=>falta(x)>0).length};
 }
 function render(){
  const area=el('romoQAInventarioLista');if(!area)return;
  area.replaceChildren();
  const matches=items.filter(x=>x.name.toLowerCase().includes(filter.toLowerCase())&&
   (modo==='todos'||(modo==='reponer'&&falta(x)>0)||(modo==='agotados'&&!x.disponible)));
  text(el('romoQAInventarioResumen'),
   items.length+' artículos en simulación · '+estado().porReponer+
   ' por reponer · no se guardan registros');
  if(!matches.length){
   area.appendChild(create('p','muted',items.length?'Sin resultados':'Sin artículos. Agrega uno para comprobar los cálculos.'));
   return;
  }
  for(const item of matches){
   const card=create('div','card');
   card.appendChild(create('strong','',item.name));
   card.appendChild(create('p','muted',
    'Recibido: '+item.recibido+' '+item.unit+
    ' · Hay: '+item.hay+' '+item.unit+
    ' · Diferencia: '+diff(item)+' '+item.unit));
   card.appendChild(create('p','muted',
    'Mínimo: '+item.minimo+' '+item.unit+' · Reponer: '+falta(item)+' '+item.unit+
    ' · '+(item.disponible?'Disponible':'Agotado')));
   const btn=create('button','sm',item.disponible?'Marcar agotado':'Marcar disponible');
   btn.type='button';
   btn.addEventListener('click',()=>{item.disponible=!item.disponible;markDirty();render()});
   card.appendChild(btn);
   const remove=create('button','sm','Quitar de simulación');
   remove.type='button';
   remove.addEventListener('click',()=>{
    if(root.confirm?.('¿Quitar '+item.name+' de esta simulación?')!==true)return;
    items=items.filter(x=>x.id!==item.id);
    markDirty();
    if(editingId===item.id)cancelEdit();
    text(el('romoQAInventarioEstado'),'Artículo quitado sólo de la simulación.');
    render();
   });
   card.appendChild(remove);
   const change=create('button','sm','Editar cantidades');
   change.type='button';
   change.addEventListener('click',()=>editItem(item.id));
   card.appendChild(change);
   area.appendChild(card);
  }
 }
 function add(){
  const status=el('romoQAInventarioEstado');
  try{
   if(!editingId&&items.length>=MAX)throw Error('Límite de simulación alcanzado');
   const row=validate({
    name:el('romoQAInventarioNombre')?.value||'',
    unit:el('romoQAInventarioUnidad')?.value||'',
    recibido:number(el('romoQAInventarioRecibido')?.value),
    hay:number(el('romoQAInventarioHay')?.value),
    minimo:number(el('romoQAInventarioMinimo')?.value),
    disponible:el('romoQAInventarioDisponible')?.checked===true
   });
   if(items.some(x=>x.id!==editingId&&x.name.toLowerCase()===row.name.toLowerCase()))
    throw Error('Este artículo ya está en la simulación');
   if(editingId){
    const index=items.findIndex(x=>x.id===editingId);
    if(index<0)throw Error('El artículo ya no existe; revisa la lista');
    items[index]={...items[index],...row};
    markDirty();
    text(status,remoteRevision===null?
     'Cantidades corregidas sólo en simulación. No se guardó en Neon.':
     'Cantidades corregidas localmente; falta guardar los cambios en Romo.');
   }else{
    const uuid=root.crypto?.randomUUID?.();
    const id=remoteRevision===null?
      'qa:'+String(items.length+1)+':'+Date.now().toString(36):
      uuid?'romo:'+uuid.toLowerCase():null;
    if(!id)throw Error('Se necesita un identificador seguro para el inventario guardado');
    items.push({...row,id});
    markDirty();
    text(status,remoteRevision===null?
      'Artículo agregado únicamente a la simulación. No se guardó en Neon.':
      'Artículo agregado localmente. Confirma Guardar para sincronizarlo con Romo.');
   }
   editingId=null;
   const save=el('romoQAInventarioAgregar');if(save)save.textContent='Agregar a simulación';
   render();
   return true;
  }catch(error){
   text(status,error?.message||'No se pudo agregar el artículo');
   return false;
  }
 }
 function search(value){
  filter=String(value||'').slice(0,100);render();
 }
 function setModo(value){
  if(!['todos','reponer','agotados'].includes(value))return false;
  modo=value;render();return true;
 }
 function editItem(id){
  const current=items.find(x=>x.id===id);
  if(!current)return false;
  editingId=id;
  const values={
   romoQAInventarioNombre:current.name,romoQAInventarioUnidad:current.unit,
   romoQAInventarioRecibido:current.recibido,romoQAInventarioHay:current.hay,
   romoQAInventarioMinimo:current.minimo
  };
  for(const [key,value] of Object.entries(values)){
   const field=el(key);if(field)field.value=String(value);
  }
  const available=el('romoQAInventarioDisponible');
  if(available)available.checked=current.disponible;
  const btn=el('romoQAInventarioAgregar');if(btn)btn.textContent='Guardar corrección de prueba';
  text(el('romoQAInventarioEstado'),'Editando '+current.name+' en la simulación; no modifica inventario real.');
  return true;
 }
 function cancelEdit(){
  editingId=null;
  const btn=el('romoQAInventarioAgregar');if(btn)btn.textContent='Agregar a simulación';
  text(el('romoQAInventarioEstado'),'Edición de prueba cancelada.');
  return true;
 }
 function compras(){
  const faltantes=items.filter(x=>falta(x)>0).sort((a,b)=>a.name.localeCompare(b.name,'es-CL'));
  const salida=faltantes.length?'LISTA DE REPOSICIÓN DE PRUEBA — ROMO LA SERENA\n'+
   faltantes.map(x=>'- '+x.name+': '+falta(x)+' '+(unidadesMostrar[x.unit]||x.unit)).join('\n')
   :'Sin artículos bajo el mínimo en esta simulación.';
  text(el('romoQAInventarioComprasVista'),salida);
  return salida;
 }
 function reset(){
  if(!root.confirm?.('¿Borrar los artículos de esta simulación? No hay cambios guardados.'))
   return false;
  items=[];filter='';modo='todos';editingId=null;
  remoteRevision=null;remoteWritable=false;remoteDirty=false;
  const input=el('romoQAInventarioBuscar');if(input)input.value='';
  const modoEl=el('romoQAInventarioFiltro');if(modoEl)modoEl.value='todos';
  const save=el('romoQAInventarioAgregar');if(save)save.textContent='Agregar a simulación';
  text(el('romoQAInventarioComprasVista'),'');
  text(el('romoQAInventarioEstado'),'Simulación limpia. Ningún registro real se modificó.');
  render();return true;
 }

 function validateRemote(data){
  if(!data||data.ok!==true||data.storeId!==STORE||
    !Number.isSafeInteger(data.revision)||data.revision<0||
    data.inventory?.sucursal!==STORE||data.inventory?.formato!=='romo-inventario-v1'||
    !Array.isArray(data.inventory.items)||data.inventory.items.length>MAX)
   throw Error('Inventario de otra sucursal o respuesta incompleta');
  const ids=new Set(),names=new Set();
  const parsed=data.inventory.items.map(raw=>{
   if(!raw||typeof raw.id!=='string'||!/^[a-z0-9:_-]{1,100}$/.test(raw.id)||ids.has(raw.id))
    throw Error('Identificador de inventario inválido');
   const row=validate(raw);
   if(names.has(row.name.toLocaleLowerCase('es-CL')))
    throw Error('Nombre de inventario duplicado');
   ids.add(raw.id);names.add(row.name.toLocaleLowerCase('es-CL'));
   return {...row,id:raw.id};
  });
  return {items:parsed,revision:data.revision,canWrite:data.edicionHabilitada===true};
 }
 async function requestInventory(method,body){
  if(!preview())throw Error('Consulta disponible solo en la copia de pruebas de Romo');
  const token=await root.ukiInventarioToken?.();
  if(!token)throw Error('Debes entrar con la cuenta Google habitual del panel');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(ENDPOINT,{method,credentials:'omit',cache:'no-store',
    signal:controller.signal,
    headers:{Authorization:'Bearer '+token,...(method==='POST'?{'Content-Type':'application/json'}:{})},
    ...(method==='POST'?{body:JSON.stringify(body)}:{})
   });
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||payload.ok!==true)
    throw Error(payload.error||'Inventario protegido no disponible todavía');
   return payload;
  }finally{clearTimeout(timer)}
 }
 async function loadRemote(){
  const status=el('romoQAInventarioRemotoEstado');
  if(remoteBusy)return false;
  if(!preview()){
   text(status,'El inventario real de Romo aún no está conectado; esta vista solo muestra pruebas.');
   return false;
  }
  if(items.length&&root.confirm?.('Esto sustituirá los datos de esta simulación por el inventario de Romo. ¿Continuar?')!==true)
   return false;
  remoteBusy=true;
  try{
   text(status,'Verificando acceso autorizado a Romo…');
   const result=validateRemote(await requestInventory('GET'));
   items=result.items;remoteRevision=result.revision;
   remoteWritable=result.canWrite;remoteDirty=false;
   editingId=null;filter='';modo='todos';render();
   const button=el('romoQAInventarioGuardarRemoto');
   if(button)button.disabled=!remoteWritable;
   text(status,'Inventario Romo cargado en revisión '+remoteRevision+
    (remoteWritable?' · Guardado privado permitido únicamente tras confirmación.':
     ' · Acceso de solo lectura.'));
   return true;
  }catch(error){
   text(status,(error?.message||'No se pudo consultar Romo')+
    '. No se modificó ningún registro real.');
   return false;
  }finally{remoteBusy=false}
 }
 async function saveRemote(){
  const status=el('romoQAInventarioRemotoEstado');
  if(remoteBusy)return false;
  if(remoteRevision===null||!remoteWritable||!remoteDirty){
   text(status,'No hay cambios autorizados pendientes de guardar en Romo.');
   return false;
  }
  if(!preview())return false;
  if(root.confirm?.('¿Guardar los cambios de inventario de Romo? Esto modifica registros reales y sólo debe hacerse después de la autorización.')!==true)
   return false;
  remoteBusy=true;
  try{
   const content={formato:'romo-inventario-v1',sucursal:STORE,
    items:items.map(x=>({id:x.id,name:x.name,unit:x.unit,
     recibido:x.recibido,hay:x.hay,minimo:x.minimo,disponible:x.disponible}))};
   validateRemote({ok:true,storeId:STORE,revision:remoteRevision,inventory:content});
   const saved=await requestInventory('POST',{expectedRevision:remoteRevision,inventory:content});
   if(saved.storeId!==STORE||!Number.isSafeInteger(saved.revision)||saved.revision!==remoteRevision+1)
    throw Error('El servidor no confirmó el guardado; no volver a enviar sin revisar');
   remoteRevision=saved.revision;remoteDirty=false;
   text(status,'Inventario guardado exclusivamente en Romo · revisión '+remoteRevision+'.');
   return true;
  }catch(error){
   text(status,error?.message||'No se pudo guardar Romo');
   return false;
  }finally{remoteBusy=false}
 }

 function view(){
  return '<details class="card" id="romoQAInventarioPreparacion">'+
   '<summary style="cursor:pointer;font-weight:700">📦 Inventario · Romo (pruebas)</summary>'+
   '<p class="muted">Misma sección de inventario, independiente por sucursal. Prueba cantidades y disponibilidad SIN guardarlas. Al salir o actualizar, estos ejemplos desaparecen.</p>'+
   '<p class="muted" role="status" id="romoQAInventarioResumen">Sin registros reales.</p>'+
   '<div class="card" id="romoQAInventarioConexionProtegida">'+
    '<h4>Conexión segura a inventario de Romo</h4>'+
    '<p class="muted">Esta conexión está apagada mientras falten autorización, tabla privada y usuarios autorizados. No se envían registros de prueba automáticamente.</p>'+
    '<button type="button" class="sm" onclick="ukiRomoInventarioQACargarRemoto()">Consultar inventario protegido</button>'+
    '<button type="button" class="sm" disabled id="romoQAInventarioGuardarRemoto" onclick="ukiRomoInventarioQAGuardarRemoto()">Guardar cambios en Romo</button>'+
    '<p role="status" class="muted" id="romoQAInventarioRemotoEstado">Solo simulación: sin datos reales ni guardados.</p>'+
   '</div>'+
   '<label for="romoQAInventarioNombre">Nombre del artículo</label>'+
   '<input id="romoQAInventarioNombre" maxlength="100" placeholder="Ej.: Arroz">'+
   '<label for="romoQAInventarioUnidad">Unidad</label>'+
   '<select id="romoQAInventarioUnidad">'+UNITS.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select>'+
   '<label for="romoQAInventarioRecibido">Cantidad recibida</label>'+
   '<input id="romoQAInventarioRecibido" type="text" inputmode="decimal" placeholder="Ej.: 2,5">'+
   '<label for="romoQAInventarioHay">Cantidad existente</label>'+
   '<input id="romoQAInventarioHay" type="text" inputmode="decimal" placeholder="Ej.: 2">'+
   '<label for="romoQAInventarioMinimo">Mínimo para reponer</label>'+
   '<input id="romoQAInventarioMinimo" type="text" inputmode="decimal" placeholder="Ej.: 3">'+
   '<label><input id="romoQAInventarioDisponible" type="checkbox" checked> Disponible</label>'+
   '<button type="button" class="sm" id="romoQAInventarioAgregar" onclick="ukiRomoInventarioQAAgg()">Agregar a simulación</button>'+
   '<button type="button" class="sm" onclick="ukiRomoInventarioQACancelar()">Cancelar edición</button>'+
   '<p class="muted" id="romoQAInventarioEstado" role="status">Los registros de prueba NO se guardan.</p>'+
   '<label for="romoQAInventarioBuscar">Buscar artículos</label>'+
   '<input id="romoQAInventarioBuscar" type="search" placeholder="Buscar…" oninput="ukiRomoInventarioQABuscar(this.value)">'+
   '<label for="romoQAInventarioFiltro">Mostrar</label>'+
   '<select id="romoQAInventarioFiltro" onchange="ukiRomoInventarioQAFiltro(this.value)">'+
    '<option value="todos">Todos</option><option value="reponer">Por reponer</option>'+
    '<option value="agotados">Agotados</option></select>'+
   '<div id="romoQAInventarioLista"></div>'+
   '<button type="button" class="sm" onclick="ukiRomoInventarioQACompras()">Ver lista de reposición</button>'+
   '<pre class="muted" id="romoQAInventarioComprasVista" aria-label="Lista de reposición en simulación" style="white-space:pre-wrap"></pre>'+
   '<button type="button" class="sm" onclick="ukiRomoInventarioQALimpiar()">Limpiar simulación</button>'+
  '</details>';
 }
 root.ukiRomoInventarioPanelHTMLQA=view;
 root.ukiRomoInventarioQAAgg=add;
 root.ukiRomoInventarioQABuscar=search;
 root.ukiRomoInventarioQAFiltro=setModo;
 root.ukiRomoInventarioQACancelar=cancelEdit;
 root.ukiRomoInventarioQACompras=compras;
 root.ukiRomoInventarioQALimpiar=reset;
 root.ukiRomoInventarioQARender=render;
 root.ukiRomoInventarioQAEditar=editItem;
 root.ukiRomoInventarioQACargarRemoto=loadRemote;
 root.ukiRomoInventarioQAGuardarRemoto=saveRemote;
 root.ukiRomoInventarioQAModelo=()=>({
  ...estado(),conexionRealCargada:remoteRevision!==null,
  revisionRemota:remoteRevision,cambiosSinGuardar:remoteDirty,
  articulos:items.map(i=>({...i,diferencia:diff(i),reponer:falta(i)}))
 });
})(window);
