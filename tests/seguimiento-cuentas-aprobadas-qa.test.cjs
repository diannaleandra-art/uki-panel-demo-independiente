'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {APPROVED,validatedDestination}=require('../lib/seguimiento-cuentas-aprobadas-v1.cjs');
const banks={
 'uki:arica':{rut:'77.836.056-K',cuenta:'000094078580',correo:'Ukisucursales@gmail.com'},
 'uki:serena':{rut:'77.836.056-K',cuenta:'000094078580',correo:'Ukisucursales@gmail.com'},
 'romo:serena':{rut:'17.626.607-4',cuenta:'000075941471',correo:'Pato.romo.c@gmail.com'}
};
const wrap=(storeId,overrides={})=>({
 [storeId]:{sucursal:storeId,verificado:true,banco:'Banco Santander',
  tipo:'Cuenta corriente',titular:'Titular legal confirmado en QA',
  ...banks[storeId],...overrides}
});
for(const storeId of Object.keys(APPROVED)){
 test(storeId+' solo revela destino Santander exacto de esta sucursal',()=>{
  const got=validatedDestination(storeId,wrap(storeId));
  assert.ok(got);
  assert.equal(got.cuenta,banks[storeId].cuenta);
  assert.equal(got.rut,banks[storeId].rut);
  assert.equal(got.correo,banks[storeId].correo);
 });
 test(storeId+' no acepta datos antiguos aunque estén marcados verificados',()=>{
  const cases=[
   {banco:'Mercado Pago'},
   {banco:'Banco Santander falso'},
   {banco:'Otro banco'},
   {tipo:'Cuenta vista'},
   {cuenta:'000000000001'},
   {cuenta:'0'+banks[storeId].cuenta},
   {rut:'88.888.888-8'},
   {correo:'cuenta-antigua@ejemplo.cl'},
   {titular:''},
   {verificado:false},
   {sucursal:'otra:sucursal'}
  ];
  for(const mismatch of cases)
   assert.equal(validatedDestination(storeId,wrap(storeId,mismatch)),null,
    'Se filtró una cuenta no aprobada: '+JSON.stringify(mismatch));
 });
 test(storeId+' requiere datos completos para permitir la notificación bancaria',()=>{
  const missing=wrap(storeId);delete missing[storeId].cuenta;
  assert.equal(validatedDestination(storeId,missing),null);
  assert.equal(validatedDestination(storeId,{}),null);
  assert.equal(validatedDestination('sucursal-inexistente',wrap(storeId)),null);
 });
}
test('Uki comparte Santander entre Regimiento y La Serena; Romo usa otra cuenta sin cruces',()=>{
 assert.equal(APPROVED['uki:arica'].cuenta,APPROVED['uki:serena'].cuenta);
 assert.notEqual(APPROVED['uki:arica'].cuenta,APPROVED['romo:serena'].cuenta);
 for(const storeId of ['uki:arica','uki:serena'])
  assert.equal(validatedDestination(storeId,wrap('romo:serena')),null);
 assert.equal(validatedDestination('romo:serena',wrap('uki:arica')),null);
});
