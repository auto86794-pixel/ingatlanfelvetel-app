export const cleanRecord = record => Object.fromEntries(Object.entries(record).filter(([key])=>!key.startsWith('_')));
export function validateRecord(record, id) {
  if(!record || record.id!==id || typeof record.updated!=='string' || !Array.isArray(record.photos) || record.photos.length>20 || !Array.isArray(record.owners) || !Array.isArray(record.roomRows||[]))throw Error('Hibás felhős adatlap.');
  for(const photo of record.photos) if(typeof photo!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(photo))throw Error('Hibás felhős fotó.');
  if(record.signature && !/^data:image\/png;base64,/.test(record.signature))throw Error('Hibás aláírás.');
  for(const [key,value] of Object.entries(record)) if(!['photos','owners','roomRows'].includes(key) && !['string','boolean','number','undefined'].includes(typeof value) && value!==null)throw Error('Hibás adatmező.');
  if(record.owners.some(o=>!o||typeof o.name!=='string'||typeof o.phone!=='string'))throw Error('Hibás tulajdonosi adat.');
  if((record.roomRows||[]).some(r=>!r||typeof r.name!=='string'||!Number.isFinite(Number(r.area))))throw Error('Hibás helyiségadat.');
  return record;
}
const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
export const allRecords = db => request(db.transaction('records').objectStore('records').getAll());
export function putRecord(db,record){return new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
export function openAccountDB(owner){return request(Object.assign(indexedDB.open('ingatlanfelvetel-v1-'+owner,1),{onupgradeneeded(event){event.target.result.createObjectStore('records',{keyPath:'id'})}}))}
export async function syncRecords(db,client,owner,onProgress=()=>{}) {
 const {data:auth,error:authError}=await client.auth.getUser();
 if(authError||auth.user?.id!==owner)throw Error('Ehhez a helyi fiókhoz újra be kell jelentkezned.');
 const local=await allRecords(db);
 const remote=[];
 for(let from=0;;from+=200){const {data,error}=await client.from('intake_records').select('id,version,client_revision,object_path,updated_at').order('id').range(from,from+199);if(error)throw error;remote.push(...data);if(data.length<200)break}
 const byId=new Map(remote.map(r=>[r.id,r]));let uploaded=0,downloaded=0,conflicts=0;
 async function pull(row){const {data:blob,error}=await client.storage.from('intake-private').download(row.object_path);if(error)throw error;const record=validateRecord(JSON.parse(await blob.text()),row.id);return {...record,_revision:row.client_revision,_cloudVersion:row.version,_dirty:false}}
 for(const record of local){onProgress(local.indexOf(record),local.length+remote.length);
   const row=byId.get(record.id);byId.delete(record.id);
   if(row && row.client_revision===record._revision){await putRecord(db,{...record,_dirty:false,_cloudVersion:row.version});continue}
   if(!record._dirty && row){if(row.version!==(record._cloudVersion||0)){await putRecord(db,await pull(row));downloaded++}continue}
   if(row && row.version!==(record._cloudVersion||0)){
     // Keep the local branch as a new record BEFORE replacing the original.
     const copyId=record._conflictCopyId||crypto.randomUUID();
     await putRecord(db,{...record,_conflictCopyId:copyId});
     const existing=await request(db.transaction('records').objectStore('records').get(copyId));
     if(!existing)await putRecord(db,{...cleanRecord(record),id:copyId,name:(record.name||'Felvétel')+' – helyi eltérés',_revision:crypto.randomUUID(),_dirty:true,_cloudVersion:0});
     await putRecord(db,await pull(row));conflicts++;downloaded++;continue;
   }
   const revision=record._revision||crypto.randomUUID();
   const path=owner+'/'+record.id+'/'+revision+'.json';
   const snapshot={...cleanRecord(record),updated:record.updated||new Date().toISOString()};
   const blob=new Blob([JSON.stringify(snapshot)],{type:'application/json'});
   if(blob.size>41943040)throw Error('Az adatlap nagyobb 40 MB-nál. Csökkentsd a fotók számát.');
   const upload=await client.storage.from('intake-private').upload(path,blob,{contentType:'application/json',upsert:false});
   if(upload.error && !['409','Duplicate','23505'].includes(String(upload.error.statusCode||upload.error.error||upload.error.code)))throw upload.error;
   const saved=await client.rpc('save_intake',{p_id:record.id,p_revision:revision,p_expected:record._cloudVersion||0,p_path:path});
   if(saved.error)throw Error(saved.error.message.includes('sync_conflict')?'Másik készüléken módosult az adatlap. Indítsd újra a szinkronizálást; a helyi változat megmaradt.':saved.error.message);
   await putRecord(db,{...record,_revision:revision,_dirty:false,_cloudVersion:saved.data.version});uploaded++;
 }
 for(const row of byId.values()){await putRecord(db,await pull(row));downloaded++}
 return {uploaded,downloaded,conflicts};
}
