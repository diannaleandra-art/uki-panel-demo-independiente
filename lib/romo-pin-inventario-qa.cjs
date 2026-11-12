'use strict';
/**
 * Romo La Serena — mismo formato de ingreso de inventario que Uki.
 * Preparación exclusivamente QA: validación y hash por separado, sin
 * crear códigos reales, sin endpoint ni privilegios de pedidos o caja.
 */
const {randomBytes,pbkdf2Sync,timingSafeEqual}=require('node:crypto');
const STORE_ID='romo:serena';
const CODE=/^[0-9]{6}$/;
const NAME=/^[^\r\n<>]{2,60}$/;
const SALT=/^[a-f0-9]{32}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const ITERATIONS=210000;
function valido(code){return typeof code==='string'&&CODE.test(code)}
function nombreValido(value){
 return typeof value==='string'&&NAME.test(value.trim())&&
  value.trim().replace(/\s+/g,' ').length>=2;
}
function crearRegistro(code){
 if(!valido(code))throw Error('Se requiere un código de seis números para inventario');
 const salt=randomBytes(16);
 return Object.freeze({
  store_id:STORE_ID,salt:salt.toString('hex'),
  hash:pbkdf2Sync(code,salt,ITERATIONS,32,'sha256').toString('hex')
 });
}
function comprobarCodigo(code,row){
 if(!valido(code)||!row||row.store_id!==STORE_ID||
  typeof row.salt!=='string'||!SALT.test(row.salt)||
  typeof row.hash!=='string'||!DIGEST.test(row.hash))return false;
 const computed=pbkdf2Sync(code,Buffer.from(row.salt,'hex'),ITERATIONS,32,'sha256');
 const original=Buffer.from(row.hash,'hex');
 return timingSafeEqual(computed,original);
}
const trabajadorPuede=Object.freeze(['inventory.read','inventory.write']);
function permiteTrabajadorOperacion(operation){
 return trabajadorPuede.includes(operation);
}
module.exports={STORE_ID,valido,nombreValido,crearRegistro,comprobarCodigo,permiteTrabajadorOperacion};
