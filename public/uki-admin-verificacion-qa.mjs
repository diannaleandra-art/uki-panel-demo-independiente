import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
const QA_HOST='uki-sushi-inventario-git-feature-uki-34d457-diannaleandra-7046.vercel.app';
const $=id=>document.getElementById(id);
const names={arica:'Regimiento Arica',serena:'La Serena'};
const fmt=n=>Number(n).toLocaleString('es-CL');
const money=n=>'$'+fmt(n);
const status=(id,message,ok=null)=>{
 const element=$(id);if(!element)return;
 element.textContent=message;element.classList.toggle('error',ok===false);
 element.classList.toggle('success',ok===true);
};
const safe=x=>String(x??'');
let user=null,current=null,product=null,busy=false,autorizada=false;
const restricted=location.hostname!==QA_HOST;
const config={
 apiKey:'AIzaSyCS05MCZdbCwN-PPg7eOSd43JIG-uWYIeA',
 authDomain:'uki-panel-f4909.firebaseapp.com',
 projectId:'uki-panel-f4909',
 storageBucket:'uki-panel-f4909.firebasestorage.app',
 messagingSenderId:'1070481165758',
 appId:'1:1070481165758:web:b8f0f9ff40caf5b8ac7def'
};
if(restricted){
 $('login').disabled=true;
 status('authStatus','Este enlace no corresponde al entorno aislado de Uki. Abre únicamente el enlace oficial de pruebas.',false);
}
const auth=getAuth(initializeApp(config));
const provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:'select_account'});
const branch=()=>$('branch').value;
function clearViews(){
 autorizada=false;current=null;product=null;
 $('facts').replaceChildren();$('productList').replaceChildren();$('historyList').replaceChildren();
 $('reportList').replaceChildren();$('report').hidden=true;
 $('tests').hidden=!user;
 status('status','Toca «Comprobar acceso» para verificar tu cuenta.');
 status('productStatus','Pendiente de comprobación.');
 status('historyStatus','Pendiente de comprobar.');
}
function busyButtons(on){
 busy=on;
 for(const id of ['check','testProduct','history','excel','pdf','whatsapp'])if($(id))$(id).disabled=on;
}
function errorText(err){
 const code=safe(err?.code),message=safe(err?.message);
 if(code==='auth/unauthorized-domain')return 'Google no tiene autorizado el dominio de pruebas. No se ha modificado nada; avisa con captura de este mensaje para ajustar el acceso.';
 if(code==='auth/popup-blocked')return 'Safari bloqueó la ventana de Google. Abre el enlace directamente en Safari y toca de nuevo «Entrar con Google».';
 if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request')return 'Se cerró la ventana de Google antes de terminar. Puedes intentar otra vez.';
 if(code==='auth/unauthorized-continue-uri')return 'El dominio de pruebas todavía no está aprobado para iniciar sesión.';
 if(code.startsWith('auth/'))return 'Google no pudo completar el acceso ('+code+'). Puedes enviar una captura del mensaje.';
 if(message==='Failed to fetch')return 'No hubo conexión con el sistema de pruebas. Comprueba internet y vuelve a intentarlo.';
 return message.slice(0,240)||'No fue posible completar la comprobación.';
}
async function googleToken(){
 if(!auth.currentUser)throw Error('Primero inicia sesión con Google.');
 return auth.currentUser.getIdToken();
}
async function call(endpoint,action,data={},selectedBranch=branch()){
 if(restricted)throw Error('No es el entorno de pruebas.');
 if(!['arica','serena'].includes(selectedBranch))throw Error('Sucursal inválida.');
 const token=await googleToken();
 const response=await fetch(location.origin+endpoint,{
  method:'POST',mode:'same-origin',cache:'no-store',credentials:'omit',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
  body:JSON.stringify({branch:selectedBranch,action,...data})
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.ok)throw Error(body.error||'Error HTTP '+response.status);
 return body;
}
const diag=(action,fields={},b=branch())=>call('/api/uki-admin-verificacion-qa',action,fields,b);
const prices=(action,fields={},b=branch())=>call('/api/uki-carta-precios-live',action,fields,b);
const availability=(action,fields={},b=branch())=>call('/api/uki-disponibilidad-live',action,fields,b);
function pair(title,value){
 const root=document.createElement('div');root.className='fact';
 const label=document.createElement('small');label.textContent=title;
 const strong=document.createElement('strong');strong.textContent=value;root.append(label,strong);return root;
}
async function diagnostic(){
 if(busy)return;const b=branch();busyButtons(true);status('status','Verificando sesión Google y acceso a la base aislada…');
 try{
  const data=await diag('diagnostico',{},b);
  if(b!==branch())return;
  autorizada=true;
  $('facts').replaceChildren(pair('Sucursal',names[b]),pair('Artículos en el inventario de QA',data.items.length),
   pair('Revisiones de QA',data.revisiones),pair('Productos nuevos en QA',data.nuevosProductos));
  status('status','✓ Acceso Google autorizado para Uki. Base de pruebas conectada. No se ha modificado ningún dato real.',true);
 }catch(err){autorizada=false;status('status',errorText(err),false);}
 finally{busyButtons(false);}
}
function productRows(rows){
 const root=$('productList');root.replaceChildren();
 for(const item of rows.slice(0,7)){
  const el=document.createElement('div');el.className='row';
  const left=document.createElement('div');const name=document.createElement('strong');name.textContent=item.name;
  const sub=document.createElement('small');sub.textContent=money(item.price)+' · '+(item.available?'Disponible':'Agotado')+
   (item.custom?' · Producto agregado':'');
  left.append(name,sub);el.append(left);root.append(el);
 }
}
async function testProduct(){
 if(busy)return;const b=branch();busyButtons(true);
 status('productStatus','Verificando creación de producto…');
 try{
  if(!autorizada)await diag('diagnostico',{},b);
  const isPizza=b==='arica';
  const name='PRUEBA QA '+(isPizza?'Pizza':'Entrada')+' '+new Date().toISOString().slice(0,16).replace(/[^0-9]/g,'');
  const created=await prices('crear-producto',{
   item:{kind:isPizza?'pizza':'dish',group:isPizza?'pizzas':'entradas',name,
    description:'SOLO PRUEBAS. No es un producto real del local.',price:9900}
  },b);
  product={branch:b,sku:created.item.sku,name};
  status('productStatus','✓ Producto de ejemplo creado en la sucursal de pruebas. Verificando edición de precio…');
  const edited=await prices('editar-precio',{sku:product.sku,expected_version:Number(created.item.version),price:10500},b);
  status('productStatus','✓ Precio de prueba cambiado. Comprobando Disponible/Agotado manual…');
  const off=await availability('marcar',{sku:product.sku,available:false,
   expected_version:Number(edited.item.version)},b);
  const on=await availability('marcar',{sku:product.sku,available:true,
   expected_version:Number(off.version)},b);
  const listed=await prices('listar',{},b);
  const row=listed.items.find(x=>x.sku===product.sku);
  if(!row||row.price!==10500||row.available!==true||on.available!==true)
   throw Error('El producto no conserva el precio o su disponibilidad tras la prueba.');
  if(b!==branch())return;
  productRows([row,...listed.items.filter(x=>x.sku!==row.sku)]);
  status('productStatus','✓ Prueba completada en '+names[b]+': producto agregado, precio actualizado a '+money(10500)+
   ', agotado manualmente y nuevamente disponible. Solo en QA; la carta pública y la caja no cambiaron.',true);
 }catch(e){status('productStatus',errorText(e)+' Los cambios, si hubo alguno, permanecen únicamente en QA.',false);}
 finally{busyButtons(false);}
}
function dateText(date){
 return new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',weekday:'long',
 day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
 .format(new Date(date));
}
async function listHistory(){
 if(busy)return;const b=branch();busyButtons(true);$('report').hidden=true;current=null;
 status('historyStatus','Buscando revisiones guardadas en la base de pruebas…');
 try{
  const data=await diag('historial',{},b);
  if(b!==branch())return;
  const root=$('historyList');root.replaceChildren();
  if(!data.revisiones?.length){
   status('historyStatus','✓ La consulta funciona, pero esta sucursal no tiene revisiones guardadas en QA.',true);
   return;
  }
  status('historyStatus','✓ Historial consultado correctamente. '+data.revisiones.length+' revisiones de prueba.',true);
  for(const entry of data.revisiones){
   const box=document.createElement('div');box.className='row';
   const left=document.createElement('div');
   const title=document.createElement('strong');title.textContent=dateText(entry.created_at);
   const info=document.createElement('small');info.textContent=String(entry.worker_name||'Sin nombre')+
    ' · '+(entry.summary?.productos||0)+' artículos';
   left.append(title,info);
   const btn=document.createElement('button');btn.type='button';btn.textContent='Ver';
   btn.onclick=()=>void openReport(entry.id,b);
   box.append(left,btn);root.append(box);
  }
 }catch(e){status('historyStatus',errorText(e),false);}
 finally{busyButtons(false);}
}
async function openReport(id,b){
 if(busy)return;busyButtons(true);
 status('historyStatus','Abriendo inventario de prueba…');
 try{
  const data=await diag('revision',{id},b);
  if(b!==branch())return;
  current={...data.revision,branch:b};
  const exp=window.ukiInventarioExportar;
  const rows=exp.filas(current);
  $('report').hidden=false;
  $('reportMeta').textContent=dateText(current.created_at)+' · '+names[b]+' · '+current.worker_name+
   ' · Copia de prueba guardada, no stock real.';
  const root=$('reportList');root.replaceChildren();
  for(const item of rows.slice(0,15)){
   const box=document.createElement('div');box.className='row';
   const left=document.createElement('div');
   const name=document.createElement('strong');name.textContent=item.name;
   const sub=document.createElement('small');sub.textContent=item.stock+' '+item.unit+
    ' · Mínimo '+item.minimum+' · '+item.status;
   left.append(name,sub);box.append(left);root.append(box);
  }
  status('historyStatus','✓ Revisión abierta. Puedes probar Excel, PDF y WhatsApp.',true);
  $('report').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){status('historyStatus',errorText(e),false);}
 finally{busyButtons(false);}
}
function download(kind){
 if(!current)return status('exportStatus','Primero abre una revisión.',false);
 const exp=window.ukiInventarioExportar;
 try{
  if(kind==='excel')exp.excel(current);
  else exp.guardarPDF(current);
  status('exportStatus','✓ Archivo de prueba preparado. Comprueba las descargas de tu iPhone.',true);
 }catch(e){status('exportStatus',errorText(e),false);}
}
async function share(){
 if(!current)return status('exportStatus','Primero abre una revisión.',false);
 try{
  const result=await window.ukiInventarioExportar.whatsapp(current);
  status('exportStatus',result==='archivo'?'✓ Elige WhatsApp en el menú para enviar el PDF de prueba.':
   result==='texto'?'✓ Se abrió WhatsApp con el resumen. Para adjuntar el PDF, descárgalo también.':
   'Se canceló la acción.',true);
 }catch(e){status('exportStatus',errorText(e),false);}
}
$('login').addEventListener('click',async()=>{
 if(restricted)return;
 $('login').disabled=true;
 status('authStatus','Abriendo acceso oficial de Google…');
 try{
  await signInWithPopup(auth,provider);
  status('authStatus','✓ Inicio de sesión Google completado. Toca «Comprobar acceso».',true);
 }catch(e){status('authStatus',errorText(e),false);}
 finally{$('login').disabled=false;}
});
$('logout').addEventListener('click',async()=>{
 try{await signOut(auth);}catch(e){status('authStatus',errorText(e),false);}
});
$('check').onclick=()=>void diagnostic();
$('testProduct').onclick=()=>void testProduct();
$('history').onclick=()=>void listHistory();
$('excel').onclick=()=>download('excel');
$('pdf').onclick=()=>download('pdf');
$('whatsapp').onclick=()=>void share();
$('branch').addEventListener('change',clearViews);
onAuthStateChanged(auth,account=>{
 user=account;
 $('login').hidden=!!account;$('logout').hidden=!account;
 $('account').textContent=account?'Sesión Google: '+safe(account.email||'cuenta autorizada'):
  'Aún no has iniciado sesión.';
 clearViews();
 if(account)status('authStatus','✓ Google confirmó la sesión. Ahora comprueba los permisos administrativos.',true);
 else if(!restricted)status('authStatus','Toca «Entrar con Google» para comprobar el acceso.');
});
