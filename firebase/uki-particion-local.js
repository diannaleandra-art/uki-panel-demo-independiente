/* Uki Sushi: dividir datos por fecha/categoría ANTES de cifrarlos.
 * Prototipo local, NO hace llamadas de red y NO se conecta a la v8.15.
 * El llamador debe cifrar cada bloque AES-GCM antes de usar Firestore.
 */
const SERIES=["pedidos","gastos","retiros","propinas","cierres","deliveriesManuales","incidencias","ajustesHistoricos","borradores"];
const MAX=180000;
const nbytes=s=>(encodeURIComponent(s).match(/%[0-9A-Fa-f]{2}|./g)||[]).length;
const mes=x=>(String(x.fechaISO||x.fecha||"").match(/^\d{4}-\d{2}/)||[])[0]||"historico";
const error=(code,msg)=>{const e=new Error(msg);e.code=code;throw e;};
function crearChunks(tipo,grupo,items,out){
  let paquete=[],n=0;
  for(const item of items){
    const size=nbytes(JSON.stringify(item))+4;
    if(size>MAX-1000)error("LIMITE","Registro demasiado grande");
    if(paquete.length&&n+size>MAX){
      out.push({tipo,grupo,numero:out.filter(x=>x.tipo===tipo&&x.grupo===grupo).length,contenido:JSON.stringify(paquete)});
      paquete=[];n=0;
    }
    paquete.push(item);n+=size;
  }
  if(paquete.length)out.push({tipo,grupo,numero:out.filter(x=>x.tipo===tipo&&x.grupo===grupo).length,contenido:JSON.stringify(paquete)});
}
export function dividirEstado(state,suc){
  if(state?.suc!==suc)error("SUCURSAL","Sucursal inválida");
  const out=[];
  for(const tipo of SERIES){
    const src=(tipo==="ajustesHistoricos"||tipo==="borradores")?(state[tipo]||[]):state[tipo];
    if(!Array.isArray(src)||src.some(x=>!x||x.suc!==suc))error("SUCURSAL","Registros mezclados");
    const grupos=new Map();
    src.forEach((v,orden)=>{
      const k=mes(v);if(!grupos.has(k))grupos.set(k,[]);
      grupos.get(k).push({orden,valor:v});
    });
    for(const [g,arr] of grupos)crearChunks(tipo,g,arr,out);
  }
  for(const tipo of ["clientes","cajasDiarias"]){
    const entries=Object.entries(state[tipo]||{});
    const grupos=new Map();
    entries.forEach(([key,valor],orden)=>{
      let hash=2166136261;
      for(const ch of Array.from(key))hash=Math.imul(hash^ch.codePointAt(0),16777619)>>>0;
      const k=String(hash%32).padStart(2,"0");
      if(!grupos.has(k))grupos.set(k,[]);
      grupos.get(k).push({orden,key,valor});
    });
    for(const [g,arr] of grupos)crearChunks(tipo,g,arr,out);
  }
  const meta={...state};
  for(const key of [...SERIES,"clientes","cajasDiarias"])delete meta[key];
  if(nbytes(JSON.stringify(meta))>MAX)error("LIMITE","Metadatos demasiado grandes");
  out.push({tipo:"meta",grupo:"actual",numero:0,contenido:JSON.stringify(meta)});
  if(out.some(b=>nbytes(b.contenido)>MAX))error("LIMITE","Bloque demasiado grande");
  return out;
}
export function reunirEstado(chunks,suc){
  const metas=chunks.filter(c=>c.tipo==="meta");
  if(metas.length!==1)error("FORMATO","Metadatos ausentes o repetidos");
  const state=JSON.parse(metas[0].contenido);
  if(state.suc!==suc)error("SUCURSAL","Otra sucursal");
  for(const tipo of SERIES)state[tipo]=[];
  state.clientes={};state.cajasDiarias={};
  for(const c of chunks){
    if(c.tipo==="meta")continue;
    const datos=JSON.parse(c.contenido);
    if(SERIES.includes(c.tipo)){
      for(const x of datos){
        if(x?.valor?.suc!==suc)error("SUCURSAL","Registro externo");
        state[c.tipo].push(x);
      }
    }else if(["clientes","cajasDiarias"].includes(c.tipo)){
      for(const x of datos)state[c.tipo][x.key]=x.valor;
    }else error("FORMATO","Tipo desconocido");
  }
  for(const tipo of SERIES){
    if(new Set(state[tipo].map(x=>x.orden)).size!==state[tipo].length)error("FORMATO","Duplicados");
    state[tipo].sort((a,b)=>a.orden-b.orden);
    state[tipo]=state[tipo].map(x=>x.valor);
  }
  return state;
}
