import {leerDTE,filasDTE,leerTextoFactura,leerCabeceraFacturaPDF,numeroFactura,opcionesRecepcionFactura,nombrePropuestoFactura,categoriaPropuestaFactura,articuloExistenteFactura,vinculoAutomaticoFactura,normalizar} from './uki-factura-lectura-live.mjs?v=20261127-factura-agil-v1';
import {reconocerFotoFactura} from './uki-factura-foto-v2.mjs?v=20261127-factura-agil-v1';
// Señal de compatibilidad: el módulo antiguo solo sirve para el QR del trabajador.
export const facturaAdmiteMontajeAdmin = true;
export function iniciarFacturaLive({getBranch,getItems,post,onSaved,onItemsCreated,mountTarget=null}){
 const section=document.createElement('section');section.id='facturaQA';section.className='card';
 section.innerHTML="<h2>📷 Recibir mercadería con factura</h2>\n<p class=\"muted\">Gratis: toma una foto o sube una factura. Revisa las cantidades antes de guardar. La foto se procesa en tu teléfono y no se envía al servidor.</p>\n<div class=\"fact-botones\"><label for=\"factFoto\">📷 Tomar foto</label><input id=\"factFoto\" type=\"file\" accept=\"image/*\" capture=\"environment\">\n<label for=\"factArchivo\">Subir archivo</label><input id=\"factArchivo\" type=\"file\" accept=\"image/*,.xml,application/xml,.pdf,application/pdf\"></div>\n<p id=\"factEstado\" role=\"status\" class=\"muted\">Fotos, XML y PDF con texto. El ingreso manual sigue disponible.</p>\n<div id=\"factTextoBox\" hidden><label for=\"factTexto\">Texto leído (corrígelo si hay errores)</label>\n<textarea id=\"factTexto\" rows=\"4\" maxlength=\"20000\" style=\"width:100%;font:inherit;border:1px solid #d5c4b6;border-radius:9px\"></textarea>\n<button type=\"button\" class=\"secondary\" id=\"factReleer\">Volver a detectar productos</button></div>\n<div id=\"factLineas\"></div>\n<div id=\"factAcciones\" hidden><button type=\"button\" class=\"secondary\" id=\"factAnadir\">Añadir línea manual</button>\n<button type=\"button\" id=\"factGuardar\">Confirmar mercadería recibida</button>\n<p id=\"factResultado\" role=\"status\"></p><p class=\"muted small\">Las entradas marcadas se guardan individualmente. Si hay un error, revisa el saldo antes de intentar otra vez.</p></div>\n<style>#facturaQA .fact-botones{display:flex;gap:8px;flex-wrap:wrap}\n#facturaQA .fact-botones input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}\n#facturaQA .fact-botones label{display:inline-block;background:#e9822d;color:white;border-radius:9px;padding:12px;cursor:pointer}\n#facturaQA .fact-fila{border:1px solid #eadbcc;border-radius:10px;padding:12px;margin:9px 0}\n#facturaQA .fact-fila select,#facturaQA .fact-fila input[type=text]{width:100%}\n#facturaQA .fact-columnas{display:grid;grid-template-columns:1fr 1fr;gap:8px}\n#facturaQA .fact-mensaje{background:#fff6e9;border-radius:8px;padding:8px}\n#facturaQA .fact-guardada{background:#f0f9ef;border-radius:8px;padding:8px;color:#25612c}\n#facturaQA .fact-cantidades{min-width:0;border:1px solid #eadbcc;border-radius:9px;margin:12px 0;padding:8px 10px}\n#facturaQA .fact-cantidades legend{font-weight:bold;padding:0 4px}\n#facturaQA .fact-atajos{display:flex;gap:6px;flex-wrap:wrap;position:sticky;top:var(--fact-header,0px);z-index:4;background:#fffaf5;border:1px solid #eadbcc;border-radius:10px;padding:6px;margin:10px 0}\n#facturaQA .fact-atajos[hidden],#facturaQA .fact-fila [hidden]{display:none!important}\n#facturaQA .fact-atajos button{margin:0;padding:8px 10px;font-size:.94em}\n#facturaQA .fact-resumen{cursor:pointer;line-height:1.4}\n#facturaQA .fact-resumen small{display:block;margin-left:1em}\n#facturaQA button{margin:8px 6px 0 0}\n#facturaQA #factAltas[hidden],#facturaQA #factRecibirVista[hidden]{display:none!important}\n#facturaQA #factEtapas button[aria-pressed=true]{background:#ae5414;color:#fff}\n#facturaQA #factEtapas button[aria-pressed=false]{background:#f6e3d2;color:#663a20}\n@media(max-width:470px){#facturaQA .fact-columnas{grid-template-columns:1fr}}</style>";
 const metaBox=document.createElement('div');
 metaBox.id='factDocumentQA';
 metaBox.innerHTML='<h3>Datos para evitar duplicados</h3>'+
  '<p class="muted small">Identifica la factura antes de guardarla. Se comprobará en el panel incluso si otro celular la registró.</p>'+
  '<div class="fact-columnas"><div><label for="factProveedor">Nombre del proveedor</label><input id="factProveedor" maxlength="120" placeholder="Ej.: Distribuidora Bombo" autocomplete="off"></div>'+
  '<div><label for="factRut">RUT del proveedor</label><input id="factRut" placeholder="77.557.762-2" autocomplete="off"></div>'+
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
 nav.innerHTML='<button type="button" id="factModoRecibir">Revisar cantidades y registrar</button>'+
  '<button type="button" id="factModoPreparar">Preparar artículos que no existen</button>';
 section.insertBefore(nav,metaBox);
 const atajos=document.createElement('nav');
 atajos.className='fact-atajos';atajos.hidden=true;atajos.setAttribute('aria-label','Atajos de factura');
 atajos.innerHTML='<button type="button" class="secondary" id="factArriba">↑ Inicio</button>'+
  '<button type="button" class="secondary" id="factIrDatos">Proveedor</button>'+
  '<button type="button" class="secondary" id="factIrLineas">Productos</button>'+
  '<button type="button" class="secondary" id="factIrGuardar">Ir a guardar</button>';
 section.insertBefore(atajos,metaBox);
 const textoBox=section.querySelector('#factTextoBox');
 const detalleTexto=document.createElement('details');
 const resumenTexto=document.createElement('summary');resumenTexto.textContent='Ver texto leído o corregirlo';
 detalleTexto.append(resumenTexto,...textoBox.childNodes);textoBox.append(detalleTexto);
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
 const unitLabels={kg:'Kilos (kg)',g:'Gramos (g)',l:'Litros (l)',ml:'Mililitros (ml)',un:'Unidades (un)',porciones:'Porciones'};
 let filas=[],meta={},busy=false,modo='recibir',docRevision=0,lookupVersion=0;
 let proveedorEditado=false;
 function ajustarCabecera(){
  const header=document.querySelector('body > header');
  const fijo=header&&['sticky','fixed'].includes(window.getComputedStyle(header).position);
  const alto=fijo?Math.ceil(header.getBoundingClientRect().height):0;
  section.style.setProperty('--fact-header',alto+'px');
  return alto;
 }
 function saltar(nodo){
  if(!nodo)return;
  const offset=ajustarCabecera()+(nodo!==section&&!atajos.hidden?atajos.getBoundingClientRect().height:0);
  nodo.style.scrollMarginTop=Math.ceil(offset+10)+'px';
  nodo.scrollIntoView?.({block:'start'});
  if(nodo!==section){nodo.tabIndex=-1;nodo.focus({preventScroll:true});}
 }
 el('factArriba').onclick=()=>saltar(section);
 el('factIrDatos').onclick=()=>saltar(metaBox);
 el('factIrLineas').onclick=()=>{if(!busy){mostrarModo('recibir');saltar(el('factLineas'));}};
 el('factIrGuardar').onclick=()=>{if(!busy){mostrarModo('recibir');saltar(el('factAcciones'));}};
 el('factProveedor').oninput=()=>{proveedorEditado=true;};
 const previews=new WeakMap();
 function mostrarModo(value){
  modo=value==='recibir'?'recibir':'preparar';
  altas.hidden=modo!=='preparar';recibidor.hidden=modo!=='recibir';
  el('factModoPreparar').setAttribute('aria-pressed',String(modo==='preparar'));
  el('factModoRecibir').setAttribute('aria-pressed',String(modo==='recibir'));
  el('factModoPreparar').disabled=busy;
  el('factModoRecibir').disabled=busy;
  el('factAltasDetalles').open=true;
 }
 el('factModoPreparar').onclick=()=>{mostrarModo('preparar');saltar(altas);};
 el('factModoRecibir').onclick=()=>{mostrarModo('recibir');saltar(el('factLineas'));};
 mostrarModo('recibir');
 const doc=()=>({rut_emisor:el('factRut').value.trim(),folio:el('factFolio').value.trim(),
  tipo_doc:el('factTipo').value});
 const documentoValido=()=>/^\d{7,8}-[\dK]$/.test(doc().rut_emisor.replace(/[.\s]/g,'').toUpperCase())&&
  /^\d{1,15}$/.test(doc().folio);
 async function consultarFactura(){
  if(!documentoValido())return false;
  const value=doc(),lote=filas,revision=docRevision,lookup=++lookupVersion;
  const result=await post('factura-consultar',value);
  if(lote!==filas||revision!==docRevision||lookup!==lookupVersion)return false;
  const historico=new Map((result.lineas||[]).map(x=>[Number(x.linea),x]));
  const entregas=result.entregas||[];
  for(const f of filas){
   f.prev=historico.get(f.linea)||null;
   f.entregas=(entregas.filter(x=>Number(x.linea)===f.linea)).map(x=>Number(x.entrega));
   if(!f.skuManual&&!f.saved){
    const mismaDescripcion=f.prev&&normalizar(f.prev.descripcion)===normalizar(f.nombre);
    f.sku=(mismaDescripcion?f.prev.sku:f.autoSku)||'';
   }
   previews.get(f)?.();
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
  const totalCantidad=f.prev?.cantidad_factura_base??f.totalCantidad;
  const totalUnidad=f.prev?.unidad_base??f.totalUnidad;
  const limite=item?convertir(numeroFactura(totalCantidad),totalUnidad,item.stock_unit):NaN;
  const previo=Number(f.prev?.cantidad_recibida_base||0);
  const otroSku=!!f.prev&&f.prev.sku!==f.sku;
  const distintaUnidad=!!f.prev&&f.prev.unidad_base!==item?.stock_unit;
  const cambioLimite=!!f.prev&&Number(f.prev.cantidad_factura_base)!==limite;
  const entregaRepetida=(f.entregas||[]).includes(Number(f.entrega));
  return {item,base,limite,previo,totalCantidad,totalUnidad,ok:!!(item&&Number.isFinite(base)&&base>0&&
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
    '. Selecciónalos en «Revisar cantidades y registrar». No se crearán duplicados.','muted small');
  }
  if(!filas.length){
   make('p',parent,'Primero sube una factura para preparar nuevos artículos.','muted small');
   return;
  }
  if(!candidatos.length){
   make('p',parent,'Todos los artículos están vinculados al inventario o ya se registraron.','muted small');
   return;
  }
  for(const f of candidatos){
   const card=make('div',parent,undefined,'fact-fila');
   make('strong',card,'Línea '+f.linea+' · '+f.nombre);
   formularioAlta(f,card);
  }
 }
 function formularioAlta(f,card,inline=false){
  if(f.sugerencia)make('p',card,'El lector sugiere «'+f.sugerencia+'». Revisa primero si ya es el mismo artículo.','muted small');
  const grid=make('div',card,undefined,'fact-columnas');
  const campo=(texto,tag)=>{
   const label=make('label',make('div',grid),texto);
   return make(tag,label);
  };
  const nombre=campo('Nombre del artículo','input');nombre.type='text';nombre.maxLength=100;
  nombre.value=f.nuevoNombre||'';
  const unidad=campo('Unidad de inventario','select');
  for(const u of units)unidad.add(new Option(unitLabels[u]||'Elige unidad…',u));
  unidad.value=f.nuevaUnidad||'';
  const categoria=campo('Tipo','select');
  for(const [k,v] of [['','Elige tipo…'],['ingrediente','Ingrediente'],['envase','Envase'],['otro','Otro insumo']])
   categoria.add(new Option(v,k));
  categoria.value=f.nuevaCategoria||'';
  const hint=make('p',card,undefined,'muted small');hint.setAttribute('role','status');
  let accion;
  if(inline){
   accion=make('button',card,'Crear y vincular este artículo','secondary');accion.type='button';
   accion.onclick=()=>void prepararAltas([f],hint,f.linea);
  }else{
   const label=make('label',card);
   accion=make('input',label);accion.type='checkbox';accion.style.width='auto';accion.checked=!!f.prepararNuevo;
   accion.onchange=()=>{f.prepararNuevo=accion.checked;};
   label.append(' Preparar este artículo');
  }
  const validar=()=>{
   const existente=articuloExistenteFactura(f.nuevoNombre,getItems());
   accion.disabled=!!existente;
   if(existente&&!inline){accion.checked=false;f.prepararNuevo=false;}
   hint.textContent=existente?'Ya existe «'+existente.name+'». Selecciónalo en la lista para evitar duplicarlo.':
    'Se crea con stock 0 y queda seleccionado en esta línea. La mercadería se suma solo al confirmar la recepción.';
  };
  nombre.oninput=()=>{f.nuevoNombre=nombre.value;validar();};
  unidad.onchange=()=>{f.nuevaUnidad=unidad.value;};
  categoria.onchange=()=>{f.nuevaCategoria=categoria.value;};
  validar();
 }
 function avisarResultado(texto){
  el('factResultado').textContent=texto;
 }
 async function prepararAltas(elegidos,feedback,linea=null){
  const mensaje=t=>{feedback.textContent=t;};
  if(busy||!getBranch())return;
  if(meta.sucursalSugerida&&meta.sucursalSugerida!==getBranch()){
   mensaje('La factura parece de Regimiento Arica. Abre la sucursal correspondiente.');
   return;
  }
  if(!documentoValido()){
   mensaje('Antes de crear artículos, comprueba RUT y folio en «Proveedor».');
   return;
  }
  elegidos=elegidos.filter(f=>!f.sku&&!f.saved&&!f.prev);
  if(!elegidos.length){mensaje('Marca los artículos faltantes que quieres preparar.');return;}
  if(elegidos.length>20){
   mensaje('Prepara hasta 20 artículos por vez.');
   return;
  }
  const nombres=new Set();
  for(const f of elegidos){
   const name=String(f.nuevoNombre||'').trim().replace(/\s+/g,' ');
   const key=normalizar(name);
   if(name.length<2||name.length>100||!units.slice(1).includes(f.nuevaUnidad)||
      !['ingrediente','envase','otro'].includes(f.nuevaCategoria)||nombres.has(key)||
      articuloExistenteFactura(name,getItems())){
    mensaje('Revisa los nombres, unidades y artículos repetidos antes de guardar.');
    return;
   }
   nombres.add(key);
  }
  busy=true;mostrarModo(modo);el('factAltasGuardar').disabled=true;el('factGuardar').disabled=true;
  mensaje('Preparando artículos exclusivamente en inventario…');
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
     fila.sku=alta.item.sku;fila.skuManual=true;fila.prepararNuevo=false;fila.solicitud=crypto.randomUUID();
     if(linea)fila.abierta=true;
    }else{conflictos++;fila.prepararNuevo=false;}
   }
   const aviso=(disponibles.length?disponibles.length+' artículo(s) disponibles para esta factura. ':'')+
    (conflictos?'Algún artículo ya existe con otra unidad o no se pudo preparar. Revisa antes de repetir. ':'')+
    'No se sumó mercadería.';
   if(disponibles.length){
    onItemsCreated(disponibles);
    render();
    mostrarModo('recibir');
    if(linea){
     const fila=el('fact-linea-'+linea);
     if(fila){make('p',fila,aviso,'fact-mensaje');saltar(fila);}
    }else saltar(el('factLineas'));
   }else mensaje(aviso);
   avisarResultado(aviso);
  }catch(e){
   mensaje('No se completó la preparación: '+e.message+'. Revisa la lista antes de intentar nuevamente.');
  }finally{busy=false;el('factAltasGuardar').disabled=false;el('factGuardar').disabled=false;mostrarModo(modo);}
 }
 el('factAltasGuardar').onclick=()=>prepararAltas(filas.filter(f=>f.prepararNuevo),el('factAltasEstado'));

 function render(){
  const parent=el('factLineas');parent.replaceChildren();
  atajos.hidden=el('factAcciones').hidden;
  if(!atajos.hidden)ajustarCabecera();
  if(!filas.length)make('p',parent,'No se reconocieron productos. Corrige el texto o añade una línea manual.','muted');
  else make('p',parent,'Puedes corregir la cantidad y la unidad en cada producto antes de guardar. Si son 3 paquetes de 100 y llegaron todos, registra 300 unidades.','muted');
  // Las opciones son solo ingredientes e insumos, no productos del menú.
  filas.forEach((f,i)=>{
   const card=make('details',parent,undefined,'fact-fila');card.id='fact-linea-'+f.linea;
   const resumen=make('summary',card,undefined,'fact-resumen');
   make('strong',resumen,f.nombre||'Producto sin identificar');
   const resumenInfo=make('small',resumen,undefined,'muted');
   card.open=f.abierta??filas.length===1;
   card.ontoggle=()=>{f.abierta=card.open;};
   if(f.cantidadFactura)make('p',card,'En el documento se leyó: '+f.cantidadFactura+' '+(f.unidadFacturada||'sin unidad')+'.','muted small');
   if(f.nota)make('p',card,f.nota,'fact-mensaje');
   const pick=make('details',card);
   const pickTitle=make('summary',pick);
   pick.open=f.selectorAbierto??!f.sku;
   pick.ontoggle=()=>{f.selectorAbierto=pick.open;};
   const buscar=make('input',pick);buscar.type='search';buscar.autocomplete='off';
   buscar.placeholder='Buscar por nombre…';buscar.setAttribute('aria-label','Buscar artículo línea '+(i+1));
   buscar.value=f.busqueda||'';
   const select=make('select',pick);select.setAttribute('aria-label','Artículo de línea '+(i+1));
   const sinCoincidencia=make('p',pick,undefined,'muted small');
   const agregar=make('details',card);
   make('summary',agregar,'No está en la lista · Agregar al inventario');
   agregar.open=!!f.altaAbierta;
   agregar.ontoggle=()=>{f.altaAbierta=agregar.open;};
   formularioAlta(f,agregar,true);
   let ultimoSku;
   const opciones=(buscarCambio=false)=>{
    if(!buscarCambio&&ultimoSku===f.sku)return;
    ultimoSku=f.sku;
    const catalogo=opcionesRecepcionFactura(getItems(),buscar.value,f.sugerencia);
    const actual=getItems().find(x=>x.sku===f.sku);
    if(actual&&!catalogo.some(x=>x.sku===actual.sku))catalogo.unshift(actual);
    select.replaceChildren(new Option('Selecciona el artículo…',''));
    for(const item of catalogo)
     select.add(new Option((item.sugerido?'Sugerencia · ':'')+item.name,item.sku));
    select.value=actual?.sku||'';
    pickTitle.textContent=actual?'Buscar o cambiar artículo':'Buscar en el inventario';
    sinCoincidencia.textContent=!catalogo.length?'No se encontraron artículos. Prueba otro nombre o agrégalo si no existe.':
      'Elige el artículo correcto. Puedes buscar por nombre o cambiar la selección sugerida.';
   };
   buscar.oninput=()=>{f.busqueda=buscar.value;opciones(true);};
   const totalForm=make('fieldset',card,undefined,'fact-cantidades');
   make('legend',totalForm,'Total de la factura');
   const totalGrid=make('div',totalForm,undefined,'fact-columnas');
   const recibidoForm=make('fieldset',card,undefined,'fact-cantidades');
   make('legend',recibidoForm,'Recibido ahora');
   const recibidoGrid=make('div',recibidoForm,undefined,'fact-columnas');
   const campo=(parent,tag,titulo,key)=>{
    const label=make('label',make('div',parent),titulo);
    const field=make(tag,label);field.id='fact-'+key+'-'+f.linea;
    label.htmlFor=field.id;
    if(tag==='input'){
     field.type='text';field.inputMode='decimal';field.maxLength=12;field.placeholder='Ej.: 300';
    }else for(const u of units)field.add(new Option(unitLabels[u]||'Elige unidad…',u));
    return field;
   };
   const totalInput=campo(totalGrid,'input','Cantidad total','total-cantidad');
   const totalUnit=campo(totalGrid,'select','Unidad del total','total-unidad');
   const input=campo(recibidoGrid,'input','Cantidad recibida','recibido-cantidad');
   const unit=campo(recibidoGrid,'select','Unidad recibida','recibido-unidad');
   input.value=f.cantidad||'';unit.value=f.unidad||'';
   const bloqueoTotal=make('p',totalForm,'El total ya está registrado para este folio. Para otra entrega, indica solo lo que llegó ahora.','muted small');
   const copiar=make('button',recibidoForm,'Copiar el total a recibido','secondary');copiar.type='button';
   const label=make('label',card);
   const check=make('input',label);check.type='checkbox';check.style.width='auto';check.checked=!!f.checked;
   label.append(' Recibir esta línea');
   const adicionales=make('details',card);
   make('summary',adicionales,'Entregas parciales e historial','muted');
   const extraGrid=make('div',adicionales,undefined,'fact-columnas');
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
    opciones();
    pick.hidden=!!f.saved;
    if(!x.item&&f.prev)pick.open=true;
    agregar.hidden=!!(x.item||f.prev||f.saved);
    resumenInfo.textContent=(f.saved?'Guardado':f.checked?'Marcado para recibir':x.item?(f.autoSku===f.sku&&!f.skuManual?'Seleccionado automáticamente':'Vinculado'):'Sin vincular')+
     (x.item?' · '+x.item.name:'')+
     (f.cantidad&&f.unidad?' · '+f.cantidad+' '+f.unidad:'');
    if(document.activeElement!==totalInput||f.prev)totalInput.value=x.totalCantidad||'';
    totalUnit.value=x.totalUnidad||'';
    totalInput.disabled=totalUnit.disabled=!!(f.prev||f.saved);
    bloqueoTotal.hidden=!f.prev;
    copiar.hidden=!!(f.prev||f.saved);
    copiar.disabled=!Number.isFinite(numeroFactura(f.totalCantidad))||!f.totalUnidad;
    recibidoForm.disabled=!!f.saved;
    if(f.prev&&(f.entregas||[]).includes(Number(f.entrega)))adicionales.open=true;
    previa.textContent=x.previo>0?
      'Registrado anteriormente: '+pretty(x.previo,x.item?.stock_unit||'un')+
      '. Entregas registradas: '+(f.entregas||[]).join(', ')+
      '. Para un despacho nuevo, cambia el número de entrega.':
      'Entrega n.º 1 para la primera recepción; usa n.º 2 solo si llega otra parte después.';
    info.textContent=f.saved?'✓ Entrada guardada en el inventario. No se sumó dos veces.':
     f.prev&&f.prev.sku!==f.sku?'Para esta entrega, selecciona el mismo artículo registrado antes en la factura.':
     !x.item?'Elige un ingrediente o insumo de inventario correcto.':
     (f.entregas||[]).includes(Number(f.entrega))?
      'Esta entrega ya se registró desde algún celular. No vuelvas a sumarla.':
     !Number.isFinite(x.base)||!Number.isFinite(x.limite)?
      'Revisa las cantidades y unidades. Este artículo se controla en '+(unitLabels[x.item.stock_unit]||x.item.stock_unit)+'.':
     x.previo+x.base>x.limite+1e-8?
      'Lo recibido supera el total pendiente. Revisa el total de la factura y lo que llegó ahora.':
     x.ok?'Se recibirán '+pretty(x.base,x.item.stock_unit)+
      '. Quedará pendiente '+pretty(Math.round((x.limite-x.previo-x.base)*1000)/1000,x.item.stock_unit)+
      '. Nuevo saldo previsto: '+pretty(Math.round((Number(x.item.stock_qty)+x.base)*1000)/1000,x.item.stock_unit):
      'Revisa artículo, unidad, total previsto y entregas anteriores. No se guardará una cantidad incompatible.';
    info.className=f.saved?'fact-guardada':'fact-mensaje';
   };
   const nuevaSolicitud=()=>{f.solicitud=crypto.randomUUID();};
   select.onchange=()=>{f.sku=select.value;f.skuManual=true;nuevaSolicitud();preview();renderAltas();};
   input.oninput=()=>{f.cantidad=input.value;nuevaSolicitud();preview();};
   unit.onchange=()=>{f.unidad=unit.value;nuevaSolicitud();preview();};
   totalInput.oninput=()=>{f.totalCantidad=totalInput.value;nuevaSolicitud();preview();};
   totalUnit.onchange=()=>{f.totalUnidad=totalUnit.value;nuevaSolicitud();preview();};
   copiar.onclick=()=>{
    if(busy||f.prev||f.saved||copiar.disabled)return;
    f.cantidad=input.value=f.totalCantidad;
    f.unidad=unit.value=f.totalUnidad;
    nuevaSolicitud();preview();
   };
   delivery.onchange=()=>{f.entrega=Number(delivery.value);nuevaSolicitud();preview();};
   check.onchange=()=>{f.checked=check.checked;preview();};check.disabled=!!f.saved;
   if(!mountTarget&&!f.saved){
    const omit=make('button',card,'Omitir línea','secondary');omit.type='button';
    omit.onclick=()=>{if(!busy){f.checked=false;check.checked=false;preview();}};
   }
   previews.set(f,preview);
   preview();
  });
  renderAltas();
 }
 function preparar(data,details={}){
  const catalogo=getItems();
  filas=data.map((f,i)=>{
   const autoSku=vinculoAutomaticoFactura(f.nombre,catalogo)?.sku||'';
   return {...f,sku:autoSku,autoSku,linea:i+1,totalCantidad:f.cantidad||'',totalUnidad:f.unidad||'',
    entrega:1,solicitud:crypto.randomUUID(),prev:null,entregas:[],checked:false,saved:false,
    nuevoNombre:nombrePropuestoFactura(f.nombre),nuevaUnidad:f.unidad||'',
    nuevaCategoria:categoriaPropuestaFactura(f.nombre),prepararNuevo:false};
  });
  meta=details;el('factAcciones').hidden=false;el('factResultado').textContent='';
  if(!proveedorEditado)el('factProveedor').value=String(details.proveedor||'').slice(0,120);
  mostrarModo('recibir');
  el('factRut').value=details.rut||details.rut_emisor||'';
  el('factFolio').value=details.folio||'';
  el('factTipo').value=['33','34','52'].includes(String(details.tipo))?String(details.tipo):'33';
  el('factDuplicados').textContent='Comprobaremos este folio antes de registrar.';
  if(documentoValido()){
   const lote=filas,revision=docRevision;
   consultarFactura().catch(e=>{
    if(lote!==filas||revision!==docRevision||busy)return;
    el('factDuplicados').textContent='No se pudo consultar el historial: '+e.message;
   });
  }
  render();
  estado(
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
  const address=URL.createObjectURL(file),img=new Image();
  let worker;
  try{
   await new Promise((resolve,reject)=>{
    img.onload=resolve;img.onerror=()=>reject(Error('No se pudo abrir esta foto. Usa JPG o PNG, o sube el PDF/XML original.'));
    img.src=address;
   });
   const lib=await script('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
   worker=await lib.createWorker('spa',1,{langPath:'https://tessdata.projectnaptha.com/4.0.0_fast'});
   return await reconocerFotoFactura(img,worker,{items:getItems(),progreso:estado});
  }finally{URL.revokeObjectURL(address);if(worker)await worker.terminate();}
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
  proveedorEditado=false;detalleTexto.open=false;
  try{
   const ext=(file.name.split('.').pop()||'').toLowerCase();
   if(ext==='xml'||file.type.includes('xml')){
    const dte=leerDTE(await file.text());
    el('factTextoBox').hidden=true;el('factTexto').value='';
    preparar(filasDTE(dte,getItems()),dte);
   }else{
    if(ext!=='pdf'&&!file.type.startsWith('image/'))throw Error('Solo imagen, PDF o XML.');
    const resultado=ext==='pdf'?null:await foto(file);
    const texto=resultado?resultado.texto:await pdfTexto(file);
    const filasLeidas=resultado?.filas||leerTextoFactura(texto,getItems());
    el('factTextoBox').hidden=false;el('factTexto').value=texto.slice(0,20000);
    preparar(filasLeidas,resultado?.meta||leerCabeceraFacturaPDF(texto));
    if(resultado?.lecturaParcial&&texto.trim())
     estado('Lectura posiblemente incompleta: '+filasLeidas.length+' línea(s). Compara todas con la factura antes de registrar. Puedes subir el PDF/XML original o tomar otra foto de la hoja completa.');
    if(/\.pdf\b/i.test(texto)&&/\d+\.pdf/i.test(texto)&&filasLeidas.length<=1)
     estado('Parece una foto de la pantalla de un PDF. Para leer la factura completa, pulsa «Subir archivo» y elige el PDF original desde Archivos. No guardes hasta verificar cantidades.');
    if(!texto.trim())estado('No se pudo leer texto; prueba otra foto o agrega productos manualmente.');
   }
  }catch(e){estado('No se pudo leer: '+e.message+'. Puedes ingresar manualmente.');el('factAcciones').hidden=false;mostrarModo('recibir');render();}
  finally{busy=false;el('factGuardar').disabled=false;mostrarModo(modo);}
 }
 for(const id of ['factFoto','factArchivo'])el(id).onchange=e=>{const file=e.target.files?.[0];e.target.value='';void importar(file);};
 el('factReleer').onclick=()=>{
  if(busy)return;
  const texto=el('factTexto').value;
  preparar(leerTextoFactura(texto,getItems()),leerCabeceraFacturaPDF(texto));
  detalleTexto.open=false;saltar(el('factLineas'));
 };
 el('factAnadir').onclick=()=>{
  if(busy)return;
  const linea=filas.length+1;
  filas.push({nombre:'Producto manual',linea,abierta:true,cantidad:'',unidad:'',totalCantidad:'',totalUnidad:'',entrega:1,solicitud:crypto.randomUUID(),sku:'',checked:false,saved:false,prev:null,entregas:[],nuevoNombre:'',nuevaUnidad:'',nuevaCategoria:'',prepararNuevo:false});
  render();saltar(el('fact-linea-'+linea));
 };
 for(const id of ['factRut','factFolio','factTipo']){
  el(id).addEventListener('input',()=>{
   docRevision++;
   for(const f of filas){
    f.prev=null;f.entregas=[];f.solicitud=crypto.randomUUID();
    if(!f.skuManual&&!f.saved)f.sku=f.autoSku||'';
   }
   el('factDuplicados').textContent='Datos cambiados: se volverá a verificar antes de guardar.';
   for(const f of filas)previews.get(f)?.();
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
  busy=true;el('factGuardar').disabled=true;mostrarModo(modo);
  try{
   if(!await consultarFactura())return;
  }catch(e){
   el('factResultado').textContent='No se pudo consultar si la factura ya está registrada: '+e.message+'. No guardamos nada.';return;
  }finally{busy=false;el('factGuardar').disabled=false;mostrarModo(modo);}

  const pending=filas.filter(f=>f.checked&&!f.saved);
  if(!pending.length){el('factResultado').textContent='Marca al menos una línea que realmente llegó.';render();return;}
  const porCorregir=pending.find(f=>!valido(f).ok);
  if(porCorregir){
   el('factResultado').textContent='Revisa las líneas marcadas: artículo, unidad, total previsto o número de entrega ya usado.';
   porCorregir.abierta=true;render();saltar(el('fact-linea-'+porCorregir.linea));return;
  }
  busy=true;el('factGuardar').disabled=true;
  let totalGuardadas=0,duplicadas=0,error='';
  const identidad=doc();
  try{
   for(const row of pending){
    const item=getItems().find(x=>x.sku===row.sku);
    if(!item){error='Artículo inexistente en esta sucursal.';break;}
    try{
     const {totalCantidad,totalUnidad}=valido(row);
     const respuesta=await post('factura-recibir',{
      ...identidad,linea:row.linea,descripcion:row.nombre,
      sku:item.sku,cantidad:numeroFactura(row.cantidad),unidad:row.unidad,
      cantidad_total:numeroFactura(totalCantidad),unidad_total:totalUnidad,
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
  filas=[];meta={};proveedorEditado=false;atajos.hidden=true;detalleTexto.open=false;
  el('factProveedor').value='';el('factLineas').replaceChildren();
  el('factAltasFilas').replaceChildren();el('factAltasEstado').textContent='';el('factAltasDetalles').open=false;
  el('factAcciones').hidden=true;el('factTextoBox').hidden=true;
  el('factTexto').value='';el('factResultado').textContent='';
  el('factFoto').value='';el('factArchivo').value='';
  el('factRut').value='';el('factFolio').value='';el('factTipo').value='33';
  el('factDuplicados').textContent='Las entradas previas se verificarán antes de guardar.';
  estado('Toma una foto o sube una factura para preparar las entradas.');
 }};
}
