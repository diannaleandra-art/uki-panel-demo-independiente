/* Romo La Serena: editor reservado para Carta y precios.
   PREPARADO EN GITHUB. NO CARGAR EN LA PÁGINA hasta habilitar el endpoint
   y comprobar el guardado/reflejo en carta durante prueba manual.
   Requiere sesión real de dueños por Google y permisos en Neon Romo.
*/
(function(){
  'use strict';
  const STORE='romo:serena';
  const SKU_PROMO_SOLO_UKI='dish:sushi-burger-promo';
  const visibleRomo=p=>p?.sku!==SKU_PROMO_SOLO_UKI;
  const API='/api/romo-carta-ediciones-seguras-qa';
  const $=(root,selector)=>root.querySelector(selector);
  const el=(tag,label,cls)=>{
    const e=document.createElement(tag);
    if(label!==undefined)e.textContent=label;
    if(cls)e.className=cls;
    return e;
  };
  const money=n=>'$'+Number(n).toLocaleString('es-CL');
  const state={current:null,filtered:[],busy:false,selectedSku:'',root:null,area:'productos'};
  function status(msg){
    const e=state.root?.querySelector('[data-romo-carta-status]');
    if(e)e.textContent=msg;
  }
  function clear(node){node?.replaceChildren();}
  function validateResponse(resp,result){
    if(!resp.ok||result?.ok!==true||result.storeId!==STORE)
      throw Error(result?.error||'La conexión de la carta Romo no está lista');
    return result;
  }
  async function request(method,payload){
    const token=await window.ukiInventarioToken?.();
    if(!token)throw Error('Debes entrar con tu cuenta Google de dueños de Romo.');
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};
    if(method==='POST')headers['Content-Type']='application/json';
    const res=await fetch(API,{
      method,credentials:'same-origin',cache:'no-store',headers,
      ...(method==='POST'?{body:JSON.stringify(payload)}:{})
    });
    const json=await res.json().catch(()=>null);
    return validateResponse(res,json);
  }
  function chosen(){
    return state.current?.products?.find(x=>visibleRomo(x)&&x.sku===state.selectedSku)||null;
  }
  function renderForm(){
    const root=state.root,box=$(root,'[data-romo-carta-form]');
    if(!root||!box)return;
    clear(box);
    // El modo lectura muestra productos, nunca controles de edición.
    if(state.current?.edicionHabilitada!==true)return;
    const p=chosen();
    if(!p)return;
    const title=el('h3','Editar · '+p.name);
    const info=el('p','Revisión '+state.current.revision+
      ' · Solo cambia este producto. No modifica recetas, pedidos ni ventas.');
    info.style.fontSize='13px';
    const form=el('form');
    form.noValidate=true;
    form.style.cssText='display:grid;gap:9px;max-width:580px';
    function input(label,value,kind,max){
      const wrap=el('label',label),field=el(kind||'input');
      if(kind!=='textarea'){field.type='text';field.value=String(value??'');}
      else{field.value=String(value??'');field.rows=3;}
      if(max)field.maxLength=max;
      field.style.cssText='display:block;width:100%;padding:10px;border:1px solid #aaa;border-radius:9px';
      wrap.append(field);form.append(wrap);return field;
    }
    const name=input('Nombre',p.name,'input',100);
    if(['classic','premium','extra'].includes(p.kind)){
      name.disabled=true;
      name.title='El nombre de este tipo de producto depende del armado aprobado';
    }
    const price=input('Precio en pesos',p.price,'input',10);
    price.type='number';price.min='1';price.max='1000000';price.step='1';
    const desc=input('Descripción',p.description||'','textarea',500);
    if(['classic','premium','topping','extra'].includes(p.kind)){
      desc.disabled=true;
      desc.title='Esta descripción todavía no está vinculada a la carta pública';
    }
    const categoryWrap=el('label','Categoría'),category=el('select');
    for(const c of state.current.categories||[])
      category.add(new Option(c.nombre,c.slug));
    category.value=p.categoriaSlug;
    category.disabled=true;
    category.title='La organización de categorías requiere el editor completo de Uki';
    category.style.cssText='display:block;width:100%;padding:10px;border:1px solid #aaa;border-radius:9px';
    categoryWrap.append(category);form.append(categoryWrap);
    const availableWrap=el('label'),available=el('input');
    available.type='checkbox';available.checked=p.available!==false;
    availableWrap.append(available,document.createTextNode(' Disponible en la carta'));
    form.append(availableWrap);
    const reason=input('Motivo obligatorio del cambio','','textarea',300);
    reason.rows=2;reason.required=true;
    const buttons=el('div');
    buttons.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
    const save=el('button','Guardar cambio en Romo');
    save.type='submit';
    save.disabled=state.current.revision<1;
    save.title=save.disabled?'Confirma primero la versión inicial sin alterar precios':'Guardar cambio auditado';
    save.style.cssText='background:#ad111f;color:white;border:0;padding:11px 15px;border-radius:10px;font-weight:700';
    const cancel=el('button','Cancelar');
    cancel.type='button';cancel.onclick=()=>{state.selectedSku='';renderForm();};
    cancel.style.cssText='background:white;border:1px solid #999;padding:11px 15px;border-radius:10px';
    buttons.append(save,cancel);form.append(buttons);
    form.onsubmit=async event=>{
      event.preventDefault();
      if(state.busy)return;
      if(state.current?.revision<1){status('Primero confirma la versión inicial de la carta aprobada.');return;}
      const changed={};
      const editedName=name.value.trim();
      if(editedName!==p.name)changed.name=editedName;
      const newPrice=Number(price.value);
      if(price.value.trim()===''||!Number.isSafeInteger(newPrice)||
         newPrice<1||newPrice>1000000){
        status('Revisa el precio; debe ser un valor entero.');return;
      }
      if(newPrice!==p.price)changed.price=newPrice;
      if(desc.value!==String(p.description||''))changed.description=desc.value;
      if(category.value!==p.categoriaSlug)changed.categoriaSlug=category.value;
      if(available.checked!==(p.available!==false))changed.available=available.checked;
      const motivo=reason.value.trim();
      if(!Object.keys(changed).length){status('No hay cambios que guardar.');return;}
      if(motivo.length<4){status('Escribe el motivo del cambio.');return;}
      if(!window.confirm('¿Guardar la edición de «'+p.name+'» en Romo?\n'+
         'El resultado debe verificarse manualmente en la carta correcta.'))return;
      state.busy=true;save.disabled=true;status('Guardando de forma segura en Romo…');
      try{
        const saved=await request('POST',{
          expectedRevision:state.current.revision,
          baseSha256:state.current.baseSha256,
          sku:p.sku,patch:changed,motivo
        });
        if(saved.guardado!==true||saved.auditado!==true||
           saved.revision!==state.current.revision+1)
          throw Error('El servidor no confirmó revisión y auditoría');
        state.current=await request('GET');
        state.selectedSku='';
        renderList();
        renderForm();renderExtras();
        status('✓ Edición auditada en Neon Romo. Falta comprobar manualmente '+
          'que la carta pública muestre exactamente el nuevo valor.');
      }catch(error){
        status('No se confirmó el cambio. Actualiza primero para evitar '+
          'sobrescribir cambios ajenos. '+String(error?.message||error));
      }finally{state.busy=false;save.disabled=false;}
    };
    box.append(title,info,form);
  }

  // Misma navegación de cuatro áreas aprobada en Uki; datos solo de Romo.
  // No inventar controles de guardado mientras el backend QA siga bloqueado.
  const AREAS=['productos','categorias','ingredientes','promociones'];
  function setArea(value){
    if(!AREAS.includes(value)||!state.root)return;
    state.area=value;
    for(const b of state.root.querySelectorAll('[data-romo-nav]')){
      const selected=b.dataset.romoNav===value;
      b.setAttribute('aria-pressed',String(selected));
      b.style.borderColor=selected?'#a80921':'#d9cdd0';
      b.style.background=selected?'#fff0f3':'#fff';
      b.style.boxShadow=selected?'inset 0 0 0 2px #a80921':'none';
    }
    for(const section of state.root.querySelectorAll('[data-romo-area]')){
      const selected=section.dataset.romoArea===value;
      section.hidden=!selected;
      section.style.display=selected?'block':'none';
    }
  }
  function aviso(text){
    const p=el('p',text);
    p.style.cssText='color:#66575a;font-size:13px;line-height:1.5;margin:6px 0 12px';
    return p;
  }
  function fila(heading,detail){
    const row=el('div');
    row.style.cssText='border-bottom:1px solid #e7dfe1;padding:11px 0;display:flex;gap:10px;justify-content:space-between;align-items:center';
    const info=el('div');
    const h=el('strong',heading);
    h.style.cssText='color:#231b1e;display:block;overflow-wrap:anywhere';
    const d=el('small',detail);
    d.style.cssText='display:block;color:#675d60;margin-top:3px;line-height:1.45';
    info.append(h,d);row.append(info);
    return row;
  }
  function renderExtras(){
    const root=state.root, current=state.current;
    if(!root)return;
    const categories=$(root,'[data-romo-categories-list]');
    const ingredients=$(root,'[data-romo-ingredients-list]');
    const promos=$(root,'[data-romo-promos-list]');
    if(!categories||!ingredients||!promos)return;
    clear(categories);clear(ingredients);clear(promos);
    const products=Array.isArray(current?.products)?current.products.filter(visibleRomo):[];
    const cats=Array.isArray(current?.categories)?current.categories:[];
    const ing=Array.isArray(current?.ingredients)?current.ingredients:[];
    categories.append(aviso('Categorías actuales de Romo, independientes de Uki. Crear, renombrar y eliminar categorías exige completar el guardado protegido en Neon; aquí no se crean registros de prueba.'));
    for(const c of cats){
      const belonging=products.filter(p=>p.categoriaSlug===c.slug);
      const row=fila(c.nombre,belonging.length+' productos · '+c.slug);
      const open=el('button','Ver productos');
      open.type='button';
      open.style.cssText='flex-shrink:0;border:1px solid #b01b31;border-radius:9px;padding:8px 9px;background:white;color:#a00b22;font-weight:650';
      open.onclick=()=>{
        const filter=$(root,'[data-romo-carta-category]');
        if(filter)filter.value=c.slug;
        renderList();setArea('productos');
      };
      row.append(open);categories.append(row);
    }
    const search=String($(root,'[data-romo-ingredient-search]')?.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const matching=ing.filter(p=>!search||String(p.name+' '+p.category).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search));
    ingredients.append(aviso(ing.length+' ingredientes aprobados en las recetas. Los recargos se muestran según el tipo de armado; la edición todavía no está habilitada en este apartado.'));
    const contextLabels={clasicas:'Clásicas',premium:'Premium',mensual_extra:'Extra de promoción',burger_extra:'Extra de burger',salsas_incluidas:'Salsas incluidas'};
    for(const p of matching){
      const details=Object.entries(p.contexts||{}).map(([k,v])=>
        (contextLabels[k]||k)+': '+(Number(v)>0?money(v):'sin recargo')).join(' · ');
      ingredients.append(fila(p.name,p.category+' · '+details));
    }
    if(!matching.length)ingredients.append(aviso('No hay ingredientes que coincidan con la búsqueda.'));
    const special=products.filter(p=>p.kind==='monthly'||p.categoriaSlug==='mensual');
    promos.append(aviso('Promociones que figuran en la carta aprobada de Romo. No incluye promociones dinámicas nuevas: su creación, fotografías y descuentos siguen pendientes de conectar al mismo guardado de Romo.'));
    for(const p of special){
      promos.append(fila(p.name,money(p.price)+' · '+(p.available!==false?'Disponible':'No disponible')+
        (p.description?' · '+p.description:'')));
    }
    if(!special.length)promos.append(aviso('No se encontraron promociones en el catálogo aprobado.'));
    // Gestión completa aislada: conserva listado aprobado y no habilita ventas.
    if(current&&typeof window.romoMontarGestionCartaQA==='function')
      window.romoMontarGestionCartaQA({container:root,base:current});
  }

  function renderList(){
    const root=state.root,container=$(root,'[data-romo-carta-list]');
    if(!root||!container)return;
    clear(container);
    const q=String($(root,'[data-romo-carta-search]')?.value||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const cat=$(root,'[data-romo-carta-category]')?.value||'';
    const products=(state.current?.products||[]).filter(p=>
      visibleRomo(p)&&(!cat||p.categoriaSlug===cat)&&
      (!q||String(p.name+' '+p.sku).normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)));
    const caption=el('p',products.length+' productos encontrados');
    caption.style.fontWeight='700';container.append(caption);
    for(const p of products.slice(0,75)){
      const row=el('div');
      row.style.cssText='border-bottom:1px solid #ddd;padding:9px 0;display:flex;gap:8px;align-items:center;justify-content:space-between';
      const info=el('div');
      const heading=el('strong',p.name);
      const detail=el('small',money(p.price)+' · '+(p.available!==false?'Disponible':'No disponible'));
      detail.style.cssText='display:block;color:#666;margin-top:3px';
      info.append(heading,detail);
      const open=el('button','Editar');
      open.type='button';open.style.cssText='background:white;color:#9b101c;border:1px solid #a11c27;border-radius:9px;padding:9px 13px';
      open.onclick=()=>{state.selectedSku=p.sku;renderForm();
        $(root,'[data-romo-carta-form]')?.scrollIntoView({block:'start',behavior:'smooth'});};
      if(state.current?.edicionHabilitada===true)row.append(info,open);
      else row.append(info);
      container.append(row);
    }
  }
  async function reload(){
    if(state.busy)return;
    state.busy=true;status('Consultando únicamente la carta de Romo…');
    try{
      const result=await request('GET');
      if(result.readOnly!==true||!Array.isArray(result.products)||
         result.products.length<40||!Array.isArray(result.categories))
        throw Error('El catálogo no incluye todos los productos aprobados');
      if(!Array.isArray(result.ingredients)||result.ingredients.length<20)
        throw Error('La lista de ingredientes de Romo no está completa');
      state.current=result;
      const initialize=$(state.root,'[data-romo-initialize]');
      if(initialize){
        const puedeIniciar=result.revision===0&&result.edicionHabilitada===true;
        initialize.hidden=!puedeIniciar;
        initialize.style.display=puedeIniciar?'block':'none';
      }
      const category=$(state.root,'[data-romo-carta-category]');
      const before=category.value;
      clear(category);category.add(new Option('Todas las categorías',''));
      for(const c of result.categories)category.add(new Option(c.nombre,c.slug));
      if([...category.options].some(x=>x.value===before))category.value=before;
      renderList();renderForm();renderExtras();setArea(state.area);
      status(result.edicionHabilitada===true?
        'Catálogo leído. Las ediciones solo son válidas con revisión '+result.revision+'.':
        'Catálogo de Romo consultado. La edición de productos sigue desactivada.');
    }catch(error){
      state.current=null;state.selectedSku='';
      renderList();renderForm();
      status('Editor de Romo NO habilitado. No se ha modificado ningún precio. '+
        String(error?.message||error));
    }finally{state.busy=false;}
  }
  // Integración futura: llamarlo solo desde la sección Carta y precios del
  // panel Romo, después de comprobar S.suc===Romo La Serena.
  window.romoMontarCartaEditorSeguroQA=async function({container,storeId}={}){
    if(storeId!==STORE||!(container instanceof HTMLElement)||!container.isConnected)
      return false;
    // El editor y la confirmación de la revisión inicial SON de dueños.
    // Antes de mostrar sus controles hay que verificar Google + rol Neon en
    // el servidor. Un agendador no debe ver este acceso.
    const montado=container.dataset.romoEditorSeguroQA==='1';
    let autorizado;
    try{
      autorizado=await request('GET');
      if(autorizado?.readOnly!==true||
         !Array.isArray(autorizado.products)||autorizado.products.length!==40)
        throw Error('Catálogo no confirmado por el servidor de Romo.');
    }catch{
      // Al cambiar de vista o cerrar Google se revocan también los controles
      // visibles; jamás dejar a la vista el formulario heredado de Uki.
      container.hidden=true;
      container.style.display='none';
      return false;
    }
    if(!container.isConnected)return false;
    if(montado){
      // Volver a la pestaña exige confirmar de nuevo el rol de dueños,
      // incluso si ya se había abierto esta misma pantalla.
      container.hidden=false;
      container.style.removeProperty('display');
      if(state.root===container)void reload();
      return true;
    }
    if(container.dataset.romoEditorSeguroQA==='1')return false;
    // El panel vuelve a dibujar la pantalla al cambiar de vista.
    if(state.root&&state.root!==container&&state.root.isConnected)return false;
    if(state.root&&state.root!==container&&!state.root.isConnected){
      state.current=null;state.selectedSku='';state.root=null;
    }
    container.dataset.romoEditorSeguroQA='1';
    container.hidden=false;
    container.style.removeProperty('display');
    state.root=container;
    const heading=el('h2','Carta y precios · Romo La Serena');
    const help=el('p','Mismos productos de la carta aprobada de Romo. '+
      'Los cambios necesitan sesión de dueños y motivo. No se guardan en Uki.');
    const statusP=el('p','Editor todavía no verificado');
    statusP.dataset.romoCartaStatus='1';statusP.setAttribute('role','status');
    const filter=el('div');filter.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
    const search=el('input'),category=el('select');
    search.dataset.romoCartaSearch='1';search.type='search';
    search.placeholder='Buscar un producto';search.style.cssText='padding:10px;flex:1;min-width:150px';
    category.dataset.romoCartaCategory='1';
    category.add(new Option('Todas las categorías',''));
    category.style.cssText='padding:10px;flex:1;min-width:150px';
    filter.append(search,category);
    const refresh=el('button','Actualizar carta de Romo');
    refresh.type='button';refresh.onclick=reload;
    refresh.style.cssText='margin:10px 0;padding:10px;border:1px solid #999;border-radius:9px;background:white';
    const initialize=el('button','Confirmar versión inicial de la carta');
    initialize.type='button';
    initialize.hidden=true;
    initialize.style.cssText='display:none;margin:8px 0;padding:11px;border-radius:9px;background:#191919;color:white;font-weight:700';
    initialize.onclick=async()=>{
      if(state.busy||state.current?.edicionHabilitada!==true||
         state.current?.revision!==0||!state.current?.baseSha256)return;
      if(!window.confirm('¿Confirmas la carta actual de Romo como versión inicial sin cambiar precios ni productos? Esta acción registra tu cuenta y fecha.'))return;
      state.busy=true;initialize.disabled=true;
      status('Registrando versión inicial sin cambiar productos…');
      try{
        const saved=await request('POST',{
          action:'initialize',expectedRevision:0,
          baseSha256:state.current.baseSha256,
          motivo:'Confirmación manual de la carta aprobada de Romo'
        });
        if(saved.inicializado!==true||saved.revision!==1||
           saved.sinCambiarPrecios!==true||saved.auditado!==true)
          throw Error('No se confirmó la inicialización');
        state.busy=false;
        await reload();
      }catch(error){
        status('No se confirmó la versión inicial. '+String(error?.message||error));
      }finally{state.busy=false;initialize.disabled=false;}
    };
    initialize.dataset.romoInitialize='1';
    const list=el('div');list.dataset.romoCartaList='1';
    const form=el('div');form.dataset.romoCartaForm='1';
    form.style.cssText='margin-top:15px;padding-top:12px;border-top:2px solid #b71622';
    search.oninput=renderList;category.onchange=renderList;
    // Cuatro áreas visuales como Uki, conservando los controles existentes
    // de producto y el aislamiento de sucursal. Las otras áreas son lectura.
    const nav=el('div');
    nav.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:15px 0';
    const panels={};
    const choices=[
      ['productos','📋 Productos'],
      ['categorias','🗂 Categorías'],
      ['ingredientes','🌿 Ingredientes'],
      ['promociones','🎁 Promociones']
    ];
    for(const [key,label] of choices){
      const btn=el('button',label);
      btn.type='button';btn.dataset.romoNav=key;
      btn.style.cssText='width:100%;min-width:0;white-space:normal;font-size:15px;font-weight:750;line-height:1.3;padding:14px 7px;border:1px solid #d9cdd0;border-radius:13px;background:#fff;color:#2a2023';
      btn.onclick=()=>setArea(key);nav.append(btn);
      const panel=el('section');panel.dataset.romoArea=key;
      panel.style.cssText='border:1px solid #ebd7dc;border-radius:14px;padding:13px 12px;margin:12px 0;background:#fff';
      const heading=el('h3',label);
      heading.style.cssText='margin:0 0 11px;color:#2a2023;font-size:18px';
      panel.append(heading);
      panels[key]=panel;
    }
    panels.productos.append(filter,refresh,initialize,list,form);
    const categoryList=el('div');categoryList.dataset.romoCategoriesList='1';
    panels.categorias.append(categoryList);
    const ingredientSearch=el('input');
    ingredientSearch.type='search';ingredientSearch.placeholder='Buscar ingrediente';
    ingredientSearch.dataset.romoIngredientSearch='1';
    ingredientSearch.style.cssText='width:100%;padding:11px;border:1px solid #d9cdd0;border-radius:10px';
    ingredientSearch.oninput=renderExtras;
    const ingredientList=el('div');ingredientList.dataset.romoIngredientsList='1';
    panels.ingredientes.append(ingredientSearch,ingredientList);
    const promoList=el('div');promoList.dataset.romoPromosList='1';
    panels.promociones.append(promoList);
    container.replaceChildren(heading,help,statusP,nav,...AREAS.map(key=>panels[key]));
    setArea(state.area);
    // Se muestra solo después de la autorización; cargar la revisión vigente
    // nuevamente (sin guardar nada) para bloquear confirmaciones obsoletas.
    void reload();
    return true;
  };
})();
