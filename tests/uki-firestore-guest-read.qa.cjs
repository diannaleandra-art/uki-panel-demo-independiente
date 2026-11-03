'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:400,height:850}});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/tests/uki-firebase-guest-probe.qa.html',{waitUntil:'domcontentloaded'});
  const outcomes=await page.evaluate(async()=>{
   const [{initializeApp},{getFirestore,doc,getDocFromServer}]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')
   ]);
   const config={apiKey:'AIzaSyCS05MCZdbCwN-PPg7eOSd43JIG-uWYIeA',
    authDomain:'uki-panel-f4909.firebaseapp.com',projectId:'uki-panel-f4909',
    appId:'1:1070481165758:web:b8f0f9ff40caf5b8ac7def'};
   const db=getFirestore(initializeApp(config,'uki-guest-readonly-ci'));
   const docs=[
    ['Regimiento Arica','uki_operacion_v1/regimiento'],
    ['La Serena','uki_operacion_v1/la-serena'],
    ['Bloque interno inexistente','uki_operacion_v1/regimiento/bloques/uki_qa_no_existente']
   ];
   const check=async([label,path])=>{
    try{
      const snap=await Promise.race([
       getDocFromServer(doc(db,path)),
       new Promise((_,reject)=>setTimeout(()=>reject(Object.assign(Error('timeout'),{code:'timeout'})),22000))
      ]);
      return {label,status:'UNSAFE_READ_ALLOWED',exists:snap.exists()};
    }catch(e){
      return {label,status:e?.code==='permission-denied'?'ACCESS_DENIED':e?.code||'ERROR'};
    }
   };
   return Promise.all(docs.map(check));
  });
  for(const res of outcomes)assert.equal(res.status,'ACCESS_DENIED',res.label+' debe denegar lectura anónima: '+res.status);
  console.log(JSON.stringify({ok:true,checks:outcomes,method:'Firebase Web SDK sin sesión, solo getDocFromServer',writeRequests:0,productionChanged:false},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error('No se pudo validar lectura anónima:',e.message);process.exitCode=1;});
