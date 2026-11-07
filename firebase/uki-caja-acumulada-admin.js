/* Uki Sushi · Caja acumulada en efectivo · preparada para pruebas.
   No modifica S.cierres ni S.pedidos ni la caja real. */
(function(){
'use strict';
const BRANCHES={arica:'Regimiento Arica',serena:'La Serena'};
const ACTIONS={entrada:'Agregar dinero',gasto:'Registrar gasto',retiro:'Retirar efectivo',traspaso:'Traspasar a otro local'};
const TYPES={apertura:'Saldo inicial',cierre:'Cierre confirmado',ajuste_cierre:'Corrección de cierre',
 entrada:'Entrada',gasto:'Gasto',retiro:'Retiro',traspaso_salida:'Traspaso enviado',traspaso_entrada:'Traspaso recibido'};
const API=window.UKI_CAJA_ACUM_QA_API||'';
const state={branch:'arica',balance:0,initialized:false,history:[],busy:false,ready:false,nonce:null};
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
 '<p class="mini-help"><b>SOLO PRUEBAS:</b> este saldo no representa el efectivo real ni modifica los cierres.</p>'+
 '<label for="ukiAcumBranch">Sucursal</label>'+
 '<select id="ukiAcumBranch"><option value="arica">Regimiento Arica</option><option value="serena">La Serena</option></select>'+
 '<div class="kpi" style="margin:12px 0"><span>Saldo acumulado · <b id="ukiAcumSucursal"></b></span><strong id="ukiAcumBalance">—</strong></div>'+
 '<p id="ukiAcumStatus" role="status" class="mini-help">Comprobando autorización administrativa…</p>'+
 '<button type="button" id="ukiAcumRefresh" class="sm">Actualizar saldo</button>'+
 '<div id="ukiAcumMain" hidden>'+
  '<div id="ukiAcumInit">'+
   '<p class="muted">Solo la administradora puede iniciar con un saldo físicamente contado.</p>'+
   '<label for="ukiAcumInitial">Saldo inicial contado</label><input id="ukiAcumInitial" type="number" min="0" max="100000000" step="1" inputmode="numeric">'+
   '<label for="ukiAcumInitialConcept">Concepto</label><input id="ukiAcumInitialConcept" maxlength="240" placeholder="Ej.: conteo al iniciar el control">'+
   '<button type="button" id="ukiAcumStart" class="big">Registrar saldo inicial de prueba</button>'+
  '</div>'+
  '<div id="ukiAcumOperations" hidden>'+
   '<label for="ukiAcumType">Movimiento</label><select id="ukiAcumType">'+Object.entries(ACTIONS).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select>'+
   '<label for="ukiAcumAmount">Monto en pesos</label><input id="ukiAcumAmount" type="number" min="1" max="100000000" step="1" inputmode="numeric">'+
   '<label for="ukiAcumConcept">Concepto o motivo</label><input id="ukiAcumConcept" maxlength="240" placeholder="Ej.: compra de mercadería">'+
   '<div id="ukiAcumDestinationRow" hidden><label for="ukiAcumDestination">Sucursal que recibe</label>'+
   '<select id="ukiAcumDestination"><option value="serena">La Serena</option><option value="arica">Regimiento Arica</option></select></div>'+
   '<button type="button" id="ukiAcumSave" class="big">Registrar movimiento de prueba</button>'+
   '<p class="muted">Si el gasto ya está descontado del cierre, NO se registra nuevamente aquí.</p>'+
  '</div>'+
 '</div>'+
 '</div>'+
 '<details class="card" open><summary><b>📖 Historial de Caja acumulada en efectivo</b></summary>'+
 '<button type="button" id="ukiAcumHistoryRefresh" class="sm">Actualizar historial</button>'+
 '<div id="ukiAcumHistory"></div></details>'+
 '<p class="muted">Los cierres antiguos no se acumulan sin reconciliar el dinero real. Las correcciones aportan solo la diferencia.</p>';
}
async function request(action,extra={},branch=state.branch){
 if(!API)throw Error('Caja acumulada aún no conectada. Esta función sigue en preparación.');
 const token=await window.ukiInventarioToken?.();
 if(!token)throw Error('Inicia sesión Google con la cuenta autorizada para administración.');
 const response=await fetch(API,{method:'POST',cache:'no-store',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({branch,action,...extra})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.ok)throw Error(data.error||'No se pudo consultar la caja de prueba.');
 return data;
}
function draw(){
 if(!$('ukiAcumRoot'))return;
 $('ukiAcumBranch').value=state.branch;
 $('ukiAcumSucursal').textContent=BRANCHES[state.branch];
 $('ukiAcumBalance').textContent=state.ready&&state.initialized?money(state.balance):'Sin saldo inicial';
 $('ukiAcumMain').hidden=!state.ready;
 $('ukiAcumInit').hidden=state.initialized;
 $('ukiAcumOperations').hidden=!state.initialized;
 $('ukiAcumDestination').value=state.branch==='arica'?'serena':'arica';
 $('ukiAcumDestinationRow').hidden=$('ukiAcumType').value!=='traspaso';
 for(const id of ['ukiAcumRefresh','ukiAcumStart','ukiAcumSave','ukiAcumHistoryRefresh'])
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
  info.style.display='block';info.textContent=x.concepto+' · '+date(x.creado_en);
  sum.textContent=(Number(x.monto)>0?'+':'')+money(x.monto);
  left.append(title,info);row.append(left,sum);root.append(row);
 }
}
async function load(){
 if(state.busy)return;
 const branch=state.branch;
 state.busy=true;status('Consultando saldo e historial de pruebas…');
 try{
  const [a,m]=await Promise.all([request('saldo',{},branch),request('movimientos',{},branch)]);
  if(branch!==state.branch)return;
  state.balance=Number(a.cuenta.balance)||0;
  state.initialized=a.cuenta.initialized===true;
  state.history=Array.isArray(m.movimientos)?m.movimientos:[];
  state.ready=true;status('✓ Datos de prueba cargados. No son ventas reales.','success');
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
 let action,monto,concepto,destino;
 try{
  action=first?'inicializar':$('ukiAcumType').value;
  monto=readAmount(first?'ukiAcumInitial':'ukiAcumAmount',first);
  concepto=readConcept(first?'ukiAcumInitialConcept':'ukiAcumConcept');
  destino=action==='traspaso'?$('ukiAcumDestination').value:undefined;
  if(destino===state.branch)throw Error('Selecciona una sucursal distinta.');
  if(!confirm('¿Registrar '+money(monto)+' en '+BRANCHES[state.branch]+'? Solo datos de QA, nunca la caja real.'))return;
 }catch(e){status(String(e.message||e),'error');return;}
 const branch=state.branch;
 if(!state.nonce)state.nonce=crypto.randomUUID();
 state.busy=true;draw();status('Registrando movimiento de prueba…');
 try{
  const r=await request(action,{monto,concepto,destino,op_key:state.nonce},branch);
  state.nonce=null;
  if(branch!==state.branch)return;
  if(first){$('ukiAcumInitial').value='';$('ukiAcumInitialConcept').value='';}
  else{$('ukiAcumAmount').value='';$('ukiAcumConcept').value='';}
  status(r.duplicate?'✓ Movimiento repetido identificado, sin duplicar saldo.':'✓ Movimiento guardado en la base de pruebas.','success');
 }catch(e){status(String(e.message||e),'error');}
 finally{state.busy=false;await load();}
}
function mount(){
 if(!$('ukiAcumRoot'))return;
 state.branch=branchFromPanel();state.ready=false;state.nonce=null;
 $('ukiAcumBranch').onchange=()=>{state.branch=$('ukiAcumBranch').value;state.ready=false;state.nonce=null;void load();};
 $('ukiAcumType').onchange=draw;
 $('ukiAcumRefresh').onclick=()=>void load();
 $('ukiAcumHistoryRefresh').onclick=()=>void load();
 $('ukiAcumStart').onclick=()=>void save(true);
 $('ukiAcumSave').onclick=()=>void save(false);
 draw();void load();
}
window.ukiCajaAcumuladaVista=html;window.ukiCajaAcumuladaMontar=mount;
})();