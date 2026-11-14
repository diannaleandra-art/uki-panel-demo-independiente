/* Tarjeta Uki Sushi: solamente presenta datos; no modifica timbres ni pedidos. */
(function(){
  "use strict";
  const W=900,H=1120;
  const C={crema:"#FFF8EE",papel:"#FFFFFF",tinta:"#4C281B",rojo:"#EC2015",naranja:"#F4770A",borde:"#F2D8BD",gris:"#897368"};
  const logo="./uki-logo-original.svg";
  const rect=(c,x,y,w,h,r,fill,stroke,sw=1)=>{
    c.beginPath();c.roundRect(x,y,w,h,r);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=sw;c.stroke();}
  };
  const txt=(c,s,x,y,px=35,color=C.tinta,weight=600,align="left")=>{
    c.font=weight+" "+px+"px system-ui, -apple-system, sans-serif";
    c.fillStyle=color;c.textAlign=align;c.textBaseline="middle";c.fillText(s,x,y);
  };
  const ajustar=(c,s,max,base,min=20)=>{
    for(let z=base;z>min;z-=2){c.font="700 "+z+"px system-ui";if(c.measureText(s).width<=max)return z;}
    return min;
  };
  const imagenLogo=()=>new Promise(resolve=>{
    const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=logo;
  });
  function dibujarGato(c,x,y){
    c.save();c.translate(x,y);
    c.fillStyle="#FFF8EF";c.strokeStyle="#E9611E";c.lineWidth=3;
    c.beginPath();c.moveTo(-21,-12);c.lineTo(-16,-31);c.lineTo(-4,-20);c.lineTo(7,-20);c.lineTo(18,-31);c.lineTo(23,-12);c.quadraticCurveTo(28,14,0,24);c.quadraticCurveTo(-28,13,-21,-12);c.closePath();c.fill();c.stroke();
    c.fillStyle="#A44C16";c.beginPath();c.arc(-8,-1,3,0,7);c.arc(8,-1,3,0,7);c.fill();
    c.beginPath();c.arc(0,8,3,0,7);c.fill();c.restore();
  }
  async function generar(datos){
    const nombre=String(datos.nombre||"Cliente").trim().slice(0,90);
    const whatsapp=String(datos.whatsapp||"").trim().slice(0,30);
    const codigo=String(datos.codigoCliente||"").trim().slice(0,12);
    const timbres=Math.min(10,Math.max(0,Number(datos.timbres)||0));
    const sucursal=String(datos.sucursal||"Uki Sushi").slice(0,70);
    const fecha=String(datos.ultimaCompra||"");
    const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
    const c=canvas.getContext("2d");
    const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,"#FFF1DF");bg.addColorStop(0.7,C.crema);bg.addColorStop(1,"#FFFFFF");
    c.fillStyle=bg;c.fillRect(0,0,W,H);
    rect(c,22,22,W-44,H-44,39,null,"#F2B878",4);
    rect(c,22,22,W-44,14,8,C.rojo);
    rect(c,95,65,710,180,31,"#FFFFFF",C.borde,2);
    const img=await imagenLogo();
    if(img){c.save();c.beginPath();c.arc(450,153,79,0,7);c.clip();c.drawImage(img,370,73,160,160);c.restore();}
    else txt(c,"UKI SUSHI",450,151,53,C.naranja,800,"center");
    txt(c,"TARJETA DE TIMBRES",450,293,47,C.tinta,800,"center");
    txt(c,sucursal,450,342,27,C.gris,600,"center");

    rect(c,75,384,750,126,28,"#FFF",C.borde,2);
    txt(c,"Nombre y apellido",109,408,21,C.gris,600);
    txt(c,nombre,110,447,ajustar(c,nombre,455,37,20),C.tinta,750);
    rect(c,612,398,178,73,30,C.naranja);
    txt(c,timbres+"/10",700,434,44,"#FFF",800,"center");
    txt(c,"Código: "+(codigo||"Sin registrar"),110,491,20,C.gris,650);
    const telefonoTexto="WhatsApp: "+(whatsapp||"Sin registrar");
    txt(c,telefonoTexto,365,491,ajustar(c,telefonoTexto,427,20,16),C.gris,600);

    for(let k=0;k<10;k++){
      const x=151+(k%5)*148,y=577+Math.floor(k/5)*139,marked=k<timbres;
      c.beginPath();c.arc(x,y,58,0,7);
      c.fillStyle=marked?"#FEE4C6":"#FFFCF7";c.fill();
      c.strokeStyle=marked?C.rojo:"#DDAE84";c.lineWidth=marked?5:3;
      c.setLineDash(marked?[]:[7,8]);c.stroke();c.setLineDash([]);
      if(marked)dibujarGato(c,x,y);
      else txt(c,String(k+1),x,y+2,29,"#C8A181",650,"center");
    }

    rect(c,70,793,760,148,26,"#FFE9D4");
    rect(c,89,813,80,44,18,C.rojo);
    txt(c,"6",129,834,30,"#FFF",800,"center");
    txt(c,"timbres = 12 piezas gratis",188,836,31,C.tinta,700);
    rect(c,89,873,80,43,18,C.rojo);
    txt(c,"10",129,895,30,"#FFF",800,"center");
    txt(c,"timbres = 36 piezas + 2 korokes",188,895,28,C.tinta,700);

    txt(c,"¡Gracias por preferir Uki Sushi!",450,989,32,C.rojo,750,"center");
    txt(c,"Vigencia: cada timbre vence 3 meses después de su compra",450,1037,21,C.gris,450,"center");
    if(fecha)txt(c,"Última compra: "+fecha,450,1070,20,C.gris,450,"center");
    return canvas;
  }
  let imagenLista=null,archivoListo=null;
  const descargar=()=>{
    if(!imagenLista)return;
    const a=document.createElement("a");a.href=imagenLista;a.download="uki-timbres-"+Date.now()+".png";
    document.body.appendChild(a);a.click();a.remove();
  };
  async function mostrar(datos){
    if(document.getElementById("ukiTarjetaDialogo"))return;
    let c;
    try{c=await generar(datos);}catch(e){alert("No se pudo crear la tarjeta. Reintenta sin cerrar el panel.");return;}
    const blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
    if(!blob){alert("Este navegador no pudo generar la imagen.");return;}
    const archivo=new File([blob],"uki-timbres.png",{type:"image/png"});
    archivoListo=archivo;imagenLista=URL.createObjectURL(blob);
    const capa=document.createElement("div");capa.id="ukiTarjetaDialogo";
    capa.setAttribute("role","dialog");capa.setAttribute("aria-modal","true");
    capa.setAttribute("aria-label","Vista previa de tarjeta de timbres");
    capa.style.cssText="position:fixed;inset:0;z-index:9999;background:#1b100fd9;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:20px 10px 35px";
    const panel=document.createElement("div");
    panel.style.cssText="background:white;max-width:500px;width:100%;border-radius:18px;padding:14px;color:#493020";
    const img=document.createElement("img");img.src=imagenLista;img.alt="Tarjeta de "+datos.nombre+": "+datos.timbres+" de 10 timbres";
    img.style.cssText="display:block;width:100%;max-height:72vh;object-fit:contain;border-radius:10px";
    const botones=document.createElement("div");botones.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px";
    function boton(t,fn){const b=document.createElement("button");b.type="button";b.textContent=t;b.style.cssText="flex:1;min-width:120px;border:0;border-radius:10px;padding:13px 9px;background:#F4770A;color:#fff;font-weight:700";b.addEventListener("click",fn);return b;}
    const cerrar=()=>{capa.remove();URL.revokeObjectURL(imagenLista);imagenLista=null;archivoListo=null;};
    botones.append(boton("Compartir imagen",async()=>{
      if(navigator.share&&navigator.canShare?.({files:[archivoListo]})){
        try{await navigator.share({files:[archivoListo],title:"Tarjeta de timbres Uki Sushi"});}
        catch(e){if(e?.name!=="AbortError")alert("No se pudo compartir. Puedes descargar la imagen.");}
      }else{descargar();alert("Se descargó la imagen. Adjunta el archivo al WhatsApp del cliente.");}
    }),boton("Descargar",descargar),boton("Cerrar",cerrar));
    panel.append(img,botones);
    capa.append(panel);
    document.body.appendChild(capa);
  }
  window.ukiTarjetaMostrar=mostrar;
})();