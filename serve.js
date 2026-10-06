// Tiny static server for local viewing: http://localhost:8123/MarketingPlanReport.html
const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((q,r)=>{
  const f=path.join(__dirname,q.url==='/'?'MarketingPlanReport.html':decodeURIComponent(q.url.split('?')[0]));
  if(!f.startsWith(__dirname)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('not found');}
  r.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(f).pipe(r);
}).listen(8123,()=>console.log('http://localhost:8123'));
