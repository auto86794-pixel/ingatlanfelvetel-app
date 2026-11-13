import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const html = await readFile('.next/server/app/index.html', 'utf8');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const lists = await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)));
  return lists.flat();
}
const staticFiles = (await walk('.next/static')).filter(f => /\.(js|css|woff2?)$/.test(f)).sort();
const assets = ['/offline-app.html', '/borito-munkater.png', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest', ...staticFiles.map(f => '/' + f.replace(/^\.next\//, '_next/'))];
const template = await readFile('scripts/sw-template.js', 'utf8');
const version = createHash('sha256').update(html).update(template).update(assets.join('\n')).digest('hex').slice(0, 16);
await writeFile('public/offline-app.html', html);
await writeFile('public/sw.js', template.replace('__PRECACHE__', JSON.stringify(assets)).replace('__VERSION__', JSON.stringify(version)));
console.log(`Offline shell ready: ${assets.length} files, version ${version}`);
