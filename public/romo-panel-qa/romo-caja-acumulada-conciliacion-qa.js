/**
 * Romo La Serena · conciliación PREVIA de Caja acumulada.
 * Solo lectura de cierres ya descifrados tras autenticar Neon.
 * No utiliza ni sustituye el libro de caja acumulada Uki.
 * No inicializa saldo, ni acredita ventas, ni escribe a Neon.
 */
(function(){
 'use strict';
 const LOCAL='Romo’s Sushi La Serena';
 const clean=x=>String(x??'').slice(0,160);
 const esc=x=>clean(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=x=>'$'+Number(x).toLocaleString('es-CL',{maximumFractionDigits:0});
 const MS_MAX=1e15;
 function clasificar(c,ids){
  const problems=[];
  const key=String(c.turnoClave||'');
  if(!/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/.test(key)||
     !key.startsWith(String(c.fechaOperativa||'')+'@'))
    problems.push('El turno o su fecha operativa no son válidos');
  else if(ids.get(key)>1)problems.push('Existe más de un cierre del mismo turno');
  const opened=Number(c.inicioTurnoMs),finished=Number(c.fechaMs);
  if(!Number.isSafeInteger(opened)||opened<=0||opened>=MS_MAX||
     !Number.isSafeInteger(finished)||finished<=opened||finished>=MS_MAX||
     !key.endsWith('@'+opened))
    problems.push('Falta confirmar las horas de apertura y cierre');
  if(!String(c.resp||'').trim())problems.push('No se indicó el responsable');
  const total=Number(c.venta);
  const medios=c.medios;
  if(!Number.isSafeInteger(total)||total<0||total>1e9||
     !medios||typeof medios!=='object'||Array.isArray(medios)||
     !Object.values(medios).every(v=>Number.isSafeInteger(v)&&v>=0&&v<=1e9)||
     Object.values(medios).reduce((a,b)=>a+b,0)!==total)
    problems.push('Los medios de cobro no cuadran con la venta');
  const expected=c.efectivo,counted=c.efectivoContado,diff=c.diferenciaEfectivo;
  if(!Number.isSafeInteger(expected)||expected<0||expected>1e9||
     !Number.isSafeInteger(counted)||counted<0||counted>1e9||
     !Number.isSafeInteger(diff)||diff!==0||counted!==expected)
    problems.push('Arqueo de efectivo sin coincidencia exacta');
  if(c.rectificacion||Array.isArray(c.rectificaciones)&&c.rectificaciones.length)
    problems.push('Cierre con rectificación: requiere conciliar el ajuste');
  if(c.suc!==LOCAL)problems.push('Registro de otra sucursal');
  return {key,dia:String(c.fechaOperativa||''),responsable:String(c.resp||''),
   valid:problems.length===0,problems};
 }
 function clasificarCierres(cierres){
  if(!Array.isArray(cierres)||cierres.length>30000)
   throw Error('No se puede verificar el historial de cierres de Romo');
  if(cierres.some(c=>!c||c.suc!==LOCAL))
   throw Error('El historial incluye otra sucursal. No se consultó la acumulada');
  const ids=new Map();
  for(const c of cierres)ids.set(String(c.turnoClave||''),
   (ids.get(String(c.turnoClave||''))||0)+1);
  const resultados=cierres.map(c=>clasificar(c,ids));
  return {total:resultados.length,
   revisables:resultados.filter(x=>x.valid).length,
   pendientes:resultados.filter(x=>!x.valid).length,
   resultados};
 }
 // Consulta exclusivamente la API privada de Romo y solo con rol dueño.
 // No crea saldos ni los modifica. PIN de inventario NO permite acceder.
 let leyendoLibroQA=false;
 async function consultarLibro(){
  if(leyendoLibroQA||window.ukiQAGet?.()?.suc!==LOCAL)return;
  const session=window.ukiRomoSesionRemotaQA,st=session?.estado?.();
  if(!session?.disponible?.()||st?.conflicto||
     !Number.isSafeInteger(st?.revision)||st.revision<1)return;
  const root=document.getElementById('romoAcumuladaLibroRealQA');
  const button=document.getElementById('romoAcumuladaConsultarQA');
  if(!root)return;
  leyendoLibroQA=true;
  if(button)button.disabled=true;
  root.textContent='Consultando libro privado de Romo, sin modificar saldo…';
  try{
   const token=await window.ukiInventarioToken?.();
   if(typeof token!=='string'||token.length<30)
    throw Error('Sin cuenta Google autorizada.');
   const request=async action=>{
    const resp=await fetch('/api/romo-caja-acumulada-qa',{
     method:'POST',cache:'no-store',credentials:'omit',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({action})
    });
    const data=await resp.json().catch(()=>null);
    if(!resp.ok||data?.ok!==true||data.storeId!=='romo:serena'||data.soloRomo!==true)
     throw Error(String(data?.error||'No se pudo consultar Neon Romo').slice(0,180));
    return data;
   };
   const [cuentas,movs]=await Promise.all([request('saldo'),request('movimientos')]);
   if(window.ukiQAGet?.()?.suc!==LOCAL||session.estado()?.revision!==st.revision)
    throw Error('La sesión cambió durante la consulta; vuelve a ingresar.');
   const cuenta=cuentas.cuenta,rows=movs.movimientos;
   if(!cuenta||cuenta.store_id!=='romo:serena'||typeof cuenta.initialized!=='boolean'||
      !Array.isArray(rows)||rows.length>250||
      rows.some(x=>!x||!['apertura','entrada','gasto','retiro','cierre'].includes(x.tipo)))
    throw Error('El historial del libro no coincide con el formato de Romo.');
   const bal=Number(cuenta.balance);
   if(!Number.isSafeInteger(bal)||bal<0||bal>1e9)
    throw Error('Saldo no válido; requiere conciliación.');
   const target=document.getElementById('romoAcumuladaLibroRealQA');
   if(!target)return;
   target.replaceChildren();
   const titulo=document.createElement('p');
   titulo.textContent=cuenta.initialized?
    'Saldo confirmado en el libro Romo: '+fmt(bal):
    'Libro Romo sin inicializar. Debes contar y confirmar el efectivo real.';
   const nota=document.createElement('p');
   nota.className='muted';
   nota.textContent='Solo consulta. Movimientos visibles: '+rows.length+
    ' (máximo los últimos 250). No modifica pedidos ni cierre del día.';
   target.append(titulo,nota);
   for(const x of rows.slice(0,30)){
    const amount=Number(x.monto),saldo=Number(x.saldo_resultante);
    if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(saldo))continue;
    const line=document.createElement('p');
    line.className='muted';
    line.textContent=String(x.tipo)+' · '+fmt(amount)+
     ' · Saldo: '+fmt(saldo)+' · '+String(x.concepto||'').slice(0,140)+
     ' · '+String(x.responsable||'').slice(0,80);
    target.append(line);
   }
   if(rows.length>30){
    const more=document.createElement('p');
    more.className='muted';more.textContent='Historial completo sujeto a exportación y conciliación.';
    target.append(more);
   }
  }catch(e){
   const target=document.getElementById('romoAcumuladaLibroRealQA');
   if(target)target.textContent='Consulta sin confirmar: '+String(e.message||e)+
    '. No se cambió el saldo.';
  }finally{
   leyendoLibroQA=false;
   const btn=document.getElementById('romoAcumuladaConsultarQA');
   if(btn)btn.disabled=false;
  }
 }
 function render(estado,session){
  const s=session?.estado?.();
  const ready=session?.disponible?.()===true&&s?.conflicto!==true&&
   Number.isSafeInteger(s?.revision)&&s.revision>=1;
  const intro='<div class="section-head"><h2>Caja acumulada en efectivo · Romo</h2></div>'+
   '<div class="card"><b>Conciliación previa · no es un saldo disponible</b>'+
   '<p class="muted">La caja acumulada necesita un saldo inicial de efectivo contado y un libro separado de movimientos. El dinero de Uki y el de Romo nunca se suman entre sí.</p>'+
   '<p class="muted">No se realiza ninguna operación financiera desde esta consulta.</p></div>';
  if(!ready)return intro+'<div class="card">Primero abre con Google y la contraseña autorizada el estado cifrado de Neon Romo. No se muestran cifras sin confirmación de revisión.</div>';
  let rep;
  try{if(estado?.suc!==LOCAL)throw Error('La sesión no pertenece a Romo');
      rep=clasificarCierres(estado.cierres)}
  catch(e){return intro+'<div class="card"><b>Conciliación bloqueada</b><p>'+esc(e.message||e)+'</p></div>'}
  const all=rep.resultados.slice().reverse();
  const list=all.slice(0,50).map(x=>'<details class="card">'+
   '<summary><b>'+(x.valid?'✓ Arqueo coincidente':'⚠️ Requiere revisión')+
    '</b> · '+esc(x.dia||'Fecha sin registrar')+
    ' · '+esc(x.key||'Turno sin identificar')+'</summary>'+
   '<p class="muted">Responsable: '+esc(x.responsable||'No indicado')+'</p>'+
   (x.valid?'<p class="muted">Cierre candidato para conciliación posterior. No acreditado en caja acumulada.</p>':
    '<p class="muted">Pendiente: '+x.problems.map(esc).join('; ')+'</p>')+
   '</details>').join('');
  return intro+
   '<section class="kpis"><div class="kpi"><span>Cierres examinados</span><strong>'+rep.total+'</strong></div>'+
   '<div class="kpi"><span>Arqueo coincidente (sin acreditar)</span><strong>'+rep.revisables+'</strong></div>'+
   '<div class="kpi"><span>Por conciliar</span><strong>'+rep.pendientes+'</strong></div></section>'+
   '<div class="card"><p><b>Saldo disponible: consulta privada pendiente.</b></p>'+
   '<p class="muted">Un saldo solo existe si el libro exclusivo de Neon Romo tiene un conteo inicial confirmado. Un cierre con arqueo coincidente no equivale a dinero acreditado.</p>'+
   '<button id="romoAcumuladaConsultarQA" type="button" class="sm" onclick="window.ukiRomoCajaAcumuladaConciliacionQA.consultarLibro()">Consultar saldo real e historial · Solo dueños</button>'+
   '<div id="romoAcumuladaLibroRealQA" role="status" class="muted">No se ha consultado el libro privado en esta sesión.</div>'+
   '<p class="muted">Última revisión cifrada cargada: '+s.revision+'. Esta comprobación no reemplaza el conteo físico.</p></div>'+
   (list||'<div class="card">Todavía no hay cierres definitivos en el estado cifrado Romo.</div>')+
   (all.length>50?'<p class="muted">Se muestran los 50 últimos cierres; los demás continúan en la base.</p>':'');
 }
 window.ukiRomoCajaAcumuladaConciliacionQA=Object.freeze({render,clasificarCierres,consultarLibro});
})();