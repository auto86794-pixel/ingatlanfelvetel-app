import {calculateCommission} from './commission.js';
export function savingLabel(record,accountId,unsaved){
 if(unsaved)return 'Mentés folyamatban…';
 if(!record.updated)return 'Új piszkozat · még nincs mentve';
 if(accountId&&!record._dirty&&record._cloudVersion)return 'Felhőbe szinkronizálva · ezen a készüléken is elmentve';
 return 'Ezen a készüléken elmentve'+(accountId?' · felhős mentésre vár':'');
}
export function documentIssues(record){
 const issues=[];
 for(const [key,step,label] of [['name',0,'Kapcsolattartó neve'],['type',1,'Ingatlan típusa'],['address',1,'Ingatlan címe']])if(!String(record[key]??'').trim())issues.push({key,step,message:label+' hiányzik.'});
 const fee=calculateCommission(record);
 if(['invalid','incomplete'].includes(fee.state)){
  const key=!String(record.commissionPercent??'').trim()?'commissionPercent':!record.commissionBasis?'commissionBasis':record.commissionBasis==='Nettó díj + áfa'&&!String(record.commissionVat??'').trim()?'commissionVat':!String(record.price??'').trim()?'price':'commissionPercent';
  issues.push({key,step:1,message:fee.message});
 }
 if(record.needsSignature)issues.push({key:'signature',step:4,message:'Az adatlap módosult. Új aláírás vagy a korábbi aláírás törlése szükséges.'});
 return issues;
}
