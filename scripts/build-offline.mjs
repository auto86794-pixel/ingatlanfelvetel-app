import { readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
// Build from application source; never depend on Next's internal output paths.
const read = file => readFile(file, 'utf8');
const shellSource = await read('lib/shell.js');
const shell = JSON.parse(shellSource.replace(/^export const shell = /, '').trim().replace(/;$/, ''));
const css = await read('app/globals.css');
await build({entryPoints:['lib/cloud-panel.js'],bundle:true,format:'esm',platform:'browser',target:'es2020',outfile:'public/offline-cloud.js',minify:true});
const controllerBuild=await build({entryPoints:['lib/intake-controller.js'],bundle:true,format:'esm',platform:'browser',target:'es2020',write:false});
const controller=controllerBuild.outputFiles[0].text;
const mobile = await read('lib/mobile-support.js');
// Both modules are dependency-free browser modules, shared with the Next entry.
const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#164d38"><meta name="apple-mobile-web-app-capable" content="yes"><title>Ingatlanfelvétel</title><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg"><link rel="apple-touch-icon" href="/icon-192.png"><link rel="stylesheet" href="/offline-style.css"></head><body><div id="app-root">${shell}</div><aside id="mobile-support" class="mobile-support" aria-label="Telefonos használat"></aside><aside id="cloud-support" class="mobile-support cloud-support" aria-label="Fiók és felhős mentés"></aside><script type="module" src="/offline-start.js"></script></body></html>`;
const start = `import {cloudShell,mountCloud} from '/offline-cloud.js';import {mountIntake} from '/offline-intake.js';import {mobileShell,mountMobile} from '/offline-mobile.js';mountIntake(document.getElementById('app-root'));const panel=document.getElementById('mobile-support');panel.innerHTML=mobileShell;mountMobile(panel,true);const cloud=document.getElementById('cloud-support');cloud.innerHTML=cloudShell;mountCloud(cloud);`;
const outputs = { 'offline-app.html': html, 'offline-style.css': css, 'offline-intake.js': controller, 'offline-mobile.js': mobile, 'offline-start.js': start };
for (const [file, content] of Object.entries(outputs)) await writeFile('public/' + file, content);
const assets = [...Object.keys(outputs).map(file => '/' + file), '/offline-cloud.js','/fonts/DejaVuSans.ttf','/fonts/DejaVuSans-Bold.ttf', '/borito-munkater.png', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
const template = await read('scripts/sw-template.js');
const hash = createHash('sha256').update(template);
for (const url of assets) hash.update(await readFile('public' + url));
const version = hash.digest('hex').slice(0, 16);
await writeFile('public/sw.js', template.replace('__PRECACHE__', JSON.stringify(assets)).replace('__VERSION__', JSON.stringify(version)));
console.log(`Offline shell ready: ${assets.length} source-built files, version ${version}`);
