import {leerDTE,filasDTE,leerTextoFactura,leerCabeceraFacturaPDF,numeroFactura,opcionesRecepcionFactura,nombrePropuestoFactura,categoriaPropuestaFactura,articuloExistenteFactura} from './uki-factura-lectura-live.mjs';
// Señal de compatibilidad: el módulo antiguo solo sirve para el QR del trabajador.
export const facturaAdmiteMontajeAdmin = true;
export function iniciarFacturaLive({getBranch,getItems,post,onSaved,onItemsCreated,mountTarget=null}){
 const section=document.createElement('section');section.id='facturaQA';section.className='card';
 section.innerHTML="<h2>📷 Recibir mercadería con factura</h2>\n<p class=\"muted\">Gratis: toma una foto o sube una factura. Revisa las cantidades antes de guardar. La foto se procesa en tu teléfono y no se envía al servidor.</p>\n<div class=\"fact-botones\"><label for=\"factFoto\">📷 Tomar foto</label><input id=\"factFoto\" type=\"file\" accept=\"image/*\" capture=\"environment\">\n<label for=\"factArchivo\">Subir archivo</label><input id=\"factArchivo\" type=\"file\" accept=\"image/*,.xml,application/xml,.pdf,application/pdf\"></div>\n<p id=\"factEstado\" role=\"status\" class=\"muted\">Fotos, XML y PDF con texto. El ingreso manual sigue disponible.</p>\n<div id=\"factTextoBox\" hidden><label for=\"factTexto\">Texto leído (corrígelo si hay errores)</label>\n<textarea id=\"factTexto\" rows=\"4\" maxlength=\"20000\" style=\"width:100%;font:inherit;border:1px solid #d5c4b6;border-radius:9px\"></textarea>\n<button type=\"button\" class=\"secondary\" id=\"factReleer\">Volver a detectar productos</button></div>\n<div id=\"factLineas\"></div>\n<div id=\"factAcciones\" hidden><button type=\"button\" class=\"secondary\" id=\"factAnadir\">Añadir línea manual</button>\n<button type=\"button\" id=\"factGuardar\">Confirmar mercadería recibida</button>\n<p id=\"factResultado\" role=\"status\"></p><p class=\"muted small\">Las entradas marcadas se guardan individualmente. Si hay un error, revisa el saldo antes de intentar otra vez.</p></div>\n<style>#facturaQA .fact-botones{display:flex;gap:8px;flex-wrap:wrap}\n#facturaQA .fact-botones input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}\n#facturaQA .fact-botones label{display:inline-block;background:#e9822d;color:white;border-radius:9px;padding:12px;cursor:pointer}\n#facturaQA .fact-fila{border:1px solid #eadbcc;border-radius:10px;padding:12px;margin:9px 0}\n#facturaQA .fact-fila select,#facturaQA .fact-fila input[type=text]{width:100%}\n#facturaQA .fact-columnas{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n#facturaQA .fact-mensaje{background:#fff6e9;border-radius:8px;padding:8px}\n#facturaQA .fact-guardada{background:#f0f9ef;border-radius:8px;padding:8px;color:#25612c}\n#facturaQA button{margin:8px 6px 0 0}\n#facturaQA #factAltas[hidden],#facturaQA #factRecibirVista[hidden]{display:none!important}\n#facturaQA #factEtapas button[aria-pressed=true]{background:#ae5414;color:#fff}\n#facturaQA #factEtapas button[aria-pressed=false]{background:#f6e3d2;color:#663a20}\n@media(max-width:470px){#facturaQA .fact-columnas{grid-template-columns:1fr}}</style>";
 const metaBox=document.createElement('div');
 metaBox.id='factDocumentQA';
 metaBox.innerHTML='<h3>Datos para evitar duplicados</h3>'+
  '<p class="muted small">Identifica la factura antes de guardarla. Se comprobará en el panel incluso si otro celular la registró.</p>'+
  '<div class="fact-columnas"><div><label for="factRut">RUT del proveedor</label><input id="factRut" placeholder="77.557.762-2" autocomplete="off"></div>'+
  '<div><label for="factFolio">Número de factura</label><input id="factFolio" placeholder="78969" inputmode="numeric" autocomplete="off"></div>'+
  '<div><label for="factTipo">Tipo de documento</label><select id="factTipo"><option value="33">Factura electrónica</option><option value="52">Guía de despacho</option><option value="34">Factura exenta</option></select></div></div>'+
  '<p id="factDuplicados" class="muted small" role="status">Las entradas previas se verificarán antes de guardar.</p>';
 section.insertBefore(metaBox,section.querySelector('#factLineas'));
 const altas=document.createElement('section');
 altas.id='factAltas';
 altas.innerHTML='<details id="factAltasDetalles"><summary><strong>Preparar artículos nuevos de la factura</strong></summary>'+
  '<p class="muted">Revisa los artículos que faltan, sus nombres y unidades. Se crean en inventario con cantidad cero y mínimo cero; no aparecen en la carta.</p>'+
  '<div id="factAltasFilas"></div>'+
  '<button type="button" id="factAltasGuardar">Agregar artículos seleccionados al inventario</button>'+
  '<p id="factAltasEstado" role="status" class="muted"></p></details>';
 section.insertBefore(altas,section.querySelector('#factLineas'));
 // Dos vistas del mismo documento: se conserva el estado al alternar.
 const recibidor=document.createElement('section');recibidor.id='factRecibirVista';
 section.insertBefore(recibidor,section.querySelector('#factLineas'));
 recibidor.append(section.querySelector('#factLineas'),section.querySelector('#factAcciones'));
 const nav=document.createElement('div');nav.id='factEtapas';nav.className='fact-botones';
 nav.innerHTML='<button type="button" id="factModoPreparar">1. Preparar artículos</button>'+
  '<button type="button" id="factModoRecibir">2. Registrar mercadería</button>';
 section.insertBefore(nav,altas);
 // En trabajadores se conserva la ubicación original; en el panel normal
 // se monta en su propio contenedor plegable sin duplicar la interfaz.
 if(mountTarget){
  if(!mountTarget.isConnected)throw Error('Abre la sección de inventario antes de recibir facturas.');
  mountTarget.append(section);
 }else{
  const itemsContainer=document.getElementById('items');
  itemsContainer.parentNode.insertBefore(section,itemsContainer);
 }
 const el=id=>section.querySelector('#'+id), estado=t=>{el('factEstado').textContent=t;};
 const make=(tag,parent,text,cls)=>{
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;
  if(cls)node.className=cls;if(parent)parent.append(node);return node;
 };
 const units=['','kg','g','l','ml','un','porciones'],factors={kg:1000,g:1,l:1000,ml:1,un:1,porciones:1};
 const groups={kg:'peso',g:'peso',l:'volumen',ml:'volumen',un:'unidad',porciones:'porcion'};
 let filas=[],meta={},busy=false,modo='preparar';
 function mostrarModo(value){
  modo=value==='recibir'?'recibir':'preparar';
  altas.hidden=modo!=='preparar';recibidor.hidden=modo!=='recibir';
  el('factModoPreparar').setAttribute('aria-pressed',String(modo==='preparar'));
  el('factModoRecibir').setAttribute('aria-pressed',String(modo==='recibir'));
  el('factModoPreparar').disabled=busy;
  el('factModoRecibir').disabled=busy;
  el('factAltasDetalles').open=true;
 }
 el('factModoPreparar').onclick=()=>mostrarModo('preparar');
 el('factModoRecibir').onclick=()=>mostrarModo('recibir');
 mostrarModo('preparar');
 const doc=()=>({rut_emisor:el('factRut').value.trim(),folio:el('factFolio').value.trim(),
  tipo_doc:el('factTipo').value});
 const documentoValido=()=>/^\d{7,8}-[\dK]$/.test(doc().rut_emisor.replace(/[.\s]/g,'').toUpperCase())&&
  /^\d{1,15}$/.test(doc().folio);
 async function consultarFactura(){
  if(!documentoValido())return false;
  const value=doc();
  const result=await post('factura-consultar',value);
  const historico=new Map((result.lineas||[]).map(x=>[Number(x.linea),x]));
  const entregas=result.entregas||[];
  for(const f of filas){
   f.prev=historico.get(f.linea)||null;
   f.entregas=(entregas.filter(x=>Number(x.linea)===f.linea)).map(x=>Number(x.entrega));
  }
  const prev=(result.lineas||[]).length;
  el('factDuplicados').textContent=prev?
   'Este folio ya tiene '+prev+' línea(s) con mercadería recibida. Revisa los saldos y la entrega antes de continuar.':
   'No existen ingresos previos de este folio en la sucursal seleccionada.';
  return true;
 }
 const pretty=(n,u)=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:3})+' '+u;
 function convertir(q,from,to){
  if(!Number.isFinite(q)||!factors[from]||!factors[to]||groups[from]!==groups[to])return NaN;
  if((from==='un'||from==='porciones')&&!Number.isInteger(q))return NaN;
  const n=q*factors[from]/factors[to];
  return n<=100000&&Math.abs(n*1000-Math.round(n*1000))<1e-7?Math.round(n*1000)/1000:NaN;
 }
 function valido(f){
  const item=getItems().find(x=>x.sku===f.sku),qty=numeroFactura(f.cantidad);
  const base=item?convertir(qty,f.unidad,item.stock_unit):NaN;
  const limite=item?convertir(numeroFactura(f.totalCantidad),f.totalUnidad,item.stock_unit):NaN;
  const previo=Number(f.prev?.cantidad_recibida_base||0);
  const otroSku=!!f.prev&&f.prev.sku!==f.sku;
  const distintaUnidad=!!f.prev&&f.prev.unidad_base!==item?.stock_unit;
  const cambioLimite=!!f.prev&&Number(f.prev.cantidad_factura_base)!==limite;
  const entregaRepetida=(f.entregas||[]).includes(Number(f.entrega));
  return {item,base,limite,previo,ok:!!(item&&Number.isFinite(base)&&base>0&&
   Number.isFinite(limite)&&limite>0&&previo+base<=limite+1e-8&&
   Number(item.stock_qty)+base<=100000&&
   !otroSku&&!distintaUnidad&&!cambioLimite&&!entregaRepetida&&
   (item.kind==='inventory'||Number(item.version)>0))};
 }

 // La factura prepara la LISTA de artículos nuevos, no modifica cantidades.
 function renderAltas(){
  const parent=el('factAltasFilas');parent.replaceChildren();
  const items=getItems();
  const yaExistentes=filas.filter(f=>!f.sku&&!f.saved&&
   articuloExistenteFactura(f.nuevoNombre,items));
  const candidatos=filas.filter(f=>!f.sku&&!f.saved&&
   !articuloExistenteFactura(f.nuevoNombre,items));
  make('p',parent,candidatos.length+' artículo(s) por preparar · '+
   yaExistentes.length+' ya existe(n) en el inventario.','muted small');
  if(yaExistentes.length){
   make('p',parent,'Ya registrados: '+yaExistentes.map(f=>f.nuevoNombre).join(', ')+
    '. Selecciónalos en «2. Registrar mercadería». No se crearán duplicados.','muted small');
  }
  if(!filas.length){
   make('p',parent,'Primero sube una factura para preparar nuevos artículos.','muted small');
   return;
  }
  if(!candidatos.length){
   make('p',parent,'Todos los artículos están vinculados al inventario o ya se registraron.','muted small');
   return;
  }
  const existentes=items;
  const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
   .toLocaleLowerCase('es-CL').trim().replace(/\s+/g,' ');
  for(const f of candidatos){
   const card=make('div',parent,undefined,'fact-fila');
   make('strong',card,'Línea '+f.linea+': '+f.nombre);
   if(f.sugerencia)make('p',card,'Existe una sugerencia: '+f.sugerencia+
     '. Verifica si corresponde al mismo ingrediente antes de crear uno diferente.','muted small');
   const grid=make('div',card,undefined,'fact-columnas');
   const nameBox=make('div',grid);make('label',nameBox,'Nombre nuevo (editable)');
   const nameInput=make('input',nameBox);
   nameInput.type='text';nameInput.maxLength=100;
   nameInput.value=f.nuevoNombre||'';nameInput.placeholder='Ej.: queso gauda';
   const unitBox=make('div',grid);make('label',unitBox,'Unidad de inventario');
   const uSel=make('select',unitBox);
   for(const unit of units.slice(1))uSel.add(new Option(unit,unit));
   if(!units.includes(f.nuevaUnidad))f.nuevaUnidad='';
   uSel.value=f.nuevaUnidad||'';
   if(!f.nuevaUnidad)uSel.add(new Option('Elegir unidad…',''),0);
   const catBox=make('div',grid);make('label',catBox,'Tipo');
   const cSel=make('select',catBox);
   cSel.add(new Option('Elegir tipo…',''));
   for(const [key,label] of [['ingrediente','Ingrediente'],['envase','Envase'],['otro','Otro insumo']])
    cSel.add(new Option(label,key));
   cSel.value=f.nuevaCategoria||'';
   const selBox=make('div',grid);
   const markLabel=make('label',selBox);
   const checkbox=make('input',markLabel);checkbox.type='checkbox';
   checkbox.style.width='auto';checkbox.checked=!!f.prepararNuevo;
   markLabel.append(' Preparar este artículo');
   const hint=make('p',card,'', 'muted small');
   const preview=()=>{
    const exact=existentes.find(x=>norm(x.name)===norm(f.nuevoNombre));
    checkbox.disabled=!!exact;
    if(exact&&checkbox.checked){checkbox.checked=false;f.prepararNuevo=false;}
    hint.textContent=exact?
     'Ya existe «'+exact.name+'». Búscalo en la lista de la factura: no se creará un duplicado.':
     'Se creará con stock 0 y mínimo 0; la mercadería se registra después, por separado.';
   };
   nameInput.oninput=()=>{f.nuevoNombre=nameInput.value;preview();};
   uSel.onchange=()=>{f.nuevaUnidad=uSel.value;};
   cSel.onchange=()=>{f.nuevaCategoria=cSel.value;};
   checkbox.onchange=()=>{f.prepararNuevo=checkbox.checked;};
   preview();
  }
 }
 el('factAltasGuardar').onclick=async()=>{
  if(busy||!getBranch())return;
  if(meta.sucursalSugerida&&meta.sucursalSugerida!==getBranch()){
   el('factAltasEstado').textContent='La factura parece de Regimiento Arica. Abre la sucursal correspondiente.';
   return;
  }
  if(!documentoValido()){
   el('factAltasEstado').textContent='Antes de crear artículos, comprueba RUT y folio de la factura.';
   return;
  }
  const elegidos=filas.filter(f=>f.prepararNuevo&&!f.sku&&!f.saved);
  if(!elegidos.length){el('factAltasEstado').textContent='Marca los artículos faltantes que quieres preparar.';return;}
  if(elegidos.length>20){
   el('factAltasEstado').textContent='Prepara hasta 20 artículos por vez.';
   return;
  }
  const nombres=new Set();
  for(const f of elegidos){
   const name=String(f.nuevoNombre||'').trim().replace(/\s+/g,' ');
   const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CL');
   if(name.length<2||name.length>100||!units.slice(1).includes(f.nuevaUnidad)||
      !['ingrediente','envase','otro'].includes(f.nuevaCategoria)||nombres.has(key)||
      articuloExistenteFactura(name,getItems())){
    el('factAltasEstado').textContent='Revisa los nombres, unidades y artículos repetidos antes de guardar.';
    return;
   }
   nombres.add(key);
  }
  busy=true;mostrarModo(modo);el('factAltasGuardar').disabled=true;el('factGuardar').disabled=true;
  el('factAltasEstado').textContent='Preparando artículos exclusivamente en inventario…';
  try{
   const respuesta=await post('factura-preparar-articulos',{
    ...doc(),articulos:elegidos.map(f=>({linea:f.linea,name:f.nuevoNombre.trim(),
     category:f.nuevaCategoria,stock_unit:f.nuevaUnidad}))
   });
   const disponibles=[];
   let conflictos=0;
   for(const alta of respuesta.articulos||[]){
    const fila=filas.find(f=>f.linea===alta.linea);
    if(!fila)continue;
    if(alta.item&&['creado','existente'].includes(alta.estado)){
     disponibles.push(alta.item);
     fila.sku=alta.item.sku;fila.prepararNuevo=false;fila.solicitud=crypto.randomUUID();
    }else{conflictos++;fila.prepararNuevo=false;}
   }
   if(disponibles.length)onItemsCreated(disponibles);
   render();
   if(disponibles.length)mostrarModo('recibir');
   el('factResultado').textContent=disponibles.length+' artículo(s) preparados con stock 0. Ahora revisa y selecciona las entradas que realmente llegaron.';
   el('factAltasEstado').textContent=disponibles.length+' artículo(s) preparados en esta sucursal, con stock 0. '+
    (conflictos?conflictos+' requieren revisar su unidad o nombre. ':'')+
    'Ninguna mercadería se ha sumado.';
  }catch(e){
   el('factAltasEstado').textContent='No se completó la preparación: '+e.message+
    '. Revisa la lista antes de intentar nuevamente.';
  }finally{busy=false;el('factAltasGuardar').disabled=false;el('factGuardar').disabled=false;mostrarModo(modo);}
 };

 function render(){
  const parent=el('factLineas');parent.replaceChildren();
  if(!filas.length)make('p',parent,'No se reconocieron productos. Corrige el texto o añade una línea manual.','muted');
  // Las opciones son solo ingredientes e insumos, no productos del menú.
  filas.forEach((f,i)=>{
   const card=make('div',parent,undefined,'fact-fila');
   make('strong',card,f.nombre||'Producto sin identificar');
   make('p',card,f.cantidadFactura?
     'Facturado: '+f.cantidadFactura+' '+(f.unidadFacturada||'sin unidad')+
     '. Sugerido para inventario: '+(f.cantidad||'pendiente')+' '+(f.unidad||''):
     'Texto reconocido: '+(f.cantidad||'cantidad desconocida')+' '+(f.unidad||'sin unidad'),'muted small');
   if(f.nota)make('p',card,f.nota,'fact-mensaje');
   const grid=make('div',card,undefined,'fact-columnas');
   const box1=make('div',grid);make('label',box1,'Artículo del inventario');
   const buscar=make('input',box1);buscar.type='search';buscar.autocomplete='off';
   buscar.placeholder='Buscar por nombre…';buscar.setAttribute('aria-label','Buscar artículo línea '+(i+1));
   const select=make('select',box1);select.setAttribute('aria-label','Artículo de línea '+(i+1));
   const sinCoincidencia=make('p',box1,'Si no encuentras este artículo, puedes prepararlo desde la misma factura arriba. No se agregará a la carta.','muted small');
   const opciones=()=>{
    const disponibles=opcionesRecepcionFactura(getItems(),buscar.value,f.sugerencia);
    select.replaceChildren(new Option('Selecciona el artículo…',''));
    for(const item of disponibles)
     select.add(new Option(item.sugerido?'★ Sugerido: '+item.name+' (verificar)':item.name,item.sku));
    if(f.sku&&disponibles.some(x=>x.sku===f.sku))select.value=f.sku;
    else {select.value='';f.sku='';}
    const sugerencia=disponibles.find(x=>x.sugerido);
    sinCoincidencia.textContent=disponibles.length===0?
      'No hay artículos con ese nombre. Administración debe agregarlo antes de registrar.':
      sugerencia?
       'La sugerencia aparece primero. Verifica que sea el mismo producto y que su unidad sea correcta.':
       'Elige el artículo correcto. Si no existe, administración puede agregarlo al inventario.';
   };
   opciones();
   buscar.oninput=()=>{opciones();preview();};
   const box2=make('div',grid);make('label',box2,'Cantidad recibida');
   const input=make('input',box2);input.type='text';input.inputMode='text';input.maxLength=12;
   input.placeholder='Ej.: 750';input.value=f.cantidad||'';
   const box3=make('div',grid);make('label',box3,'Unidad');
   const unit=make('select',box3);
   for(const u of units)unit.add(new Option(u||'Elige unidad…',u));
   unit.value=f.unidad||'';
   const box4=make('div',grid);const label=make('label',box4);
   const check=make('input',label);check.type='checkbox';check.style.width='auto';check.checked=!!f.checked;
   label.append(' Recibir esta línea');
   const adicionales=make('details',card);
   make('summary',adicionales,'Entrega parcial / corregir cantidad total','muted');
   const extraGrid=make('div',adicionales,undefined,'fact-columnas');
   const prevBox=make('div',extraGrid);
   make('label',prevBox,'Total previsto de la factura');
   const totalInput=make('input',prevBox);totalInput.type='text';
   totalInput.inputMode='text';totalInput.value=f.totalCantidad||'';
   totalInput.placeholder='Total en '+(f.totalUnidad||'unidad');
   const deliveryBox=make('div',extraGrid);
   make('label',deliveryBox,'Número de entrega (1, 2…)');
   const delivery=make('input',deliveryBox);delivery.type='number';
   delivery.min='1';delivery.max='50';delivery.step='1';
   delivery.value=String(f.entrega||1);
   const previa=make('p',adicionales,undefined,'muted small');
   if((f.entregas||[]).length)adicionales.open=true;
   const info=make('p',card,undefined,'fact-mensaje');
   const preview=()=>{
    const x=valido(f);
    previa.textContent=x.previo>0?
      'Registrado anteriormente: '+pretty(x.previo,x.item?.stock_unit||'un')+
      '. Entregas registradas: '+(f.entregas||[]).join(', ')+
      '. Para un despacho nuevo, cambia el número de entrega.':
      'Entrega n.º 1 para la primera recepción; usa n.º 2 solo si llega otra parte después.';
    info.textContent=f.saved?'✓ Entrada guardada en la inventario de producción. No se sumó dos veces.':
     !x.item?'Elige un ingrediente o insumo de inventario correcto.':
     (f.entregas||[]).includes(Number(f.entrega))?
      'Esta entrega ya se registró desde algún celular. No vuelvas a sumarla.':
     x.ok?'Se recibirán '+pretty(x.base,x.item.stock_unit)+
      '. Quedará pendiente '+pretty(Math.round((x.limite-x.previo-x.base)*1000)/1000,x.item.stock_unit)+
      '. Nuevo saldo previsto: '+pretty(Math.round((Number(x.item.stock_qty)+x.base)*1000)/1000,x.item.stock_unit):
      'Revisa artículo, unidad, total previsto y entregas anteriores. No se guardará una cantidad incompatible.';
    info.className=f.saved?'fact-guardada':'fact-mensaje';
   };
   const nuevaSolicitud=()=>{f.solicitud=crypto.randomUUID();};
   select.onchange=()=>{f.sku=select.value;nuevaSolicitud();preview();renderAltas();};
   input.oninput=()=>{f.cantidad=input.value;nuevaSolicitud();preview();};
   unit.onchange=()=>{f.unidad=unit.value;nuevaSolicitud();preview();};
   totalInput.oninput=()=>{f.totalCantidad=totalInput.value;nuevaSolicitud();preview();};
   delivery.onchange=()=>{f.entrega=Number(delivery.value);nuevaSolicitud();preview();};
   check.onchange=()=>{f.checked=check.checked;preview();};check.disabled=!!f.saved;
   preview();
  });
  renderAltas();
 }
 function preparar(data,details={}){
  filas=data.map((f,i)=>({...f,linea:i+1,totalCantidad:f.cantidad||'',totalUnidad:f.unidad||'',
   entrega:1,solicitud:crypto.randomUUID(),prev:null,entregas:[],checked:false,saved:false,
   nuevoNombre:nombrePropuestoFactura(f.nombre),nuevaUnidad:f.unidad||'',
   nuevaCategoria:categoriaPropuestaFactura(f.nombre),prepararNuevo:false}));
  meta=details;el('factAcciones').hidden=false;el('factResultado').textContent='';
  mostrarModo('preparar');
  el('factRut').value=details.rut||details.rut_emisor||'';
  el('factFolio').value=details.folio||'';
  el('factTipo').value=['33','34','52'].includes(String(details.tipo))?String(details.tipo):'33';
  el('factDuplicados').textContent='Comprobaremos este folio antes de registrar.';
  if(documentoValido()){
   consultarFactura().then(()=>render()).catch(e=>{
    el('factDuplicados').textContent='No se pudo consultar el historial: '+e.message;
   });
  }
  render();
  estado((meta.proveedor?'Proveedor: '+meta.proveedor+'. ':'')+
    (meta.folio?'Folio: '+meta.folio+'. ':'')+
    (meta.sucursalSugerida==='arica'?'Observación: Regimiento Arica. ':'')+
    filas.length+' línea(s). Revisa antes de registrar.');
 }
 function script(url,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  return new Promise((resolve,reject)=>{
   const tag=document.createElement('script');tag.src=url;tag.async=true;tag.crossOrigin='anonymous';
   tag.onload=()=>window[globalName]?resolve(window[globalName]):reject(Error('Lector no disponible.'));
   tag.onerror=()=>reject(Error('No se descargó el lector. Comprueba la conexión.'));
   document.head.append(tag);
  });
 }
 async function foto(file){
  const lib=await script('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
  const worker=await lib.createWorker('spa');
  try{return String((await worker.recognize(file)).data?.text||'');}
  finally{await worker.terminate();}
 }
 async function pdfTexto(file){
  const lib=await script('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','pdfjsLib');
  lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const pdf=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const lines=[];
  try{
   for(let p=1;p<=Math.min(pdf.numPages,4);p++){
    const page=await pdf.getPage(p),data=await page.getTextContent(),byY=new Map();
    for(const part of data.items||[]){
     const y=Math.round(part.transform?.[5]||0);
     byY.set(y,[...(byY.get(y)||[]),{x:part.transform?.[4]||0,text:part.str||''}]);
    }
    [...byY].sort((a,b)=>b[0]-a[0]).forEach(row=>
      lines.push(row[1].sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ')));
   }
  }finally{await pdf.destroy();}
  return lines.join('\n');
 }
 async function importar(file){
  if(!file||busy)return;
  if(!getBranch()){estado('Primero abre el inventario de tu sucursal.');return;}
  if(file.size>12*1024*1024){estado('Archivo demasiado grande. Máximo 12 MB.');return;}
  busy=true;el('factGuardar').disabled=true;estado('Leyendo el documento en el dispositivo…');
  try{
   const ext=(file.name.split('.').pop()||'').toLowerCase();
   if(ext==='xml'||file.type.includes('xml')){
    const dte=leerDTE(await file.text());
    el('factTextoBox').hidden=true;el('factTexto').value='';
    preparar(filasDTE(dte,getItems()),dte);
   }else{
    if(ext!=='pdf'&&!file.type.startsWith('image/'))throw Error('Solo imagen, PDF o XML.');
    const texto=ext==='pdf'?await pdfTexto(file):await foto(file);
    el('factTextoBox').hidden=false;el('factTexto').value=texto.slice(0,20000);
    preparar(leerTextoFactura(texto,getItems()),leerCabeceraFacturaPDF(texto));
    if(/\.pdf\b/i.test(texto)&&/\d+\.pdf/i.test(texto)&&
       leerTextoFactura(texto,getItems()).length<=1)
     estado('Parece una foto de la pantalla de un PDF. Para leer la factura completa, pulsa «Subir archivo» y elige el PDF original desde Archivos. No guardes hasta verificar cantidades.');
    if(!texto.trim())estado('No se pudo leer texto; prueba otra foto o agrega productos manualmente.');
   }
  }catch(e){estado('No se pudo leer: '+e.message+'. Puedes ingresar manualmente.');el('factAcciones').hidden=false;}
  finally{busy=false;el('factGuardar').disabled=false;mostrarModo(modo);}
 }
 el('factFoto').onchange=e=>importar(e.target.files?.[0]);
 el('factArchivo').onchange=e=>importar(e.target.files?.[0]);
 el('factReleer').onclick=()=>preparar(leerTextoFactura(el('factTexto').value,getItems()),leerCabeceraFacturaPDF(el('factTexto').value));
 el('factAnadir').onclick=()=>{
  filas.push({nombre:'Producto manual',linea:filas.length+1,cantidad:'',unidad:'',totalCantidad:'',totalUnidad:'',entrega:1,solicitud:crypto.randomUUID(),sku:'',checked:false,saved:false,prev:null,entregas:[],nuevoNombre:'',nuevaUnidad:'',nuevaCategoria:'',prepararNuevo:false});render();
 };
 for(const id of ['factRut','factFolio','factTipo']){
  el(id).addEventListener('input',()=>{
   for(const f of filas){f.prev=null;f.entregas=[];f.solicitud=crypto.randomUUID();}
   el('factDuplicados').textContent='Datos cambiados: se volverá a verificar antes de guardar.';
   render();
  });
 }
 el('factGuardar').onclick=async()=>{
  if(busy||!getBranch())return;
  if(meta.sucursalSugerida&&meta.sucursalSugerida!==getBranch()){
   el('factResultado').textContent='El documento parece corresponder a Regimiento Arica. Abre la sucursal correcta.';
   return;
  }
  if(!documentoValido()){
   el('factResultado').textContent='Escribe el RUT y el folio reales para evitar registros duplicados en otros celulares.';
   return;
  }
  let confirmado=false;
  try{confirmado=await consultarFactura();}
  catch(e){el('factResultado').textContent='No se pudo consultar si la factura ya está registrada: '+e.message+'. No guardamos nada.';return;}
  if(!confirmado)return;
  const pending=filas.filter(f=>f.checked&&!f.saved);
  if(!pending.length){el('factResultado').textContent='Marca al menos una línea que realmente llegó.';render();return;}
  if(pending.some(f=>!valido(f).ok)){
   el('factResultado').textContent='Revisa las líneas marcadas: artículo, unidad, total previsto o número de entrega ya usado.';
   render();return;
  }
  busy=true;el('factGuardar').disabled=true;
  let totalGuardadas=0,duplicadas=0,error='';
  const identidad=doc();
  try{
   for(const row of pending){
    const item=getItems().find(x=>x.sku===row.sku);
    if(!item){error='Artículo inexistente en esta sucursal.';break;}
    try{
     const respuesta=await post('factura-recibir',{
      ...identidad,linea:row.linea,descripcion:row.nombre,
      sku:item.sku,cantidad:numeroFactura(row.cantidad),unidad:row.unidad,
      cantidad_total:numeroFactura(row.totalCantidad),unidad_total:row.totalUnidad,
      entrega:Number(row.entrega),request_id:row.solicitud,
      expected_version:Number(item.version)
     });
     if(respuesta.duplicada)duplicadas++;
     else {onSaved(respuesta);totalGuardadas++;}
     row.saved=true;row.checked=false;
    }catch(e){error='No se confirmó «'+item.name+'»: '+e.message;break;}
   }
   try{await consultarFactura();}
   catch(e){error+=(error?' ':'')+'Consulta posterior no disponible. Comprueba los saldos antes de intentar de nuevo.';}
   render();
   el('factResultado').textContent=totalGuardadas+' entrada(s) nuevas guardadas.'+
     (duplicadas?' '+duplicadas+' repetida(s) no se sumaron.':'')+
     (error?' '+error+' Las demás líneas permanecen pendientes.':' Puedes compartir luego el reporte como antes.');
  }finally{busy=false;el('factGuardar').disabled=false;}
 };
 return {reset(){
  filas=[];meta={};el('factLineas').replaceChildren();
  el('factAltasFilas').replaceChildren();el('factAltasEstado').textContent='';el('factAltasDetalles').open=false;
  el('factAcciones').hidden=true;el('factTextoBox').hidden=true;
  el('factTexto').value='';el('factResultado').textContent='';
  el('factFoto').value='';el('factArchivo').value='';
  el('factRut').value='';el('factFolio').value='';el('factTipo').value='33';
  el('factDuplicados').textContent='Las entradas previas se verificarán antes de guardar.';
  estado('Toma una foto o sube una factura para preparar las entradas.');
 }};
}
