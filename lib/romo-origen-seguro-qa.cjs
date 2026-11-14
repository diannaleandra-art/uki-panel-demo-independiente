'use strict';
/**
 * Vercel GET from same-origin Safari often has no Origin header.
 * An absent Origin is permitted ONLY for GET when the request Host
 * exactly matches the configured authorized origin. All writes require
 * the explicit configured Origin. JWT and Romo roles remain mandatory.
 */
function esOrigenAutorizadoRomoQA(req,expected){
 if(typeof expected!=='string'||!/^https:\/\/[^\/\s?#@]+$/.test(expected))return false;
 const origin=req?.headers?.origin;
 if(typeof origin==='string'&&origin.length>0)return origin===expected;
 if(req?.method!=='GET')return false;
 const host=String(req?.headers?.host||'').trim().toLowerCase();
 if(!host||host.includes('@')||host.includes('/')||host.includes(','))return false;
 try{return host===new URL(expected).host.toLowerCase()}catch{return false}
}
module.exports={esOrigenAutorizadoRomoQA};
