/* Romo Sushi · Caja acumulada real, aislada de las ventas del turno.
   Su saldo se calcula en Neon con movimientos auditables. No reescribe pedidos ni cierres. */
(function(){
'use strict';
const BRANCHES={serena:'Romo Sushi La Serena'};
const ACTIONS={entrada:'Agregar dinero',gasto:'Registrar gasto',retiro:'Retirar efectivo'};
const TYPES={apertura:'Saldo inicial',cierre:'Cierre confirmado',ajuste_cierre:'Corrección de cierre',
 entrada:'Entrada',gasto:'Gasto',retiro:'Retiro',traspaso_salida:'Traspaso enviado',traspaso_entrada:'Traspaso recibido'};
const API='/api/romo-caja-acumulada-qa';
const LOCAL='Romo’s Sushi La Serena';
const state={branch:'serena',balance:0,initialized:false,initializedAt:null,history:[],busy:false,ready:false,nonce:null,pending:null,write:false,credited:[],candidates:[],operationRoot:null};
const $=id=>document.getElementById(id);
const money=v=>'$'+Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
const branchFromPanel=()=>typeof S!=='undefined'&&S?.suc===LOCAL?'serena':null;
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
 '<select id="ukiAcumBranch" hidden disabled aria-label="Sucursal de este panel"><option value="arica">Romo Sushi</option><option value="serena">Romo La Serena</option></select>'+
 '<div class="kpi" style="margin:12px 0"><span>Saldo acumulado · <b id="ukiAcumSucursal"></b></span><strong id="ukiAcumBalance">—</strong></div>'+
 '<p id="ukiAcumStatus" role="status" class="mini-help">Cargando con el acceso habitual del panel…</p>'+
 '<button type="button" id="ukiAcumRefresh" class="sm">Actualizar saldo</button>'+
 '<div id="ukiAcumMain" hidden>'+ 
  '<label for="ukiAcumResponsable">Responsable del movimiento (dueños autorizados)</label>'+
  '<input id="ukiAcumResponsable" maxlength="80" placeholder="Ej.: nombre de quien registra">'+
  '<div id="ukiAcumInit">'+
   '<p class="muted">Los dueños autorizados pueden registrar un saldo inicial, después de contar el efectivo real.</p>'+
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
 '<div class="card"><h3>Cierres por conciliar</h3><p class="muted">Los nuevos cierres se acreditan por el efectivo contado, con la diferencia y su motivo. Aquí puedes conciliar los pendientes posteriores al conteo inicial, sin duplicar efectivo.</p><div id="romoAcumCierres"></div></div>'+
 '<details class="card" open><summary><b>📖 Historial de Caja acumulada en efectivo</b></summary>'+
 '<button type="button" id="ukiAcumHistoryRefresh" class="sm">Actualizar historial</button>'+
 '<div class="quick-grid" style="margin-top:10px">'+
 '<button type="button" id="ukiAcumExcel" class="sm">Excel (.csv)</button>'+
 '<button type="button" id="ukiAcumPDF" class="sm">PDF</button>'+
 '<button type="button" id="ukiAcumWhatsApp" class="sm">Compartir WhatsApp</button></div>'+
 '<div id="ukiAcumHistory"></div></details>'+
 '<p class="muted">Historial: últimos 250 movimientos. No volver a registrar cierres anteriores al saldo inicial. Traspasos y correcciones de cierres requieren integración contable adicional; no se habilitan en este módulo.</p>';
}
async function request(action,extra={},branch=state.branch){
 if(branch!=='serena'||branchFromPanel()!==branch||!window.ukiRomoSesionRemotaQA?.disponible?.()||window.ukiRomoSesionRemotaQA.estado()?.conflicto)
  throw Error('Abre el estado autorizado y actualizado de Romo.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Ingresa con Google autorizado de Romo.');
 const response=await fetch(API,{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...extra})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true||data.storeId!=='romo:serena'||data.soloRomo!==true)throw Error(data.error||'No se pudo confirmar la caja acumulada de Romo.');
 return data;
}
// Solo cierres posteriores al saldo inicial, con conteo real y diferencia documentada.
function closureEligible(c,branch,initMs){
 const ms=Number(c?.fechaMs),cash=c?.efectivo,key=String(c?.turnoClave||'');
 return branch==='serena'&&c?.suc===LOCAL&&Number.isSafeInteger(ms)&&ms>initMs&&ms<=Date.now()+20*60000&&Number.isSafeInteger(cash)&&Math.abs(cash)<=100000000&&Number.isSafeInteger(c.efectivoContado)&&c.efectivoContado>=0&&c.efectivoContado<=100000000&&Number.isSafeInteger(c.diferenciaEfectivo)&&c.efectivoContado-cash===c.diferenciaEfectivo&&(c.diferenciaEfectivo===0||typeof c.obs==='string'&&c.obs.trim().length>=3)&&/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(key)&&key.startsWith(String(c.fechaOperativa)+'@')&&!c.rectificacion&&!(c.rectificaciones||[]).length&&typeof c.resp==='string'&&c.resp.trim().length>=2;
}
function closePayload(c){
 return {source_key:'romo:serena|'+c.turnoClave,concepto:c.diferenciaEfectivo===0?'Cierre definitivo '+c.fechaOperativa:String(c.obs||'').trim().slice(0,240),responsable:c.resp.trim().slice(0,80),op_key:crypto.randomUUID()};
}
function reconcileCandidates(initializedAt,credited){
 const since=Date.parse(initializedAt||'');
 if(!Number.isFinite(since))return [];
 const all=(S.cierres||[]).filter(c=>c?.suc===LOCAL&&Number(c.fechaMs)>since&&!credited.includes('romo:serena|'+c.turnoClave));
 const counts=new Map();for(const c of all)counts.set(c.turnoClave,(counts.get(c.turnoClave)||0)+1);
 return all.map(c=>({c,eligible:counts.get(c.turnoClave)===1&&closureEligible(c,'serena',since)})).sort((a,b)=>b.c.fechaMs-a.c.fechaMs);
}
async function confirmarCierre(c){
 if(state.busy||!state.ready||!state.write||state.pending||!state.initialized)return;
 if(!state.candidates.some(x=>x.c===c&&x.eligible)||branchFromPanel()!=='serena')return;
 if(!confirm('¿Confirmas incorporar al efectivo acumulado el dinero real de este cierre de Romo, '+money(c.efectivoContado)+'? No lo registres si ya está incluido en el conteo inicial o en otra entrada.'))return;
 const root=state.operationRoot;state.busy=true;draw();status('Confirmando constancia del cierre…');
 let message='';
 try{const r=await request('sincronizar_cierre',closePayload(c),'serena');message=r.duplicate?'Cierre ya acreditado, sin duplicar.':'Cierre acreditado mediante su constancia de Neon.';}
 catch(e){message='No se confirmó la acreditación. Revisa el historial antes de repetir: '+String(e.message||e);}
 finally{state.busy=false;if(root?.isConnected){await load();status(message);}}
}
async function registrarCierreConfirmado(c){
 // Solo cierre con constancia en Neon y saldo inicial previo; la función SQL
 // verifica la constancia y evita duplicar por source_key.
 if(branchFromPanel()!=='serena'||c?.suc!==LOCAL)return 'omitido';
 try{
  const info=await request('libro',{},'serena');
  const since=Date.parse(info.cuenta?.initialized_at||'');
  if(info.cuenta?.store_id!=='romo:serena'||!info.cuenta?.initialized||!info.escrituraHabilitada||!Number.isFinite(since)||!closureEligible(c,'serena',since))return 'pendiente';
  const keys=info.cierres_acreditados;
  if(!Array.isArray(keys))return 'pendiente';
  if(keys.includes('romo:serena|'+c.turnoClave))return 'acreditado';
  const result=await request('sincronizar_cierre',closePayload(c),'serena');
  return result.ok===true?'acreditado':'pendiente';
 }catch(e){console.warn('Romo cierre pendiente de conciliar:',String(e?.message||e));return 'pendiente';}
}
function drawCandidates(){
 const root=$('romoAcumCierres');if(!root)return;root.replaceChildren();
 if(!state.ready||!state.initialized){root.textContent='Disponible después de confirmar el saldo inicial real.';return;}
 if(!state.candidates.length){root.textContent='No hay cierres pendientes de acreditar después del saldo inicial.';return;}
 for(const {c,eligible} of state.candidates.slice(0,100)){
  const line=document.createElement('div');line.className='row';
  const text=document.createElement('span');text.textContent=String(c.fechaOperativa||'Fecha sin verificar')+' · '+(Number.isSafeInteger(c.efectivoContado)?money(c.efectivoContado):'Sin arqueo confirmado')+' · '+(eligible?(c.diferenciaEfectivo===0?'Caja exacta':'Diferencia '+money(c.diferenciaEfectivo)+' · '+String(c.obs||'')):'Requiere revisión');
  line.append(text);
  if(eligible&&state.write){const b=document.createElement('button');b.type='button';b.className='sm';b.disabled=state.busy||!!state.pending;b.textContent='Acreditar cierre';b.onclick=()=>void confirmarCierre(c);line.append(b);}
  root.append(line);
 }
 if(state.candidates.length>100){const note=document.createElement('p');note.textContent='Mostrando los 100 cierres pendientes más recientes.';root.append(note);}
}

function draw(){
 if(!$('ukiAcumRoot'))return;
 $('ukiAcumBranch').value=state.branch;
 $('ukiAcumSucursalFija').textContent=BRANCHES[state.branch]||'Romo Sushi';
 $('ukiAcumSucursal').textContent=BRANCHES[state.branch];
 $('ukiAcumBalance').textContent=!state.ready?'—':state.initialized?money(state.balance):'Sin saldo inicial';
 $('ukiAcumMain').hidden=!state.ready||!state.write;
 drawCandidates();
 $('ukiAcumInit').hidden=state.initialized;
 $('ukiAcumOperations').hidden=!state.initialized;
 $('ukiAcumDestinationRow').hidden=true;
 for(const id of ['ukiAcumRefresh','ukiAcumStart','ukiAcumSave','ukiAcumHistoryRefresh','ukiAcumExcel','ukiAcumPDF','ukiAcumWhatsApp'])
   $(id).disabled=state.busy||(!state.ready&&id!=='ukiAcumRefresh')||(['ukiAcumStart','ukiAcumSave'].includes(id)&&!state.write)||(['ukiAcumExcel','ukiAcumPDF','ukiAcumWhatsApp'].includes(id)&&!state.initialized);
 const root=$('ukiAcumHistory');root.replaceChildren();
 if(!state.ready||!state.history.length){
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
 const branch=state.branch,loadRoot=state.operationRoot;
 state.busy=true;status('Consultando saldo e historial…');
 try{
  const root=state.operationRoot;
  const a=await request('libro',{},branch);
  if(!root?.isConnected||root!==state.operationRoot||branchFromPanel()!==branch)return;
  const cuenta=a.cuenta,history=a.movimientos,balance=Number(cuenta?.balance),credited=a.cierres_acreditados;
  if(cuenta?.store_id!=='romo:serena'||typeof cuenta.initialized!=='boolean'||typeof a.escrituraHabilitada!=='boolean'||!Number.isSafeInteger(balance)||balance<0||balance>1000000000||!Array.isArray(history)||history.length>250||history.some(x=>!x||!['apertura','entrada','gasto','retiro','cierre'].includes(x.tipo)||!Number.isSafeInteger(Number(x.monto))||!Number.isSafeInteger(Number(x.saldo_resultante)))||!Array.isArray(credited)||credited.some(k=>typeof k!=='string'||!/^romo:serena\|\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(k)))throw Error('Libro de Romo sin confirmar; no se muestran importes.');
  state.write=a.escrituraHabilitada;state.credited=credited;state.candidates=cuenta.initialized?reconcileCandidates(cuenta.initialized_at,credited):[];
  state.balance=balance;
  state.initialized=cuenta.initialized;
  state.initializedAt=cuenta.initialized_at||null;
  state.history=history;
  state.ready=true;
  if(state.pending)status('Existe una operación sin confirmar en esta sesión. Revisa el historial y conserva los mismos datos si reintentas.','error');
  else if(!state.write)status('Saldo e historial confirmados. Escritura deshabilitada por el servidor.','success');
  else status('✓ Efectivo acumulado actualizado. No se modificó ningún saldo al consultar.','success');
 }catch(e){state.ready=false;state.write=false;state.history=[];state.candidates=[];state.balance=0;status(String(e.message||e),'error');}
 finally{state.busy=false;draw();if(state.operationRoot?.isConnected&&!state.ready&&state.operationRoot!==loadRoot)void load();}
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
 if(state.busy||!state.ready||!state.write)return;
 let action,monto,concepto,responsable;
 try{
  action=first?'inicializar':$('ukiAcumType').value;
  monto=readAmount(first?'ukiAcumInitial':'ukiAcumAmount',first);
  concepto=readConcept(first?'ukiAcumInitialConcept':'ukiAcumConcept');
  responsable=String($('ukiAcumResponsable')?.value||'').trim();
  if(responsable.length<2||responsable.length>80)throw Error('Escribe el nombre del responsable (dueños autorizados).');
  if(!first&&!Object.hasOwn(ACTIONS,action))throw Error('Movimiento no autorizado.');
  if(state.pending&&state.pending!==JSON.stringify({action,monto,concepto,responsable}))throw Error('Hay una operación sin confirmar. Revisa el historial y no cambies los datos del reintento.');
  if(!confirm('ATENCIÓN: es DINERO REAL. ¿Confirmas '+money(monto)+' en '+BRANCHES[state.branch]+'? '+(first?'El saldo inicial debe incluir todo el efectivo ya acumulado de cierres anteriores.':'El movimiento se guardará una sola vez y quedará en el historial.')))return;
 }catch(e){status(String(e.message||e),'error');return;}
 const branch=state.branch;
 if(!state.nonce)state.nonce=crypto.randomUUID();
 state.pending=JSON.stringify({action,monto,concepto,responsable});
 let finalStatus='',finalKind='error';
 state.busy=true;draw();status('Registrando movimiento de efectivo…');
 try{
  const r=await request(action,{monto,concepto,responsable,op_key:state.nonce},branch);
  state.nonce=null;state.pending=null;
  if(branch!==state.branch)return;
  if(first){$('ukiAcumInitial').value='';$('ukiAcumInitialConcept').value='';}
  else{$('ukiAcumAmount').value='';$('ukiAcumConcept').value='';}
  finalStatus=r.duplicate?'✓ Movimiento ya registrado; no se duplicó el saldo.':'✓ Movimiento guardado correctamente.';finalKind='success';
 }catch(e){finalStatus=String(e.message||e)+' Revisa el historial antes de reintentar. No cambies el importe ni los datos.';}
 finally{state.busy=false;await load();if(finalStatus)status(finalStatus+(state.ready?'':' Saldo pendiente de actualizar.'),finalKind);}
}
function exportReport(kind){
 if(!state.ready||!state.initialized)return status('Primero comprueba tu acceso y el saldo inicial real.','error');
 const exporter=window.romoCajaAcumExportar;
 if(!exporter)return status('No está cargado el generador de informes.','error');
 const report={branch:state.branch,balance:state.balance,history:state.history,generated_at:new Date().toISOString()};
 try{
  if(kind==='excel')exporter.excel(report);
  else if(kind==='pdf')exporter.savePDF(report);
  else return exporter.whatsapp(report).then(v=>status(v==='cancelado'?'Se canceló compartir.':'✓ Documento preparado para compartir.','success')).catch(e=>status(String(e.message||e),'error'));
  status('✓ Archivo generado para guardar desde tu iPhone.','success');
 }catch(e){status(String(e.message||e),'error');}
}
function mount(){
 if(!$('ukiAcumRoot'))return;
 if(branchFromPanel()!=='serena')return;
 const root=$('ukiAcumRoot');if(state.operationRoot===root)return;
 state.operationRoot=root;state.branch='serena';state.ready=false;state.write=false;state.history=[];state.candidates=[];state.balance=0;
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
window.romoCajaAcumuladaVista=html;window.romoCajaAcumuladaMontar=mount;window.romoCajaAcumuladaRegistrarCierre=registrarCierreConfirmado;
// Consultar el saldo nunca genera escrituras automáticas.
})();