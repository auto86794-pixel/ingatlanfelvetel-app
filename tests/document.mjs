import assert from 'node:assert/strict';
import {renderDocument,displayDate} from '../lib/document-render.js';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
// Tiny PNG fixtures; real image order survives the JSON roundtrip too.
const photo1='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0sAAAAASUVORK5CYII=';
const photo2='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVQIHWP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const record={id:'11111111-1111-4111-8111-111111111111',date:'2026-11-15',name:'Teszt Ágnes',city:'Debrecen',address:'Minta utca 12.',type:'Lakás',price:'64900000',area:'68.5',commissionPercent:'2,5',commissionBasis:'Nettó díj + áfa',commissionVat:'27',photos:[photo1,photo2],owners:[],roomRows:[{name:'Nappali',area:'20.4'},{name:'Konyha',area:'6.8'}],notes:'Árvíztűrő tükörfúrógép.\nMásodik sor.',internal:'INTERNAL_SECRET',signature:photo1,signer:'Teszt Ágnes'};
const before=renderDocument(record),after=renderDocument(JSON.parse(JSON.stringify(record)));
assert.equal(before,after);
assert.equal(displayDate(record.date),'2026. 11. 15.');
assert(before.includes('68,5 m²'));assert(before.replace(/\s/g,'').includes('64900000Ft'));assert(before.replace(/\s/g,'').includes('2060575Ft'));
assert(before.indexOf('Ingatlanfotók')<before.indexOf('signature-block'));
assert(before.indexOf(photo1)<before.indexOf(photo2));assert(!before.includes(record.internal));
assert(renderDocument({...record,name:'<script>alert(1)</script>'}).includes('&lt;script&gt;'));
assert(renderDocument({...record,signature:''}).includes('Aláírás nélkül rögzített adatlap.'));
assert(renderDocument({...record,photos:[]}).includes('signature-block'));
console.log('PASS: identical review/print renderer, currency/date/area, photos before signature, photo order, JSON roundtrip, private-note exclusion');
