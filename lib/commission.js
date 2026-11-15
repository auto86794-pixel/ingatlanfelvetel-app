const blank = value => value === undefined || value === null || String(value).trim() === '';
export function decimalValue(value, label, max=100) {
  const text=String(value??'').trim().replace(',','.');
  if(!/^\d+(?:\.\d{1,4})?$/.test(text)||!Number.isFinite(Number(text))||Number(text)>max)throw Error(`${label}: 0 és ${max} közötti számot adj meg, legfeljebb 4 tizedessel.`);
  return Number(text);
}
function money(value,label){const text=String(value??'').replace(/[\s\u00a0\u202f]/g,'');if(!/^\d+$/.test(text)||!Number.isSafeInteger(Number(text)))throw Error(`${label}: egész, nem negatív forintösszeget adj meg.`);return Number(text)}
function percentage(amount,percent){const result=(BigInt(amount)*BigInt(Math.round(percent*10000))+500000n)/1000000n;if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error('A számított összeg túl nagy.');return Number(result)}
export function calculateCommission(record){
 const fields=['commissionPercent','commissionBasis','commissionVat','commissionMinimum'];
 if(fields.every(key=>blank(record[key])))return {state:'empty'};
 try{
  if(blank(record.commissionPercent))return {state:'incomplete',message:'Add meg a közvetítői díj százalékát.'};
  const percent=decimalValue(record.commissionPercent,'Közvetítői díj');
  if(!['Bruttó díj','Nettó díj + áfa','Áfamentes díj'].includes(record.commissionBasis))return {state:'incomplete',message:'Válaszd ki a díj megadásának módját.'};
  const minimum=blank(record.commissionMinimum)?0:money(record.commissionMinimum,'Minimumdíj');
  const vat=record.commissionBasis==='Nettó díj + áfa'?(blank(record.commissionVat)?null:decimalValue(record.commissionVat,'Áfa')):null;
  if(record.commissionBasis==='Nettó díj + áfa'&&vat===null)return {state:'incomplete',message:'Add meg az alkalmazott áfa százalékát.'};
  if(blank(record.price))return {state:'incomplete',message:'A díj kiszámításához add meg az irányárat.'};
  const price=money(record.price,'Irányár');
  const rateAmount=percentage(price,percent),base=Math.max(rateAmount,minimum),vatAmount=vat===null?0:percentage(base,vat),total=base+vatAmount;
  if(!Number.isSafeInteger(total))throw Error('A számított összeg túl nagy.');
  return {state:'ready',percent,price,minimum,minimumApplies:minimum>rateAmount,base,vat,vatAmount,total,basis:record.commissionBasis};
 }catch(error){return {state:'invalid',message:error.message}}
}
export const formatHuf=amount=>new Intl.NumberFormat('hu-HU',{maximumFractionDigits:0}).format(amount)+' Ft';
