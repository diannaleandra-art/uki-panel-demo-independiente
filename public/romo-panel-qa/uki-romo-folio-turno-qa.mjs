/**
 * Folio del turno Romo: lectura PURA sobre el snapshot cifrado ya confirmado.
 * Prohíbe inventar una apertura o alterar cajasDiarias antes de CAS Neon.
 * Nunca modifica las dos sucursales Uki.
 */
export const ROMO_FOLIO_LECTURA_QA=true;
const SUC='Romo’s Sushi La Serena';
const fail=msg=>{throw Error(msg)};
export function obtenerTurnoRomoFolioQA(estado,{fechaOperativa,registradoEn}={}){
 if(estado?.suc!==SUC||!Array.isArray(estado.pedidos)||
    !estado.cajasDiarias||typeof estado.cajasDiarias!=='object'||
    Array.isArray(estado.cajasDiarias)||
    !Array.isArray(estado.cierres))fail('El estado no corresponde a Romo La Serena');
 if(typeof fechaOperativa!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fechaOperativa)||
    !Number.isSafeInteger(registradoEn)||registradoEn<=0)
  fail('Fecha o momento del pedido Romo inválidos');
 const caja=estado.cajasDiarias[SUC+'|'+fechaOperativa];
 if(caja?.turnoAbierto!==true||!Number.isSafeInteger(caja.inicioMs)||
    caja.inicioMs<=0||caja.inicioMs>registradoEn)
  fail('Abre y confirma primero el turno de Romo en Caja');
 const clave=fechaOperativa+'@'+caja.inicioMs;
 if(caja.turnoId!==clave||estado.cierres.some(c=>c.turnoClave===clave))
  fail('El turno de Romo ya cerró o no está confirmado');
 if(estado.pedidos.some(p=>p?.suc!==SUC))
  fail('Hay pedidos de otra sucursal en el estado Romo');
 const existentes=estado.pedidos.filter(p=>p.turnoClave===clave);
 const numeraciones=existentes.map(p=>Number(p.numeroTurno));
 if(numeraciones.some(n=>!Number.isSafeInteger(n)||n<1))
  fail('Revisa la numeración del turno de Romo');
 const proximo=Math.max(existentes.length,...numeraciones,0)+1;
 if(!Number.isSafeInteger(proximo)||proximo<1||proximo>100000000)
  fail('El folio del turno Romo no es válido');
 return Object.freeze({numero:proximo,clave});
}
