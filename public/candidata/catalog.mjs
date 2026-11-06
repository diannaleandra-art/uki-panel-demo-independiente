export const catalogGroups=[['entradas','Entradas'],['gohan','Gohan'],['burger','Sushi Burger'],['fusion','Sushi Fusión · Toppings']];
export const dishes=[
{id:'korokes-4',group:'entradas',name:'4 korokes',price:2500,description:''},
{id:'gyozas-pollo',group:'entradas',name:'Gyozas de pollo',price:3000,description:''},
{id:'gyozas-camaron',group:'entradas',name:'Gyozas de camarón',price:3500,description:''},
{id:'alitas-papas',group:'entradas',name:'Alitas fritas con papas',price:7500,description:''},
{id:'papitas',group:'entradas',name:'Papitas fritas',price:2700,description:'Porción.'},
{id:'pollo-furay',group:'entradas',name:'Pollo furay con papas',price:6500,description:''},
{id:'gohan-vegetariano',group:'gohan',name:'Gohan vegetariano',price:5500,description:'Base de arroz, dos vegetales a elección, palta, queso crema y salsas.',vegetableCount:2,sauceChoice:true},
{id:'gohan-pollo',group:'gohan',name:'Gohan pollo teriyaki',price:6500,description:'Base de arroz, pollo teriyaki apanado, palta, queso crema, un vegetal a elección y salsas.',vegetableCount:1,sauceChoice:true},
{id:'gohan-camaron',group:'gohan',name:'Gohan camarón',price:7200,description:'Base de arroz, camarón apanado, palta, queso crema, un vegetal a elección y salsas.',vegetableCount:1,sauceChoice:true},
{id:'gohan-salmon',group:'gohan',name:'Gohan salmón',price:8000,description:'Base de arroz, salmón marinado, palta, queso crema, un vegetal a elección y salsas.',vegetableCount:1,sauceChoice:true},
{id:'sushi-burger',group:'burger',name:'Sushi Burger con papas',price:8000,description:'Papas fritas, dos vegetales, queso crema, proteína a elección y salsa.',vegetableCount:2,proteinChoice:true,sauceChoice:true,help:'Puedes agregar proteínas y vegetales extra con el recargo indicado.'},
];
dishes.push({id:'sushi-burger-promo',group:'promo',name:'Sushi Burguer · Promo del mes',price:5800,description:'Incluye pollo o kanikama, 2 vegetales y salsa soya o teriyaki; otras proteínas tienen recargo.',vegetableCount:2,proteinChoice:true,sauceChoice:true});
export const toppings=[
{id:'topping-carne',name:'Carne',price:3800},
{id:'topping-pollo',name:'Pollo con vegetales',price:3000},
{id:'topping-cerdo',name:'Cerdo teriyaki',price:3500},
{id:'topping-acevichado',name:'Acevichado',price:4000},
{id:'topping-vegetales',name:'Vegetales salteados',price:2500},
{id:'topping-repollo',name:'Repollo',price:2800}
];
export function toppingCost(item){return (item.toppings||[]).reduce((sum,t)=>{const p=toppings.find(p=>p.id===t.id);if(!p||!Number.isInteger(t.qty)||t.qty<1||t.qty>20)throw new Error('Topping inválido');return sum+p.price*t.qty},0)}
export function validateDish(item,vegetables,sauces){
 const p=dishes.find(p=>p.id===item.productId);
 if(!p)return 'Elige un producto de la carta.';
 const burger=['sushi-burger','sushi-burger-promo'].includes(p.id),vegBurger=burger&&!!item.vegetariano,soloBurger=burger&&!!item.soloProteina;
 if(vegBurger&&soloBurger)return 'Elige vegetariana o solo proteína, no ambas.';
 if(p.proteinChoice&&!vegBurger&&!['Pollo','Kanicama','Berenjena crispy','Cerdo','Camarón','Carne','Salmón'].includes(item.protein))
  return 'Elige una proteína de la Sushi Burger.';
 if(vegBurger&&(item.protein||(item.extraProteins||[]).some(x=>Number(x.qty)>0)))
  return 'La Sushi Burger vegetariana no lleva proteínas. Elige 3 vegetales distintos.';
 if(soloBurger&&((item.vegetables||[]).length>0||(item.extraVegetables||[]).some(x=>Number(x.qty)>0)))
  return 'Solo proteína significa sin vegetales. Desmarca los vegetales extra.';
 if(p.vegetableCount&&!soloBurger){
  const opts=vegetables.filter(v=>p.group!=='gohan'||v!=='Palta');
  const count=vegBurger?3:p.vegetableCount;
  if(item.vegetables?.length!==count||item.vegetables.some(v=>!opts.includes(v))||
   new Set(item.vegetables).size!==count)
   return 'Elige '+count+' '+(count===1?'vegetal':'vegetales distintos')+'.';
 }
 if(burger&&(
  (item.extraProteins||[]).some(x=>!burgerExtraProteins.some(p=>p[0]===x.name)||!Number.isInteger(x.qty)||x.qty<0||x.qty>20)||
  (item.extraVegetables||[]).some(x=>!vegetables.includes(x.name)||!Number.isInteger(x.qty)||x.qty<0||x.qty>20)
 ))return 'Revisa los extras de la Sushi Burger.';
 if(p.sauceChoice&&!sauces.includes(item.sauce))return 'Elige soya o teriyaki.';
 return '';
}

export const burgerExtraProteins=[['Pollo',600],['Cerdo',800],['Camarón',1000],['Kanicama',500],['Berenjena crispy',500],['Carne',1800],['Salmón',2500]];
export function burgerExtraCost(i){if(!['sushi-burger','sushi-burger-promo'].includes(i.productId))return 0;return ({'Pollo':0,'Kanicama':0,'Berenjena crispy':0,'Cerdo':800,'Camarón':1000,'Carne':1800,'Salmón':2500}[i.protein]||0)+(i.extraProteins||[]).reduce((sum,x)=>sum+(burgerExtraProteins.find(p=>p[0]===x.name)?.[1]||0)*x.qty,0)+(i.extraVegetables||[]).reduce((sum,x)=>sum+500*x.qty,0)}
