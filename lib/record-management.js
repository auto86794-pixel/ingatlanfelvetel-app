export const recordStatuses=['Piszkozat','Felmérve','Lezárva'];
export const statusOf=record=>recordStatuses.includes(record.recordStatus)?record.recordStatus:'Piszkozat';
export function filterRecords(records,{query='',status='',archive='active'}={}){
 const q=query.trim().toLocaleLowerCase('hu');
 return records.filter(r=>(archive==='all'||(archive==='archived'?r.archived===true:r.archived!==true))&&(!status||statusOf(r)===status)&&[r.name,r.city,r.address].join(' ').toLocaleLowerCase('hu').includes(q)).sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||'')));
}
export function copyRecord(source,id,date){
 const result=structuredClone(source);
 for(const key of Object.keys(result))if(key.startsWith('_'))delete result[key];
 for(const key of ['signature','signatureBroker','signer','needsSignature','updated','archived'])delete result[key];
 return {...result,id,date,photos:[],recordStatus:'Piszkozat',_dirty:true};
}
