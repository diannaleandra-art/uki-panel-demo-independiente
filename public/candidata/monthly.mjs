export const monthlyPromos=[
{id:'handroll-individual',name:'Handroll a tu gusto',price:3800,unit:'handroll',rollCount:1,size:null,sauceCount:1,korokes:0,standalone:true,proteins:['Pollo','Kanicama','Berenjena crispy'],wraps:['Panko','Tempura'],payments:['efectivo','transferencia','debito','edenred'],photo:'assets/handroll-tabla-real.jpeg'},
{id:'antojo-doble',name:'Antojo doble',price:6800,unit:'handroll',rollCount:2,size:null,sauceCount:2,korokes:2,proteins:['Pollo','Kanicama'],wraps:['Panko','Tempura'],payments:['efectivo','transferencia'],photo:'assets/antojo-doble-caricatura.png'},
{id:'sesenta-ahorro',name:'Promo 60 piezas + 3 korokes',price:16000,unit:'roll',rollCount:5,size:60,sauceCount:5,korokes:3,proteins:['Pollo','Kanicama'],wraps:['Tempura','Panko','Ciboulette','Sésamo','Merkén','Pepino','Mixta','Nori'],payments:['efectivo','transferencia'],photo:'assets/promo-60-caricatura.png'},
{id:'sesenta-edenred',name:'Promo Edenred · 60 piezas + 4 korokes',price:18000,unit:'roll',rollCount:5,size:60,sauceCount:4,korokes:4,proteins:['Pollo','Kanicama'],wraps:['Tempura','Panko','Ciboulette','Sésamo','Merkén','Pepino','Mixta','Nori'],payments:['edenred'],photo:'assets/promo-edenred-caricatura.png'},
{id:'ciento-ocho-mes',name:'Promo 108 piezas + 3 korokes + 8 salsas',price:27500,unit:'roll',rollCount:9,size:108,sauceCount:8,korokes:3,proteins:['Pollo','Kanicama'],wraps:['Tempura','Panko','Ciboulette','Sésamo','Merkén','Pepino','Mixta','Nori'],payments:['efectivo','transferencia'],photo:'/uki-promo-108-original.avif',description:'9 rolls de 12 piezas. Pollo o kanicama incluidos, vegetal a elección, distintas envolturas. Solo efectivo o transferencia. Otros ingredientes pueden tener recargo.'}
];
export function monthlyPayments(cart,options=['efectivo','transferencia','debito','edenred']){return cart.filter(i=>i.kind==='monthly').reduce((opts,i)=>{const p=monthlyPromos.find(p=>p.id===i.productId);return p?opts.filter(v=>p.payments.includes(v)):[]},options)}
export function validateMonthly(i,vegetables,sauces){
 const p=monthlyPromos.find(p=>p.id===i.productId);
 if(!p)return 'Elige una promo disponible.';
 if(!Number.isInteger(i.qty)||i.qty<1||i.qty>20)return 'Revisa la cantidad de promos.';
 if(i.rolls?.length!==p.rollCount)return 'Completa todas las preparaciones.';
 for(let n=0;n<i.rolls.length;n++){
  const r=i.rolls[n],veg=!!r.vegetariano;
  if((veg&&r.soloProteina)||
   (veg?(!!r.protein||!!r.extraProtein):(!monthlyProteins(p).includes(r.protein)))||
   (r.soloProteina?!!r.vegetable||!!r.vegetable2:!vegetables.includes(r.vegetable))||
   (r.vegetable2&&(!veg||!vegetables.includes(r.vegetable2)||r.vegetable2===r.vegetable))||
   !monthlyWraps(p).includes(r.wrap)||
   (r.sinNori&&r.wrap==='Nori')||
   (veg&&['Jamón serrano','Salmón ahumado','Salmón palta'].includes(r.wrap))||
   (r.extraProtein&&!monthlyExtraProteins.some(x=>x[0]===r.extraProtein)))
   return 'Revisa la proteína, el vegetal y la envoltura del '+(p.unit==='handroll'?'handroll ':'roll ')+(n+1)+'. Un roll vegetariano no puede llevar carne o pescado ni una envoltura Nori si elegiste Sin nori.';
 }
 if(i.sauces?.length!==p.sauceCount||i.sauces.some(s=>!sauces.includes(s)))return 'Elige tus '+p.sauceCount+' salsas, entre soya y teriyaki.';
 return '';
}

export const monthlyExtraProteins=[['Cerdo',500],['Camarón',600],['Carne',1000],['Salmón',1800],['Pulpo',2000]];
export const monthlyExtraWraps=[['Queso',1000],['Palta',1000],['Queso maní',1300],['Queso ciboulette',1300],['Queso sésamo',1300],['Queso panko',1500],['Jamón serrano',2000],['Palta queso',2000],['Salmón ahumado',3000],['Salmón palta',2500]];
export const monthlyProteins=p=>[...p.proteins,...monthlyExtraProteins.map(x=>x[0])];
export const monthlyWraps=p=>p.unit==='handroll'?['Panko','Tempura']:[...p.wraps,...monthlyExtraWraps.map(x=>x[0])];
export function monthlyExtraCost(i){return i.rolls.reduce((sum,r)=>sum+(monthlyExtraProteins.find(x=>x[0]===r.protein)?.[1]||0)+(monthlyExtraProteins.find(x=>x[0]===r.extraProtein)?.[1]||0)+(monthlyExtraWraps.find(x=>x[0]===r.wrap)?.[1]||0),0)}
