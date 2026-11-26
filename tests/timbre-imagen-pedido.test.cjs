const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const romo=fs.existsSync('public/romo-panel-qa/romo-logo-original.jpeg'),folder=romo?'public/romo-panel-qa':'firebase';
const suc=romo?'Romo’s Sushi La Serena':'Uki Regimiento Arica';
const html=fs.readFileSync(folder+'/'+(romo?'index.html':'uki-sushi-local.html'),'utf8');
const tarjeta=fs.readFileSync(folder+'/uki-tarjeta-cliente.js','utf8');
const parte=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
test('La imagen del pedido usa el saldo del texto y la misma confirmación de envío',async()=>{
 let solicitud,abiertos=0,errores=[];
 const d={cliente:'Cliente de prueba',telefono:'56900000000',editando:2,pagado:true,items:[{nombre:'Roll'}]};
 const p={...d,id:2,suc,pagado:false},S={suc,vista:'nuevo',pedidos:[p]};
 const contexto={D:d,S,ROMO_SUCURSAL_QA:suc,ukiRomoFechaOperativaActualSeguraQA:()=>true,
  ukiTurnoFolioActual:()=>({clave:'2026-11-26:P'}),ukiNumeroTimbreWhatsApp:String,ukiTelefonoNormalizado:String,
  ukiRomoRecordarTimbreEdicionQA:()=>{},getCliente:()=>({}),ventasValidas:()=>7,ukiTimbreResponsableActual:()=> 'Persona',
  aviso:msg=>errores.push(msg),render(){},window:{open:()=>abiertos++,ukiTarjetaMostrar:(datos,acciones)=>{solicitud={datos,acciones}}}};
 S.cajasDiarias={[suc+'|2026-11-26']:{turnoAbierto:true,baseConfirmada:true,turnoId:'2026-11-26:P'}};
 const ctx=vm.createContext(contexto);
 vm.runInContext(parte('function ukiTimbreYaEnviadoPedido(','function ukiRevisionBancoFirmaQA('),ctx);
 ctx.ukiAbrirTimbreBorrador(true);
 assert.equal(solicitud.datos.timbres,8);
 assert.equal(solicitud.datos.modoPedido,true);
 assert.equal(solicitud.datos.sucursal,suc);
 assert.doesNotMatch(JSON.stringify(solicitud.datos),/56900000000/,'El número no aparece impreso.');
 assert.equal(abiertos,0);
 assert.equal(d.timbreAvisoAbiertoEn,undefined,'La vista previa sola no habilita la confirmación.');
 ctx.ukiConfirmarTimbreBorrador(true);
 assert.equal(errores.length,1);
 solicitud.acciones.preparada();
 assert.equal(ctx.ukiTimbreBorradorConfirmado(d),false,'Compartir no equivale a confirmar.');
 ctx.ukiConfirmarTimbreBorrador(true);
 assert.equal(ctx.ukiTimbreBorradorConfirmado(d),true);
 assert.equal(solicitud.acciones.vigente(),false);
 ctx.ukiAbrirTimbreBorrador();
 assert.equal(abiertos,0,'La confirmación de una imagen impide duplicar el envío de texto.');
 assert.match(html,/onclick="ukiAbrirTimbreBorrador\(true\)">Compartir imagen del timbre/);
 assert.match(html,/onclick="ukiAbrirTimbreBorrador\(\)">📲 Enviar timbre por WhatsApp/);
});
test('La vista prepara un PNG con el logo correcto y permite descargarlo o compartirlo sin envío automático',async()=>{
 const trazos=[],logos=[],abiertos=[],descargas=[],revocadas=[];
 const raiz={elementos:[],appendChild(n){this.elementos.push(n);return n}};
 let dialogo,modo='cancelado',procesadas=0,compartidas=0,vigente=true,soporte=true;
 const canvas=new Proxy({measureText:t=>({width:String(t).length*9}),fillText:t=>trazos.push(String(t)),
  createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
 function Element(tag){
  this.tag=tag;this.style={};this.nodos=[];this.eventos={};
  this.setAttribute=()=>{};this.append=(...n)=>this.nodos.push(...n);
  this.addEventListener=(k,fn)=>{this.eventos[k]=fn};
  this.showModal=()=>{dialogo=this;};this.close=()=>{this.eventos.close?.()};
  this.remove=()=>{if(dialogo===this)dialogo=null;};
  this.click=()=>{if(tag==='a')descargas.push(this.download);return this.eventos.click?.({currentTarget:this})};
 }
 const ctx={
  document:{body:raiz,getElementById:()=>dialogo,createElement:tag=>tag==='canvas'?
   {getContext:()=>canvas,toBlob:fn=>fn({size:20000})}:new Element(tag)},
  Image:class{set src(x){logos.push(x);this.onload();}},File:class{constructor(content,name,options){this.name=name;this.type=options.type;}},
  URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL:url=>revocadas.push(url)},window:{open:(...x)=>abiertos.push(x)},
  navigator:{canShare:()=>soporte,share:async ({files})=>{
   assert.equal(files[0].type,'image/png');assert.equal(files[0].name,(romo?'romo':'uki')+'-timbres.png');
   if(modo==='cancelado')throw {name:'AbortError'};
   compartidas++;
  }},alert:m=>assert.fail(m)
 };
 vm.runInNewContext(tarjeta,ctx);
 const args=[{nombre:'Cliente de prueba',sucursal:suc,modoPedido:true,whatsapp:'56900000000',codigoCliente:'9999',timbres:8},
  {telefonoChat:'56900000000',vigente:()=>vigente,preparada:()=>procesadas++}];
 await ctx.window.ukiTarjetaMostrar(...args);
 assert.deepEqual(logos,[romo?'./romo-logo-original.jpeg':'./uki-logo-original.svg']);
 assert.ok(trazos.includes('8/10'));assert.ok(!trazos.some(x=>/56900000000|9999/.test(x)));
 const boton=t=>dialogo.nodos.at(-1).nodos.find(n=>n.textContent===t);
 await boton('Compartir imagen').click();
 assert.equal(procesadas,0);
 modo='aceptado';vigente=false;
 await boton('Compartir imagen').click();assert.equal(compartidas,0);
 vigente=true;
 await boton('Compartir imagen').click();
 assert.equal(procesadas,1);assert.equal(compartidas,1);assert.equal(revocadas.length,1);
 soporte=false;await ctx.window.ukiTarjetaMostrar(...args);
 assert.equal(boton('Compartir imagen'),undefined);
 boton('Descargar imagen').click();boton('Descargar imagen').click();assert.equal(procesadas,2);
 assert.equal(descargas.length,2);
 boton('Abrir chat del cliente').click();
 assert.equal(abiertos[0][0],'https://wa.me/56900000000');
 boton('Cerrar').click();
});
