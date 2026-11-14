/* Uki Sushi · Caja acumulada real, aislada de las ventas del turno.
   Su saldo se calcula en Neon con movimientos auditables. No reescribe pedidos ni cierres. */
(function(){
'use strict';
const BRANCHES={arica:'Regimiento Arica',serena:'La Serena'};
const ACTIONS={entrada:'Agregar dinero',gasto:'Registrar gasto',retiro:'Retirar efectivo',traspaso:'Traspasar a otro local'};
const TYPES={apertura:'Saldo inicial',cierre:'Cierre confirmado',ajuste_cierre:'Corrección de cierre',
 entrada:'Entrada',gasto:'Gasto',retiro:'Retiro',traspaso_salida:'Traspaso enviado',traspaso_entrada:'Traspaso recibido'};
const API='https://uki-sushi-inventario.vercel.app/api/uki-caja-acumulada-live';
const state={branch:'arica',balance:0,initialized:false,initializedAt:null,history:[],busy:false,ready:false,nonce:null};
const $=id=>document.getElementById(id);
const money=v=>'$'+Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
const branchFromPanel=()=>typeof S!=='undefined'&&S?.suc==='Uki La Serena'?'serena':'arica';
const date=v=>new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',
 day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v));
function status(msg,kind=''){
 const el=$('ukiAcumStatus');if(!el)return;
 el.textContent=msg;el.dataset.kind=kind;
}
function html(){
 return '<div class="card" id="ukiAcumRoot">'+
 '<h2>💵 Caja acumulada en efectivo</h2>'+
 '<p class="muted">Dinero físico que quedó de cierres anteriores. Independiente de transferencias y tarjetas.</p>'+
 '<p class="mini-help"><b>EFECTIVO REAL:</b> para comenzar, cuenta una sola vez el dinero físico que ya quedó de los cierres anteriores. No vuelvas a registrar esos cierres.</p>'+
 '<p class="mini-help">Sucursal actual: <b id="ukiAcumSucursalFija"></b>. Para consultar otra caja, utiliza «Salir» y entra a esa sucursal.</p>'+
 '<select id="ukiAcumBranch" hidden disabled aria-label="Sucursal de este panel"><option value="arica">Regimiento Arica</option><option value="serena">La Serena</option></select>'+
 '<div class="kpi" style="margin:12px 0"><span>Saldo acumulado · <b id="ukiAcumSucursal"></b></span><strong id="ukiAcumBalance">—</strong></div>'+
 '<p id="ukiAcumStatus" role="status" class="mini-help">Cargando con el acceso habitual del panel…</p>'+
 '<button type="button" id="ukiAcumRefresh" class="sm">Actualizar saldo</button>'+
 '<div id="ukiAcumMain" hidden>'+ 
  '<label for="ukiAcumResponsable">Responsable del movimiento (agendador o administración)</label>'+
  '<input id="ukiAcumResponsable" maxlength="80" placeholder="Ej.: nombre de quien registra">'+
  '<div id="ukiAcumInit">'+
   '<p class="muted">El agendador o la administración pueden registrar un saldo inicial, después de contar el efectivo real.</p>'+
   '<label for="ukiAcumInitial">Saldo inicial contado</label><input id="ukiAcumInitial" type="number" min="0" max="100000000" step="1" inputmode="numeric">'+
   '<label for="ukiAcumInitialConcept">Concepto</label><input id="ukiAcumInitialConcept" maxlength="240" placeholder="Ej.: conteo al iniciar el control">'+
   '<button type="button" id="ukiAcumStart" class="big">Registrar saldo inicial</button>'+
  '</div>'+
  '<div id="ukiAcumOperations" hidden>'+
   '<label for="ukiAcumType">Movimiento</label><select id="ukiAcumType">'+Object.entries(ACTIONS).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select>'+
   '<label for="ukiAcumAmount">Monto en pesos</label><input id="ukiAcumAmount" type="number" min="1" max="100000000" step="1" inputmode="numeric">'+
   '<label for="ukiAcumConcept">Concepto o motivo</label><input id="ukiAcumConcept" maxlength="240" placeholder="Ej.: compra de mercadería">'+
   '<div id="ukiAcumDestinationRow" hidden><label for="ukiAcumDestination">Sucursal que recibe</label>'+
   '<select id="ukiAcumDestination"><option value="serena">La Serena</option><option value="arica">Regimiento Arica</option></select></div>'+
   '<button type="button" id="ukiAcumSave" class="big">Registrar movimiento</button>'+
   '<p class="muted">Si el gasto ya está descontado del cierre, NO se registra nuevamente aquí.</p>'+
  '</div>'+
 '</div>'+
 '</div>'+
 '<details class="card" open><summary><b>📖 Historial de Caja acumulada en efectivo</b></summary>'+
 '<button type="button" id="ukiAcumHistoryRefresh" class="sm">Actualizar historial</button>'+
 '<div class="quick-grid" style="margin-top:10px">'+
 '<button type="button" id="ukiAcumExcel" class="sm">Excel (.csv)</button>'+
 '<button type="button" id="ukiAcumPDF" class="sm">PDF</button>'+
 '<button type="button" id="ukiAcumWhatsApp" class="sm">Compartir WhatsApp</button></div>'+
 '<div id="ukiAcumHistory"></div></details>'+
 '<p class="muted">Los cierres antiguos no se acumulan sin reconciliar el dinero real. Las correcciones aportan solo la diferencia.</p>';
}
async function request(action,extra={},branch=state.branch){
 if(branch!==branchFromPanel())throw Error('Abre la sucursal correspondiente para gestionar su caja acumulada.');
 if(!API)throw Error('Servicio de caja acumulada no disponible.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Utiliza el acceso habitual de Uki Sushi al panel.');
 const response=await fetch(API,{method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({branch,action,...extra})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw Error(data.error||'No se pudo consultar la caja acumulada.');
 return data;
}
// Solo se acreditan cierres posteriores al saldo inicial, confirmados, con arqueo exacto.
function closureEligible(c,branch,initMs){
 const cash=Number(c?.efectivo),counted=c?.efectivoContado,diff=c?.diferenciaEfectivo;
 const ms=Number(c?.fechaMs);
 return c?.suc===(branch==='arica'?'Uki Regimiento Arica':'Uki La Serena') &&
  Number.isSafeInteger(ms)&&ms>initMs&&ms<=Date.now()+20*60000&&
  Number.isSafeInteger(cash)&&cash>=0&&cash<=100000000&&
  counted!==null&&counted!==undefined&&Number(counted)===cash&&diff===0&&
  /^\d{4}-\d{2}-\d{2}$/.test(String(c.fechaOperativa||''))&&
  typeof c.resp==='string'&&c.resp.trim().length>=2;
}
function closePayload(c,branch){
 return {monto:c.efectivo,efectivo_contado:c.efectivoContado,
  diferencia_efectivo:c.diferenciaEfectivo,confirmado:true,
  fecha_operativa:c.fechaOperativa,fecha_cierre_ms:c.fechaMs,
  cierre_clave:'uki|'+branch+'|'+c.fechaMs,
  responsable:String(c.resp).trim().slice(0,80),op_key:crypto.randomUUID()};
}
async function reconcileClosures(branch,initializedAt){
 const since=Date.parse(initializedAt||'');
 if(!Number.isFinite(since)||typeof S==='undefined'||S?.suc!==
  (branch==='arica'?'Uki Regimiento Arica':'Uki La Serena'))return {synced:0,skipped:0,failed:0};
 const all=(S.cierres||[]).filter(c=>c?.suc===S.suc&&Number(c?.fechaMs)>since);
 let synced=0,skipped=0,failed=0;
 for(const c of all){
  if(!closureEligible(c,branch,since)){skipped++;continue}
  try{const r=await request('sincronizar_cierre',closePayload(c,branch),branch);
    if(!r.duplicate)synced++;
  }catch(e){failed++;console.warn('Uki cierre pendiente de conciliar:',String(e?.message||e));}
 }
 return {synced,skipped,failed};
}
async function registerConfirmedClosure(c){
 try{
  const branch=c?.suc==='Uki Regimiento Arica'?'arica':c?.suc==='Uki La Serena'?'serena':null;
  if(!branch)return;
  const info=await request('saldo',{},branch);
  const since=Date.parse(info.cuenta?.initialized_at||'');
  if(!info.cuenta?.initialized||!closureEligible(c,branch,since))return;
  await request('sincronizar_cierre',closePayload(c,branch),branch);
 }catch(e){
  // No bloquear el cierre real: se volverá a conciliar al abrir Caja acumulada.
  console.warn('Uki caja acumulada: cierre en cola de conciliación',String(e?.message||e));
 }
}
function draw(){
 if(!$('ukiAcumRoot'))return;
 $('ukiAcumBranch').value=state.branch;
 $('ukiAcumSucursalFija').textContent='Uki '+BRANCHES[state.branch];
 $('ukiAcumSucursal').textContent=BRANCHES[state.branch];
 $('ukiAcumBalance').textContent=state.ready&&state.initialized?money(state.balance):'Sin saldo inicial';
 $('ukiAcumMain').hidden=!state.ready;
 $('ukiAcumInit').hidden=state.initialized;
 $('ukiAcumOperations').hidden=!state.initialized;
 $('ukiAcumDestination').value=state.branch==='arica'?'serena':'arica';
 $('ukiAcumDestinationRow').hidden=$('ukiAcumType').value!=='traspaso';
 for(const id of ['ukiAcumRefresh','ukiAcumStart','ukiAcumSave','ukiAcumHistoryRefresh','ukiAcumExcel','ukiAcumPDF','ukiAcumWhatsApp'])
   $(id).disabled=state.busy||!state.ready&&id!=='ukiAcumRefresh';
 const root=$('ukiAcumHistory');root.replaceChildren();
 if(!state.history.length){
  const p=document.createElement('p');p.className='muted';
  p.textContent=state.ready?'Aún no hay movimientos en esta sucursal.':'Historial no disponible.';
  root.append(p);return;
 }
 for(const x of state.history){
  const row=document.createElement('div');row.className='row';
  const left=document.createElement('div'),title=document.createElement('b'),info=document.createElement('small'),sum=document.createElement('b');
  title.textContent=TYPES[x.tipo]||String(x.tipo);
  info.style.display='block';info.textContent=x.concepto+' · '+String(x.responsable||'Responsable no registrado')+' · '+date(x.creado_en);
  sum.textContent=(Number(x.monto)>0?'+':'')+money(x.monto);
  left.append(title,info);row.append(left,sum);root.append(row);
 }
}
async function load(){
 if(state.busy)return;
 const branch=state.branch;
 state.busy=true;status('Consultando saldo e historial…');
 try{
  let [a,m]=await Promise.all([request('saldo',{},branch),request('movimientos',{},branch)]);
  if(branch!==state.branch)return;
  let summary={synced:0,skipped:0,failed:0};
  if(a.cuenta.initialized){
   summary=await reconcileClosures(branch,a.cuenta.initialized_at);
   if(summary.synced){
    [a,m]=await Promise.all([request('saldo',{},branch),request('movimientos',{},branch)]);
   }
  }
  if(branch!==state.branch)return;
  state.balance=Number(a.cuenta.balance)||0;
  state.initialized=a.cuenta.initialized===true;
  state.initializedAt=a.cuenta.initialized_at||null;
  state.history=Array.isArray(m.movimientos)?m.movimientos:[];
  state.ready=true;
  if(summary.failed)status('Algunos cierres no se sincronizaron. Revisa la conexión y vuelve a Actualizar saldo.','error');
  else if(summary.skipped)status(summary.skipped+' cierre(s) aún sin arqueo exacto; no se sumaron para evitar descuadres.','error');
  else status('✓ Efectivo acumulado actualizado y separado de las ventas del turno.','success');
 }catch(e){state.ready=false;status(String(e.message||e),'error');}
 finally{state.busy=false;draw();}
}
function readAmount(id,allowZero=false){
 const raw=String($(id)?.value||'').trim(),n=Number(raw);
 if(!/^\d{1,9}$/.test(raw)||!Number.isSafeInteger(n)||n>100000000||(!allowZero&&n===0))
   throw Error('Ingresa un monto válido en pesos enteros.');
 return n;
}
function readConcept(id){
 const x=String($(id)?.value||'').trim();
 if(x.length<3||x.length>240)throw Error('Explica el concepto del movimiento (mínimo tres letras).');
 return x;
}
async function save(first=false){
 if(state.busy||!state.ready)return;
 let action,monto,concepto,destino,responsable;
 try{
  action=first?'inicializar':$('ukiAcumType').value;
  monto=readAmount(first?'ukiAcumInitial':'ukiAcumAmount',first);
  concepto=readConcept(first?'ukiAcumInitialConcept':'ukiAcumConcept');
  responsable=String($('ukiAcumResponsable')?.value||'').trim();
  if(responsable.length<2||responsable.length>80)throw Error('Escribe el nombre del responsable (agendador o administración).');
  destino=action==='traspaso'?$('ukiAcumDestination').value:undefined;
  if(destino===state.branch)throw Error('Selecciona una sucursal distinta.');
  if(!confirm('ATENCIÓN: es DINERO REAL. ¿Confirmas '+money(monto)+' en '+BRANCHES[state.branch]+'? '+(first?'El saldo inicial debe incluir todo el efectivo ya acumulado de cierres anteriores.':'El movimiento se guardará una sola vez y quedará en el historial.')))return;
 }catch(e){status(String(e.message||e),'error');return;}
 const branch=state.branch;
 if(!state.nonce)state.nonce=crypto.randomUUID();
 state.busy=true;draw();status('Registrando movimiento de efectivo…');
 try{
  const r=await request(action,{monto,concepto,destino,responsable,op_key:state.nonce,saldo_inicial_contado:first},branch);
  state.nonce=null;
  if(branch!==state.branch)return;
  if(first){$('ukiAcumInitial').value='';$('ukiAcumInitialConcept').value='';}
  else{$('ukiAcumAmount').value='';$('ukiAcumConcept').value='';}
  status(r.duplicate?'✓ Movimiento ya registrado; no se duplicó el saldo.':'✓ Movimiento guardado correctamente.','success');
 }catch(e){status(String(e.message||e),'error');}
 finally{state.busy=false;await load();}
}
function exportReport(kind){
 if(!state.ready)return status('Primero comprueba tu acceso y carga el historial de pruebas.','error');
 const exporter=window.ukiCajaAcumExportar;
 if(!exporter)return status('No está cargado el generador de informes.','error');
 const report={branch:state.branch,balance:state.balance,history:state.history,generated_at:new Date().toISOString()};
 try{
  if(kind==='excel')exporter.excel(report);
  else if(kind==='pdf')exporter.savePDF(report);
  else return exporter.whatsapp(report).then(v=>status(v==='cancelado'?'Se canceló compartir.':'✓ Documento de prueba preparado para compartir.','success')).catch(e=>status(String(e.message||e),'error'));
  status('✓ Archivo generado para guardar desde tu iPhone.','success');
 }catch(e){status(String(e.message||e),'error');}
}
function mount(){
 if(!$('ukiAcumRoot'))return;
 state.branch=branchFromPanel();state.ready=false;state.nonce=null;
 $('ukiAcumBranch').disabled=true;
 $('ukiAcumType').onchange=draw;
 $('ukiAcumRefresh').onclick=()=>void load();
 $('ukiAcumHistoryRefresh').onclick=()=>void load();
 $('ukiAcumStart').onclick=()=>void save(true);
 $('ukiAcumSave').onclick=()=>void save(false);
 $('ukiAcumExcel').onclick=()=>void exportReport('excel');
 $('ukiAcumPDF').onclick=()=>void exportReport('pdf');
 $('ukiAcumWhatsApp').onclick=()=>void exportReport('whatsapp');
 draw();void load();
}
window.ukiCajaAcumuladaVista=html;window.ukiCajaAcumuladaMontar=mount;
window.ukiCajaAcumuladaRegistrarCierre=registerConfirmedClosure;
})();