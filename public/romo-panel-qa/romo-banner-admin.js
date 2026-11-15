'use strict';
(function(){
 const STORE='romo:serena',ENDPOINT='/api/romo-banner-carta-qa';
 let revision=null,items=[],loading=false,photos=new Map();
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const peso=n=>'$'+Number(n).toLocaleString('es-CL');
 const status=(s,error=false)=>{const el=$('romoBannerEstado');if(!el)return;el.textContent=s;el.style.color=error?'#a51d2d':'#273e2f'};
 const blank=()=>({id:'rb'+crypto.randomUUID().replaceAll('-',''),title:'',subtitle:'',price:0,image:'',visible:true});
 async function request(method,body){
  const token=await window.ukiInventarioToken?.();
  if(typeof token!=='string'||token.length<30)throw Error('Ingresa con Google como dueña desde el panel');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),24000);
  try{
   const r=await fetch(ENDPOINT,{method,credentials:'omit',cache:'no-store',signal:ctrl.signal,
    headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
   const j=await r.json().catch(()=>null);
   if(!r.ok||!j?.ok||j.storeId!==STORE)throw Error(j?.error||'No se confirmó el banner');
   return j;
  }finally{clearTimeout(timer)}
 }
 function render(){
  const target=$('romoBannerRows');if(!target)return;
  target.replaceChildren();
  if(!items.length){
   const p=document.createElement('p');p.className='muted';p.textContent='No hay anuncios activos. La carta muestra un banner limpio, sin publicidad fija.';target.append(p);
  }
  items.forEach((item,index)=>{
   const box=document.createElement('article');box.className='card';
   box.style.cssText='margin:12px 0;border:1px solid #ddd;border-radius:14px;padding:13px;background:white';
   box.innerHTML='<h3>Promoción '+(index+1)+'</h3>'+
    '<label>Nombre visible</label><input data-field="title" maxlength="80" value="'+esc(item.title)+'" placeholder="Ej. Especial del fin de semana">'+
    '<label>Descripción</label><textarea data-field="subtitle" rows="2" maxlength="165" placeholder="Qué incluye o condiciones">'+esc(item.subtitle)+'</textarea>'+
    '<label>Precio destacado (opcional)</label><input data-field="price" inputmode="numeric" type="number" min="0" max="1000000" step="1" value="'+item.price+'">'+
    '<label>Imagen o fotografía del anuncio (opcional)</label><input data-field="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif">'+
    '<p class="muted">La fotografía se ajusta automáticamente para la carta. No modifica las fotos de los productos.</p>'+
    '<div data-preview></div>'+
    '<label style="display:flex;gap:9px;align-items:center"><input data-field="visible" type="checkbox" style="width:22px;height:22px" '+(item.visible?'checked':'')+'> Mostrar en la carta</label>'+
    '<div style="display:flex;flex-wrap:wrap;gap:9px;margin-top:10px"><button type="button" class="sm" data-up>↑ Subir</button><button type="button" class="sm" data-down>↓ Bajar</button><button type="button" class="sm" data-remove>Quitar</button></div>';
   const preview=box.querySelector('[data-preview]');
   if(item.image){const im=document.createElement('img');im.alt='Fotografía de '+item.title;im.loading='lazy';im.src=item.image;im.style.cssText='max-width:100%;max-height:190px;object-fit:cover;border-radius:12px;display:block;margin:7px 0';preview.append(im)}
   for(const field of ['title','subtitle','price','visible']){
    const control=box.querySelector('[data-field="'+field+'"]');
    control.addEventListener(field==='visible'?'change':'input',()=>{
     item[field]=field==='visible'?control.checked:field==='price'?Number(control.value):control.value;
    });
   }
   box.querySelector('[data-field="file"]').onchange=async event=>{
    const file=event.target.files?.[0];if(!file)return;
    status('Preparando la fotografía de promoción…');
    try{item.image=await compressPhoto(file);status('Fotografía lista. Pulsa Guardar para publicarla.');render()}
    catch(e){status(String(e.message||e),true)}
   };
   box.querySelector('[data-up]').onclick=()=>{if(index>0){[items[index-1],items[index]]=[items[index],items[index-1]];render()}};
   box.querySelector('[data-down]').onclick=()=>{if(index<items.length-1){[items[index+1],items[index]]=[items[index],items[index+1]];render()}};
   box.querySelector('[data-remove]').onclick=()=>{items.splice(index,1);render();status('Cambio pendiente. Pulsa Guardar para aplicarlo.')};
   target.append(box);
  });
  $('romoBannerAdd').disabled=items.length>=6;
 }
 async function compressPhoto(file){
  if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type))throw Error('Elige una imagen JPG, PNG o WebP');
  if(file.size>14*1024*1024)throw Error('La imagen es demasiado grande');
  const obj=URL.createObjectURL(file);
  try{
   const img=new Image();
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('No se pudo abrir esta fotografía'));img.src=obj});
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Este navegador no puede preparar imágenes');
   for(const width of [1000,800,650,520,400]){
    const scale=Math.min(1,width/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [0.78,0.66,0.54,0.43]){
     const value=canvas.toDataURL('image/jpeg',quality);
     if(value.length<180000)return value;
    }
   }
   throw Error('No se pudo reducir la fotografía. Selecciona una imagen más pequeña');
  }finally{URL.revokeObjectURL(obj)}
 }
 async function load(){
  if(loading)return;loading=true;status('Leyendo anuncios exclusivos de Romo…');
  try{
   const data=await request('GET');revision=data.revision;
   if(!Number.isSafeInteger(revision)||!Array.isArray(data.items))throw Error('Banner no disponible');
   items=data.items.map(x=>({...x}));
   render();status('Banner sincronizado con Romo. '+items.length+' anuncios guardados.');
  }catch(e){status(String(e.message||e),true)}
  finally{loading=false}
 }
 async function save(){
  if(loading||revision===null)return;
  const errors=items.filter(x=>x.title.trim().length<2||x.price<0||!Number.isSafeInteger(x.price));
  if(errors.length){status('Escribe un nombre válido y revisa los precios antes de guardar.',true);return}
  loading=true;$('romoBannerSave').disabled=true;
  status('Publicando el banner exclusivamente para Romo…');
  try{
   const data=await request('POST',{expectedRevision:revision,items});
   revision=data.revision;status('✓ Banner guardado. La carta de Romo ya puede mostrar los anuncios activos.');
  }catch(e){status(String(e.message||e),true)}
  finally{loading=false;$('romoBannerSave').disabled=false}
 }
 window.ukiRomoBannerAdminHTML=()=>'<section class="card" style="background:white;max-width:700px;margin:auto">'+
  '<h2>Promociones del banner · Romo</h2>'+
  '<p class="muted">Publica aquí la fotografía, el nombre y un mensaje de cada promoción. La carta se actualiza sin hacer otro despliegue. Los anuncios son independientes del precio y armado del producto.</p>'+
  '<p class="muted"><b>La promoción debe estar creada también en la carta para que el cliente pueda armarla y comprarla.</b> El banner solo anuncia y abre Promociones; no crea productos ni cambia la caja.</p>'+
  '<p id="romoBannerEstado" role="status">Preparado para cargar promociones.</p><div id="romoBannerRows"></div>'+
  '<div style="display:flex;flex-wrap:wrap;gap:9px"><button id="romoBannerAdd" type="button" class="sm">＋ Agregar anuncio</button>'+
  '<button id="romoBannerSave" type="button" class="big" style="background:#c4162c;color:#fff">Guardar y publicar banner</button></div>'+
  '<p class="muted">Solo se guarda cuando pulsas Guardar y publicar. Máximo seis anuncios.</p></section>';
 window.ukiRomoBannerAdminMount=()=>{
  if(!$('romoBannerRows'))return;
  $('romoBannerAdd').onclick=()=>{if(items.length>=6)return;items.push(blank());render();status('Anuncio nuevo. Completa y guarda para publicarlo.')};
  $('romoBannerSave').onclick=()=>void save();
  void load();
 };
})();
