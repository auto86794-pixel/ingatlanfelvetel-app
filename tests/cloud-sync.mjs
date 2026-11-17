import assert from 'node:assert/strict';
import {syncRecords} from '../lib/cloud-sync.js';
const owner='00000000-0000-4000-8000-000000000001';
const id='11111111-1111-4111-8111-111111111111';
function database(records=[]){const map=new Map(records.map(r=>[r.id,structuredClone(r)]));return {map,transaction(){const tx={};tx.objectStore=()=>({getAll(){const req={};queueMicrotask(()=>{req.result=[...map.values()].map(r=>structuredClone(r));req.onsuccess?.()});return req},get(id){const req={};queueMicrotask(()=>{req.result=structuredClone(map.get(id));req.onsuccess?.()});return req},put(record){map.set(record.id,structuredClone(record));queueMicrotask(()=>tx.oncomplete?.())}});return tx}}}
function cloud(){const rows=new Map(),files=new Map();return {rows,files,auth:{getUser:async()=>({data:{user:{id:owner}}})},from(){return {select(){return this},order(){return this},range:async(from,to)=>({data:[...rows.values()].slice(from,to+1)})}},storage:{from(){return {upload:async(path,blob)=>{if(files.has(path))return {error:{statusCode:'409'}};files.set(path,blob);return {}},download:async path=>({data:files.get(path)})}}},rpc:async(name,p)=>{const row=rows.get(p.p_id);if(row?.client_revision===p.p_revision)return {data:{version:row.version}};if((row?.version||0)!==p.p_expected)return {error:{message:'sync_conflict'}};const version=(row?.version||0)+1;rows.set(p.p_id,{id:p.p_id,version,client_revision:p.p_revision,object_path:p.p_path});return {data:{version}}}}}
const record={id,documentType:'rental-mandate',rentalFeeMethod:'Egyhavi bérleti díj',rent:'200000',deposit:'400000',rentalPercent:'12',rentalVat:'27',rentalClause9:'Egyedi kikötés',signatureBroker:'data:image/png;base64,ZA==',recordStatus:'Felmérve',archived:true,name:'Próba',commissionPercent:'2,5',commissionBasis:'Nettó díj + áfa',commissionVat:'27',commissionMinimum:'100000',updated:new Date().toISOString(),photos:['data:image/png;base64,YQ==','data:image/png;base64,Yg=='],signature:'data:image/png;base64,Yw==',signer:'Próba',owners:[],roomRows:[],_revision:crypto.randomUUID(),_dirty:true};
const first=database([record]),client=cloud();
assert.equal((await syncRecords(first,client,owner)).uploaded,1);
assert.equal(first.map.get(id)._dirty,false);
const second=database();assert.equal((await syncRecords(second,client,owner)).downloaded,1);assert.equal(second.map.get(id).name,'Próba');for(const key of ['commissionPercent','commissionBasis','commissionVat','commissionMinimum','recordStatus','archived','documentType','rent','deposit','rentalPercent','rentalFeeMethod','rentalVat','rentalClause9','signatureBroker'])assert.equal(second.map.get(id)[key],record[key]);
assert.deepEqual(second.map.get(id).photos,record.photos);assert.equal(second.map.get(id).signature,record.signature);assert.equal(second.map.get(id).signer,record.signer);
const local=first.map.get(id);local.name='Első készülék';local._revision=crypto.randomUUID();local._dirty=true;
const other=second.map.get(id);other.name='Második készülék';other._revision=crypto.randomUUID();other._dirty=true;
await syncRecords(second,client,owner);
assert.equal((await syncRecords(first,client,owner)).conflicts,1);
assert.equal(first.map.get(id).name,'Második készülék');assert.equal([...first.map.values()].filter(r=>r.name.includes('helyi eltérés')).length,1);
await syncRecords(first,client,owner);assert.equal(client.rows.size,2);
const retry=database([{...record,id:crypto.randomUUID(),_revision:crypto.randomUUID()}]);const original=client.rpc;client.rpc=async()=>({error:{message:'network failure'}});
await assert.rejects(()=>syncRecords(retry,client,owner));assert.equal([...retry.map.values()][0]._dirty,true);client.rpc=original;
await syncRecords(retry,client,owner);assert.equal([...retry.map.values()][0]._dirty,false);
await assert.rejects(()=>syncRecords(first,client,'other-owner'),/újra be kell/);
console.log('PASS: upload, cross-device download, conflict preservation, retry, account mismatch');
