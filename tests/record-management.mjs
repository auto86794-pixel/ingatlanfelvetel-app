import assert from 'node:assert/strict';
import {filterRecords,copyRecord,statusOf} from '../lib/record-management.js';
const source={id:'old',name:'Ágnes',city:'Debrecen',address:'Minta 12',updated:'2026-11-15',date:'2026-01-01',photos:['photo'],signature:'signature',signer:'Ágnes',needsSignature:true,recordStatus:'Lezárva',archived:true,_revision:'rev',_cloudVersion:7,_dirty:false,roomRows:[{name:'Nappali',area:'20'}],owners:[],commissionPercent:'2,5'};
const copy=copyRecord(source,'new','2026-11-16');
assert.equal(copy.id,'new');assert.equal(copy.date,'2026-11-16');assert.deepEqual(copy.photos,[]);assert.equal(copy.signature,undefined);assert.equal(copy.signer,undefined);assert.equal(copy._cloudVersion,undefined);assert.equal(copy._revision,undefined);assert.equal(copy.archived,undefined);assert.equal(copy.recordStatus,'Piszkozat');assert.equal(copy.commissionPercent,'2,5');copy.roomRows[0].name='Más';assert.equal(source.roomRows[0].name,'Nappali');assert.equal(source.photos.length,1);
const legacy={id:'legacy',name:'Régi',city:'Debrecen',updated:'2026-11-14'};
assert.equal(statusOf(legacy),'Piszkozat');assert.equal(filterRecords([source,legacy]).length,1);assert.equal(filterRecords([source,legacy],{archive:'archived'})[0].id,'old');assert.equal(filterRecords([source,legacy],{archive:'all',query:'DEBRECEN',status:'Lezárva'}).length,1);assert.equal(filterRecords([source,legacy],{query:'nincs'}).length,0);
console.log('PASS: legacy status, combined filters, archive/restore, isolated copy without photos/signature/cloud identity');
