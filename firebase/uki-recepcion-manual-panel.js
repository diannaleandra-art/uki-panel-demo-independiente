/* Entrada de mercadería del agendador. No reemplaza conteos ni registra pagos. */
(function(){
'use strict';
const unidades={kg:['kg','g'],g:['g','kg'],l:['l','ml'],ml:['ml','l'],un:['un'],porciones:['porciones']};
const etiquetas={kg:'Kilos (kg)',g:'Gramos (g)',l:'Litros (l)',ml:'Mililitros (ml)',un:'Unidades',porciones:'Porciones'};
const factores={kg:1000,g:1,l:1000,ml:1,un:1,porciones:1};
const fmt=n=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:3});
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const el=(tag,t)=>{const n=document.createElement(tag);if(t)n.textContent=t;return n;};
const option=(value,label)=>{const o=el('option',label);o.value=value;return o;};
function cantidades(raw,origen,destino){
 if(!unidades[destino]?.includes(origen))throw Error('Selecciona una unidad compatible.');
 if(!/^\d{1,6}(?:[.,]\d{1,3})?$/.test(raw.trim()))throw Error('Escribe la cantidad con hasta tres decimales.');
 const n=Number(raw.replace(',','.')),base=n*factores[origen]/factores[destino],redondo=Math.round(base*1000);
 if(n<=0||n>100000||base>100000)throw Error('Escribe una cantidad mayor a cero y dentro del límite del artículo.');
 if(['un','porciones'].includes(origen)&&!Number.isInteger(n))throw Error('Las unidades y porciones se registran con números enteros.');
 if(Math.abs(redondo-base*1000)>1e-7)throw Error('Usa la unidad del artículo y hasta tres decimales.');
 return {cantidad:n,base:redondo/1000};
}
window.ukiMontarRecepcionManual=function({host,local,cargar,guardar,alGuardar}){
 const form=el('form');form.noValidate=true;
 const info=el('p','Ingresa solo la cantidad que llegó. Se sumará al stock del local.');
 const ayuda=el('p','Para que la entrada quede vinculada a una factura, usa «Registrar con factura». Ahí también puedes escribir los productos a mano.');
 info.className=ayuda.className='mini-help';
 const stock=el('p');stock.className='mini-help';
 const status=el('p');status.className='mini-help';status.setAttribute('role','status');
 const input=(tipo,id,label,destino=form)=>{
  const l=el('label',label),node=el(tipo==='select'?'select':'input');
  if(tipo!=='select')node.type=tipo;
  node.id='ukiRecepcionManual'+id;l.htmlFor=node.id;destino.append(l,node);return node;
 };
 const search=input('search','Buscar','Buscar artículo');search.placeholder='Ej. pollo, aceite o aceituna';
 search.autocomplete='off';
 const select=input('select','Articulo','Artículo');
 const group=el('div');group.className='quick-grid';const a=el('div'),b=el('div');group.append(a,b);form.append(group);
 const qty=input('text','Cantidad','Cantidad recibida',a);qty.inputMode='decimal';qty.autocomplete='off';qty.placeholder='Ej. 125';
 const unit=input('select','Unidad','Unidad',b);
 const submit=el('button','Registrar entrada');submit.type='submit';submit.className='big';
 const reload=el('button','Actualizar existencias');reload.type='button';reload.className='sm';
 const actions=el('div');actions.className='uki-mini-action';actions.append(submit,reload);
 form.prepend(info);form.append(stock,actions,status,ayuda);host.append(form);
 let rows=[],snapshot=null,busy=false,requiresReview=false;
 const active=()=>host.isConnected&&local()===true;
 const selected=()=>rows.find(x=>x.sku===select.value);
 function update(){
  const item=selected(),editable=!!item&&!busy&&!requiresReview;
  search.disabled=select.disabled=busy;qty.disabled=unit.disabled=!editable;
  submit.disabled=!editable||!qty.value.trim();reload.disabled=busy;
  if(!item){stock.textContent='';return;}
  const antes=Number(item.stock_qty),actual='Hay '+fmt(antes)+' '+item.stock_unit+'.';
  try{
   const {base}=cantidades(qty.value,unit.value,item.stock_unit);
   stock.textContent=actual+' Cuando guardes, quedarán '+fmt(antes+base)+' '+item.stock_unit+'.';
  }catch{stock.textContent=actual;}
 }
 function unidadesArticulo(prior=''){
  const opciones=unidades[selected()?.stock_unit]||[];
  unit.replaceChildren(...opciones.map(u=>option(u,etiquetas[u])));
  if(opciones.includes(prior))unit.value=prior;
  update();
 }
 function lista(prior='',priorUnit=''){
  const found=rows.filter(i=>norm(i.name).includes(norm(search.value)));
  select.replaceChildren(option('',found.length?'Selecciona un artículo':'No hay artículos para mostrar'),...found.map(i=>option(i.sku,i.name)));
  if(found.some(x=>x.sku===prior))select.value=prior;
  unidadesArticulo(priorUnit);
 }
 async function load(){
  if(busy||!active())return;
  busy=true;update();status.textContent='Consultando existencias del local…';
  const prior=select.value,priorUnit=unit.value;
  try{
   const result=await cargar();if(!active())return;
   if(!Array.isArray(result.items))throw Error('No se confirmó la lista del local.');
   snapshot=result;
   rows=result.items.filter(i=>i&&typeof i.name==='string'&&typeof i.sku==='string'&&
    Object.hasOwn(unidades,i.stock_unit)&&Number.isSafeInteger(i.version)&&i.version>=0&&Number.isFinite(Number(i.stock_qty)))
    .sort((a,b)=>a.name.localeCompare(b.name,'es'));
   if(requiresReview)qty.value='';
   requiresReview=false;lista(prior,priorUnit);
   status.textContent=rows.length?'':'Este local todavía no tiene artículos para seleccionar.';
  }catch(e){
   if(!active())return;
   snapshot=null;rows=[];lista();
   status.textContent='No se pudieron consultar las existencias. '+String(e.message||e);
  }finally{busy=false;update();}
 }
 search.oninput=()=>lista(select.value,unit.value);
 search.onkeydown=e=>{if(e.key==='Enter')e.preventDefault();};
 select.onchange=()=>{qty.value='';unidadesArticulo();};
 qty.oninput=unit.onchange=update;
 reload.onclick=()=>void load();
 form.onsubmit=async e=>{
  e.preventDefault();
  const item=selected();
  if(!active()||!snapshot||!item||busy||requiresReview)return;
  let cantidad;
  try{cantidad=cantidades(qty.value,unit.value,item.stock_unit);}
  catch(error){status.textContent=error.message;return;}
  busy=true;update();status.textContent='Guardando entrada…';
  try{
   const result=await guardar({sku:item.sku,unidad:unit.value,expected_version:item.version,...cantidad},snapshot);
   if(!active())return;
   if(result?.item?.sku!==item.sku||!Number.isSafeInteger(result.item.version)||result.item.version<=item.version||
    !Number.isFinite(Number(result.item.stock_qty)))throw Error('El servidor no confirmó el nuevo saldo.');
   if(snapshot.perfil==='romo-independiente')
    rows=rows.map(x=>({...x,version:result.item.version}));
   rows=rows.map(x=>x.sku===item.sku?{...x,...result.item}:x);
   qty.value='';
   status.textContent='Entrada registrada. '+item.name+' · Hay '+fmt(result.item.stock_qty)+' '+item.stock_unit+'.';
   alGuardar?.();
  }catch(error){
   if(!active())return;
   requiresReview=true;
   status.textContent='No se confirmó la entrada. '+String(error.message||error)+
    ' Actualiza existencias y verifica el saldo antes de registrar de nuevo.';
  }finally{busy=false;update();}
 };
 lista();
 return {cargar:()=>{if(!snapshot)void load();}};
};
})();
