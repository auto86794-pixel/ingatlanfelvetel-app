import {isRental,rentalMethod,rentalSteps,rentalLabels,newRental,rentalIssues,rentalFeeHTML,defaultRentalClauses,clauseText} from './rental-mandate.js';
import {recordStatuses,statusOf,filterRecords,copyRecord} from './record-management.js';
import {savingLabel,documentIssues} from './intake-state.js';
import {createPdf,extractDocument,pdfFilename,convertWebp} from './pdf-export.js';
import {calculateCommission} from './commission.js';
import {labels as definitions,renderCommission,renderDocument,validImage} from './document-render.js';
export function mountIntake(root) {
let disposed=false;
const listeners = new AbortController();
function listen(element, event, handler) { element.addEventListener(event, handler, { signal: listeners.signal }); }


const $=s=>root.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const savedAccount=localStorage.getItem('intake-active-account')||'';const accountId=/^[0-9a-f-]{36}$/i.test(savedAccount)?savedAccount:'';
let db,data={},step=0,saveTimer,painting=false,canvas,unsaved=false,photoBusy=false,signatureObserver=null,pdfBusy=false,readyPdf=null;const names=['Kapcsolattartó','Ingatlan','Állapot és jellemzők','Fotók és megjegyzések','Ellenőrzés és aláírás'];

function issuesFor(){return isRental(data)?rentalIssues(data):documentIssues(data)}
function field(k,type='text',opts=null,wide=false){let v=data[k]??'';return `<label class="${wide?'wide':''}">${isRental(data)?(rentalLabels[k]||({name:"Megbízó neve",date:"Aláírás dátuma"})[k]||definitions[k]):definitions[k]}${type==='textarea'?`<textarea data-k="${k}">${esc(v)}</textarea>`:opts?`<select data-k="${k}"><option value="">Válassz / nem ismert</option>${opts.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input data-k="${k}" type="${type}" value="${esc(v)}" ${type==='number'?'min="0" step="any"':''} ${k==='phone'?'autocomplete="tel"':k==='email'?'autocomplete="email"':''}>`}</label>`}
function showWorkspace(){$('#welcome').classList.add('hidden');$('#workspace').classList.remove('hidden');$('#homeBtn').classList.remove('hidden');$('#status').classList.remove('hidden');}
function showHome(){$('#welcome').classList.remove('hidden');$('#workspace').classList.add('hidden');$('#homeBtn').classList.add('hidden');$('#status').classList.add('hidden');window.scrollTo({top:0});}
async function startNew(){clearTimeout(saveTimer);if(await save(true))fresh()}
function updateSaveState(){$('#status').textContent=savingLabel(data,accountId,unsaved);$('#status').setAttribute('role','status')}
async function startRental(){clearTimeout(saveTimer);if(await save(true)){fresh();data={...data,...newRental()};render()}}
function fresh(){clearReadyPdf();unsaved=false;data={id:crypto.randomUUID(),date:new Date().toLocaleDateString('sv-SE'),photos:[],owners:[],roomRows:[]};step=0;updateSaveState();render()}
function toast(t){$('#toast').textContent=t;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),3500)}
function tx(mode='readonly'){return db.transaction('records',mode).objectStore('records')}
async function save(silent=false){
 if(photoBusy){toast('Várd meg a fotók feldolgozását.');return false}
 if(!data.name&&!data.city&&!data.address){
   if(unsaved||!silent){$('#status').textContent='Adj meg nevet vagy címet a mentéshez';toast('Adj meg legalább egy nevet vagy ingatlancímet.');}
   return !unsaved;
 }
 data._revision??=crypto.randomUUID();data._dirty??=true;data.updated=new Date().toISOString();
 const snapshot=structuredClone(data);
 try{
   await new Promise((resolve,reject)=>{let t=db.transaction('records','readwrite');t.objectStore('records').put(snapshot);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});
   if(data.id===snapshot.id&&data._revision===snapshot._revision){unsaved=false;updateSaveState();}
   window.dispatchEvent(new CustomEvent('intake:saved'));if(!silent)toast(unsaved?'Az újabb változások mentése még folyamatban van.':'Piszkozat elmentve.');return !unsaved;
 }catch(e){$('#status').textContent='Mentési hiba';toast('Nem sikerült menteni. Exportáld az adatokat biztonsági másolatként.');return false}
}
function schedule(){clearReadyPdf();unsaved=true;data._revision=crypto.randomUUID();data._dirty=true; $('#status').textContent='Mentés folyamatban…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(true),500)}

function commissionSummary(){return renderCommission(data)}
function feeEditor(){return `<section class="fee-section" aria-label="Közvetítői díj"><h4>Közvetítői díj</h4><div class="fields"><label>Közvetítői díj (%)<input data-k="commissionPercent" type="text" inputmode="decimal" placeholder="Például: 2,5" value="${esc(data.commissionPercent??'')}"></label>${field('commissionBasis','text',['Bruttó díj','Nettó díj + áfa','Áfamentes díj'])}<label id="feeVatField" class="${data.commissionBasis==='Nettó díj + áfa'?'':'hidden'}">Áfa (%)<input data-k="commissionVat" type="text" inputmode="decimal" placeholder="Add meg az alkalmazott mértéket" value="${esc(data.commissionVat??'')}"></label></div><details><summary>Minimumdíj megadása (opcionális)</summary>${field('commissionMinimum','number')}<p class="muted">A minimumdíjat a fent kiválasztott nettó, bruttó vagy áfamentes módon add meg.</p></details><div id="feeResult" class="fee-result" aria-live="polite">${commissionSummary()||'<p class="muted">A díj megadása opcionális. A százalék és az irányár alapján itt megjelenik a számítás.</p>'}</div></section>`}

function documentHTML(){return renderDocument(data)}
function showChecks(){const panel=$('#documentChecks');if(!panel)return;const issues=issuesFor();panel.innerHTML=issues.length?`<h4>Ellenőrizendő adatok (${issues.length})</h4><p>A javításhoz válaszd ki a megfelelő sort.</p>${issues.map((issue,i)=>`<button type="button" data-issue="${i}">${esc(issue.message)} →</button>`).join('')}`:`<p>✓ A PDF-hez szükséges adatok megvannak.${isRental(data)?' Mindkét aláírás rögzítve.':' Az aláírás opcionális.'}</p>`}
function preview(){showChecks();if($('#rentalFeeResult'))$('#rentalFeeResult').innerHTML=rentalFeeHTML(data);if($('#feeResult'))$('#feeResult').innerHTML=commissionSummary()||'<p class="muted">A díj megadása opcionális.</p>';$('#preview').innerHTML=documentHTML();if($('#review'))$('#review').innerHTML=documentHTML();if($('#brokerSignatureState'))$('#brokerSignatureState').textContent=data.signatureBroker?'Megbízott aláírása rögzítve':'Megbízott aláírása hiányzik';if($('#signatureState'))$('#signatureState').textContent=data.signature?'Aláírás rögzítve':data.needsSignature?'Az adatlap módosult. Új aláírás szükséges.':'Még nincs aláírás';}
function invalidate(){if(data.signature||data.signatureBroker){data.needsSignature=true;data.signature='';data.signatureBroker='';toast('A dokumentum módosult. Kérj új aláírást.');if($('#signature'))setupCanvas();}}
function roomTotal(){return (data.roomRows||[]).reduce((sum,r)=>sum+(Number(r.area)||0),0)}
function roomEditor(){return `<details><summary>Helyiségek felvétele (${(data.roomRows||[]).length})</summary><p class="muted">Csak név és méret. A felmért helyiségek összege külön szerepel az ingatlan alapterületétől.</p><div id="roomRows">${(data.roomRows||[]).map((r,i)=>`<div class="roomrow"><label>Helyiség neve<input data-room="${i}" data-prop="name" value="${esc(r.name)}" placeholder="Például: nappali"></label><label>Terület (m²)<input data-room="${i}" data-prop="area" type="number" min="0" step="0.01" value="${esc(r.area)}"></label><button data-remove-room="${i}" aria-label="${i+1}. helyiség eltávolítása">Eltávolítás</button></div>`).join('')}</div><p><strong>Felmért helyiségek összesen: <span id="roomTotal">${roomTotal().toLocaleString('hu-HU',{maximumFractionDigits:2})}</span> m²</strong></p><button id="addRoom">+ Helyiség hozzáadása</button></details>`}

function render(){const stepNames=isRental(data)?rentalSteps:names;updateSaveState();$('#heading').textContent=isRental(data)?'Bérbeadási megbízás':'Ingatlan felvétele';signatureObserver?.disconnect();showWorkspace();data.roomRows??=[]; $('#list').classList.add('hidden');$('#editor').classList.remove('hidden');$('.steps').innerHTML=stepNames.map((n,i)=>`<button data-step="${i}" class="${i===step?'active':''}" ${i===step?'aria-current="step"':''}>${i+1}. ${n}</button>`).join('');$('#stepTitle').textContent=stepNames[step];$('#back').disabled=step===0;$('#next').textContent=step===4?'PDF letöltése':'Tovább →';let h='';if(step===0)h=`<div class="fields">${field('name')}${field('phone','tel')}${field('email','email')}${field('role','text',['Tulajdonos','Meghatalmazott','Kapcsolattartó'])}</div><details><summary>További tulajdonosok (${data.owners.length})</summary><div id="owners">${data.owners.map((o,i)=>`<div class="fields" style="margin-top:15px"><label>Név<input data-owner="${i}" data-prop="name" value="${esc(o.name)}"></label><label>Telefon<input type="tel" data-owner="${i}" data-prop="phone" value="${esc(o.phone)}"></label><button data-remove-owner="${i}">Tulajdonos eltávolítása</button></div>`).join('')}</div><button id="addOwner" style="margin-top:15px">+ Tulajdonos hozzáadása</button></details>`;
if(step===1)h=`<div class="fields">${field('type','text',['Lakás','Családi ház','Ikerház','Sorház','Telek','Garázs','Üzleti ingatlan','Egyéb'])}${field('city')}${field('district')}${field('address')}${field('area','number')}${field('rooms','number')}${field('price','number')}${['Családi ház','Ikerház','Sorház','Telek'].includes(data.type)?field('plot','number'):''}${data.type==='Lakás'?field('floor')+field('lift','text',['Van','Nincs','Nem ismert']):''}</div><details><summary>Részletes azonosítás</summary>${field('hrsz')}</details>${feeEditor()}`;
if(step===2)h=`<div class="fields">${field('condition','text',['Új építésű','Újszerű','Felújított','Jó állapotú','Átlagos','Felújítandó','Befejezetlen','Nem ismert'])}${field('year','number')}${field('wall','text',['Tégla','Panel','Vályog','Könnyűszerkezet','Vegyes','Egyéb','Nem ismert'])}${field('heating','text',['Gázkazán','Konvektor','Távfűtés','Házközponti','Hőszivattyú','Elektromos','Vegyes tüzelés','Nincs','Egyéb','Nem ismert'])}${field('balcony','text',['Erkély','Terasz','Mindkettő','Nincs','Nem ismert'])}${field('parking','text',['Garázs','Beálló','Utcai parkolás','Több lehetőség','Nincs','Nem ismert'])}${field('ac','text',['Van','Nincs','Nem ismert'])}${field('faults','textarea',null,true)}</div><details><summary>További műszaki adatok</summary><div class="fields">${field('cost','number')}${field('energy')}${field('utilities','textarea',null,true)}${field('roomlist','textarea',null,true)}</div></details>${roomEditor()}`;
if(step===3)h=`<label>Helyszíni fotók (legfeljebb 20)<input id="photoInput" type="file" accept="image/*" multiple></label><p class="muted">Az első fotó a borítókép. A nyilakkal rendezheted a képeket. Telefonon a kamera is választható. A képeket mentés előtt kisebb méretre alakítjuk.</p><div class="photos">${data.photos.map((p,i)=>`<div><span class="badge">${i===0?'Borítókép':'Fotó '+(i+1)}</span><img src="${p}" alt="Ingatlanfotó ${i+1}"><div class="photoactions"><button data-move-photo="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="${i+1}. fotó előrébb">←</button><button data-move-photo="${i}" data-direction="1" ${i===data.photos.length-1?'disabled':''} aria-label="${i+1}. fotó hátrébb">→</button></div>${i>0?`<button data-cover="${i}">Legyen borítókép</button>`:''}<button data-remove-photo="${i}">Eltávolítás</button></div>`).join('')}</div><div class="fields" style="margin-top:25px">${field('benefits','textarea',null,true)}${field('viewing')}${field('possession')}${field('notes','textarea',null,true)}${field('internal','textarea',null,true)}</div><p class="muted">A belső megjegyzés csak a mentett felvételben és a biztonsági másolatban szerepel.</p>`;
if(step===4)h=`<div class="notice">Ez ingatlanfelvételi adatlap. Az aláírás előtt ellenőrizd az adatokat. A PDF letöltése gombbal közvetlenül elmentheted a kész adatlapot. A fájlt ezután továbbküldheted is.</div><div id="documentChecks" class="document-checks" aria-live="polite"></div><div id="review">${documentHTML()}</div><div class="fields" style="margin-top:20px">${field('date','date')}${field('signer')}</div><h4>Aláírás a képernyőn</h4><p id="signatureState" class="badge">${data.signature?'Aláírás rögzítve':data.needsSignature?'Az adatlap módosult. Új aláírás szükséges.':'Még nincs aláírás'}</p><canvas id="signature" aria-label="Aláírási felület"></canvas><button id="clearSig">Aláírás törlése</button><p class="muted">Az adatlap aláírás nélkül is nyomtatható.</p><div class="document-actions"><button id="printDoc">Nyomtatás</button>${canSharePdf()?`<button id="sharePdf">${readyPdf?'PDF megosztása':'PDF előkészítése megosztáshoz'}</button>`:''}<button id="export">Biztonsági másolat exportálása</button></div><div id="pdfReady" class="pdf-ready" role="status"></div>`;if(isRental(data))h=rentalForm();$('#form').innerHTML=h;preview();if(step===4){setupCanvas();showPdfReady();showChecks()}}
function rentalForm(){
 if(step===0)return `<p class="muted">A bérbeadást megrendelő tulajdonos adatai.</p><div class="fields">${field('name')}${field('homeAddress')}${field('phone','tel')}${field('email','email')}</div><details><summary>További személyazonosító adatok a minta szerint</summary><div class="fields">${field('motherName')}${field('identityNumber')}${field('birthPlace')}${field('birthDate','date')}</div></details>`;
 if(step===1)return `<div class="fields">${field('brokerName')}${field('brokerAddress')}${field('brokerContact')}${field('brokerPhone','tel')}${field('brokerEmail','email')}${field('brokerTax')}${field('brokerRegistration')}</div>`;
 if(step===2)return `<div class="fields">${field('city')}${field('address')}${field('hrsz')}${field('rent','number')}${field('deposit','number')}${field('rentalFeeMethod','text',['Egyhavi bérleti díj','Éves bérleti díj százaléka'])}${rentalMethod(data)==='Éves bérleti díj százaléka'?field('rentalPercent'):''}${field('rentalBasis','text',['Bruttó díj','Nettó díj + áfa','Áfamentes díj'])}${data.rentalBasis==='Nettó díj + áfa'?field('rentalVat'):''}</div><p class="muted">Alapértelmezés: egyhavi bérleti díj. Választható az éves bérleti díj százaléka is. A fizetendő összeget a bruttó, nettó + áfa vagy áfamentes díjmód határozza meg. Kaució nélkül 0 Ft-ot adj meg.</p><div id="rentalFeeResult" class="fee-result">${rentalFeeHTML(data)}</div>`;
 if(step===3)return `<p class="notice">A küldött minta alapján digitalizált, szerkeszthető feltételek. Nyisd meg és ellenőrizd mind a kilenc pontot, különösen a kötbért, az utólagos értékesítés díját és a jogvita helyét.</p>${defaultRentalClauses.map((_,i)=>`<details><summary>${i+1}. feltétel szerkesztése</summary><label>${i+1}. szerződési feltétel<textarea rows="8" data-k="rentalClause${i+1}">${esc(clauseText(data,i))}</textarea></label></details>`).join('')}${field('rentalExtra','textarea',null,true)}${field('rentalInternal','textarea',null,true)}`;
 return `<div class="notice">Ellenőrizd a teljes szerződést. Minden tartalmi módosítás mindkét aláírást törli. A képernyőn rajzolt aláírás képként kerül a PDF-be; ez nem minősített elektronikus aláírás.</div><div class="fields">${field('contractNumber')}${field('signingPlace')}${field('date','date')}</div><div id="documentChecks" class="document-checks" aria-live="polite"></div><div id="review">${documentHTML()}</div><div class="rental-signatures"><section><h4>Megbízó aláírása</h4><p>${esc(data.name||'Megbízó')}</p><p id="signatureState" class="badge"></p><canvas id="signature" aria-label="Megbízó aláírása"></canvas><button id="clearSig">Megbízó aláírásának törlése</button></section><section><h4>Megbízott aláírása</h4><p>${esc(data.brokerContact||data.brokerName||'Megbízott')}</p><p id="brokerSignatureState" class="badge"></p><canvas id="signatureBroker" aria-label="Megbízott aláírása"></canvas><button id="clearBrokerSig">Megbízott aláírásának törlése</button></section></div><div class="document-actions"><button id="printDoc">Nyomtatás</button>${canSharePdf()?'<button id="sharePdf">PDF előkészítése megosztáshoz</button>':''}<button id="export">Biztonsági másolat exportálása</button></div><div id="pdfReady" class="pdf-ready" role="status"></div>`;
}
listen($('#form'), 'input',e=>{let k=e.target.dataset.k;if(k){if(!['internal','rentalInternal'].includes(k))invalidate();data[k]=e.target.value;schedule();preview();if(k==='commissionBasis'&&$('#feeVatField'))$('#feeVatField').classList.toggle('hidden',data.commissionBasis!=='Nettó díj + áfa');if(['type','rentalFeeMethod','rentalBasis'].includes(k))render()}if(e.target.dataset.owner!==undefined){data.owners[+e.target.dataset.owner][e.target.dataset.prop]=e.target.value;invalidate();schedule();preview()}if(e.target.dataset.room!==undefined){invalidate();data.roomRows[+e.target.dataset.room][e.target.dataset.prop]=e.target.value;$('#roomTotal').textContent=roomTotal().toLocaleString('hu-HU',{maximumFractionDigits:2});schedule();preview()}});
function changed(){invalidate();schedule();render()}
listen($('#form'), 'click',e=>{let t=e.target;if(t.dataset.issue!==undefined){const issue=issuesFor()[+t.dataset.issue];if(issue){step=issue.step;render();const target=['signature','signatureBroker'].includes(issue.key)?$('#'+issue.key):$('[data-k="'+issue.key+'"]');if(target){const details=target.closest('details');if(details)details.open=true;target.setAttribute('tabindex','0');target.focus();target.scrollIntoView({block:'center',behavior:'smooth'})}}return}if(t.id==='addRoom'){data.roomRows.push({name:'',area:''});changed();$('#roomRows').closest('details').open=true}if(t.dataset.removeRoom!==undefined){data.roomRows.splice(+t.dataset.removeRoom,1);changed();$('#roomRows').closest('details').open=true}if(t.dataset.movePhoto!==undefined){let i=+t.dataset.movePhoto,j=i+(+t.dataset.direction);if(j>=0&&j<data.photos.length){[data.photos[i],data.photos[j]]=[data.photos[j],data.photos[i]];changed()}}if(t.dataset.cover!==undefined){let [cover]=data.photos.splice(+t.dataset.cover,1);data.photos.unshift(cover);changed()}if(t.id==='addOwner'){data.owners.push({name:'',phone:''});changed()}if(t.dataset.removeOwner!==undefined){data.owners.splice(+t.dataset.removeOwner,1);changed()}if(t.dataset.removePhoto!==undefined){data.photos.splice(+t.dataset.removePhoto,1);changed()}if(t.id==='clearBrokerSig'){data.signatureBroker='';setupCanvas();schedule();preview()}if(t.id==='clearSig'){data.signature='';data.needsSignature=false;setupCanvas();schedule();preview()}if(t.id==='printDoc')finishExport('print');if(t.id==='sharePdf')sharePdf();if(t.id==='export')download(JSON.stringify(data,null,2),'ingatlanfelvetel-'+data.id.slice(0,8)+'.json','application/json')});
function download(content,name,type){let u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
listen($('#form'), 'change',async e=>{if(e.target.id!=='photoInput')return;photoBusy=true;try{for(const f of e.target.files){if(data.photos.length>=20){toast('Legfeljebb 20 képet tölthetsz fel.');break}try{let bmp=await createImageBitmap(f),c=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bmp.width,bmp.height));c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);data.photos.push(c.toDataURL('image/jpeg',.78));bmp.close()}catch{toast('Egy kép nem olvasható. Próbáld JPG vagy PNG formátumban.')}}}finally{photoBusy=false;changed()}});
function setupCanvas(){
 signatureObserver?.disconnect();const observers=[];signatureObserver={disconnect(){observers.forEach(o=>o.disconnect())}};
 const targets=isRental(data)?[['signature','signature'],['signatureBroker','signatureBroker']]:[['signature','signature']];
 for(const [id,key] of targets){const target=$('#'+id);if(!target)continue;canvas=target;let ink=false,startPoint=null,active=false;
 function resize(){
  if(active)return;const ratio=window.devicePixelRatio||1,width=target.clientWidth;if(!width)return;
  target.width=Math.round(width*ratio);target.height=Math.round(180*ratio);const c=target.getContext('2d');c.scale(ratio,ratio);c.strokeStyle='#183c2c';c.lineWidth=2.3;c.lineCap='round';c.lineJoin='round';
  if(data[key]){const source=data[key],img=new Image();img.onload=()=>{if(data[key]!==source||!target.isConnected||active)return;const scale=Math.min(width/img.width,180/img.height),w=img.width*scale,h=img.height*scale;c.drawImage(img,(width-w)/2,(180-h)/2,w,h)};img.src=source}
 }
 resize();if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(resize);observer.observe(target);observers.push(observer)}
 const point=e=>{const r=target.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
 target.onpointerdown=e=>{if(painting)return;painting=true;active=true;ink=false;startPoint=point(e);target.setPointerCapture(e.pointerId);const c=target.getContext('2d');c.beginPath();c.moveTo(...startPoint)};
 target.onpointermove=e=>{if(!active)return;const p=point(e);if(Math.hypot(p[0]-startPoint[0],p[1]-startPoint[1])>2)ink=true;const c=target.getContext('2d');c.lineTo(...p);c.stroke()};
 const finish=()=>{if(!active)return;active=false;painting=false;if(ink){data[key]=target.toDataURL();data.needsSignature=false;schedule();preview()}};
 target.onpointerup=finish;target.onpointercancel=finish;
 }
}

function clearReadyPdf(){if(readyPdf){URL.revokeObjectURL(readyPdf.url);readyPdf=null}if($('#pdfReady'))$('#pdfReady').innerHTML='';if($('#sharePdf'))$('#sharePdf').textContent='PDF előkészítése megosztáshoz'}
function canSharePdf(){try{return typeof navigator!=='undefined'&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[new File(['%PDF-1.7\n'],'adatlap.pdf',{type:'application/pdf'})]})}catch{return false}}
function showPdfReady(){if(!$('#pdfReady'))return;if(readyPdf&&readyPdf.revision===data._revision){$('#pdfReady').innerHTML=`<p>A PDF elkészült. <a href="${readyPdf.url}" download="${esc(readyPdf.file.name)}">Letöltés újra</a></p><p class="muted">${esc(readyPdf.file.name)} · A fájl a készülékeden jött létre; nem küldtük el automatikusan.</p>`;if($('#sharePdf'))$('#sharePdf').textContent='PDF megosztása'}}
async function finishExport(action){
 if(pdfBusy)return false;
 const issues=issuesFor();if(issues.length){step=4;render();$('#documentChecks').scrollIntoView({block:'center',behavior:'smooth'});toast('A PDF előtt javítsd az ellenőrzőlistában jelzett adatokat.');return false}
 if(!await save(true))return false;
 if(action==='print'){await printDocument();return true}
 const revision=data._revision;
 try{
  pdfBusy=true;root.inert=true;toast('PDF készítése…');
  if(!readyPdf||readyPdf.revision!==revision){
   clearReadyPdf();const snapshot=structuredClone(data),model=extractDocument(renderDocument(snapshot));
   const bytes=await createPdf(model,{convertImage:convertWebp});
   const file=new File([bytes],pdfFilename(snapshot),{type:'application/pdf'});
   if(disposed)return false;
   readyPdf={file,url:URL.createObjectURL(file),revision};
  }
  showPdfReady();
  if(action==='download'){const a=document.createElement('a');a.href=readyPdf.url;a.download=readyPdf.file.name;document.body.append(a);a.click();a.remove();toast('A PDF elkészült. Keresd a letöltések között.');}
  else toast('A PDF elkészült. Koppints a PDF megosztása gombra.');
  return true;
 }catch(error){toast(error?.message||'Nem sikerült elkészíteni a PDF-et. Próbáld a Nyomtatás gombot.');return false}
 finally{pdfBusy=false;root.inert=false}
}
function sharePdf(){
 if(pdfBusy)return;
 if(!readyPdf||readyPdf.revision!==data._revision){finishExport('prepare');return}
 if(!canSharePdf()){toast('Ezen a készüléken a fájlmegosztás nem elérhető. Töltsd le a PDF-et.');return}
 navigator.share({files:[readyPdf.file],title:'Ingatlanfelvételi adatlap'}).catch(error=>{if(error.name!=='AbortError')toast('A megosztás nem indult el. A kész PDF-et a Letöltés újra hivatkozással mentheted.')});
}

async function printDocument(){
 const snapshot=structuredClone(data);
 if((snapshot.signatureBroker&&!validImage(snapshot.signatureBroker))||(snapshot.photos||[]).some(photo=>!validImage(photo))||(snapshot.signature&&!validImage(snapshot.signature))){toast('Egy fotó vagy aláírás hibás. Ellenőrizd az adatlapot a PDF előtt.');return}
 $('#printArea').innerHTML=renderDocument(snapshot);
 try{await Promise.race([Promise.all([...$('#printArea').querySelectorAll('img')].map(img=>img.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('image_timeout')),10000))]);}
 catch{toast('Egy fotó vagy aláírás nem tölthető be. Ellenőrizd a képeket, majd próbáld újra.');return}
 const oldTitle=document.title;
 document.title=(isRental(snapshot)?'Berbeadasi_megbizas_':'Ingatlanfelvetel_')+(snapshot.city||snapshot.address||snapshot.id.slice(0,8)).replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,80);
 window.addEventListener('afterprint',()=>{document.title=oldTitle},{once:true});
 window.print();
}

$('.steps').onclick=e=>{if(e.target.dataset.step!==undefined){step=+e.target.dataset.step;render()}};$('#back').onclick=()=>{if(step>0){step--;render()}};$('#next').onclick=async()=>{if(step<4){step++;render();window.scrollTo({top:0,behavior:'smooth'})}else await finishExport('download')};$('#save').onclick=()=>save();
async function list(){
 clearTimeout(saveTimer);if(!await save(true))return;
 let records;try{records=await new Promise((resolve,reject)=>{const r=tx().getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}catch{toast('A mentett felvételek nem olvashatók. Próbáld újra.');return}
 showWorkspace();$('#editor').classList.add('hidden');$('#list').classList.remove('hidden');
 $('#list').innerHTML=`<div class="intro"><h3>Mentett felvételek</h3><div class="welcome-actions"><button id="newRecord" class="primary">+ Új felvétel</button><button id="newRental">+ Bérbeadási megbízás</button></div></div><div class="record-filters"><label>Keresés<input id="search" placeholder="Név vagy cím" type="search"></label><label>Állapot<select id="statusFilter"><option value="">Minden állapot</option>${recordStatuses.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Megjelenítés<select id="archiveFilter"><option value="active">Aktív felvételek</option><option value="archived">Archivált felvételek</option><option value="all">Minden felvétel</option></select></label></div><p id="recordCount" role="status"></p><p class="muted">Az állapot a munkád követését segíti. A lezárás nem zárolja az adatlapot. Az archivált felvétel bármikor visszaállítható.</p><div id="records"></div><hr><label>Biztonsági másolat visszatöltése<input type="file" id="import" accept="application/json,.json"></label>`;
 function results(){
 const visible=filterRecords(records,{query:$('#search').value,status:$('#statusFilter').value,archive:$('#archiveFilter').value});
 $('#recordCount').textContent=visible.length+' találat · összesen '+records.length+' felvétel';
 $('#records').innerHTML=visible.map(r=>`<div class="draft record-card"><div><strong>${esc(r.city||'Ingatlan')} ${esc(r.address||'')}</strong><p>${esc(r.name||'Név nélkül')} · ${r.updated?esc(new Date(r.updated).toLocaleString('hu-HU')):''}</p><span class="badge">${isRental(r)?'Bérbeadási megbízás':'Ingatlanfelvétel'}</span><span class="badge">${esc(statusOf(r))}${r.archived===true?' · Archivált':''}</span><p class="cloud-state">${accountId?(r._dirty||!r._cloudVersion?'Helyben mentve · felhős mentésre vár':'Felhőben is mentve'):'Csak ezen a készüléken'}</p></div><div class="record-actions"><label>Felvétel állapota<select data-status="${esc(r.id)}" aria-label="${esc(r.address||r.name||'Felvétel')} állapota">${recordStatuses.map(x=>`<option ${statusOf(r)===x?'selected':''}>${x}</option>`).join('')}</select></label><button data-open="${esc(r.id)}">Megnyitás</button><button data-copy="${esc(r.id)}">Másolás</button>${!isRental(r)?`<button data-rental="${esc(r.id)}">Bérbeadási megbízás indítása</button>`:''}<button data-archive="${esc(r.id)}">${r.archived===true?'Visszaállítás':'Archiválás'}</button></div></div>`).join('')||'<p class="muted">Nincs a szűrésnek megfelelő felvétel.</p>';
 }
 results();$('#search').oninput=results;$('#statusFilter').onchange=results;$('#archiveFilter').onchange=results;$('#newRecord').onclick=startNew;$('#newRental').onclick=startRental;
 let recordBusy=false;
 async function persistRecord(record){
 record._revision=crypto.randomUUID();record._dirty=true;record.updated=new Date().toISOString();
 await new Promise((resolve,reject)=>{const t=db.transaction('records','readwrite');t.objectStore('records').put(record);t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)});
 const i=records.findIndex(r=>r.id===record.id);if(i<0)records.push(record);else records[i]=record;
 if(data.id===record.id){data=structuredClone(record);unsaved=false;updateSaveState()}
 window.dispatchEvent(new CustomEvent('intake:saved'));
 }
 async function action(kind,id,value){
 if(recordBusy)return;const record=records.find(r=>r.id===id);if(!record)return;
 if(kind==='open'){clearReadyPdf();data=structuredClone(record);unsaved=false;step=0;render();return}
 recordBusy=true;$('#records').inert=true;$('#newRecord').disabled=true;
 try{
 if(kind==='copy'||kind==='rental'){
 const copied=kind==='rental'?{...newRental(record),id:crypto.randomUUID(),date:new Date().toLocaleDateString('sv-SE')}:copyRecord(record,crypto.randomUUID(),new Date().toLocaleDateString('sv-SE'));
 await persistRecord(copied);clearReadyPdf();data=copied;unsaved=false;step=0;render();toast('Másolat létrehozva. A fotókat és az aláírást újra kell rögzíteni.');
 }else{const changed=structuredClone(record);if(kind==='status'){if(!recordStatuses.includes(value))return;changed.recordStatus=value}else changed.archived=record.archived!==true;
 await persistRecord(changed);results();toast(kind==='status'?'Állapot elmentve.':changed.archived?'Felvétel archiválva.':'Felvétel visszaállítva.');}
 }catch{results();toast('A változtatás mentése nem sikerült. Az eredeti felvétel megmaradt.');}
 finally{recordBusy=false;$('#records').inert=false;$('#newRecord').disabled=false}
 }
 $('#records').onclick=e=>{const t=e.target;for(const kind of ['open','copy','archive','rental'])if(t.dataset[kind]!==undefined){action(kind,t.dataset[kind]);break}};
 $('#records').onchange=e=>{if(e.target.dataset.status!==undefined)action('status',e.target.dataset.status,e.target.value)};
 $('#import').onchange=async e=>{try{let r=JSON.parse(await e.target.files[0].text());if(!r||typeof r.id!=='string'||!Array.isArray(r.photos)||!Array.isArray(r.owners)||r.photos.some(p=>typeof p!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(p))||(r.signature&&!/^data:image\/png;base64,/.test(r.signature))||(r.signatureBroker&&!/^data:image\/png;base64,/.test(r.signatureBroker))||(r.documentType&&!['intake','rental-mandate'].includes(r.documentType)))throw Error();if(r.roomRows&&(!Array.isArray(r.roomRows)||r.roomRows.some(x=>!x||typeof x.name!=='string'||!Number.isFinite(Number(x.area))||Number(x.area)<0)))throw Error();r.id=crypto.randomUUID();for(const key of Object.keys(r))if(key.startsWith('_'))delete r[key];data=r;await save();step=0;render()}catch{toast('Nem érvényes ingatlanfelvételi biztonsági másolat.')}}}$('#listBtn').onclick=list;
$('#welcomeNew').onclick=startNew;$('#welcomeRental').onclick=startRental;$('#welcomeList').onclick=list;$('#homeBtn').onclick=async()=>{clearTimeout(saveTimer);if(await save(true))showHome()};
$('#accountBtn').onclick=()=>{const panel=document.querySelector('[aria-label="Fiók és felhős mentés"]');if(panel){const details=panel.querySelector('details');if(details)details.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});panel.querySelector('summary')?.focus()}};
listen(window,'intake:flush',async e=>{clearTimeout(saveTimer);if(!db||pdfBusy){e.detail.done(false);return}e.detail.done(await save(true))});
listen(window,'intake:reload',async event=>{try{if(!db)return;const currentId=data.id;const record=await new Promise((resolve,reject)=>{const r=tx().get(currentId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(record){data=record;unsaved=false;updateSaveState()}if(!$('#list').classList.contains('hidden'))await list();else if(!$('#workspace').classList.contains('hidden'))render();}finally{event.detail?.done?.()}});
listen(window,'beforeunload',event=>{if(unsaved||photoBusy||painting){event.preventDefault();event.returnValue=''}});
listen(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'&&unsaved&&!photoBusy){clearTimeout(saveTimer);save(true)}});
let request=indexedDB.open('ingatlanfelvetel-v1'+(accountId?'-'+accountId:''),1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onsuccess=()=>{db=request.result;if(disposed){db.close();return}fresh();showHome()};request.onerror=()=>{$('#form').innerHTML='<p>A böngésző nem engedélyezi a helyi adattárolást. Nyisd meg normál böngészőablakban.</p>'};

return ()=>{disposed=true;clearReadyPdf();signatureObserver?.disconnect();listeners.abort();clearTimeout(saveTimer);if(db)db.close();};
}
