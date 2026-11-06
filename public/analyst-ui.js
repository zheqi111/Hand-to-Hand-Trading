import {parseRows} from './gex-input.js';
const form=document.querySelector('#photo-form'),batch=document.querySelector('#photo-batch'),message=document.querySelector('#photo-message');
let uploads=[],activeDraft=null,configured=false,previewUrls=[];
const localTime=d=>new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
form.elements.asOf.value=localTime(new Date());
async function api(path,body){
 const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);
 const value=await r.json();if(!r.ok)throw new Error(value.error||'Request failed.');return value;
}
function buttons(busy=false){document.querySelector('#photo-read').disabled=busy||!configured||!batch.value;document.querySelector('#photo-run').disabled=busy||!configured||!batch.value;batch.disabled=busy;}
function clearDraft(){activeDraft=null;document.querySelector('#photo-draft').hidden=true;document.querySelector('#photo-confirm').checked=false;}
async function refresh(id){
 uploads=(await api('/api/analyst/uploads')).uploads;
 batch.replaceChildren(...uploads.map(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.symbol+' · '+new Date(u.asOf).toLocaleString()+' · '+u.images.map(i=>i.role).join(', ');return o;}));
 if(id)batch.value=id;buttons();
}
function preview(){
 for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];
 const target=document.querySelector('#photo-previews');target.replaceChildren();
 for(const file of [...form.elements.gex.files,...form.elements.charts.files].slice(0,3)){
  if(!['image/png','image/jpeg'].includes(file.type))continue;
  const img=document.createElement('img');img.src=URL.createObjectURL(file);previewUrls.push(img.src);img.alt=file.name;target.append(img);
 }
}
form.elements.gex.addEventListener('change',preview);form.elements.charts.addEventListener('change',preview);
const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Unable to read photo.'));reader.readAsDataURL(file);});
form.addEventListener('submit',async event=>{
 event.preventDefault();const submit=form.querySelector('button');submit.disabled=true;message.textContent='';
 try{
  const selected=[...form.elements.gex.files].map(file=>({file,role:'gex'})).concat([...form.elements.charts.files].map(file=>({file,role:'chart'})));
  if(!selected.length||selected.length>3)throw new Error('Select 1–3 photos.');
  if(selected.some(x=>x.file.size>5*1024*1024))throw new Error('Each photo must be 5 MB or smaller.');
  const images=await Promise.all(selected.map(async({file,role})=>({name:file.name,role,dataUrl:await readFile(file)})));
  const result=await api('/api/analyst/uploads',{symbol:form.elements.symbol.value.trim().toUpperCase(),asOf:new Date(form.elements.asOf.value).toISOString(),notes:form.elements.notes.value,images});
  clearDraft();await refresh(result.id);document.dispatchEvent(new Event('photos-saved'));message.textContent='Photos saved locally. Read GEX photo, review the rows, then save them in the GEX form before analysis.';
 }catch(e){message.textContent=e.message;}finally{submit.disabled=false;}
});
batch.addEventListener('change',()=>{clearDraft();document.querySelector('#analyst-report').hidden=true;});
document.querySelector('#photo-read').addEventListener('click',async()=>{
 buttons(true);clearDraft();message.textContent='Reading photo…';
 try{
  const id=batch.value,{draft}=await api('/api/analyst/extract',{uploadId:id});activeDraft={id,draft};
  document.querySelector('#photo-draft').hidden=false;
  document.querySelector('#photo-mapping').textContent=(draft.headersConfirmed?'Visible headers identified: ':'Column mapping needs confirmation: ')+draft.mapping;
  document.querySelector('#photo-warnings').textContent=draft.warnings.join('\n');
  document.querySelector('#photo-raw').textContent=JSON.stringify(draft.rows,null,2);
  document.querySelector('#photo-rows').value='strike,gex\n'+draft.rows.map(r=>(r.strike??'')+','+(r.net??'')).join('\n');
  message.textContent='Extraction is a draft. Review missing cells and signs before using it.';
 }catch(e){message.textContent=e.message;}finally{buttons();}
});
document.querySelector('#photo-use').addEventListener('click',()=>{
 try{
  if(!activeDraft||activeDraft.id!==batch.value)throw new Error('Read this batch first.');
  if(!document.querySelector('#photo-confirm').checked)throw new Error('Confirm that you checked the extracted values.');
  parseRows(document.querySelector('#photo-rows').value);
  const upload=uploads.find(u=>u.id===activeDraft.id),target=document.querySelector('#gex-form');
  target.elements.symbol.value=upload.symbol;target.elements.asOf.value=localTime(new Date(upload.asOf));
  target.elements.rows.value=document.querySelector('#photo-rows').value;
  target.elements.notes.value=('Reviewed photo batch '+upload.id+'\n'+upload.notes).slice(0,4000);
  target.elements.source.value='';target.elements.scope.value='';target.elements.spot.value='';
  location.hash='gex-upload';message.textContent='Rows copied. Enter source, spot, scope and units in the GEX form, then save.';
 }catch(e){message.textContent=e.message;}
});
function renderPart(part){
 part={...part,text:part.text.replace(/<forecast>[\s\S]*?<\/forecast>/g,'')};
 const p=document.createElement('p');p.className='report-text';
 let cursor=0;
 const citations=(part.annotations||[]).filter(a=>a.type==='url_citation'&&/^https?:\/\//.test(a.url||'')&&Number.isInteger(a.start_index)&&Number.isInteger(a.end_index)).sort((a,b)=>a.start_index-b.start_index);
 for(const a of citations){if(a.start_index<cursor||a.end_index>part.text.length)continue;p.append(document.createTextNode(part.text.slice(cursor,a.start_index)));const link=document.createElement('a');link.href=a.url;link.textContent='['+(a.title||'Source')+']';link.target='_blank';link.rel='noopener noreferrer';p.append(link);cursor=a.end_index;}
 p.append(document.createTextNode(part.text.slice(cursor)));return p;
}
document.querySelector('#photo-run').addEventListener('click',async()=>{
 buttons(true);document.querySelector('#analyst-report').hidden=true;message.textContent='Analyzing confirmed GEX, chart evidence, and current news…';
 try{
  const {report}=await api('/api/analyst/run',{uploadId:batch.value});
  document.querySelector('#analyst-report').hidden=false;
  const policy=document.querySelector('#report-policy');
  policy.textContent=report.policyDecision?.accepted?'Policy-approved outlook: '+(report.forecast?.direction||'unscored')+' · '+report.strategy.name+' revision '+report.strategy.revision+'. Evidence checks use model-declared observations.':'Outlook withheld / unscored. '+(report.policyDecision?.reasons||[]).join(' ')+'. The text below remains research scenarios, not an approved directional call.';
  policy.classList.toggle('overdue',!report.policyDecision?.accepted);
  document.querySelector('#report-time').textContent='Generated '+new Date(report.createdAt).toLocaleString()+' · snapshot '+report.snapshotId;
  document.querySelector('#report-body').replaceChildren(...report.parts.map(renderPart));message.textContent=report.forecast?'Report saved. Locked outlook: '+report.forecast.direction+' over '+report.forecast.horizonMinutes+' minutes. Follow it in Learning journal.':'Report saved without a valid scoreable forecast. It will remain unscored in Learning journal.';document.dispatchEvent(new Event('analyst-saved'));
 }catch(e){message.textContent=e.message;}finally{buttons();}
});
(async()=>{try{const status=await api('/api/analyst/status');configured=status.configured;document.querySelector('#analyst-status').textContent=configured?'AI CONFIGURED':'AI KEY REQUIRED';await refresh();if(!configured)message.textContent='Photo storage is ready. To enable reading and analysis, configure OPENAI_API_KEY in the local .env file and restart the app. Do not paste your key into chat.';}catch(e){message.textContent=e.message;}})();

