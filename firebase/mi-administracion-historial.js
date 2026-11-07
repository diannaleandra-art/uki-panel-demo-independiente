// Mi Administración QA: filtros por razón social e historial móvil.
export function crearHistorialCompras({api,$,esc,fmt,businessName,branchName,branchesFor,negocios}){
 let razones=[],vinculos=[],busy=false;
 const clean=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const date=x=>String(x||'').slice(0,10);
 const qty=x=>Number(x||0).toLocaleString('es-CL',{maximumFractionDigits:3});
 const html=x=>esc(x??'');
 const getReasons=business=>razones.filter(r=>vinculos.some(x=>x.negocio_id===business&&x.razon_social_id===r.id));
 const options=(id,header,arr)=>{const e=$(id),old=e.value;e.replaceChildren(new Option(header,''));
  arr.forEach(x=>e.add(new Option(x.label,x.value)));
  if(Array.from(e.options).some(x=>x.value===old))e.value=old;
 };
 const optReasons=()=>razones.map(x=>({value:x.id,label:x.nombre+(x.rut?' · '+x.rut:'')}));
 function reasonSelector(){
  const list=getReasons($('docBiz').value),e=$('docRazon');
  options('docRazon','Selecciona la razón social compradora',list.map(x=>({label:x.nombre+(x.rut?' · '+x.rut:''),value:x.id})));
  $('docRazonHelp').textContent=list.length?
   'Elige la empresa que figura como compradora en la factura; confirma el RUT.':
   'No hay razón social vinculada. Agrégala a continuación.';
 }
 function reasonList(){
  $('legalReasonsList').innerHTML=razones.map(r=>
   '<div class="legal-line"><strong>'+html(r.nombre)+'</strong><small>RUT: '+html(r.rut||'sin registrar')+
   ' · Negocios: '+html(vinculos.filter(v=>v.razon_social_id===r.id).map(v=>businessName(v.negocio_id)).join(', ')||'sin vincular')+'</small></div>'
  ).join('')||'<p class="hint">Aún no hay razones sociales.</p>';
  options('legalLinkReason','Selecciona razón social',optReasons());
  options('legalLinkBiz','Selecciona negocio',negocios().map(b=>({value:b.id,label:b.nombre})));
 }
 function histories(){
  options('histBiz','Todos los negocios',negocios().map(b=>({value:b.id,label:b.nombre})));
  options('histRazon','Todas las razones sociales',[
   {value:'sin_clasificar',label:'Sin clasificar'},...optReasons()]);
  // El backend usa el valor 'todos' para no filtrar.
  const e=$('histRazon');e.options[0].value='todos';
  historyBranches();
 }
 function historyBranches(){
  options('histBranch','Todas las sucursales',branchesFor($('histBiz').value).map(s=>({label:s.nombre,value:s.id})));
 }
 async function cargarRazones(){
  const d=await api('razones_sociales');razones=d.razones||[];vinculos=d.vinculos||[];
  reasonSelector();reasonList();histories();
  return {razones,vinculos};
 }
 function sugerirRazon(receptor,rut=''){
  if(!receptor)return;
  $('docBuyerInfo').textContent='Comprador leído en la factura: '+receptor+(rut?' · RUT '+rut:'')+'. Confirma la razón social antes de guardar.';
  const m=getReasons($('docBiz').value).find(x=>clean(x.nombre)===clean(receptor));
  if(m){$('docRazon').value=m.id;$('docRazonHelp').textContent='Sugerencia detectada: '+m.nombre+'. Confirma antes de guardar.';}
  else {$('legalNewName').value=receptor;if(rut)$('legalNewRut').value=rut;$('docRazonHelp').textContent='Esta empresa no aparece vinculada al negocio. Agrégala y confirma su RUT.';}
 }
 async function nuevaRazon(){
  const nombre=$('legalNewName').value.trim(),rut=$('legalNewRut').value.trim(),biz=$('docBiz').value;
  if(!biz)throw Error('Elige primero el negocio.');
  if(nombre.length<2)throw Error('Escribe el nombre de la razón social.');
  const d=await api('crear_razon_social',{nombre,rut,negocio_id:biz});
  await cargarRazones();$('docRazon').value=d.razon.id;
  $('legalNewName').value='';$('legalNewRut').value='';
  $('legalStatus').textContent='Razón social registrada y vinculada a '+businessName(biz)+'.';
 }
 async function vincular(){
  const razon=$('legalLinkReason').value,biz=$('legalLinkBiz').value;
  if(!razon||!biz)throw Error('Selecciona empresa y negocio.');
  await api('vincular_razon_negocio',{razon_social_id:razon,negocio_id:biz});
  await cargarRazones();$('legalStatus').textContent='Razón social vinculada correctamente.';
 }
 function totals(p){
  const s=p.resumen||{};
  $('purchasesTotal').textContent=fmt(s.compras);$('purchasesDue').textContent=fmt(s.pendiente);
  $('purchasesCount').textContent=String(s.facturas||0);$('purchasesSuppliers').textContent=String(s.proveedores||0);
  $('purchasesNoReason').textContent=String(s.sin_clasificar||0);
  $('invoiceLegalTotals').innerHTML=(p.razones||[]).map(x=>
   '<div class="finance-total-row"><strong>'+html(x.razon_social)+'</strong><b class="finance-price">'+fmt(x.total)+'</b>'+
   '<small>'+html(x.rut_razon||'')+' · '+html(x.facturas)+' facturas · Por pagar '+fmt(x.pendiente)+'</small></div>'
  ).join('')||'<p class="hint">No hay compras para los filtros elegidos.</p>';
  $('invoiceVendors').innerHTML=(p.proveedores||[]).map(x=>
   '<div class="finance-total-row"><strong>'+html(x.proveedor)+'</strong><b class="finance-price">'+fmt(x.total)+'</b>'+
   '<small>'+html(x.facturas)+' factura(s) · Pendiente '+fmt(x.pendiente)+'</small></div>'
  ).join('')||'<p class="hint">Sin datos.</p>';
  $('invoiceProducts').innerHTML=(p.productos||[]).map(x=>
   '<div class="finance-item-row"><div><strong>'+html(x.producto)+'</strong><small>'+qty(x.cantidad)+' '+html(x.unidad)+' · '+html(x.veces)+' veces</small></div>'+
   '<b class="finance-price">'+fmt(x.importe)+'</b></div>'
  ).join('')||'<p class="hint">Sin artículos.</p>';
 }
 function productRows(rows){
  return '<div class="finance-products">'+rows.map(x=>
   '<div class="finance-item-row"><div class="finance-item-text"><strong>'+html(x.descripcion)+'</strong>'+
   '<small>'+qty(x.cantidad)+' '+html(x.unidad)+' · Unitario '+fmt(x.precio_unitario)+'</small></div>'+
   '<b class="finance-price">'+fmt(x.total_linea)+'</b></div>'
  ).join('')+'</div>';
 }
 async function openInvoice(button){
  const card=button.closest('.finance-invoice'),view=card.querySelector('.finance-invoice-details');
  if(!view.hidden){view.hidden=true;button.textContent='Ver detalle';return;}
  view.hidden=false;view.textContent='Cargando…';button.disabled=true;
  try{
   const {compra:c,articulos:items}=await api('detalle_compra',{id:button.dataset.id});
   view.innerHTML='<div class="finance-invoice-summary">'+
    '<span>Neto <b class="finance-price">'+fmt(c.datos?.neto||0)+'</b></span>'+
    '<span>IVA <b class="finance-price">'+fmt(c.datos?.iva||0)+'</b></span>'+
    '<span>Total <b class="finance-price">'+fmt(c.monto)+'</b></span></div>'+
    '<h3>Productos y cantidades</h3>'+((items||[]).length?productRows(items):'<p class="hint">Sin desglose de productos.</p>')+
    '<details><summary>Corregir razón social o sucursal</summary>'+
    '<label>Razón social</label><select data-reason></select><label>Sucursal</label><select data-branch></select>'+
    '<button class="soft" type="button" data-update>Guardar clasificación</button><p class="hint" data-update-status></p></details>';
   const legal=view.querySelector('[data-reason]'),loc=view.querySelector('[data-branch]');
   legal.add(new Option('Selecciona razón social',''));
   getReasons(c.negocio_id).forEach(r=>legal.add(new Option(r.nombre,r.id)));
   legal.value=c.razon_social_id||'';
   loc.add(new Option('General / sin sucursal',''));
   branchesFor(c.negocio_id).forEach(br=>loc.add(new Option(br.nombre,br.id)));
   loc.value=c.sucursal_id||'';
   view.querySelector('[data-update]').onclick=async()=>{
    try{
     if(!legal.value)throw Error('Selecciona una razón social.');
     if(!confirm('¿Actualizar la clasificación de esta factura?'))return;
     await api('clasificar_compra',{id:c.id,razon_social_id:legal.value,sucursal_id:loc.value||null});
     await cargar();
    }catch(e){view.querySelector('[data-update-status]').textContent='No se pudo guardar: '+e.message}
   };
   button.textContent='Ocultar detalle';
  }catch(e){view.textContent='No se pudo cargar: '+e.message;}
  finally{button.disabled=false;}
 }
 function invoices(rows){
  $('invoicePurchaseList').innerHTML=rows.map(x=>
   '<article class="finance-invoice"><div class="finance-invoice-head">'+
   '<strong>'+html(x.razon_social||'Sin clasificar')+'</strong><b class="finance-price">'+fmt(x.monto)+'</b></div>'+
   '<div class="finance-supplier">'+html(x.proveedor)+'</div>'+
   '<p class="hint">Factura N.º '+html(x.referencia||'sin folio')+' · '+html(date(x.fecha))+'</p>'+
   '<p class="hint">'+html(x.marca)+' · '+html(branchName(x.sucursal_id))+
    (x.datos?.observacion_factura?' · Factura indica: '+html(x.datos.observacion_factura):'')+'</p>'+
   '<div class="finance-invoice-foot"><span class="pill">'+html(x.estado)+'</span>'+
    '<button class="soft" type="button" data-id="'+html(x.id)+'">Ver detalle</button></div>'+
   '<div class="finance-invoice-details" hidden></div></article>'
  ).join('')||'<p class="hint">No hay facturas que coincidan con esta búsqueda.</p>';
  $('invoicePurchaseList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>void openInvoice(b));
 }
 async function cargar(){
  if(busy)return;busy=true;
  $('historyStatus').textContent='Buscando compras…';
  try{
   const params={negocio_id:$('histBiz').value||null,sucursal_id:$('histBranch').value||null,
    razon_social_id:$('histRazon').value||'todos',buscar:$('histSearch').value.trim(),
    desde:$('histFrom').value,hasta:$('histTo').value};
   const p=await api('resumen_compras',params);
   totals(p);invoices(p.facturas||[]);
   $('historyStatus').textContent=String(p.resumen?.facturas||0)+' factura(s) encontradas.';
  }catch(e){$('historyStatus').textContent='No se pudo buscar: '+e.message;throw e}
  finally{busy=false;}
 }
 $('docBiz').addEventListener('change',()=>reasonSelector());
 $('histBiz').addEventListener('change',()=>{historyBranches();void cargar()});
 for(const id of ['histBranch','histRazon','histFrom','histTo'])$(id).addEventListener('change',()=>void cargar());
 $('histSearchButton').onclick=()=>void cargar();
 $('histSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();void cargar()}});
 $('legalAddButton').onclick=async()=>{try{await nuevaRazon()}catch(e){$('legalStatus').textContent=e.message}};
 $('legalLinkButton').onclick=async()=>{try{await vincular()}catch(e){$('legalStatus').textContent=e.message}};
 return {cargar,cargarRazones,reasonSelector,sugerirRazon,getReasons,historyBranches};
}
