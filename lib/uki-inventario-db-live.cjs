'use strict';
const LIVE_HOSTS=new Set([
 'ep-jolly-paper-b5r8w6vu.c-7.us-east-2.aws.neon.tech',
 'ep-jolly-paper-b5r8w6vu-pooler.c-7.us-east-2.aws.neon.tech'
]);
function url(env=process.env){
 if(env.VERCEL_ENV!=='production'||env.UKI_INVENTARIO_LIVE_ENABLED!=='true')return null;
 let u;try{u=new URL(String(env.UKI_INVENTARIO_LIVE_DATABASE_URL||''));}catch{return null;}
 return ['postgres:','postgresql:'].includes(u.protocol)&&LIVE_HOSTS.has(u.hostname)?u.toString():null;
}
module.exports={url,LIVE_HOSTS};
