import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = {'/':'index.html','/app.js':'app.js','/style.css':'style.css','/model.js':'model.js'};
const types = {html:'text/html',js:'text/javascript',css:'text/css'};
http.createServer(async(req,res)=>{
 const path = new URL(req.url,'http://localhost').pathname;
 if(path==='/api/status'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({mode:'demo',gex:'not_connected',news:'not_connected',execution:'disabled'}));}
 const file=files[path];
 if(!file){res.writeHead(404);return res.end('Not found');}
 try{const body=await readFile(new URL('./public/'+file,import.meta.url));res.writeHead(200,{'Content-Type':types[file.split('.').pop()]+'; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(body);}catch{res.writeHead(500);res.end('Unable to load page');}
}).listen(5173,'127.0.0.1',()=>console.log('Hand to Hand Trading: http://127.0.0.1:5173'));
