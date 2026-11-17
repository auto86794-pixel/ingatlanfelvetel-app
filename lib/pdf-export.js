import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export function extractDocument(html,dom=globalThis.document){
 const box=dom.createElement('div');box.innerHTML=html;const article=box.querySelector('.paper');
 if(!article)throw Error('A dokumentum nem állítható össze.');
 const sections=[...article.querySelectorAll('.document-section')].filter(el=>!el.classList.contains('document-photos')&&!el.classList.contains('signature-block')).map(el=>({title:el.querySelector('h4')?.textContent||'',rows:[...el.querySelectorAll('.row')].map(row=>({label:row.children[0]?.textContent||'',value:row.children[1]?.textContent||'',strong:row.classList.contains('fee-total')})),notes:[...el.querySelectorAll('p')].map(p=>p.textContent)}));
 const photos=[...article.querySelectorAll('.document-photo')].map(el=>({src:el.querySelector('img')?.getAttribute('src'),caption:el.querySelector('figcaption')?.textContent||''}));
 const signature=article.querySelector('.signature-block');
 const signatures=[...article.querySelectorAll('.signature-block')].map(el=>({title:el.querySelector('h4')?.textContent||'Aláírás',text:el.querySelector('p')?.textContent||'',src:el.querySelector('img')?.getAttribute('src')||''}));
 return {signatures,title:article.querySelector('h3')?.textContent||'INGATLANFELVÉTELI ADATLAP',meta:article.querySelector('.document-meta')?.textContent||'',sections,photos,signature:{text:signature?.querySelector('p')?.textContent||'',src:signature?.querySelector('img')?.getAttribute('src')||''},footer:article.querySelector('.document-footer')?.textContent||''};
}
export function pdfFilename(record){
 const part=[record.city,record.address].filter(Boolean).join('_')||String(record.id||'adatlap').slice(0,8);
 return (record.documentType==='rental-mandate'?'Berbeadasi_megbizas_':'Ingatlanfelvetel_')+part.replace(/[^\p{L}\p{N}_ -]/gu,'').replace(/\s+/g,'_').slice(0,90)+'.pdf';
}
let fontPromise;
async function defaultFonts(){
 fontPromise??=Promise.all(['/fonts/DejaVuSans.ttf','/fonts/DejaVuSans-Bold.ttf'].map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('A PDF betűkészlete nem tölthető be. Internet mellett nyisd meg újra az appot.');return new Uint8Array(await response.arrayBuffer())})).catch(e=>{fontPromise=null;throw e});return fontPromise;
}
export async function createPdf(model,options={}){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const fonts=options.fonts||await defaultFonts();
 const regular=await doc.embedFont(fonts[0],{subset:true}),bold=await doc.embedFont(fonts[1],{subset:true});
 const chars=new Set(regular.getCharacterSet());
 const text=value=>Array.from(String(value??'').replace(/\t/g,' ').replace(/[\r\u0000-\u0008\u000B-\u001F]/g,'')).map(c=>c==='\n'||chars.has(c.codePointAt(0))?c:'?').join('');
 const green=rgb(.086,.302,.22),gold=rgb(.67,.53,.24),gray=rgb(.38,.44,.40),line=rgb(.86,.89,.85),black=rgb(.14,.21,.17);
 const W=595.28,H=841.89,M=42,BOTTOM=46,RIGHT=W-M,CW=W-2*M;let page,y;
 const wrap=(value,font,size,width)=>{const out=[];for(const raw of text(value).split('\n')){if(!raw){out.push('');continue}let current='';for(const word of raw.split(/\s+/)){const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue}if(current){out.push(current);current=''}let chunk='';for(const ch of word){if(font.widthOfTextAtSize(chunk+ch,size)>width&&chunk){out.push(chunk);chunk=''}chunk+=ch}current=chunk}out.push(current)}return out};
 const draw=(value,x,yy,size=9.5,font=regular,color=black)=>page.drawText(text(value),{x,y:yy,size,font,color});
 function addPage(){page=doc.addPage([W,H]);draw('Ingatlanfelvétel',M,H-45,15,bold,green);draw('Digitális adatlap',M,H-61,9,regular,gray);page.drawLine({start:{x:M,y:H-73},end:{x:RIGHT,y:H-73},thickness:1,color:gold});draw(model.title,M,H-96,12,bold,green);const metaLines=wrap(model.meta,regular,8,CW);metaLines.forEach((s,i)=>draw(s,M,H-112-i*11,8,regular,gray));y=H-132-(metaLines.length-1)*11;}
 const ensure=height=>{if(y-height<BOTTOM)addPage()};
 function heading(title){ensure(54);y-=9;draw(title,M,y,11,bold,green);y-=8;page.drawLine({start:{x:M,y},end:{x:RIGHT,y},thickness:.5,color:line});y-=19;}
 function paragraph(value,size=9,color=gray){const lines=wrap(value,regular,size,CW);for(const s of lines){ensure(14);draw(s,M,y,size,regular,color);y-=14}y-=4;}
 function row(row){const font=row.strong?bold:regular;const left=wrap(row.label,font,9.3,205),right=wrap(row.value,font,9.3,CW-225);const count=Math.max(left.length,right.length);for(let i=0;i<count;i++){ensure(17);if(row.strong)page.drawRectangle({x:M-3,y:y-4,width:CW+6,height:17,color:rgb(.94,.96,.92)});if(left[i])draw(left[i],M,y,9.3,font,row.strong?green:gray);if(right[i])draw(right[i],RIGHT-font.widthOfTextAtSize(right[i],9.3),y,9.3,font);y-=14;}y-=5;page.drawLine({start:{x:M,y:y+1},end:{x:RIGHT,y:y+1},thickness:.3,color:line});y-=7;}
 addPage();
 for(const section of model.sections){
  const estimate=section.rows.reduce((sum,r)=>sum+Math.max(wrap(r.label,regular,9.3,205).length,wrap(r.value,regular,9.3,CW-225).length)*14+12,45)+section.notes.reduce((sum,n)=>sum+wrap(n,regular,9,CW).length*14+4,0);
  if(section.title==='Közvetítői díj'&&estimate<H-190)ensure(estimate);
  heading(section.title);section.rows.forEach(row);section.notes.forEach(n=>paragraph(n));
 }
 async function embed(src){
  if(typeof src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(src))throw Error('Egy kép hibás. Ellenőrizd a fotókat és az aláírást.');
  try{if(src.startsWith('data:image/webp')){if(!options.convertImage)throw Error();src=await options.convertImage(src)}return src.startsWith('data:image/png')?await doc.embedPng(src):await doc.embedJpg(src)}catch{throw Error('Egy fotó vagy aláírás nem olvasható. Cseréld ki a hibás képet, majd próbáld újra.')}
 }
 if(model.photos.length){addPage();heading('Ingatlanfotók ('+model.photos.length+')');
  const gap=14,cell=(CW-gap)/2,photoHeight=158;
  for(let i=0;i<model.photos.length;i+=2){ensure(photoHeight+37);for(let j=0;j<2&&i+j<model.photos.length;j++){const photo=model.photos[i+j],img=await embed(photo.src),x=M+j*(cell+gap);page.drawRectangle({x,y:y-photoHeight-17,width:cell,height:photoHeight+24,borderWidth:.5,borderColor:line});const scale=Math.min((cell-12)/img.width,(photoHeight-8)/img.height),w=img.width*scale,h=img.height*scale;page.drawImage(img,{x:x+(cell-w)/2,y:y-photoHeight+(photoHeight-h)/2,width:w,height:h});draw(photo.caption,x+6,y-photoHeight-11,8,regular,gray);}y-=photoHeight+40;}
 }
 const signatures=model.signatures||[{title:'Aláírás',...model.signature}];
 for(const signature of signatures){ensure(signature.src?160:95);heading(signature.title||'Aláírás');paragraph(signature.text,9,black);
 if(signature.src){const img=await embed(signature.src),scale=Math.min(250/img.width,72/img.height);ensure(85);page.drawImage(img,{x:M,y:y-img.height*scale,width:img.width*scale,height:img.height*scale});y-=img.height*scale+12;}}
 const pages=doc.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:M,y:34},end:{x:RIGHT,y:34},thickness:.5,color:line});p.drawText(model.title.includes('MEGBÍZÁSI')?'Bérbeadási megbízási szerződés':'Ingatlanfelvételi adatlap',{x:M,y:22,size:7.5,font:regular,color:gray});const value=(i+1)+' / '+pages.length;p.drawText(value,{x:RIGHT-regular.widthOfTextAtSize(value,8),y:22,size:8,font:regular,color:gray})});
 doc.setTitle(model.title);doc.setSubject(model.title.includes('MEGBÍZÁSI')?'Bérbeadási megbízási szerződés':'Digitális ingatlanfelvételi adatlap');doc.setCreator('Ingatlanfelvétel');return doc.save();
}
export async function convertWebp(src){
 const blob=await (await fetch(src)).blob();const bitmap=await createImageBitmap(blob);try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return canvas.toDataURL('image/png')}finally{bitmap.close()}
}
