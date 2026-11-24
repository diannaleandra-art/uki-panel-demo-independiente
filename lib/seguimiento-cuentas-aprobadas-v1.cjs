'use strict';
/*
 * Datos bancarios de destino confirmados por el comercio, no credenciales.
 * Verifica que el backend NUNCA presente una cuenta distinta a la aprobada.
 * NO acredita el abono recibido. Requiere además verificado=true y un
 * titular bancario verificado por la operación; no inventa ese nombre.
 */
const {bankDetailsFor}=require('./seguimiento-tres-sucursales-v1.cjs');
const APPROVED=Object.freeze({
 'uki:arica':Object.freeze({
  rut:'77836056K',cuenta:'000094078580',correo:'ukisucursales@gmail.com'
 }),
 'uki:serena':Object.freeze({
  rut:'77836056K',cuenta:'000094078580',correo:'ukisucursales@gmail.com'
 }),
 'romo:serena':Object.freeze({
  rut:'176266074',cuenta:'000075941471',correo:'pato.romo.c@gmail.com'
 })
});
const onlyDigits=value=>String(value||'').replace(/[^0-9]/g,'');
const normalizeRut=value=>String(value||'').replace(/[^0-9k]/gi,'').toUpperCase();
const normalizeBank=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
const normalizeType=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
function validatedDestination(storeId,raw){
 const approved=APPROVED[storeId],bank=bankDetailsFor(storeId,raw);
 if(!approved||!bank)return null;
 // Si una cuenta antigua de Mercado Pago (u otro banco/RUT) quedó guardada
 // por error como verificada, jamás mostrarla ni habilitar «Ya transferí».
 if(!/^(?:banco )?santander(?: chile)?$/.test(normalizeBank(bank.banco))||
    !/^(?:cuenta )?corriente$/.test(normalizeType(bank.tipo))||
    onlyDigits(bank.cuenta)!==approved.cuenta||
    normalizeRut(bank.rut)!==approved.rut||
    bank.correo.trim().toLowerCase()!==approved.correo)
  return null;
 return bank;
}
module.exports={APPROVED,validatedDestination};
