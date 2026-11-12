'use strict';
// Ruta temporal para validar Carta y precios de Uki sin publicar una segunda carta.
// Se desactiva fuera del preview aislado autorizado.
const fs=require('node:fs'),path=require('node:path');
const QA_BRANCH='ui/uki-carta-promociones-categorias-descuentos-qa-20261111';
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.mjs':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.webp':'image/webp','.ico':'image/x-icon','.gif':'image/gif'};
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!==QA_BRANCH)
  return res.status(404).send('No disponible fuera de pruebas');
 if(req.method!=='GET'&&req.method!=='HEAD')
  return res.status(405).send('Método no permitido');
 const file=String(req.query?.file||'');
 // Se admiten únicamente archivos estáticos propios, no archivos de configuración.
 if(!/^[a-z0-9][a-z0-9_-]{0,110}\.(?:html|js|mjs|css|svg|png|jpe?g|webp|ico|gif)$/i.test(file))
  return res.status(404).send('Archivo no encontrado');
 const full=path.resolve(__dirname,'../firebase',file);
 try{
  const data=fs.readFileSync(full);
  res.setHeader('Content-Type',MIME[path.extname(file).toLowerCase()]||'application/octet-stream');
  return res.status(200).send(req.method==='HEAD'?'':data);
 }catch(e){
  if(e?.code!=='ENOENT')console.error('Panel QA estático:',String(e?.code||'error').slice(0,40));
  return res.status(404).send('Archivo de panel no encontrado');
 }
};
