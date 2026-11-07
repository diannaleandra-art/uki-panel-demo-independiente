// Delivery por recorrido real de calles. El cliente paga el mismo valor que el repartidor.
export const deliveryOrigins={
 arica:{lat:-29.9495625,lng:-71.269984375},
 serena:{lat:-29.9154375,lng:-71.2523125}
};
export const deliveryBands=[[1,1000],[2,1500],[3,2000],[4,2500],[4.5,2800],[5,3100],[6,3300],[7,3500],[8,3700],[9,3900]];
const point=(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
const pair=s=>{const m=String(s||'').trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);return m?point(Number(m[1]),Number(m[2])):null};
export function locationPoint(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;const h=u.hostname.toLowerCase(),google=/^(?:www\.)?google\.(?:com|cl)$/.test(h)||h==='maps.google.com',apple=h==='maps.apple.com',osm=/^(?:www\.)?openstreetmap.org$/.test(h);if(!google&&!apple&&!osm)return null;if(google){const s=decodeURIComponent(u.pathname+u.search);const m=s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);if(m)return point(Number(m[1]),Number(m[2]));for(const k of ['q','query','destination']){const p=pair(u.searchParams.get(k));if(p)return p}}if(apple)return pair(u.searchParams.get('ll'));if(osm&&u.searchParams.has('mlat')&&u.searchParams.has('mlon'))return point(Number(u.searchParams.get('mlat')),Number(u.searchParams.get('mlon')));return null}catch{return null}}
export function radiusKm(a,b){const rad=n=>n*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),v=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 6371.0088*2*Math.asin(Math.sqrt(Math.min(1,v)))}
export function feeForRadius(km){
 if(!Number.isFinite(km)||km<0||km>9)return null;
 const raw=km<=1?1000:km<4.5?1000+(km-1)*500:2750+(km-4.5)*200+50+(km>=5?200:0);
 return Math.max(1000,Math.ceil((raw-0.000001)/100)*100);
}
const resolved=new Map(),inflight=new Map();
const keyFor=d=>{const p=locationPoint(d?.location);return d?.branch&&deliveryOrigins[d.branch]&&p?d.branch+'|'+p.lat.toFixed(7)+','+p.lng.toFixed(7):null};
export function deliveryQuote(d){
 if(d?.mode!=='delivery')return {status:'none',fee:0,km:null};
 if(!deliveryOrigins[d?.branch])return {status:'branch',fee:null,km:null};
 const key=keyFor(d);if(!key)return {status:'location',fee:null,km:null};
 const q=resolved.get(key);return q||{status:'pending',fee:null,km:null};
}
export async function resolveDeliveryRoute(d){
 const key=keyFor(d);if(!key)return deliveryQuote(d);
 if(resolved.has(key))return resolved.get(key);
 if(inflight.has(key))return inflight.get(key);
 const p=locationPoint(d.location);
 const promise=(async()=>{
  let result;
  try{
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
   let response;
   try{response=await fetch('/api/route?branch='+encodeURIComponent(d.branch)+'&lat='+encodeURIComponent(p.lat)+'&lng='+encodeURIComponent(p.lng),{signal:ctrl.signal,cache:'no-store'});}
   finally{clearTimeout(timer)}
   if(!response.ok)throw new Error('No se pudo consultar la ruta');
   const body=await response.json();
   if((body.status!=='priced'&&body.status!=='outside')||!Number.isFinite(body.km))throw new Error('Ruta no disponible');
   result={status:body.status,km:body.km,fee:body.status==='priced'?feeForRadius(body.km):null};
  }catch(e){result={status:'error',km:null,fee:null};}
  resolved.set(key,result);
  return result;
 })();
 inflight.set(key,promise);
 try{return await promise}finally{inflight.delete(key)}
}