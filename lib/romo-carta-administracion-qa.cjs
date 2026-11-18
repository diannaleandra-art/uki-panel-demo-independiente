'use strict';
/**
 * Gestión administrativa aislada de Romo · QA.
 * Los datos nuevos son borradores administrativos: NUNCA forman parte de la
 * carta comercial hasta que exista una proyección y pruebas de cotización.
 */
const {randomUUID}=require('node:crypto');
const STORE='romo:serena';
const OBJ=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const NAME=x=>typeof x==='string'&&x.trim().length>=2&&x.trim().length<=100;
const PRICE=x=>Number.isSafeInteger(x)&&x>=1&&x<=1000000;
const slugify=x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
const empty=()=>({categories:[],categoryNames:{},categoryHidden:[],assignments:{},
  products:[],ingredients:[],ingredientOverrides:{},promotions:[],discounts:{}});
const fail=msg=>{const e=new Error(msg);e.status=400;throw e;};
function read(row){
 if(!row)return {revision:0,data:empty()};
 const revision=Number(row.revision);
 const data=typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido;
 if(!Number.isSafeInteger(revision)||revision<0||!OBJ(data)||
    row.store_id!==STORE)throw Error('Estado de gestión Romo inválido');
 const result={...empty(),...data};
 for(const field of ['categories','categoryHidden','products','ingredients','promotions'])
  if(!Array.isArray(result[field]))throw Error('Lista de gestión Romo inválida');
 for(const field of ['categoryNames','assignments','ingredientOverrides','discounts'])
  if(!OBJ(result[field]))throw Error('Configuración de gestión Romo inválida');
 return {revision,data:result};
}
const checkBase=base=>{
 if(!base||base.storeId!==STORE||base.brand!=='romo'||base.branch!=='serena'||
    base.readOnly!==true||!Array.isArray(base.products)||base.products.length!==40||
    !Array.isArray(base.categories)||!Array.isArray(base.ingredients))
  throw Error('La carta aprobada de Romo no se puede comprobar');
};
function view(row,base){
 checkBase(base);
 const {revision,data}=read(row);
 return {ok:true,storeId:STORE,revision,readOnly:true,
    draftOnly:true,baseCount:base.products.length,data};
}
const fields=(obj,allowed)=>{
 if(!OBJ(obj))fail('Datos de formulario inválidos');
 if(Object.keys(obj).some(k=>!allowed.includes(k)))fail('Campos adicionales no permitidos');
};
const choice=(data,base,slug)=>{
 if(typeof slug!=='string'||slug.length>70)fail('Categoría inválida');
 if(slug===''||slug==='sin-categoria')return true;
 return [...base.categories,...data.categories].some(c=>c.slug===slug&&!data.categoryHidden.includes(slug));
};
const validReason=x=>typeof x==='string'&&x.trim().length>=4&&x.trim().length<=300;
const idx=(arr,id)=>arr.findIndex(x=>x.id===id||x.sku===id);
function validProduct(item){
 fields(item,['name','price','description','categoriaSlug','available']);
 if(!NAME(item.name)||!PRICE(item.price)||typeof item.categoriaSlug!=='string'||
   typeof (item.description||'')!=='string'||(item.description||'').length>500||
   typeof item.available!=='boolean')fail('Datos de producto inválidos');
}
function validIngredient(item){
 fields(item,['name','category','surcharge','surfaces','available']);
 if(!NAME(item.name)||!['vegetal','proteina','envoltura'].includes(item.category)||
   !Number.isSafeInteger(item.surcharge)||item.surcharge<0||item.surcharge>50000||
   !Array.isArray(item.surfaces)||!item.surfaces.length||item.surfaces.length>6||
   item.surfaces.some(s=>!['classic','premium','monthly','handroll','burger','gohan'].includes(s))||
   typeof item.available!=='boolean')fail('Datos de ingrediente inválidos');
}
function validPromo(item){
 fields(item,['name','description','price','promoType','rollCount','piecesPerRoll',
    'sauceCount','korokes','payments','available']);
 if(!NAME(item.name)||!PRICE(item.price)||
   typeof item.description!=='string'||item.description.length>500||
   !['sushi','gohan','combo'].includes(item.promoType)|| // Romo no vende pizzas
   !Number.isInteger(item.rollCount)||item.rollCount<0||item.rollCount>20||
   ![10,12].includes(item.piecesPerRoll)||
   !Number.isInteger(item.sauceCount)||item.sauceCount<0||item.sauceCount>20||
   !Number.isInteger(item.korokes)||item.korokes<0||item.korokes>30||
   !Array.isArray(item.payments)||!item.payments.length||item.payments.length>5||
   item.payments.some(x=>!['efectivo','transferencia','debito','edenred','junaeb'].includes(x))||
   typeof item.available!=='boolean')fail('Datos de promoción inválidos');
}
function apply(state,base,action,fieldsIn){
 checkBase(base);
 if(!/^[a-z][a-z-]{3,39}$/.test(String(action||'')))fail('Acción no permitida');
 const {revision}=state;
 const data=structuredClone(state.data);
 const f=fieldsIn;
 let id='',before=null,after=null;
 const baseCats=new Set(base.categories.map(c=>c.slug));
 const baseProducts=new Set(base.products.map(p=>p.sku));
 const baseIngredients=new Set(base.ingredients.map(x=>x.sku));
 const ensureId=()=>{if(typeof f.id!=='string'||f.id.length>100)fail('Identificador inválido');id=f.id;};
 if(action==='category-create'){
  fields(f,['name']);
  if(!NAME(f.name)||f.name.trim().length>45)fail('Nombre de categoría inválido');
  const slug=slugify(f.name);if(!slug||slug.length<2)fail('Nombre de categoría inválido');
  if([...baseCats,...data.categories.map(c=>c.slug)].includes(slug))fail('La categoría ya existe');
  after={slug,nombre:f.name.trim()};data.categories.push(after);id='category:'+slug;
 }else if(action==='category-rename'){
  fields(f,['id','name']);ensureId();
  if(!NAME(f.name)||f.name.trim().length>45)fail('Nombre de categoría inválido');
  const c=base.categories.find(c=>c.slug===id)||data.categories.find(c=>c.slug===id);
  if(!c||data.categoryHidden.includes(id))fail('Categoría no encontrada');
  const name=f.name.trim(),current=data.categoryNames[id]||c.nombre;
  if(name===current)fail('No hay cambios');
  if([...base.categories,...data.categories].some(x=>x.slug!==id&&(data.categoryNames[x.slug]||x.nombre).toLowerCase()===name.toLowerCase()))fail('Ya existe ese nombre');
  before={name:current};data.categoryNames[id]=name;after={name};
 }else if(action==='category-delete'){
  fields(f,['id']);ensureId();
  const exists=baseCats.has(id)||data.categories.some(c=>c.slug===id);
  if(!exists||data.categoryHidden.includes(id))fail('Categoría no encontrada');
  // Se oculta sin borrar jamás productos. Los productos siguen registrados.
  const i=data.categories.findIndex(c=>c.slug===id);
  before={id};if(i>=0)data.categories.splice(i,1);
  else data.categoryHidden.push(id);
  delete data.categoryNames[id];
  // Quitar asignaciones explícitas; los productos originales no se modifican.
  for(const sku of Object.keys(data.assignments))
   if(data.assignments[sku]===id)delete data.assignments[sku];
  for(const prod of data.products)if(prod.categoriaSlug===id)prod.categoriaSlug='';
  after={hidden:true};
 }else if(action==='category-assign'){
  fields(f,['id','category']);ensureId();
  if(!baseProducts.has(id)&&!data.products.some(p=>p.sku===id)&&
     !data.promotions.some(p=>p.sku===id))fail('Producto desconocido');
  if(!choice(data,base,f.category))fail('Categoría desconocida');
  before={category:data.assignments[id]??null};
  data.assignments[id]=f.category;after={category:f.category};
 }else if(action==='product-create'){
  fields(f,['item']);validProduct(f.item);
  if(!choice(data,base,f.item.categoriaSlug))fail('Categoría desconocida');
  if(data.products.length>=70)fail('Límite de productos de prueba');
  id='custom:'+randomUUID();
  after={sku:id,...f.item,description:f.item.description||'',status:'borrador'};
  data.products.push(after);
 }else if(action==='product-edit'){
  fields(f,['id','item']);ensureId();validProduct(f.item);
  if(!choice(data,base,f.item.categoriaSlug))fail('Categoría desconocida');
  const i=idx(data.products,id);if(i<0)fail('Producto personalizado no encontrado');
  before=data.products[i];after={...before,...f.item};
  data.products[i]=after;
 }else if(action==='product-delete'){
  fields(f,['id']);ensureId();const i=idx(data.products,id);
  if(i<0)fail('Solo se eliminan productos creados en Romo, no los aprobados');
  before=data.products[i];data.products.splice(i,1);after={deleted:true};
 }else if(action==='ingredient-create'){
  fields(f,['item']);validIngredient(f.item);
  if(data.ingredients.length>=100)fail('Límite de ingredientes de prueba');
  if(data.ingredients.some(x=>x.category===f.item.category&&
      x.name.toLowerCase()===f.item.name.trim().toLowerCase()))fail('El ingrediente ya existe');
  id='ingredient:'+randomUUID();after={sku:id,...f.item};data.ingredients.push(after);
 }else if(action==='ingredient-edit'){
  fields(f,['id','item']);ensureId();validIngredient(f.item);
  const i=idx(data.ingredients,id);if(i<0)fail('Ingrediente personalizado no encontrado');
  before=data.ingredients[i];after={...before,...f.item};data.ingredients[i]=after;
 }else if(action==='ingredient-availability'){
  fields(f,['id','available']);ensureId();
  if(typeof f.available!=='boolean')fail('Estado inválido');
  const i=idx(data.ingredients,id);
  if(i>=0){before=data.ingredients[i];after={...before,available:f.available};data.ingredients[i]=after;}
  else if(baseIngredients.has(id)){before=data.ingredientOverrides[id]||null;
   after={...before,available:f.available};data.ingredientOverrides[id]=after;}
  else fail('Ingrediente desconocido');
 }else if(action==='promotion-create'){
  fields(f,['item']);validPromo(f.item);
  if(data.promotions.length>=30)fail('Límite de promociones de prueba');
  id='promo:'+randomUUID();after={sku:id,...f.item,status:'borrador',photo:null};
  data.promotions.push(after);
 }else if(action==='promotion-edit'){
  fields(f,['id','item']);ensureId();validPromo(f.item);
  const i=idx(data.promotions,id);if(i<0)fail('Promoción personalizada no encontrada');
  before=data.promotions[i];after={...before,...f.item,status:'borrador'};data.promotions[i]=after;
 }else if(action==='promotion-delete'){
  fields(f,['id']);ensureId();const i=idx(data.promotions,id);
  if(i<0)fail('Solo promociones creadas en Romo');
  before=data.promotions[i];data.promotions.splice(i,1);after={deleted:true};
 }else if(action==='discount-set'){
  fields(f,['id','percent']);ensureId();
  if(!baseProducts.has(id)&&!data.products.some(p=>p.sku===id)&&
     !data.promotions.some(p=>p.sku===id))fail('Producto desconocido');
  if(!Number.isInteger(f.percent)||f.percent<0||f.percent>99)fail('Descuento inválido');
  before={percent:data.discounts[id]||0};
  if(f.percent===0)delete data.discounts[id];
  else data.discounts[id]=f.percent;
  after={percent:f.percent};
 }else fail('Acción no permitida');
 if(JSON.stringify(before)===JSON.stringify(after))fail('No hay cambios');
 if(Buffer.byteLength(JSON.stringify(data),'utf8')>145000)fail('Gestión excede tamaño permitido');
 return {id,action,revision:revision+1,data,before,after};
}
module.exports={STORE,empty,read,view,apply,validProduct,validIngredient,validPromo};