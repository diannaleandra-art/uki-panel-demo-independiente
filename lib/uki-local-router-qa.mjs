/**
 * ÚNICO PANEL, tres locales. Puente de operaciones para la fase QA.
 *
 * Este contrato NO ejecuta HTTP, no abre Neon, no interpreta un permiso
 * enviado por navegador y no reemplaza los servicios de Uki. Demuestra que
 * nunca existe una opción implícita "si no es Serena => Arica".
 *
 * Más adelante, un backend con sesión Google y rol verificados tendrá que
 * crear explícitamente el adaptador de cada local. El navegador no podrá
 * inyectar un adapter ni un rol en producción.
 */
export const PANEL_LOCAL_ROUTER_QA_ONLY = true;
export const STORES_QA = Object.freeze({
 'uki:arica':Object.freeze({brand:'uki',branch:'arica',name:'Uki Regimiento Arica',mode:'legacy'}),
 'uki:serena':Object.freeze({brand:'uki',branch:'serena',name:'Uki La Serena',mode:'legacy'}),
 'romo:serena':Object.freeze({brand:'romo',branch:'serena',name:'Romo’s Sushi La Serena',mode:'preparacion'})
});
const AREA_ACTIONS=Object.freeze({
 operativo:Object.freeze(['read','save']),
 catalog:Object.freeze(['read','create','edit','retire','restore','availability','discount','category']),
 inventory:Object.freeze(['read','create','edit','retire','count']),
 orders:Object.freeze(['read','receive','accept','edit','reject','cancel','deliver']),
 cash:Object.freeze(['read','record','correct','preclose','close']),
 stamps:Object.freeze(['read','send','history']),
 owners:Object.freeze(['read','record','report'])
});
const WRITE_ACTIONS=new Set(['save','create','edit','retire','restore','availability',
 'discount','category','count','receive','accept','reject','cancel','deliver',
 'record','correct','preclose','close','send']);
const VALID_DATE=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value){
 if(typeof value!=='string'||!VALID_DATE.test(value))return false;
 const d=new Date(value+'T12:00:00.000Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
function operation(area,action){
 if(!Object.hasOwn(AREA_ACTIONS,area)||!AREA_ACTIONS[area].includes(action))
  throw Error('Acción de panel no reconocida');
 return WRITE_ACTIONS.has(action)?'write':'read';
}
export function localPanelDescriptorQA(storeId){
 if(!Object.hasOwn(STORES_QA,storeId))throw Error('Sucursal no reconocida: no se usará Uki como alternativa');
 return STORES_QA[storeId];
}
export function localOperationPlanQA({storeId,area,action,fechaOperativa=null}={}){
 const local=localPanelDescriptorQA(storeId);
 const mode=operation(area,action);
 if(fechaOperativa!==null&&!validDate(fechaOperativa))throw Error('Fecha de operación inválida');
 return Object.freeze({
  storeId,brand:local.brand,branch:local.branch,area,action,mode,fechaOperativa,
  backend:local.brand==='uki'?'uki-existente':'romo-neon-independiente',
  live:false
 });
}
/**
 * Prueba de integración de servicios: los adaptadores se crean en el backend.
 * Se exige enlace exacto de storeId y NO existe backend por defecto.
 * El constructor nunca se llama desde el HTML del panel.
 */
export function crearRouterAlmacenamientoQA({adapters,qaOnly}={}){
 if(qaOnly!==true)throw Error('Router sólo autorizado en ensayos privados');
 if(!adapters||typeof adapters!=='object'||Array.isArray(adapters))
  throw Error('Faltan servicios independientes de sucursal');
 const registry=new Map();
 for(const [storeId,adapter] of Object.entries(adapters)){
  localPanelDescriptorQA(storeId);
  if(!adapter||adapter.storeId!==storeId||typeof adapter.read!=='function'||
     typeof adapter.write!=='function')
   throw Error('El servicio no coincide con la sucursal seleccionada');
  registry.set(storeId,adapter);
 }
 return Object.freeze({
  async execute({storeId,area,action,fechaOperativa=null,payload=null}={}){
   const p=localOperationPlanQA({storeId,area,action,fechaOperativa});
   const backend=registry.get(storeId);
   if(!backend)throw Error('Datos de este local aún no conectados, sin acceso alternativo a Uki');
   const request=Object.freeze({storeId:p.storeId,area:p.area,action:p.action,
     fechaOperativa:p.fechaOperativa,payload:payload===null?null:structuredClone(payload)});
   const result=await (p.mode==='read'?backend.read(request):backend.write(request));
   if(!result||result.storeId!==storeId)
    throw Error('Respuesta de datos de otra sucursal bloqueada');
   return structuredClone(result);
  },
  hasLocal(storeId){localPanelDescriptorQA(storeId);return registry.has(storeId);}
 });
}
/** Una prueba con memoria independiente, NO un servicio real ni almacenamiento. */
export function crearMemoriaLocalQA(storeId){
 const desc=localPanelDescriptorQA(storeId);
 const records=new Map();
 const history=[];
 const key=(a,fecha)=>a+':'+(fecha||'sin-fecha');
 return Object.freeze({
  storeId,
  async read({storeId:s,area,fechaOperativa}){
   if(s!==storeId)throw Error('Lectura fuera de '+desc.name);
   return {storeId,area,fechaOperativa,
    entries:structuredClone(records.get(key(area,fechaOperativa))||[]),
    revision:history.filter(x=>x.area===area&&x.fechaOperativa===fechaOperativa).length};
  },
  async write({storeId:s,area,action,fechaOperativa,payload}){
   if(s!==storeId)throw Error('Escritura fuera de '+desc.name);
   // Sólo datos ficticios. No acepta nombres o teléfonos como identidad real.
   if(!payload||payload.fixtureQA!==true||typeof payload.key!=='string'||
      !/^[a-z0-9_-]{3,50}$/.test(payload.key))
    throw Error('Sólo datos de prueba sin clientes reales');
   const k=key(area,fechaOperativa);
   const items=records.get(k)||[];
   if(action==='retire'||action==='cancel'||action==='reject'){
    records.set(k,items.filter(x=>x.key!==payload.key));
   }else{
    const next=items.filter(x=>x.key!==payload.key);
    next.push({key:payload.key,operation:action,fixtureQA:true});
    records.set(k,next);
   }
   history.push({area,action,fechaOperativa,key:payload.key});
   return {storeId,area,fechaOperativa,revision:history.length,changed:true};
  }
 });
}
