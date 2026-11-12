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
 let items=[],filter='';
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
  const matches=items.filter(x=>x.name.toLowerCase().includes(filter.toLowerCase()));
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
   btn.addEventListener('click',()=>{item.disponible=!item.disponible;render()});
   card.appendChild(btn);
   const remove=create('button','sm','Quitar de simulación');
   remove.type='button';
   remove.addEventListener('click',()=>{
    items=items.filter(x=>x.id!==item.id);render();
   });
   card.appendChild(remove);
   area.appendChild(card);
  }
 }
 function add(){
  const status=el('romoQAInventarioEstado');
  try{
   if(items.length>=MAX)throw Error('Límite de simulación alcanzado');
   const row=validate({
    name:el('romoQAInventarioNombre')?.value||'',
    unit:el('romoQAInventarioUnidad')?.value||'',
    recibido:number(el('romoQAInventarioRecibido')?.value),
    hay:number(el('romoQAInventarioHay')?.value),
    minimo:number(el('romoQAInventarioMinimo')?.value),
    disponible:el('romoQAInventarioDisponible')?.checked===true
   });
   if(items.some(x=>x.name.toLowerCase()===row.name.toLowerCase()))
    throw Error('Este artículo ya está en la simulación');
   items.push({...row,id:'qa:'+String(items.length+1)+':'+Date.now().toString(36)});
   text(status,'Artículo agregado únicamente a la simulación. No se guardó en Neon.');
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
 function reset(){
  if(!root.confirm?.('¿Borrar los artículos de esta simulación? No hay cambios guardados.'))
   return false;
  items=[];filter='';
  const input=el('romoQAInventarioBuscar');if(input)input.value='';
  text(el('romoQAInventarioEstado'),'Simulación limpia. Ningún registro real se modificó.');
  render();return true;
 }
 function view(){
  return '<details class="card" id="romoQAInventarioPreparacion">'+
   '<summary style="cursor:pointer;font-weight:700">📦 Inventario · Romo (pruebas)</summary>'+
   '<p class="muted">Misma sección de inventario, independiente por sucursal. Prueba cantidades y disponibilidad SIN guardarlas. Al salir o actualizar, estos ejemplos desaparecen.</p>'+
   '<p class="muted" role="status" id="romoQAInventarioResumen">Sin registros reales.</p>'+
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
   '<button type="button" class="sm" onclick="ukiRomoInventarioQAAgg()">Agregar a simulación</button>'+
   '<p class="muted" id="romoQAInventarioEstado" role="status">Los registros de prueba NO se guardan.</p>'+
   '<label for="romoQAInventarioBuscar">Buscar artículos</label>'+
   '<input id="romoQAInventarioBuscar" type="search" placeholder="Buscar…" oninput="ukiRomoInventarioQABuscar(this.value)">'+
   '<div id="romoQAInventarioLista"></div>'+
   '<button type="button" class="sm" onclick="ukiRomoInventarioQALimpiar()">Limpiar simulación</button>'+
  '</details>';
 }
 root.ukiRomoInventarioPanelHTMLQA=view;
 root.ukiRomoInventarioQAAgg=add;
 root.ukiRomoInventarioQABuscar=search;
 root.ukiRomoInventarioQALimpiar=reset;
 root.ukiRomoInventarioQARender=render;
 root.ukiRomoInventarioQAModelo=()=>({
  ...estado(),articulos:items.map(i=>({...i,diferencia:diff(i),reponer:falta(i)}))
 });
})(window);
