(async()=>{
const {isRental,rentalIssues}=await import('./lib/rental-mandate.js');
const {savingLabel,documentIssues}=await import('./lib/intake-state.js');
const {calculateCommission,formatHuf}=await import('./lib/commission.js');
const {labels:definitions,renderCommission,renderDocument,validImage}=await import('./lib/document-render.js');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const handlers={};const elements=new Map();const node=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',textContent:'',classList:{add(){},remove(){}},setAttribute(){},scrollIntoView(){},addEventListener(event,fn){handlers[s+':'+event]=fn}});return elements.get(s)};
let source=fs.readFileSync('lib/intake-controller.js','utf8').split('export function mountIntake(root) {')[1];source=source.slice(0,source.indexOf('let request=indexedDB.open'));
const ctx=vm.createContext({isRental,rentalIssues,savingLabel,documentIssues,calculateCommission,formatHuf,definitions,renderCommission,renderDocument,validImage,AbortController,localStorage:{getItem(){return null}},window:node('window'),root:{querySelector:node},document:{querySelector:node,addEventListener(event,fn){handlers['document:'+event]=fn}},setTimeout:()=>0,clearTimeout(){},structuredClone,console});vm.runInContext(source,ctx);vm.runInContext(`render=()=>{};setupCanvas=()=>{};schedule=()=>{};data={photos:['a','b','c'],roomRows:[],owners:[]};`,ctx);
handlers['#form:click']({target:{dataset:{movePhoto:'2',direction:'-1'}}});assert.equal(vm.runInContext('data.photos.join()',ctx),'a,c,b');handlers['#form:click']({target:{dataset:{cover:'2'}}});assert.equal(vm.runInContext('data.photos.join()',ctx),'b,a,c');
vm.runInContext("data.signature='signed';data.internal='PRIVATE';data.id='test';data.roomRows=[{name:'Nappali',area:'20.4'},{name:'Konyha',area:'6.8'}];",ctx);assert(Math.abs(vm.runInContext('roomTotal()',ctx)-27.2)<1e-9);handlers['#form:click']({target:{dataset:{movePhoto:'0',direction:'1'}}});assert.equal(vm.runInContext('data.needsSignature',ctx),true);assert.equal(vm.runInContext('data.signature',ctx),'');assert(!vm.runInContext('documentHTML()',ctx).includes('PRIVATE'));console.log('PASS: photo order, cover, area total, signature invalidation, internal-note exclusion');

vm.runInContext("data={id:'test',name:'Próba',address:'Minta utca',type:'Lakás',photos:[],owners:[],roomRows:[],_revision:'rev',_dirty:true,commissionPercent:'2,5',commissionBasis:'Bruttó díj',price:'64900000'};",ctx);
assert(vm.runInContext('documentHTML()',ctx).replace(/\s/g,'').includes('1622500Ft'));
vm.runInContext("db={transaction(){throw Error('disk full')}}",ctx);
assert.equal(await vm.runInContext('save(true)',ctx),false);
vm.runInContext("globalThis.newCount=0;fresh=()=>{newCount++}",ctx);
await vm.runInContext('startNew()',ctx);assert.equal(ctx.newCount,0);
vm.runInContext("step=4;globalThis.printCount=0;window.print=()=>{printCount++}",ctx);
await node('#next').onclick();assert.equal(ctx.printCount,0);
vm.runInContext("photoBusy=true",ctx);assert.equal(await vm.runInContext('save(true)',ctx),false);
vm.runInContext('photoBusy=false;unsaved=true',ctx);let prevented=false;handlers['window:beforeunload']({preventDefault(){prevented=true}});assert.equal(prevented,true);
vm.runInContext('unsaved=false',ctx);prevented=false;handlers['window:beforeunload']({preventDefault(){prevented=true}});assert.equal(prevented,false);
vm.runInContext("data={documentType:'rental-mandate',signature:'a',signatureBroker:'b'};invalidate()",ctx);assert.equal(vm.runInContext('data.signatureBroker',ctx),'');assert.equal(vm.runInContext('data.signature',ctx),'');
console.log('PASS: commission in document, failed save blocks new record and PDF, photo-processing guard');
})().catch(e=>{console.error(e);process.exitCode=1});
