const {mkdtempSync,mkdirSync,copyFileSync,readdirSync,readFileSync,existsSync,rmSync}=require('node:fs');
const {join}=require('node:path');const {tmpdir}=require('node:os');const {execFileSync}=require('node:child_process');const assert=require('node:assert/strict');
const temp=mkdtempSync(join(tmpdir(),'intake-offline-'));
try {
 for(const dir of ['lib','scripts','app','public'])mkdirSync(join(temp,dir));
 for(const file of ['lib/shell.js','lib/commission.js','lib/intake-controller.js','lib/mobile-support.js','lib/cloud-client.js','lib/cloud-sync.js','lib/cloud-panel.js','app/globals.css','scripts/build-offline.mjs','scripts/sw-template.js','public/borito-munkater.png','public/icon.svg','public/icon-192.png','public/icon-512.png','public/manifest.webmanifest'])copyFileSync(file,join(temp,file));
 assert.equal(existsSync(join(temp,'.next')),false);
 const {symlinkSync}=require('node:fs');symlinkSync(join(process.cwd(),'node_modules'),join(temp,'node_modules'),'dir');execFileSync(process.execPath,['scripts/build-offline.mjs'],{cwd:temp});
 const sw=readFileSync(join(temp,'public/sw.js'),'utf8');
 const assets=JSON.parse(sw.match(/const ASSETS = (\[[^;]+\]);/)[1]);
 for(const url of assets)assert(existsSync(join(temp,'public',url.slice(1))),url);
 const html=readFileSync(join(temp,'public/offline-app.html'),'utf8');
 assert(html.includes('id="app-root"'));assert(html.includes('/offline-start.js'));assert(!html.includes('/_next/'));
 assert(!sw.includes('__PRECACHE__'));assert(!sw.includes('__VERSION__'));
 console.log('PASS: offline build without .next; all offline files exist; no Next internal paths');
} finally {rmSync(temp,{recursive:true,force:true})}
