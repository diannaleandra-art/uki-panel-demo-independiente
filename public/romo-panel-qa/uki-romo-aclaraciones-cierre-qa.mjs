/** Aclaración del cierre, exactamente como Uki: nota, no movimiento financiero.
 * El panel de Romo es responsable de confirmar la copia mediante CAS Neon.
 */
const SUC='Romo’s Sushi La Serena';
const TURN=/^\d{4}-\d{2}-\d{2}@[1-9]\d{12,14}$/;
const need=(v,m)=>{if(!v)throw Error(m)};
const field=(v,max,n)=>{
 const text=String(v??'').trim().replace(/\s+/g,' ');
 need(text.length>0&&text.length<=max,n+' obligatorio o demasiado largo');
 return text;
};
export function prepararAclaracionCierreRomoQA(estado,{
 turnoClave,dato,correcto,responsable,motivo,registradoEn
}={}){
 need(estado?.suc===SUC&&Array.isArray(estado.cierres)&&
  estado.cierres.every(c=>c?.suc===SUC)&&
  (estado.ajustesHistoricos===undefined||
   Array.isArray(estado.ajustesHistoricos)&&
   estado.ajustesHistoricos.every(a=>a?.suc===SUC))&&
  Number.isSafeInteger(estado.nextId)&&estado.nextId>=1,
  'Se requiere la copia original de Romo');
 need(typeof turnoClave==='string'&&TURN.test(turnoClave),
  'Identificador de turno inválido');
 const matching=estado.cierres.filter(c=>c.turnoClave===turnoClave);
 need(matching.length===1,'Cierre del turno ausente o duplicado');
 const original=matching[0];
 need(original.fechaOperativa===turnoClave.slice(0,10)&&
  Number.isSafeInteger(original.fechaMs)&&original.fechaMs>0&&
  Number.isSafeInteger(registradoEn)&&registradoEn>=original.fechaMs,
  'Fecha del cierre o de aclaración inconsistente');
 const note={
  dato:field(dato,100,'Dato'),
  correcto:field(correcto,200,'Valor correcto'),
  responsable:field(responsable,100,'Responsable'),
  motivo:field(motivo,300,'Motivo')
 };
 if(!Array.isArray(estado.ajustesHistoricos))estado.ajustesHistoricos=[];
 need(!estado.ajustesHistoricos.some(a=>a.tipo==='cierre_aclarado'&&
  a.turnoClave===turnoClave&&
  a.dato===note.dato&&a.correcto===note.correcto&&
  a.responsable===note.responsable&&a.motivo===note.motivo),
  'La misma aclaración ya figura en Historial');
 const item={
  id:estado.nextId++,suc:SUC,tipo:'cierre_aclarado',turnoClave,
  cierreMs:original.fechaMs,fechaOperativa:original.fechaOperativa,
  fechaISO:new Date(registradoEn).toISOString(),registradoEn,...note
 };
 estado.ajustesHistoricos.push(item);
 return Object.freeze({tipo:item.tipo,turnoClave,id:item.id,
  responsable:item.responsable,fechaISO:item.fechaISO});
}
