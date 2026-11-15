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

function field(k,type='text',opts=null,wide=false){let v=data[k]??'';return `<label class="${wide?'wide':''}">${definitions[k]}${type==='textarea'?`<textarea data-k="${k}">${esc(v)}</textarea>`:opts?`<select data-k="${k}"><option value="">Válassz / nem ismert</option>${opts.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input data-k="${k}" type="${type}" value="${esc(v)}" ${type==='number'?'min="0" step="any"':''} ${k==='phone'?'autocomplete="tel"':k==='email'?'autocomplete="email"':''}>`}</label>`}
function showWorkspace(){$('#welcome').classList.add('hidden');$('#workspace').classList.remove('hidden');$('#homeBtn').classList.remove('hidden');$('#status').classList.remove('hidden');}
function showHome(){$('#welcome').classList.remove('hidden');$('#workspace').classList.add('hidden');$('#homeBtn').classList.add('hidden');$('#status').classList.add('hidden');window.scrollTo({top:0});}
async function startNew(){clearTimeout(saveTimer);if(await save(true))fresh()}
function fresh(){clearReadyPdf();unsaved=false;data={id:crypto.randomUUID(),date:new Date().toLocaleDateString('sv-SE'),photos:[],owners:[],roomRows:[]};step=0;$('#status').textContent='Új piszkozat';render()}
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
   if(data.id===snapshot.id&&data._revision===snapshot._revision){unsaved=false;$('#status').textContent='Piszkozat mentve • '+new Date().toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});}
   window.dispatchEvent(new CustomEvent('intake:saved'));if(!silent)toast('Piszkozat elmentve.');return true;
 }catch(e){$('#status').textContent='Mentési hiba';toast('Nem sikerült menteni. Exportáld az adatokat biztonsági másolatként.');return false}
}
function schedule(){clearReadyPdf();unsaved=true;data._revision=crypto.randomUUID();data._dirty=true; $('#status').textContent='Mentés folyamatban…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(true),500)}

function commissionSummary(){return renderCommission(data)}
function feeEditor(){return `<section class="fee-section" aria-label="Közvetítői díj"><h4>Közvetítői díj</h4><div class="fields"><label>Közvetítői díj (%)<input data-k="commissionPercent" type="text" inputmode="decimal" placeholder="Például: 2,5" value="${esc(data.commissionPercent??'')}"></label>${field('commissionBasis','text',['Bruttó díj','Nettó díj + áfa','Áfamentes díj'])}<label id="feeVatField" class="${data.commissionBasis==='Nettó díj + áfa'?'':'hidden'}">Áfa (%)<input data-k="commissionVat" type="text" inputmode="decimal" placeholder="Add meg az alkalmazott mértéket" value="${esc(data.commissionVat??'')}"></label></div><details><summary>Minimumdíj megadása (opcionális)</summary>${field('commissionMinimum','number')}<p class="muted">A minimumdíjat a fent kiválasztott nettó, bruttó vagy áfamentes módon add meg.</p></details><div id="feeResult" class="fee-result" aria-live="polite">${commissionSummary()||'<p class="muted">A díj megadása opcionális. A százalék és az irányár alapján itt megjelenik a számítás.</p>'}</div></section>`}

function documentHTML(){return renderDocument(data)}
function preview(){if($('#feeResult'))$('#feeResult').innerHTML=commissionSummary()||'<p class="muted">A díj megadása opcionális.</p>';$('#preview').innerHTML=documentHTML();if($('#review'))$('#review').innerHTML=documentHTML();if($('#signatureState'))$('#signatureState').textContent=data.signature?'Aláírás rögzítve':data.needsSignature?'Az adatlap módosult. Új aláírás szükséges.':'Még nincs aláírás';}
function invalidate(){if(data.signature){data.needsSignature=true;data.signature='';toast('Az adatlap módosult. Kérj új aláírást.');if($('#signature'))setupCanvas();}}
function roomTotal(){return (data.roomRows||[]).reduce((sum,r)=>sum+(Number(r.area)||0),0)}
function roomEditor(){return `<details><summary>Helyiségek felvétele (${(data.roomRows||[]).length})</summary><p class="muted">Csak név és méret. A felmért helyiségek összege külön szerepel az ingatlan alapterületétől.</p><div id="roomRows">${(data.roomRows||[]).map((r,i)=>`<div class="roomrow"><label>Helyiség neve<input data-room="${i}" data-prop="name" value="${esc(r.name)}" placeholder="Például: nappali"></label><label>Terület (m²)<input data-room="${i}" data-prop="area" type="number" min="0" step="0.01" value="${esc(r.area)}"></label><button data-remove-room="${i}" aria-label="${i+1}. helyiség eltávolítása">Eltávolítás</button></div>`).join('')}</div><p><strong>Felmért helyiségek összesen: <span id="roomTotal">${roomTotal().toLocaleString('hu-HU',{maximumFractionDigits:2})}</span> m²</strong></p><button id="addRoom">+ Helyiség hozzáadása</button></details>`}

function render(){signatureObserver?.disconnect();showWorkspace();data.roomRows??=[]; $('#list').classList.add('hidden');$('#editor').classList.remove('hidden');$('.steps').innerHTML=names.map((n,i)=>`<button data-step="${i}" class="${i===step?'active':''}" ${i===step?'aria-current="step"':''}>${i+1}. ${n}</button>`).join('');$('#stepTitle').textContent=names[step];$('#back').disabled=step===0;$('#next').textContent=step===4?'PDF letöltése':'Tovább →';let h='';if(step===0)h=`<div class="fields">${field('name')}${field('phone','tel')}${field('email','email')}${field('role','text',['Tulajdonos','Meghatalmazott','Kapcsolattartó'])}</div><details><summary>További tulajdonosok (${data.owners.length})</summary><div id="owners">${data.owners.map((o,i)=>`<div class="fields" style="margin-top:15px"><label>Név<input data-owner="${i}" data-prop="name" value="${esc(o.name)}"></label><label>Telefon<input type="tel" data-owner="${i}" data-prop="phone" value="${esc(o.phone)}"></label><button data-remove-owner="${i}">Tulajdonos eltávolítása</button></div>`).join('')}</div><button id="addOwner" style="margin-top:15px">+ Tulajdonos hozzáadása</button></details>`;
if(step===1)h=`<div class="fields">${field('type','text',['Lakás','Családi ház','Ikerház','Sorház','Telek','Garázs','Üzleti ingatlan','Egyéb'])}${field('city')}${field('district')}${field('address')}${field('area','number')}${field('rooms','number')}${field('price','number')}${['Családi ház','Ikerház','Sorház','Telek'].includes(data.type)?field('plot','number'):''}${data.type==='Lakás'?field('floor')+field('lift','text',['Van','Nincs','Nem ismert']):''}</div><details><summary>Részletes azonosítás</summary>${field('hrsz')}</details>${feeEditor()}`;
if(step===2)h=`<div class="fields">${field('condition','text',['Új építésű','Újszerű','Felújított','Jó állapotú','Átlagos','Felújítandó','Befejezetlen','Nem ismert'])}${field('year','number')}${field('wall','text',['Tégla','Panel','Vályog','Könnyűszerkezet','Vegyes','Egyéb','Nem ismert'])}${field('heating','text',['Gázkazán','Konvektor','Távfűtés','Házközponti','Hőszivattyú','Elektromos','Vegyes tüzelés','Nincs','Egyéb','Nem ismert'])}${field('balcony','text',['Erkély','Terasz','Mindkettő','Nincs','Nem ismert'])}${field('parking','text',['Garázs','Beálló','Utcai parkolás','Több lehetőség','Nincs','Nem ismert'])}${field('ac','text',['Van','Nincs','Nem ismert'])}${field('faults','textarea',null,true)}</div><details><summary>További műszaki adatok</summary><div class="fields">${field('cost','number')}${field('energy')}${field('utilities','textarea',null,true)}${field('roomlist','textarea',null,true)}</div></details>${roomEditor()}`;
if(step===3)h=`<label>Helyszíni fotók (legfeljebb 20)<input id="photoInput" type="file" accept="image/*" multiple></label><p class="muted">Az első fotó a borítókép. A nyilakkal rendezheted a képeket. Telefonon a kamera is választható. A képeket mentés előtt kisebb méretre alakítjuk.</p><div class="photos">${data.photos.map((p,i)=>`<div><span class="badge">${i===0?'Borítókép':'Fotó '+(i+1)}</span><img src="${p}" alt="Ingatlanfotó ${i+1}"><div class="photoactions"><button data-move-photo="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="${i+1}. fotó előrébb">←</button><button data-move-photo="${i}" data-direction="1" ${i===data.photos.length-1?'disabled':''} aria-label="${i+1}. fotó hátrébb">→</button></div>${i>0?`<button data-cover="${i}">Legyen borítókép</button>`:''}<button data-remove-photo="${i}">Eltávolítás</button></div>`).join('')}</div><div class="fields" style="margin-top:25px">${field('benefits','textarea',null,true)}${field('viewing')}${field('possession')}${field('notes','textarea',null,true)}${field('internal','textarea',null,true)}</div><p class="muted">A belső megjegyzés csak a mentett felvételben és a biztonsági másolatban szerepel.</p>`;
if(step===4)h=`<div class="notice">Ez ingatlanfelvételi adatlap. Az aláírás előtt ellenőrizd az adatokat. A PDF letöltése gombbal közvetlenül elmentheted a kész adatlapot. A fájlt ezután továbbküldheted is.</div><div id="review">${documentHTML()}</div><div class="fields" style="margin-top:20px">${field('date','date')}${field('signer')}</div><h4>Aláírás a képernyőn</h4><p id="signatureState" class="badge">${data.signature?'Aláírás rögzítve':data.needsSignature?'Az adatlap módosult. Új aláírás szükséges.':'Még nincs aláírás'}</p><canvas id="signature" aria-label="Aláírási felület"></canvas><button id="clearSig">Aláírás törlése</button><p class="muted">Az adatlap aláírás nélkül is nyomtatható.</p><div class="document-actions"><button id="printDoc">Nyomtatás</button>${canSharePdf()?`<button id="sharePdf">${readyPdf?'PDF megosztása':'PDF előkészítése megosztáshoz'}</button>`:''}<button id="export">Biztonsági másolat exportálása</button></div><div id="pdfReady" class="pdf-ready" role="status"></div>`;$('#form').innerHTML=h;preview();if(step===4){setupCanvas();showPdfReady()}}
listen($('#form'), 'input',e=>{let k=e.target.dataset.k;if(k){if(k!=='internal')invalidate();data[k]=e.target.value;schedule();preview();if(k==='commissionBasis'&&$('#feeVatField'))$('#feeVatField').classList.toggle('hidden',data.commissionBasis!=='Nettó díj + áfa');if(k==='type')render()}if(e.target.dataset.owner!==undefined){data.owners[+e.target.dataset.owner][e.target.dataset.prop]=e.target.value;invalidate();schedule();preview()}if(e.target.dataset.room!==undefined){invalidate();data.roomRows[+e.target.dataset.room][e.target.dataset.prop]=e.target.value;$('#roomTotal').textContent=roomTotal().toLocaleString('hu-HU',{maximumFractionDigits:2});schedule();preview()}});
function changed(){invalidate();schedule();render()}
listen($('#form'), 'click',e=>{let t=e.target;if(t.id==='addRoom'){data.roomRows.push({name:'',area:''});changed();$('#roomRows').closest('details').open=true}if(t.dataset.removeRoom!==undefined){data.roomRows.splice(+t.dataset.removeRoom,1);changed();$('#roomRows').closest('details').open=true}if(t.dataset.movePhoto!==undefined){let i=+t.dataset.movePhoto,j=i+(+t.dataset.direction);if(j>=0&&j<data.photos.length){[data.photos[i],data.photos[j]]=[data.photos[j],data.photos[i]];changed()}}if(t.dataset.cover!==undefined){let [cover]=data.photos.splice(+t.dataset.cover,1);data.photos.unshift(cover);changed()}if(t.id==='addOwner'){data.owners.push({name:'',phone:''});changed()}if(t.dataset.removeOwner!==undefined){data.owners.splice(+t.dataset.removeOwner,1);changed()}if(t.dataset.removePhoto!==undefined){data.photos.splice(+t.dataset.removePhoto,1);changed()}if(t.id==='clearSig'){data.signature='';data.needsSignature=false;setupCanvas();schedule();preview()}if(t.id==='printDoc')finishExport('print');if(t.id==='sharePdf')sharePdf();if(t.id==='export')download(JSON.stringify(data,null,2),'ingatlanfelvetel-'+data.id.slice(0,8)+'.json','application/json')});
function download(content,name,type){let u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
listen($('#form'), 'change',async e=>{if(e.target.id!=='photoInput')return;photoBusy=true;try{for(const f of e.target.files){if(data.photos.length>=20){toast('Legfeljebb 20 képet tölthetsz fel.');break}try{let bmp=await createImageBitmap(f),c=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(bmp.width,bmp.height));c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);data.photos.push(c.toDataURL('image/jpeg',.78));bmp.close()}catch{toast('Egy kép nem olvasható. Próbáld JPG vagy PNG formátumban.')}}}finally{photoBusy=false;changed()}});
function setupCanvas(){
 signatureObserver?.disconnect();canvas=$('#signature');const target=canvas;let ink=false,startPoint=null;
 function resize(){
  if(painting)return;const ratio=window.devicePixelRatio||1,width=target.clientWidth;if(!width)return;
  target.width=Math.round(width*ratio);target.height=Math.round(180*ratio);const c=target.getContext('2d');c.scale(ratio,ratio);c.strokeStyle='#183c2c';c.lineWidth=2.3;c.lineCap='round';c.lineJoin='round';
  if(data.signature){const source=data.signature,img=new Image();img.onload=()=>{if(data.signature!==source||canvas!==target)return;const scale=Math.min(width/img.width,180/img.height),w=img.width*scale,h=img.height*scale;c.drawImage(img,(width-w)/2,(180-h)/2,w,h)};img.src=source}
 }
 resize();if(typeof ResizeObserver!=='undefined'){signatureObserver=new ResizeObserver(resize);signatureObserver.observe(target)}
 const point=e=>{const r=target.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
 target.onpointerdown=e=>{painting=true;ink=false;startPoint=point(e);target.setPointerCapture(e.pointerId);const c=target.getContext('2d');c.beginPath();c.moveTo(...startPoint)};
 target.onpointermove=e=>{if(!painting)return;const p=point(e);if(Math.hypot(p[0]-startPoint[0],p[1]-startPoint[1])>2)ink=true;const c=target.getContext('2d');c.lineTo(...p);c.stroke()};
 const finish=()=>{if(!painting)return;painting=false;if(ink){data.signature=target.toDataURL();data.needsSignature=false;schedule();preview()}};
 target.onpointerup=finish;target.onpointercancel=finish;
}


function clearReadyPdf(){if(readyPdf){URL.revokeObjectURL(readyPdf.url);readyPdf=null}if($('#pdfReady'))$('#pdfReady').innerHTML='';if($('#sharePdf'))$('#sharePdf').textContent='PDF előkészítése megosztáshoz'}
function canSharePdf(){try{return typeof navigator!=='undefined'&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[new File(['%PDF-1.7\n'],'adatlap.pdf',{type:'application/pdf'})]})}catch{return false}}
function showPdfReady(){if(!$('#pdfReady'))return;if(readyPdf&&readyPdf.revision===data._revision){$('#pdfReady').innerHTML=`<p>A PDF elkészült. <a href="${readyPdf.url}" download="${esc(readyPdf.file.name)}">Letöltés újra</a></p><p class="muted">${esc(readyPdf.file.name)} · A fájl a készülékeden jött létre; nem küldtük el automatikusan.</p>`;if($('#sharePdf'))$('#sharePdf').textContent='PDF megosztása'}}
async function finishExport(action){
 if(pdfBusy)return false;
 if(data.needsSignature){toast('Az adatlap módosult. Kérj új aláírást, vagy töröld a régit az aláírás nélküli exporthoz.');return false}
 if(!data.name||!data.address||!data.type){toast('A végleges adatlaphoz add meg a nevet, az ingatlan címét és típusát.');return false}
 const fee=calculateCommission(data);if(fee.state==='invalid'||fee.state==='incomplete'){toast(fee.message);step=1;render();return false}
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
 if((snapshot.photos||[]).some(photo=>!validImage(photo))||(snapshot.signature&&!validImage(snapshot.signature))){toast('Egy fotó vagy aláírás hibás. Ellenőrizd az adatlapot a PDF előtt.');return}
 $('#printArea').innerHTML=renderDocument(snapshot);
 try{await Promise.race([Promise.all([...$('#printArea').querySelectorAll('img')].map(img=>img.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('image_timeout')),10000))]);}
 catch{toast('Egy fotó vagy aláírás nem tölthető be. Ellenőrizd a képeket, majd próbáld újra.');return}
 const oldTitle=document.title;
 document.title='Ingatlanfelvetel_'+(snapshot.city||snapshot.address||snapshot.id.slice(0,8)).replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,80);
 window.addEventListener('afterprint',()=>{document.title=oldTitle},{once:true});
 window.print();
}

$('.steps').onclick=e=>{if(e.target.dataset.step!==undefined){step=+e.target.dataset.step;render()}};$('#back').onclick=()=>{if(step>0){step--;render()}};$('#next').onclick=async()=>{if(step<4){step++;render();window.scrollTo({top:0,behavior:'smooth'})}else await finishExport('download')};$('#save').onclick=()=>save();
async function list(){clearTimeout(saveTimer);if(!await save(true))return;let records=await new Promise((resolve,reject)=>{let r=tx().getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});showWorkspace();$('#editor').classList.add('hidden');$('#list').classList.remove('hidden');$('#list').innerHTML=`<div class="intro"><h3>Mentett felvételek</h3><button id="newRecord" class="primary">+ Új felvétel</button></div><input id="search" placeholder="Keresés név vagy cím alapján" aria-label="Keresés"><div id="records"></div><hr><label>Biztonsági másolat visszatöltése<input type="file" id="import" accept="application/json,.json"></label>`;function results(q=''){$('#records').innerHTML=records.sort((a,b)=>b.updated.localeCompare(a.updated)).filter(r=>[r.name,r.city,r.address].join(' ').toLocaleLowerCase('hu').includes(q.toLocaleLowerCase('hu'))).map(r=>`<div class="draft"><div><strong>${esc(r.city||'Ingatlan')} ${esc(r.address||'')}</strong><p>${esc(r.name||'Név nélkül')} · ${new Date(r.updated).toLocaleString('hu-HU')}</p><p class="cloud-state">${accountId?(r._dirty||!r._cloudVersion?'Helyben mentve · felhős mentésre vár':'Felhőben is mentve'):'Csak ezen a készüléken'}</p></div><button data-open="${r.id}">Megnyitás</button></div>`).join('')||'<p class="muted">Nincs találat. Itt jelennek meg a mentett felvételek.</p>'}results();$('#search').oninput=e=>results(e.target.value);$('#newRecord').onclick=startNew;$('#records').onclick=e=>{let r=records.find(r=>r.id===e.target.dataset.open);if(r){data=r;step=0;render()}};$('#import').onchange=async e=>{try{let r=JSON.parse(await e.target.files[0].text());if(!r||typeof r.id!=='string'||!Array.isArray(r.photos)||!Array.isArray(r.owners)||r.photos.some(p=>typeof p!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(p))||(r.signature&&!/^data:image\/png;base64,/.test(r.signature)))throw Error();if(r.roomRows&&(!Array.isArray(r.roomRows)||r.roomRows.some(x=>!x||typeof x.name!=='string'||!Number.isFinite(Number(x.area))||Number(x.area)<0)))throw Error();r.id=crypto.randomUUID();for(const key of Object.keys(r))if(key.startsWith('_'))delete r[key];data=r;await save();step=0;render()}catch{toast('Nem érvényes ingatlanfelvételi biztonsági másolat.')}}}$('#listBtn').onclick=list;
$('#welcomeNew').onclick=startNew;$('#welcomeList').onclick=list;$('#homeBtn').onclick=async()=>{clearTimeout(saveTimer);if(await save(true))showHome()};
$('#accountBtn').onclick=()=>{const panel=document.querySelector('[aria-label="Fiók és felhős mentés"]');if(panel){const details=panel.querySelector('details');if(details)details.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});panel.querySelector('summary')?.focus()}};
listen(window,'intake:flush',async e=>{clearTimeout(saveTimer);if(!db||pdfBusy){e.detail.done(false);return}e.detail.done(await save(true))});
listen(window,'intake:reload',async event=>{try{if(!db)return;const currentId=data.id;const record=await new Promise((resolve,reject)=>{const r=tx().get(currentId);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(record)data=record;if(!$('#list').classList.contains('hidden'))await list();else if(!$('#workspace').classList.contains('hidden'))render();}finally{event.detail?.done?.()}});
let request=indexedDB.open('ingatlanfelvetel-v1'+(accountId?'-'+accountId:''),1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onsuccess=()=>{db=request.result;if(disposed){db.close();return}fresh();showHome()};request.onerror=()=>{$('#form').innerHTML='<p>A böngésző nem engedélyezi a helyi adattárolást. Nyisd meg normál böngészőablakban.</p>'};

return ()=>{disposed=true;clearReadyPdf();signatureObserver?.disconnect();listeners.abort();clearTimeout(saveTimer);if(db)db.close();};
}
