import {prepararVinculoLocalQA} from './uki-locales-motor-qa.mjs';
import {crearMensajeVisualRomoQA} from './uki-locales-puente-visual-qa.mjs';
/* Agregar local operativo · reutiliza Mi Administración, Google y PIN privados.
 * QA sin publicación. Las fotos del teléfono son SOLO vista previa:
 * la carga definitiva requiere conectar almacenamiento autorizado. */
export function iniciarLocalesOperativosQA({api,negocios,sucursales,notificar,refrescarNegocios=async()=>{}}){
 const by=id=>document.getElementById(id),ids=['ownerLocBiz','ownerLocBranch'];
 const biz=by(ids[0]),branch=by(ids[1]),save=by('ownerLocSave'),list=by('ownerLocList');
 let drafts=[],lastRevision=0,loading=false;
 const setOptions=(select,items,title)=>{
  const previous=select.value;select.replaceChildren(new Option(title,''));
  for(const item of items)select.add(new Option(item.nombre,item.id));
  if([...select.options].some(o=>o.value===previous))select.value=previous;
 };
 const sync=()=>{
  setOptions(biz,negocios(),'Selecciona un negocio');
  setOptions(branch,sucursales().filter(x=>x.negocio_id===biz.value),'Selecciona sucursal');
  branch.add(new Option('＋ Crear nueva sucursal','__new__'));
  by('ownerLocNewBranchWrap').hidden=branch.value!=='__new__';
 };
 const renderList=()=>{
  list.replaceChildren();
  const msg=document.createElement('p');msg.className='hint';
  msg.textContent='Uki Regimiento Arica y Uki La Serena mantienen su operación. Romo La Serena sigue en integración; aquí no se vuelven a crear.';
  list.append(msg);
  for(const [name,status] of [
   ['Uki Regimiento Arica','Existente · sin cambios'],
   ['Uki La Serena','Existente · sin cambios'],
   ['Romo’s Sushi La Serena','Integración en pruebas']
  ]){
   const line=document.createElement('div');line.className='line';
   const h=document.createElement('strong');h.textContent=name;
   const p=document.createElement('p');p.className='hint';p.textContent=status;
   line.append(h,p);list.append(line);
  }
  for(const record of drafts){
   const div=document.createElement('div');div.className='line';
   const title=document.createElement('strong');title.textContent=record.configuracion?.nombre||'Local';
   const detail=document.createElement('p');detail.className='hint';
   try{const p=prepararVinculoLocalQA(record);
    detail.textContent='Carta y panel: '+p.storeId+' · Configurados en borrador, sin ventas';
   }catch{detail.textContent='Borrador · vinculación por revisar · sin ventas';}
   if(record.store_id==='romo:serena'){
    const btn=document.createElement('button');
    btn.type='button';btn.textContent='Ver identidad de carta (prueba)';
    btn.addEventListener('click',()=>{
     try{
      const descriptor=crearMensajeVisualRomoQA(prepararVinculoLocalQA(record));
      const host=by('ownerLocPreview');host.replaceChildren();
      const header=document.createElement('strong');
      header.textContent=descriptor.identidad.nombre;
      const p=document.createElement('p');p.className='hint';
      p.textContent=descriptor.identidad.direccion+' · '+descriptor.identidad.horarios+
       ' · '+(descriptor.identidad.whatsapp||'WhatsApp pendiente');
      host.append(header,p);host.style.borderLeft='5px solid '+descriptor.identidad.color;
      for(const url of [descriptor.identidad.logoUrl,descriptor.identidad.portadaUrl]){
       if(!url)continue;
       const img=document.createElement('img');img.src=url;
       img.alt='Vista previa del diseño de Romo';
       img.style.cssText='width:100%;max-height:180px;object-fit:contain';
       host.append(img);
      }
      const hint=document.createElement('p');hint.className='hint';
      hint.textContent='Solo vista previa en Administración. No publica ni activa la carta.';
      host.append(hint);
     }catch(e){notificar('No se pudo mostrar la ficha de Romo: '+e.message,'error')}
    });
    div.append(btn);
   }
   div.append(title,detail);list.append(div);
  }
 };
 const valores=()=>({
  negocio_id:biz.value,sucursal_id:branch.value,
  nombre:by('ownerLocName').value.trim(),direccion:by('ownerLocAddress').value.trim(),
  whatsapp:by('ownerLocWhatsApp').value.trim(),instagram:by('ownerLocInstagram').value.trim(),
  horarios:by('ownerLocSchedule').value.trim(),plantilla:by('ownerLocTemplate').value,
  color:by('ownerLocColor').value,logoUrl:'',portadaUrl:''
 });
 const preview=()=>{
  const f=valores(),host=by('ownerLocPreview');
  host.replaceChildren();
  if(!f.negocio_id||(!f.sucursal_id&&branch.value!=='__new__')||f.nombre.length<3||f.direccion.length<5){
   host.textContent='Completa negocio, sucursal, nombre y dirección para ver la ficha.';return;
  }
  const h=document.createElement('strong');h.textContent=f.nombre;
  const p=document.createElement('p');p.className='hint';
  p.textContent=f.direccion+' · '+(f.whatsapp||'WhatsApp pendiente')+
   ' · '+(f.plantilla==='uki-motor'?'Diseño y funciones Uki sin copiar datos':'Carta vacía, mismas funciones');
  host.append(h,p);host.style.borderLeft='5px solid '+f.color;
 };
 const files=[['ownerLocLogo','ownerLocLogoPreview'],['ownerLocCover','ownerLocCoverPreview']];
 for(const [field,target] of files){
  let url=null;
  by(field).addEventListener('change',()=>{
   if(url)URL.revokeObjectURL(url);url=null;
   const f=by(field).files?.[0],el=by(target);el.replaceChildren();
   if(!f)return;
   if(!f.type.startsWith('image/')||f.size>6000000){notificar('Usa una imagen de máximo 6 MB.','error');return}
   url=URL.createObjectURL(f);
   const img=document.createElement('img');img.src=url;img.alt='Vista previa, todavía no guardada';
   img.style.cssText='width:100%;max-height:150px;object-fit:contain;border-radius:10px';
   el.append(img);
  });
 }
 const leerBorradorSeleccionado=()=>{
  const existente=drafts.find(x=>x.sucursal_id===branch.value);
  lastRevision=Number(existente?.revision||0);
  const config=existente?.configuracion;
  by('ownerLocExisting').value=existente?.store_id==='romo:serena'?'romo:serena':'';
  if(config){
   const mapping={ownerLocName:'nombre',ownerLocAddress:'direccion',
    ownerLocWhatsApp:'whatsapp',ownerLocInstagram:'instagram',
    ownerLocSchedule:'horarios',ownerLocTemplate:'plantilla',ownerLocColor:'color'};
   for(const [id,field] of Object.entries(mapping))by(id).value=config[field]||'';
  }else{
   const nombreSucursal=branch.value==='__new__'?by('ownerLocNewBranch').value.trim():
   (sucursales().find(x=>x.id===branch.value)?.nombre||'');
   const nombreNegocio=negocios().find(x=>x.id===biz.value)?.nombre||'';
   for(const id of ['ownerLocWhatsApp','ownerLocInstagram','ownerLocAddress','ownerLocSchedule'])
    by(id).value='';
   by('ownerLocName').value=[nombreNegocio,nombreSucursal].filter(Boolean).join(' · ');
   by('ownerLocTemplate').value='uki-motor';by('ownerLocColor').value='#bc1725';
  }
  preview();
 };
 biz.addEventListener('change',()=>{sync();leerBorradorSeleccionado();});
 branch.addEventListener('change',()=>{
  by('ownerLocNewBranchWrap').hidden=branch.value!=='__new__';
  leerBorradorSeleccionado();
 });
 by('ownerLocPreviewBtn').onclick=preview;
 save.onclick=async()=>{
  if(loading)return;loading=true;save.disabled=true;
  try{
   const ficha=valores();
   if(!ficha.negocio_id||(!ficha.sucursal_id&&branch.value!=='__new__')||!ficha.nombre||!ficha.direccion)
    throw Error('Completa negocio, sucursal, nombre y dirección');
   const nueva=branch.value==='__new__';
   if(nueva&&by('ownerLocExisting').value)throw Error('No puedes vincular Romo creando otra sucursal');
   if(nueva){
    const nombreSucursal=by('ownerLocNewBranch').value.trim();
    if(nombreSucursal.length<2)throw Error('Escribe el nombre de la nueva sucursal');
    if(!ficha.negocio_id)throw Error('Selecciona primero el negocio');
    const {sucursal_id,...datosFicha}=ficha;
    const result=await api('locales_operativos_crear_qa',
     {negocio_id:ficha.negocio_id,nombre_sucursal:nombreSucursal,ficha:datosFicha});
    await refrescarNegocios();
    branch.value=result.local?.sucursal_id||'';
    by('ownerLocNewBranchWrap').hidden=true;
    await consultar();
    notificar('Nueva sucursal preparada y seleccionada. Aún no está publicada.','success');
    return;
   }
   const result=await api('locales_operativos_guardar_qa',{ficha,expectedRevision:lastRevision,vincularLocalExistente:by('ownerLocExisting').value});
   lastRevision=result.local?.revision||0;
   notificar('Ficha guardada como borrador privado. Aún no está publicada.','success');
   await consultar();
  }catch(e){notificar('No se guardó el borrador: '+e.message,'error')}
  finally{loading=false;save.disabled=false;}
 };
 async function consultar(){
  try{
   const resp=await api('locales_operativos_diagnostico_qa');
   const d=resp.diagnostico||{};
   save.disabled=d.registroHabilitado!==true;
   if(!d.registroHabilitado){
    drafts=[];
    by('ownerLocStatus').textContent=
     'Administrador de Locales en preparación. '+(d.siguiente||'No está activado')+
     '. La vista previa sí está disponible; no se guardó ningún local.';
    renderList();
    return;
   }
   const data=await api('locales_operativos_listar_qa');
   drafts=Array.isArray(data.locales)?data.locales:[];
   by('ownerLocStatus').textContent='Borradores privados disponibles. Ninguno activa caja ni QR.';
  }catch{
   drafts=[];
   save.disabled=true;
   by('ownerLocStatus').textContent='El guardado privado aún no está disponible. Puedes completar la ficha y verla sin publicarla.';
  }
  renderList();
  if(branch.value)leerBorradorSeleccionado();
 }
 sync();renderList();
 return Object.freeze({sync,consultar});
}
