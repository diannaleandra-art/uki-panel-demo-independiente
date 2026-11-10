'use strict';
const LIVE_HOSTS=new Set([
 'ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech',
 'ep-jolly-paper-b5r8w6vu-pooler.c-7.us-east-2.aws.neon.tech'
]);
// Las previews de esta rama usan SOLO la base de pruebas de Neon.
// Nunca se acepta el host de producción dentro del entorno QA.
const QA_HOSTS=new Set([
 'ep-lingering-glade-b5m4hfhu.c-7.us-east-2.aws.neon.tech',
 'ep-lingering-glade-b5m4hfhu-pooler.c-7.us-east-2.aws.neon.tech'
]);
const QA_REF='feature/uki-disponibilidad-manual-live-2026-11-06';
const QA_REF_ETAPA2='integracion/uki-promociones-ingredientes-seguros-qa-20261109';
const QA_REF_TIPOS='qa/uki-promos-tipos-producto-20261110';
function url(env=process.env){
 const prod=env.VERCEL_ENV==='production'&&env.UKI_INVENTARIO_LIVE_ENABLED==='true';
 const qa=env.VERCEL_ENV==='preview'&&(env.VERCEL_GIT_COMMIT_REF===QA_REF||(env.VERCEL_GIT_COMMIT_REF===QA_REF_ETAPA2||env.VERCEL_GIT_COMMIT_REF===QA_REF_TIPOS))&&env.UKI_INVENTARIO_QA_ENABLED==='true';
 if(!prod&&!qa)return null;
 let u;try{u=new URL(String(prod?env.UKI_INVENTARIO_LIVE_DATABASE_URL:env.UKI_INVENTARIO_QA_DATABASE_URL||''));}catch{return null;}
 const allowed=prod?LIVE_HOSTS:QA_HOSTS;
 return ['postgres:','postgresql:'].includes(u.protocol)&&allowed.has(u.hostname)?u.toString():null;
}
module.exports={url,LIVE_HOSTS,QA_HOSTS};
