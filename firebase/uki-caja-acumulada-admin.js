/* Uki Sushi · Caja acumulada real, aislada de las ventas del turno.
   Su saldo se calcula en Neon con movimientos auditables. No reescribe pedidos ni cierres. */
(function(){
'use strict';
const BRANCHES={arica:'Regimiento Arica',serena:'La Serena'};
const ACTIONS={entrada:'Agregar dinero',gasto:'Registrar gasto',retiro:'Retirar efectivo',traspaso:'Traspasar a otro local'};
const TYPES={apertura:'Saldo inicial',cierre:'Cierre confirmado',ajuste_cierre:'Corrección de cierre',
 entrada:'Entrada',gasto:'Gasto',retiro:'Retiro',traspaso_salida:'Traspaso enviado',traspaso_entrada:'Traspaso recibido'};
const API='https://uki-sushi-inventario.vercel.app/api/uki-caja-acumulada-live';
const state={branch:'arica',balance:0,initialized:false,initializedAt:null,history:[],busy:false,ready:false,nonce:null,pendingClosures:[],markedClosures:[],revisiones:[]};
const $=id=>document.getElementById(id);
const money=v=>'$'+Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
const branchFromPanel=()=>typeof S!=='undefined'&&S?.suc==='Uki La Serena'?'serena':'arica';
const date=v=>new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',
 day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v));
const movimientoFechaChile=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',weekday:'long',day:'numeric',month:'long',year:'numeric'});
const movimientoHoraChile=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const primeraMayuscula=s=>{const value=String(s).replace(/^([^,]+),\s*(?=\d)/,'$1 ');return value.charAt(0).toLocaleUpperCase('es-CL')+value.slice(1);};
function fechaHoraMovimiento(v){
 if(v===null||v===undefined||v==='')return 'Fecha y hora sin registrar';
 const d=new Date(v);
 if(!Number.isFinite(d.getTime()))return 'Fecha y hora sin registrar';
 return primeraMayuscula(movimientoFechaChile.format(d))+' · '+movimientoHoraChile.format(d);
}
function fechaOperativaLegible(raw){
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
 const [y,m,d]=raw.split('-').map(Number),utc=new Date(Date.UTC(y,m-1,d,12));
 if(utc.getUTCFullYear()!==y||utc.getUTCMonth()+1!==m||utc.getUTCDate()!==d)return null;
 return primeraMayuscula(movimientoFechaChile.format(utc));
}
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
 '<details class="card" open><summary><b>Cierres pendientes de acreditar</b></summary><p class="muted">Muestra cierres exactos o con diferencia que todavía no aparecen en Efectivo acumulado. Si el dinero ya se agregó manualmente, quita el cierre de pendientes sin borrar el cierre ni alterar saldos.</p><div id="ukiAcumPendientes"></div></details>'+ 
 '<details class="card"><summary><b>Cierres marcados como ya incluidos manualmente</b></summary><p class="muted">Estos cierres se conservan en el historial y no se vuelven a acreditar. Puedes restaurar uno si fue marcado por error.</p><div id="ukiAcumExcluidos"></div></details>'+
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
// Solo cierres guardados posteriores al saldo inicial, con conteo físico.
function closureEligible(c,branch,initMs){
 const cash=Number(c?.efectivo),counted=c?.efectivoContado,diff=c?.diferenciaEfectivo;
 const ms=Number(c?.fechaMs);
 return c?.suc===(branch==='arica'?'Uki Regimiento Arica':'Uki La Serena') &&
  Number.isSafeInteger(ms)&&ms>initMs&&ms<=Date.now()+20*60000&&
  Number.isSafeInteger(cash)&&Math.abs(cash)<=100000000&&
  Number.isSafeInteger(counted)&&counted>=0&&counted<=100000000&&
  Number.isSafeInteger(diff)&&counted-cash===diff&&
  (diff===0||typeof c.obs==='string'&&c.obs.trim().length>=3)&&
  /^\d{4}-\d{2}-\d{2}$/.test(String(c.fechaOperativa||''))&&
  typeof c.resp==='string'&&c.resp.trim().length>=2;
}
function closePayload(c,branch){
 return {monto:c.efectivoContado,efectivo_contado:c.efectivoContado,efectivo_esperado:c.efectivo,
  diferencia_efectivo:c.diferenciaEfectivo,observacion:String(c.obs||'').trim().slice(0,700),confirmado:true,
  fecha_operativa:c.fechaOperativa,fecha_cierre_ms:c.fechaMs,
  cierre_clave:'uki|'+branch+'|'+c.fechaMs,
  responsable:String(c.resp).trim().slice(0,80),op_key:crypto.randomUUID()};
}
async function reconcileClosures(branch,initializedAt,excluded=new Set()){
 const since=Date.parse(initializedAt||'');
 if(!Number.isFinite(since)||typeof S==='undefined'||S?.suc!==
  (branch==='arica'?'Uki Regimiento Arica':'Uki La Serena'))return {synced:0,skipped:0,failed:0};
 const all=(S.cierres||[]).filter(c=>c?.suc===S.suc&&Number(c?.fechaMs)>since);
 let synced=0,skipped=0,failed=0;
 for(const c of all){
  if(excluded.has('uki|'+branch+'|'+c.fechaMs))continue;
  if(!closureEligible(c,branch,since)){skipped++;continue}
  // Los cierres antiguos con diferencia pueden haberse incorporado manualmente.
  // Solo se acreditan previa confirmación; nunca se vuelven a sumar solos.
  if(c.diferenciaEfectivo!==0)continue;
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
  const listado=await request('movimientos',{},branch);
  if((listado.revisiones||[]).some(x=>x.cierre_clave==='uki|'+branch+'|'+c.fechaMs&&x.estado==='ya_incluido'))return;
  await request('sincronizar_cierre',closePayload(c,branch),branch);
 }catch(e){
  // No bloquear el cierre real: se volverá a conciliar al abrir Caja acumulada.
  console.warn('Uki caja acumulada: cierre en cola de conciliación',String(e?.message||e));
 }
}

// Los cierres guardados siguen intactos: esta revisión solo explica por qué
// falta la acreditación y permite conciliar el efectivo físico con confirmación.
function problemasCierre(c,branch,initMs){
 const issues=[];
 const local=branch==='arica'?'Uki Regimiento Arica':'Uki La Serena';
 if(c?.suc!==local)issues.push('Este cierre no pertenece a la sucursal actual.');
 const ms=c?.fechaMs;
 if(!Number.isSafeInteger(ms)||ms<=initMs||ms>Date.now()+20*60000)
  issues.push('La fecha de cierre no es válida o el cierre ya estaba comprendido en el saldo inicial.');
 const dia=String(c?.fechaOperativa||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dia)||
   !Number.isFinite(Date.parse(dia+'T12:00:00Z'))||
   new Date(dia+'T12:00:00Z').toISOString().slice(0,10)!==dia)
  issues.push('La fecha del turno necesita revisión.');
 const esperado=c?.efectivo;
 if(!Number.isSafeInteger(esperado)||Math.abs(esperado)>100000000)
  issues.push('El cierre no contiene un efectivo esperado válido.');
 const contado=c?.efectivoContado;
 if(!Number.isSafeInteger(contado)||contado<0||contado>100000000)
  issues.push('Falta confirmar cuánto efectivo físico quedó realmente.');
 else if(Number.isSafeInteger(esperado) &&
         (!Number.isSafeInteger(c?.diferenciaEfectivo)||contado-esperado!==c.diferenciaEfectivo))
  issues.push('La diferencia guardada no coincide con el efectivo contado.');
 const dif=Number.isSafeInteger(contado)&&Number.isSafeInteger(esperado)?contado-esperado:null;
 if(dif!==null&&dif!==0&&String(c?.obs||'').trim().length<3)
  issues.push('Falta una observación para explicar la diferencia.');
 if(String(c?.resp||'').trim().length<2)
  issues.push('Falta el nombre del responsable del cierre.');
 return issues;
}
function conciliacionPosible(c,branch,initMs){
 const local=branch==='arica'?'Uki Regimiento Arica':'Uki La Serena';
 const day=String(c?.fechaOperativa||'');
 const ms=c?.fechaMs;
 return c?.suc===local&&Number.isSafeInteger(ms)&&ms>initMs&&ms<=Date.now()+20*60000&&
   /^\d{4}-\d{2}-\d{2}$/.test(day)&&
   Number.isFinite(Date.parse(day+'T12:00:00Z'))&&
   new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day&&
   Number.isSafeInteger(c?.efectivo)&&Math.abs(c.efectivo)<=100000000;
}
async function revisarYConciliarCierre(c){
 if(state.busy||!state.ready||!state.initialized||branchFromPanel()!==state.branch)return;
 const branch=state.branch,inicio=Date.parse(state.initializedAt||'');
 const issues=problemasCierre(c,branch,inicio);
 if(!conciliacionPosible(c,branch,inicio)){
  alert('Este cierre necesita revisar sus datos antes de acreditarlo:\n- '+issues.join('\n- ')+
   '\nEl cierre histórico y el dinero no se modificarán.');
  return;
 }
 const nota=issues.length?'Datos a revisar:\n- '+issues.join('\n- '):
   'Los datos registrados están completos.';
 alert('Turno '+fechaOperativaLegible(c.fechaOperativa)+'\n'+nota+
   '\nLa conciliación no cambiará el cierre original.');
 const previo=Number.isSafeInteger(c.efectivoContado)&&c.efectivoContado>=0?
  String(c.efectivoContado):'';
 const raw=prompt('¿Cuánto dinero FÍSICO quedó de este cierre? Verifica el conteo real antes de continuar.',previo);
 if(raw===null)return;
 const texto=raw.trim();
 if(!/^\d{1,9}$/.test(texto)){status('Ingresa el efectivo físico contado, en pesos enteros.','error');return;}
 const contado=Number(texto);
 if(!Number.isSafeInteger(contado)||contado>100000000){status('Efectivo contado inválido.','error');return;}
 const esperado=c.efectivo,diferencia=contado-esperado;
 let responsable=String(c.resp||'').trim();
 if(responsable.length<2){
  const nuevo=prompt('Nombre de quien revisa y acredita el cierre:','');
  if(nuevo===null)return;
  responsable=nuevo.trim();
 }
 if(responsable.length<2||responsable.length>80){status('Nombre del responsable inválido.','error');return;}
 let observacion=String(c.obs||'').trim();
 if(diferencia!==0){
  const sugerida=observacion.length>=3?observacion:'';
  const nueva=prompt('Hay una diferencia de '+money(diferencia)+'. Explica el motivo para registrar la conciliación:',sugerida);
  if(nueva===null)return;
  observacion=nueva.trim();
  if(observacion.length<3){status('Escribe la observación de la diferencia.','error');return;}
 }
 if(!confirm('CONFIRMACIÓN DE EFECTIVO REAL\nTurno: '+String(c.fechaOperativa)+
   '\nEsperado: '+money(esperado)+'\nContado: '+money(contado)+
   '\nDiferencia: '+money(diferencia)+
   '\n¿Confirmas que este importe NO está incluido en el saldo inicial ni en una entrada manual?'))return;
 const payload={
  monto:contado,efectivo_contado:contado,efectivo_esperado:esperado,
  diferencia_efectivo:diferencia,observacion:observacion.slice(0,700),
  confirmado:true,fecha_operativa:c.fechaOperativa,fecha_cierre_ms:c.fechaMs,
  cierre_clave:'uki|'+branch+'|'+c.fechaMs,
  responsable,op_key:crypto.randomUUID()
 };
 state.busy=true;draw();status('Conciliando efectivo contado, sin modificar el cierre de ventas…');
 let msg='';
 try{
  const resultado=await request('sincronizar_cierre',payload,branch);
  msg=resultado.duplicate?'✓ El cierre ya estaba acreditado. No se sumó dos veces.':
    '✓ Efectivo conciliado y registrado una sola vez.';
 }catch(e){msg='No se acreditó el cierre: '+String(e?.message||e);}
 finally{state.busy=false;await load();status(msg,/^✓/.test(msg)?'success':'error');}
}

async function acreditarPendiente(c){
 if(state.busy||!state.ready||!state.initialized||branchFromPanel()!==state.branch)return;
 const branch=state.branch;
 if(!closureEligible(c,branch,Date.parse(state.initializedAt||'')))return;
 if(!confirm('¿Confirmas que '+money(c.efectivoContado)+' de este cierre aún NO está incluido en el saldo inicial ni en una entrada manual?'))return;
 state.busy=true;draw();
 try{await request('sincronizar_cierre',closePayload(c,branch),branch);}
 catch(e){status(String(e.message||e),'error');}
 finally{state.busy=false;await load();}
}

async function revisarPendiente(c,estado){
 if(state.busy||!state.ready||!state.initialized||branchFromPanel()!==state.branch)return;
 const clave='uki|'+state.branch+'|'+c.fechaMs;
 const marcado=estado==='ya_incluido';
 const pregunta=marcado?
  '¿Confirmas que el dinero de este cierre YA SE AGREGÓ MANUALMENTE? Se quitará de pendientes sin alterar el saldo ni borrar el cierre.':
  '¿Restaurar este cierre a pendientes? NO se agregará dinero automáticamente por esta acción.';
 if(!confirm(pregunta))return;
 const responsable=String(prompt('Nombre de quien confirma esta revisión:','')||'').trim();
 if(responsable.length<2||responsable.length>80){status('Escribe un responsable válido para guardar la revisión.','error');return;}
 const motivo=marcado?
  'Cierre ya incorporado manualmente al saldo acumulado':
  'Restaurar cierre a pendientes tras revisión';
 const branch=state.branch;
 state.busy=true;draw();status('Registrando revisión sin modificar efectivo…');
 try{
  await request('marcar_revision',{cierre_clave:clave,estado,responsable,motivo,op_key:crypto.randomUUID()},branch);
  state.busy=false;await load();
  status(marcado?'✓ Cierre quitado de pendientes. El dinero y el historial siguen intactos.':'✓ Cierre restaurado para conciliación.','success');
 }catch(e){state.busy=false;await load();status(String(e.message||e),'error');}
}
function drawPendientes(){
 const root=$('ukiAcumPendientes'),archived=$('ukiAcumExcluidos');
 if(!root||!archived)return;
 root.replaceChildren();archived.replaceChildren();
 function renderRow(target,c,excluded){
  const eligible=closureEligible(c,state.branch,Date.parse(state.initializedAt||''));
  const line=document.createElement('div');line.className='row';
  line.style.cssText='display:flex;flex-wrap:wrap;gap:9px;align-items:flex-start';
  const desc=document.createElement('span');desc.style.cssText='flex:1 1 200px;min-width:0;overflow-wrap:anywhere';
  const turno=fechaOperativaLegible(c.fechaOperativa)||String(c.fechaOperativa||'Fecha del turno sin registrar');
  const diferencia=Number.isSafeInteger(c.diferenciaEfectivo)?' · Diferencia '+money(c.diferenciaEfectivo):' · Sin diferencia validada';
  const monto=Number.isSafeInteger(c.efectivoContado)?money(c.efectivoContado):'Sin conteo confirmado';
  const problemas=eligible?[]:problemasCierre(c,state.branch,Date.parse(state.initializedAt||''));
  desc.textContent='Turno: '+turno+' · Registrado: '+fechaHoraMovimiento(c.fechaMs)+' · Contado '+monto+diferencia+(c.obs?' · '+String(c.obs):'')+(problemas.length?' · Revisar: '+problemas.join(' '):'');
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:6px;flex-wrap:wrap;flex:0 1 auto';
  const b=document.createElement('button');b.type='button';b.className='sm';b.disabled=state.busy;
  if(excluded){
   b.textContent='Restaurar a pendientes';b.onclick=()=>void revisarPendiente(c,'pendiente');
  }else{
   b.textContent='Ya ingresado manualmente';b.onclick=()=>void revisarPendiente(c,'ya_incluido');
   const add=document.createElement('button');add.type='button';add.className='sm';
   add.textContent=eligible?'Acreditar':'Revisar y acreditar';
   add.disabled=state.busy;
   add.onclick=()=>eligible?void acreditarPendiente(c):void revisarYConciliarCierre(c);
   actions.append(add);
  }
  actions.append(b);line.append(desc,actions);target.append(line);
 }
 for(const c of state.pendingClosures)renderRow(root,c,false);
 for(const c of state.markedClosures)renderRow(archived,c,true);
 if(!state.pendingClosures.length)root.textContent='Sin cierres pendientes de acreditar.';
 if(!state.markedClosures.length)archived.textContent='No hay cierres marcados manualmente.';
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
 drawPendientes();
 const root=$('ukiAcumHistory');root.replaceChildren();
 if(!state.history.length){
  const p=document.createElement('p');p.className='muted';
  p.textContent=state.ready?'Aún no hay movimientos en esta sucursal.':'Historial no disponible.';
  root.append(p);return;
 }
 for(const x of state.history){
  const row=document.createElement('div');row.className='row';
  const left=document.createElement('div'),title=document.createElement('b'),info=document.createElement('small'),sum=document.createElement('b');
  const registrado=document.createElement('small');
  title.textContent=TYPES[x.tipo]||String(x.tipo);
  registrado.style.cssText='display:block;font-weight:700;margin:5px 0 3px;line-height:1.45';
  registrado.textContent='📅 Registrado: '+fechaHoraMovimiento(x.creado_en);
  const diaTurno=['cierre','ajuste_cierre'].includes(x.tipo)?fechaOperativaLegible(x.fecha_operativa):null;
  if(diaTurno){
   const turno=document.createElement('small');
   turno.style.cssText='display:block;margin:3px 0;font-weight:700';
   turno.textContent='Turno: '+diaTurno;
   left.append(title,turno,registrado);
  }else left.append(title,registrado);
  info.style.display='block';info.textContent=String(x.concepto||'Sin concepto')+' · '+String(x.responsable||'Responsable no registrado');
  sum.textContent=(Number(x.monto)>0?'+':'')+money(x.monto);
  left.append(info);row.append(left,sum);root.append(row);
 }
}
async function load(){
 if(state.busy)return;
 const branch=state.branch;
 state.busy=true;status('Consultando saldo e historial…');
 try{
  let [a,m]=await Promise.all([request('saldo',{},branch),request('movimientos',{},branch)]);
  if(branch!==state.branch)return;
  // Consultar no mueve efectivo. Los cierres anteriores que falten
  // se muestran para acreditación explícita: evita duplicar entradas manuales.
  if(branch!==state.branch)return;
  state.balance=Number(a.cuenta.balance)||0;
  state.initialized=a.cuenta.initialized===true;
  state.initializedAt=a.cuenta.initialized_at||null;
  state.history=Array.isArray(m.movimientos)?m.movimientos:[];
  const credited=new Set(Array.isArray(m.cierres_acreditados)?m.cierres_acreditados:[]);
  state.revisiones=Array.isArray(m.revisiones)?m.revisiones:[];
  const excluidos=new Set(state.revisiones.filter(x=>x.estado==='ya_incluido').map(x=>x.cierre_clave));
  const inicio=Date.parse(state.initializedAt||'');
  const branchName=branch==='arica'?'Uki Regimiento Arica':'Uki La Serena';
  const candidates=state.initialized&&Array.isArray(m.cierres_acreditados)?
    (S.cierres||[]).filter(c=>c?.suc===branchName&&Number.isSafeInteger(c.fechaMs)&&c.fechaMs>inicio&&c.fechaMs<=Date.now()+20*60000&&!credited.has('uki|'+branch+'|'+c.fechaMs)).sort((a,b)=>b.fechaMs-a.fechaMs):[];
  state.pendingClosures=candidates.filter(c=>!excluidos.has('uki|'+branch+'|'+c.fechaMs));
  state.markedClosures=candidates.filter(c=>excluidos.has('uki|'+branch+'|'+c.fechaMs));
  state.ready=true;
  if(state.pendingClosures.length)status(state.pendingClosures.length+' cierre(s) pendientes de acreditar. Revisa antes de sumar: pueden estar incluidos manualmente.','error');
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