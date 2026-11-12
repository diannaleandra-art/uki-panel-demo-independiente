/**
 * Presentación QA para la sección EXISTENTE #ukiPreciosPanel.
 * No crea otro panel, no llama APIs, no guarda ni toca pedidos/caja/Neon.
 * Es una vista de revisión embebible: solo cuando el panel seleccione Romo.
 * Hasta confirmar Google + permisos servidor y publicación, es SOLO LECTURA.
 */
import {normalizarCatalogoCompletoRomoQA} from './romo-editor-carta-compatibilidad-qa.mjs';
import {precioPublicoRomoQA} from './romo-categorias-descuentos-qa.mjs';

const STORE='romo:serena';
export const ROMO_CARTA_VISTA_EN_PANEL_SOLO_QA=true;
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+Number(n).toLocaleString('es-CL');
const label=(x)=>html(x);

function badge(item){
 if(!item.visible)return '<strong class="romo-estado" style="color:#6b6b6b">Retirado</strong>';
 if(!item.available)return '<strong class="romo-estado" style="color:#b4232e">Agotado</strong>';
 return '<strong class="romo-estado" style="color:#1e6135">Disponible</strong>';
}
function amount(item){
 const p=precioPublicoRomoQA(item.price,item.discountPercent??0);
 return p.descuentoPorcentaje>0
 ?'<span><s style="color:#555">Antes '+money(p.precioOriginal)+'</s>'+
  ' <strong style="color:#b4232e">Ahora '+money(p.price)+'</strong>'+
  ' <small>−'+p.descuentoPorcentaje+'%</small></span>'
 :'<strong>'+money(p.price)+'</strong>';
}
function row(item,group){
 const promo=group==='promociones';
 const info=promo
  ?'<p class="romo-detalle-qa">'+html(item.rollCount?item.rollCount+' rolls × '+item.piecesPerRoll+' piezas':'Combo sin armado')+
   ' · '+Number(item.sauceCount)+' salsas · '+Number(item.korokes)+' korokes</p>'
  :'<p class="romo-detalle-qa">'+html(item.group||'')+'</p>';
 return '<article class="romo-fila-carta-qa" style="padding:12px;border:1px solid #e4d3ce;border-radius:12px;margin:8px 0;background:#fff">'+
  '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
  '<div><strong>'+html(item.name)+'</strong>'+info+'</div>'+
  '<div>'+badge(item)+'</div></div>'+
  '<div>'+amount(item)+'</div>'+
  (item.categoriaSlug?'<small>Categoría: '+html(item.categoriaSlug)+'</small>':'')+
  '</article>';
}
function section(title,items,group){
 return '<section class="romo-seccion-carta-qa" style="padding:12px 0">'+
  '<h3 style="margin:0 0 8px;color:#181818">'+html(title)+' <small>('+items.length+')</small></h3>'+
  (items.length?items.map(x=>row(x,group)).join(''):
   '<p style="color:#555">Todavía no hay registros en esta sección.</p>')+
  '</section>';
}
export function vistaCartaRomoEnPanelUnicoQA(snapshot){
 if(snapshot==null)
  return Object.freeze({storeId:STORE,initialized:false,revision:0,
   categories:[],products:[],promotions:[],ingredients:[]});
 const x=normalizarCatalogoCompletoRomoQA(snapshot);
 const categories=(x.categories||[]).map(c=>Object.freeze({
  slug:c.slug,nombre:c.nombre,visible:c.visible,version:c.version,
  count:x.products.filter(p=>p.categoriaSlug===c.slug).length+
        x.promotions.filter(p=>p.categoriaSlug===c.slug).length
 }));
 return Object.freeze({storeId:STORE,initialized:true,revision:x.revision,
  categories:Object.freeze(categories),
  products:Object.freeze(x.products),
  promotions:Object.freeze(x.promotions),
  ingredients:Object.freeze(x.ingredients)});
}
export function htmlCartaRomoEnPanelUnicoQA(snapshot){
 const v=vistaCartaRomoEnPanelUnicoQA(snapshot);
 if(!v.initialized)return '<section aria-label="Carta y precios de Romo" '+
  'style="padding:15px;color:#171717;background:#fff;border:2px solid #b4232e;border-radius:14px">'+
  '<h2 style="color:#171717">Carta y precios · Romo’s Sushi La Serena</h2>'+
  '<p>Catálogo de Romo aún no configurado. No se han creado productos ni promociones ficticios.</p>'+
  '<nav aria-label="Secciones de la carta Romo" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0">'+
   ['Categorías','Productos','Promociones','Ingredientes'].map(x=>'<div style="padding:12px;border:1px solid #d6c5c4;border-radius:10px;background:#fff;color:#171717"><strong>'+x+'</strong><small style="display:block;color:#555">0 registrados</small></div>').join('')+'</nav>'+
  '<p><strong>Vista privada de pruebas. Sin guardado ni publicación.</strong></p></section>';
 const cats=v.categories;
 return '<section aria-label="Carta y precios de Romo" data-store-id="romo:serena" '+
  'style="padding:14px;color:#171717;background:#fff;border:2px solid #b4232e;border-radius:14px">'+
  '<h2 style="color:#171717">Carta y precios · Romo’s Sushi La Serena</h2>'+
  '<p>Balmaceda 1612 · Datos independientes de Uki · Revisión '+v.revision+'</p>'+
  '<p role="status"><strong>VISTA PRIVADA DE PRUEBA · No guarda ni publica</strong></p>'+
  '<section><h3>Categorías ('+cats.length+')</h3>'+
   (cats.length?cats.map(c=>'<article style="padding:11px;margin:7px 0;border:1px solid #ded5cc;border-radius:10px">'+
    '<strong>'+label(c.nombre)+'</strong>'+
    ' <small>('+c.count+' productos/promociones)</small>'+
    (c.visible?'':' <small>Retirada de la carta</small>')+'</article>').join(''):
    '<p style="color:#555">Aún no hay categorías personalizadas.</p>')+
  '</section>'+
  section('Productos',v.products,'productos')+
  section('Promociones',v.promotions,'promociones')+
  '<section><h3>Ingredientes ('+v.ingredients.length+')</h3>'+
  v.ingredients.map(i=>'<p style="padding:6px 0">'+html(i.name)+' · '+html(i.category)+
    ' · '+money(i.surcharge)+' · '+(i.available?'Disponible':'Agotado')+
    (i.visible?'':' · Retirado')+'</p>').join('')+
  '</section></section>';
}
/**
 * Montaje futuro en la sección REAL del mismo panel; nunca fuera de ella.
 * La integración del login/selección de tienda deberá llamar esto sólo para
 * Romo. No altera ni oculta los controles de Uki durante la preparación.
 */
export function montarVistaCartaRomoEnPanelUnicoQA({document,storeId,snapshot}={}){
 if(storeId!==STORE)throw Error('Romo no puede montar datos de Uki ni otra sucursal');
 const host=document?.getElementById?.('ukiPreciosPanel');
 if(!host)throw Error('Sección Carta y precios del panel único no encontrada');
 let region=document.getElementById('romoCartaQAContenido');
 if(region&&!host.contains(region))throw Error('La región Romo debe estar dentro del editor único');
 if(!region){
  region=document.createElement('div');
  region.id='romoCartaQAContenido';
  host.append(region);
 }
 region.innerHTML=htmlCartaRomoEnPanelUnicoQA(snapshot);
 return region;
}
