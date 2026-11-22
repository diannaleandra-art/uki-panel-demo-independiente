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
const state={branch:'serena',balance:0,initialized:false,initializedAt:null,history:[],busy:false,ready:false,nonce:null,pending:null,write:false,credited:[],candidates:[],marked:[],revisiones:[],operationRoot:null};
const $=id=>document.getElementById(id);
const money=v=>'$'+Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
const branchFromPanel=()=>typeof S!=='undefined'&&S?.suc===LOCAL?'serena':null;
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
// Calendario del turno, sin cambiar el libro contable ni la hora de auditoría.
const diaChileFormato=new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'});
function diaMovimientoRomo(m){
 const ref=/^romo:serena\|(\d{4}-\d{2}-\d{2})@/.exec(String(m?.source_key||''));
 if(['cierre','ajuste_cierre'].includes(m?.tipo)&&ref)return ref[1];
 if(typeof m?.fecha_operativa==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(m.fecha_operativa))
  return m.fecha_operativa;
 const fecha=new Date(m?.creado_en);
 if(!Number.isFinite(fecha.getTime()))return '';
 const parts=diaChileFormato.formatToParts(fecha);
 const part=k=>parts.find(v=>v.type===k)?.value||'';
 return part('year')+'-'+part('month')+'-'+part('day');
}
function ordenarCalendarioRomo(a,b){
 const dayA=diaMovimientoRomo(a),dayB=diaMovimientoRomo(b);
 if(dayA!==dayB)return dayA<dayB?1:-1;
 const aTime=Date.parse(a?.creado_en)||0,bTime=Date.parse(b?.creado_en)||0;
 if(aTime!==bTime)return bTime-aTime;
 return Number(b?.id||0)-Number(a?.id||0);
}
function resumenPendientesRomo(candidatos){
 const unique=[...new Set(candidatos.map(x=>
  fechaOperativaLegible(x.c.fechaOperativa)||String(x.c.fechaOperativa||'Fecha no identificada')))];
 return unique.slice(0,8).join('; ')+(unique.length>8?
  '; y '+(unique.length-8)+' fecha(s) más (ver lista)':'');
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
 '<div class="card"><h3>Cierres por conciliar</h3><p class="muted">Revisa los cierres anteriores antes de acreditar. Si ya agregaste el dinero manualmente, quita ese cierre de pendientes sin modificar el saldo ni eliminar su historial.</p><div id="romoAcumCierres"></div></div>'+ 
 '<details class="card"><summary><b>Cierres ya incluidos manualmente</b></summary><p class="muted">Conservados para auditoría, sin generar un nuevo abono. Puedes restaurarlos a pendientes.</p><div id="romoAcumExcluidos"></div></details>'+
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
function reconcileCandidates(initializedAt,credited,revisiones=[]){
 const since=Date.parse(initializedAt||'');
 if(!Number.isFinite(since))return [];
 const all=(S.cierres||[]).filter(c=>c?.suc===LOCAL&&Number(c.fechaMs)>since&&!credited.includes('romo:serena|'+c.turnoClave));
 const counts=new Map();for(const c of all)counts.set(c.turnoClave,(counts.get(c.turnoClave)||0)+1);
 const excluidos=new Set(revisiones.filter(x=>x.estado==='ya_incluido').map(x=>x.source_key));
 return all.map(c=>({c,eligible:counts.get(c.turnoClave)===1&&closureEligible(c,'serena',since),excluded:excluidos.has('romo:serena|'+c.turnoClave)})).sort((a,b)=>b.c.fechaMs-a.c.fechaMs);
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
  if((info.revisiones||[]).some(x=>x.source_key==='romo:serena|'+c.turnoClave&&x.estado==='ya_incluido'))return 'pendiente';
  const result=await request('sincronizar_cierre',closePayload(c),'serena');
  return result.ok===true?'acreditado':'pendiente';
 }catch(e){console.warn('Romo cierre pendiente de conciliar:',String(e?.message||e));return 'pendiente';}
}

async function revisarPendiente(c,estado){
 if(state.busy||!state.ready||!state.write||state.pending||!state.initialized)return;
 if(branchFromPanel()!=='serena')return;
 const excluido=estado==='ya_incluido';
 if(!confirm(excluido?
  '¿Confirmas que este efectivo de Romo YA FUE AGREGADO MANUALMENTE? Se quitará de pendientes sin mover dinero ni borrar el cierre.':
  '¿Restaurar este cierre de Romo a pendientes? No se agregará ningún dinero por restaurarlo.'))return;
 const responsable=String(prompt('Nombre de quien confirma la revisión:','')||'').trim();
 if(responsable.length<2||responsable.length>80){status('Escribe el responsable de esta revisión.','error');return;}
 const motivo=excluido?'Cierre ya incorporado manualmente al saldo acumulado':'Restaurar cierre a pendientes tras revisión';
 const root=state.operationRoot;state.busy=true;draw();status('Guardando revisión de Romo sin modificar efectivo…');
 let message='';
 try{
  await request('marcar_revision',{source_key:'romo:serena|'+c.turnoClave,estado,motivo,responsable,op_key:crypto.randomUUID()},'serena');
  message=excluido?'✓ Cierre quitado de pendientes sin modificar dinero.':'✓ Cierre restaurado para conciliación.';
 }catch(e){message='No se confirmó la revisión: '+String(e.message||e);}
 finally{state.busy=false;if(root?.isConnected){await load();status(message);}}
}
function motivosRevisionRomo(c,initMs){
 const issues=[];
 const ms=c?.fechaMs,key=String(c?.turnoClave||'');
 if(c?.suc!==LOCAL)issues.push('No corresponde a Romo La Serena.');
 if(!Number.isSafeInteger(ms)||ms<=initMs||ms>Date.now()+20*60000)
  issues.push('La fecha de cierre necesita revisión.');
 if(!/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(key)||
    !key.startsWith(String(c?.fechaOperativa||'')+'@'))
  issues.push('La referencia del turno no está confirmada.');
 if(!Number.isSafeInteger(c?.efectivo)||Math.abs(c.efectivo)>100000000)
  issues.push('No hay efectivo esperado válido.');
 if(!Number.isSafeInteger(c?.efectivoContado)||c.efectivoContado<0||c.efectivoContado>100000000)
  issues.push('Falta efectivo físicamente contado.');
 else if(Number.isSafeInteger(c?.efectivo)&&(!Number.isSafeInteger(c?.diferenciaEfectivo)||
          c.efectivoContado-c.efectivo!==c.diferenciaEfectivo))
  issues.push('El efectivo contado no coincide con la diferencia del cierre.');
 if(c?.diferenciaEfectivo!==0&&String(c?.obs||'').trim().length<3)
  issues.push('Falta explicación de la diferencia.');
 if(c?.rectificacion||(c?.rectificaciones||[]).length)
  issues.push('Cierre con rectificaciones: requiere revisión antes de acreditar.');
 if(String(c?.resp||'').trim().length<2)
  issues.push('Falta identificar al responsable.');
 return issues;
}
function drawCandidates(){
 const root=$('romoAcumCierres'),archived=$('romoAcumExcluidos');if(!root||!archived)return;
 root.replaceChildren();archived.replaceChildren();
 if(!state.ready||!state.initialized){
  root.textContent='Disponible después de confirmar el saldo inicial real.';return;
 }
 function createRow(target,c,eligible,excluded){
  const line=document.createElement('div');line.className='row';
  line.style.cssText='display:flex;flex-wrap:wrap;gap:9px;align-items:flex-start';
  const desc=document.createElement('span');desc.style.cssText='flex:1 1 200px;min-width:0;overflow-wrap:anywhere';
  const registrado=fechaHoraMovimiento(c.fechaMs);
  const contado=Number.isSafeInteger(c.efectivoContado)?money(c.efectivoContado):'Sin arqueo confirmado';
  desc.textContent='Turno: '+(fechaOperativaLegible(c.fechaOperativa)||String(c.fechaOperativa||''))+
    ' · Registrado: '+registrado+' · Contado '+contado+
    (Number.isSafeInteger(c.diferenciaEfectivo)?' · Diferencia '+money(c.diferenciaEfectivo):'')+
    (c.obs?' · '+String(c.obs):'')+(eligible?'':' · Revisar: '+motivosRevisionRomo(c,Date.parse(state.initializedAt||'')).join(' '));
  line.append(desc);
  if(!eligible&&!excluded){
   const issues=motivosRevisionRomo(c,Date.parse(state.initializedAt||''));
   const revisar=document.createElement('button');revisar.type='button';revisar.className='sm';
   revisar.textContent='Revisar cierre';revisar.onclick=()=>alert(
     'No se puede acreditar este cierre hasta verificar:\\n- '+
     (issues.length?issues.join('\\n- '):'El servidor requiere confirmar la constancia del cierre.')+
     '\\nEl dinero y el cierre original no se han modificado.');
   line.append(revisar);
  }
  if(state.write){
   const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:5px';
   if(!excluded&&eligible){
    const b=document.createElement('button');b.type='button';b.className='sm';
    b.disabled=state.busy||!!state.pending;b.textContent='Acreditar cierre';
    b.onclick=()=>void confirmarCierre(c);actions.append(b);
   }
   const b=document.createElement('button');b.type='button';b.className='sm';
   b.disabled=state.busy||!!state.pending;b.textContent=excluded?'Restaurar a pendientes':'Ya ingresado manualmente';
   b.onclick=()=>void revisarPendiente(c,excluded?'pendiente':'ya_incluido');
   actions.append(b);line.append(actions);
  }
  target.append(line);
 }
 for(const {c,eligible} of state.candidates.slice(0,100))createRow(root,c,eligible,false);
 for(const {c,eligible} of state.marked.slice(0,100))createRow(archived,c,eligible,true);
 if(!state.candidates.length)root.textContent='No hay cierres pendientes de acreditar después del saldo inicial.';
 if(!state.marked.length)archived.textContent='No hay cierres marcados como incluidos manualmente.';
 if(state.candidates.length>100||state.marked.length>100){
  const p=document.createElement('p');p.textContent='Se muestran los 100 cierres más recientes de cada lista.';
  root.append(p);
 }
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
  const registrado=document.createElement('small');
  title.textContent=TYPES[x.tipo]||String(x.tipo);
  registrado.style.cssText='display:block;font-weight:700;margin:5px 0 3px;line-height:1.45';
  registrado.textContent='📅 Registrado: '+fechaHoraMovimiento(x.creado_en);
  const diaTurno=['cierre','ajuste_cierre'].includes(x.tipo)?fechaOperativaLegible((/^romo:serena\|(\d{4}-\d{2}-\d{2})@/.exec(String(x.source_key||''))||[])[1]):null;
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
 const branch=state.branch,loadRoot=state.operationRoot;
 state.busy=true;status('Consultando saldo e historial…');
 try{
  const root=state.operationRoot;
  const a=await request('libro',{},branch);
  if(!root?.isConnected||root!==state.operationRoot||branchFromPanel()!==branch)return;
  const cuenta=a.cuenta,history=a.movimientos,balance=Number(cuenta?.balance),credited=a.cierres_acreditados;
  if(cuenta?.store_id!=='romo:serena'||typeof cuenta.initialized!=='boolean'||typeof a.escrituraHabilitada!=='boolean'||!Number.isSafeInteger(balance)||balance<0||balance>1000000000||!Array.isArray(history)||history.length>250||history.some(x=>!x||!['apertura','entrada','gasto','retiro','cierre'].includes(x.tipo)||!Number.isSafeInteger(Number(x.monto))||!Number.isSafeInteger(Number(x.saldo_resultante)))||!Array.isArray(credited)||credited.some(k=>typeof k!=='string'||!/^romo:serena\|\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(k)))throw Error('Libro de Romo sin confirmar; no se muestran importes.');
  if(!Array.isArray(a.revisiones)||a.revisiones.some(x=>typeof x.source_key!=='string'||!['ya_incluido','pendiente'].includes(x.estado)))throw Error('No se pudo verificar el estado de revisiones de Romo.');
  state.write=a.escrituraHabilitada;state.credited=credited;
  state.revisiones=a.revisiones;
  const disponibles=cuenta.initialized?reconcileCandidates(cuenta.initialized_at,credited,a.revisiones):[];
  state.candidates=disponibles.filter(x=>!x.excluded)
   .sort((a,b)=>String(a.c.fechaOperativa||'')===String(b.c.fechaOperativa||'')?
     b.c.fechaMs-a.c.fechaMs:String(a.c.fechaOperativa||'')<String(b.c.fechaOperativa||'')?1:-1);
  state.marked=disponibles.filter(x=>x.excluded)
   .sort((a,b)=>String(a.c.fechaOperativa||'')===String(b.c.fechaOperativa||'')?
     b.c.fechaMs-a.c.fechaMs:String(a.c.fechaOperativa||'')<String(b.c.fechaOperativa||'')?1:-1);
  state.balance=balance;
  state.initialized=cuenta.initialized;
  state.initializedAt=cuenta.initialized_at||null;
  state.history=history.slice().sort(ordenarCalendarioRomo);
  state.ready=true;
  const fechas=state.candidates.length?' Cierre(s) pendientes de acreditar ('+
   state.candidates.length+'). Turno(s): '+resumenPendientesRomo(state.candidates)+'.':'';
  if(state.pending)status('Existe una operación sin confirmar en esta sesión. Revisa el historial.'+fechas,'error');
  else if(state.candidates.length)status('⚠'+fechas+
   (state.write?' Revisa si ya ingresaste ese efectivo manualmente.':' Escritura no habilitada.'),'error');
  else if(!state.write)status('Saldo e historial confirmados. Escritura deshabilitada por el servidor.','success');
  else status('✓ Efectivo acumulado actualizado. No se modificó ningún saldo al consultar.','success');
 }catch(e){state.ready=false;state.write=false;state.history=[];state.candidates=[];state.marked=[];state.balance=0;status(String(e.message||e),'error');}
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