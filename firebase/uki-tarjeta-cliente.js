/* Tarjeta de timbres Uki/Romo: solamente presenta datos; no modifica timbres ni pedidos. */
(function(){
  "use strict";
  const W=900,H=1120;
  const UKI={crema:"#FFF8EE",papel:"#FFFFFF",tinta:"#4C281B",rojo:"#EC2015",naranja:"#F4770A",borde:"#F2D8BD",gris:"#897368"};
  const ROMO={crema:"#21171C",papel:"#2F2026",tinta:"#FFF5E9",rojo:"#B81831",naranja:"#F4CF83",borde:"#875D55",gris:"#F2D5C3"};
  const TARJETAS={
    uki:{nombre:"UKI SUSHI",archivo:"uki-timbres",logo:"./uki-logo-original.svg"},
    romo:{nombre:"ROMO’S SUSHI",archivo:"romo-timbres",logo:""}
  };
  const rect=(c,x,y,w,h,r,fill,stroke,sw=1)=>{
    c.beginPath();c.roundRect(x,y,w,h,r);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=sw;c.stroke();}
  };
  const txt=(c,s,x,y,px=35,color=UKI.tinta,weight=600,align="left")=>{
    c.font=weight+" "+px+"px system-ui, -apple-system, sans-serif";
    c.fillStyle=color;c.textAlign=align;c.textBaseline="middle";c.fillText(s,x,y);
  };
  const ajustar=(c,s,max,base,min=20)=>{
    for(let z=base;z>min;z-=2){c.font="700 "+z+"px system-ui";if(c.measureText(s).width<=max)return z;}
    return min;
  };
  const imagenLogo=logo=>new Promise(resolve=>{
    if(!logo)return resolve(null);
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=logo;
  });
  function dibujarGato(c,x,y){
    c.save();c.translate(x,y);
    c.fillStyle="#FFF8EF";c.strokeStyle="#E9611E";c.lineWidth=3;
    c.beginPath();c.moveTo(-21,-12);c.lineTo(-16,-31);c.lineTo(-4,-20);c.lineTo(7,-20);c.lineTo(18,-31);c.lineTo(23,-12);c.quadraticCurveTo(28,14,0,24);c.quadraticCurveTo(-28,13,-21,-12);c.closePath();c.fill();c.stroke();
    c.fillStyle="#A44C16";c.beginPath();c.arc(-8,-1,3,0,7);c.arc(8,-1,3,0,7);c.fill();
    c.beginPath();c.arc(0,8,3,0,7);c.fill();c.restore();
  }
  async function generar(datos,marca){
    const esRomo=marca===TARJETAS.romo,C=esRomo?ROMO:UKI;
    const modoPedido=datos.modoPedido===true;
    const nombre=String(datos.nombre||"Cliente").trim().slice(0,90);
    const whatsapp=String(datos.whatsapp||"").trim().slice(0,30);
    const codigo=String(datos.codigoCliente||"").trim().slice(0,12);
    const timbres=Math.min(10,Math.max(0,Math.trunc(Number(datos.timbres)||0)));
    const sucursal=String(datos.sucursal||"Uki Sushi").slice(0,70);
    const fecha=String(datos.ultimaCompra||"");
    const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
    const c=canvas.getContext("2d");
    const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,esRomo?"#110E10":"#FFF1DF");bg.addColorStop(0.7,C.crema);bg.addColorStop(1,esRomo?"#231018":"#FFFFFF");
    c.fillStyle=bg;c.fillRect(0,0,W,H);
    rect(c,22,22,W-44,H-44,39,null,esRomo?C.naranja:"#F2B878",4);
    rect(c,22,22,W-44,14,8,C.rojo);
    rect(c,95,65,710,180,31,C.papel,C.borde,2);
    const img=await imagenLogo(marca.logo);
    if(img){
      c.save();c.beginPath();
      if(esRomo)c.roundRect(370,73,160,160,25);
      else c.arc(450,153,79,0,7);
      c.clip();c.drawImage(img,370,73,160,160);c.restore();
    }
    else txt(c,marca.nombre,450,151,esRomo?60:53,C.naranja,800,"center");
    txt(c,"TARJETA DE TIMBRES",450,293,47,C.tinta,800,"center");
    txt(c,sucursal,450,342,27,C.gris,600,"center");

    rect(c,75,384,750,126,28,C.papel,C.borde,2);
    txt(c,modoPedido?"Tarjeta de":"Nombre y apellido",109,408,21,C.gris,600);
    txt(c,nombre,110,447,ajustar(c,nombre,455,37,20),C.tinta,750);
    rect(c,612,398,178,73,30,C.naranja);
    txt(c,timbres+"/10",700,434,44,esRomo?"#21151A":"#FFF",800,"center");
    if(modoPedido){
      txt(c,"Timbres acumulados",110,491,22,C.gris,650);
    }else{
      txt(c,"Código: "+(codigo||"Sin registrar"),110,491,20,C.gris,650);
      const telefonoTexto="WhatsApp: "+(whatsapp||"Sin registrar");
      txt(c,telefonoTexto,365,491,ajustar(c,telefonoTexto,427,20,16),C.gris,600);
    }

    for(let k=0;k<10;k++){
      const x=151+(k%5)*148,y=577+Math.floor(k/5)*139,marked=k<timbres;
      c.beginPath();c.arc(x,y,58,0,7);
      c.fillStyle=esRomo?(marked?"#4F1C2A":C.papel):(marked?"#FEE4C6":"#FFFCF7");c.fill();
      c.strokeStyle=esRomo?(marked?C.naranja:C.borde):(marked?C.rojo:"#DDAE84");c.lineWidth=marked?5:3;
      c.setLineDash(marked?[]:[7,8]);c.stroke();c.setLineDash([]);
      if(marked&&esRomo){
        c.beginPath();c.moveTo(x-22,y);c.lineTo(x-5,y+17);c.lineTo(x+25,y-19);
        c.lineWidth=7;c.lineJoin="round";c.lineCap="round";c.strokeStyle=C.naranja;c.stroke();
        c.lineJoin="miter";c.lineCap="butt";
      }else if(marked)dibujarGato(c,x,y);
      else txt(c,String(k+1),x,y+2,29,esRomo?C.gris:"#C8A181",650,"center");
    }

    rect(c,70,793,760,148,26,esRomo?C.papel:"#FFE9D4");
    rect(c,89,813,80,44,18,C.rojo);
    txt(c,"6",129,834,30,"#FFF",800,"center");
    txt(c,"timbres = 12 piezas gratis",188,836,31,C.tinta,700);
    rect(c,89,873,80,43,18,C.rojo);
    txt(c,"10",129,895,30,"#FFF",800,"center");
    txt(c,"timbres = 36 piezas + 2 korokes",188,895,28,C.tinta,700);

    txt(c,esRomo?"¡Gracias por elegir Romo’s Sushi!":"¡Gracias por preferir Uki Sushi!",450,989,32,esRomo?C.naranja:C.rojo,750,"center");
    txt(c,"Vigencia: cada timbre vence 3 meses después de su compra",450,1037,21,C.gris,450,"center");
    if(fecha)txt(c,"Última compra: "+fecha,450,1070,20,C.gris,450,"center");
    return canvas;
  }
  let generando=false;
  async function mostrar(datos,acciones={}){
    if(generando||document.getElementById("ukiTarjetaDialogo"))return;
    const marca=/^Romo/i.test(String(datos.sucursal||""))?TARJETAS.romo:TARJETAS.uki;
    const vigente=()=>typeof acciones.vigente!=="function"||acciones.vigente();
    const telefono=/^\d{8,15}$/.test(String(acciones.telefonoChat||""))?acciones.telefonoChat:"";
    generando=true;
    let blob;
    try{
      const c=await generar(datos,marca);
      blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
      if(!blob)throw Error("PNG no disponible");
    }catch{
      alert("No se pudo crear la tarjeta. Todavía puedes enviar el timbre en texto.");return;
    }finally{generando=false;}
    if(!vigente())return;
    const archivo=new File([blob],marca.archivo+".png",{type:"image/png"});
    const imagenLista=URL.createObjectURL(blob);
    const capa=document.createElement("dialog");capa.id="ukiTarjetaDialogo";
    capa.setAttribute("aria-label","Vista previa de tarjeta de timbres");
    capa.style.cssText="border:0;border-radius:18px;padding:14px;color:#242025;width:min(500px,calc(100% - 26px));max-height:calc(100dvh - 26px);box-sizing:border-box";
    const img=document.createElement("img");img.src=imagenLista;img.alt="Tarjeta de "+datos.nombre+": "+datos.timbres+" de 10 timbres";
    img.style.cssText="display:block;width:100%;max-height:63vh;object-fit:contain;border-radius:10px";
    const estado=document.createElement("p");estado.setAttribute("role","status");
    estado.style.cssText="font-size:14px;line-height:1.35;margin:10px 0 0";
    estado.textContent=telefono?"Al compartir, selecciona WhatsApp y el chat de este cliente. Después confirma el envío en el pedido.":"Comparte o descarga la tarjeta.";
    const botones=document.createElement("div");botones.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px";
    const color=marca===TARJETAS.romo?"#9C1530":"#9F4212";
    function boton(t,fn){const b=document.createElement("button");b.type="button";b.textContent=t;b.style.cssText="flex:1;min-width:120px;border:0;border-radius:10px;padding:13px 9px;background:"+color+";color:#fff;font-weight:700";b.addEventListener("click",fn);return b;}
    const valido=()=>{
      if(vigente())return true;
      estado.textContent="El pedido cambió. Cierra la tarjeta y vuelve a abrirla.";
      return false;
    };
    let lista=false;
    const preparada=()=>{
      if(!lista&&vigente()){
        lista=true;
        acciones.preparada?.();
      }
    };
    const descargar=()=>{
      if(!valido())return;
      const a=document.createElement("a");a.href=imagenLista;a.download=archivo.name;
      document.body.appendChild(a);a.click();a.remove();
      preparada();
      estado.textContent="Adjunta la imagen descargada al chat del cliente. Confirma el envío solo después de mandarla.";
    };
    let puedoCompartir=false;
    try{puedoCompartir=typeof navigator.share==="function"&&navigator.canShare?.({files:[archivo]})===true;}catch{}
    if(puedoCompartir){
      botones.append(boton("Compartir imagen",async (e)=>{
        if(!valido())return;
        const b=e.currentTarget;
        b.disabled=true;
        try{
          await navigator.share({files:[archivo],title:"Tarjeta de timbres "+marca.nombre});
          preparada();
          if(telefono)capa.close();
        }catch(err){
          if(err?.name!=="AbortError")estado.textContent="No se pudo compartir. Puedes descargar la imagen y adjuntarla.";
        }finally{b.disabled=false;}
      }));
    }
    botones.append(boton("Descargar imagen",descargar));
    if(telefono)botones.append(boton("Abrir chat del cliente",()=>{
      if(valido())window.open("https://wa.me/"+telefono,"_blank","noopener,noreferrer");
    }));
    botones.append(boton("Cerrar",()=>capa.close()));
    capa.addEventListener("close",()=>{capa.remove();URL.revokeObjectURL(imagenLista);},{once:true});
    capa.append(img,estado,botones);
    document.body.appendChild(capa);
    capa.showModal();
  }
  window.ukiTarjetaMostrar=mostrar;
})();
