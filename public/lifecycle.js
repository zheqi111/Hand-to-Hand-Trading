export const STALE_MS=30*60*1000;
export const STATUS_LABELS={waiting:'Waiting for entry',entered:'Entry confirmed',target:'Target reached',stopped:'Stop reached',cancelled:'Cancelled'};
export function freshness(report,now=Date.now()){
 if(report.demo)return {stale:false,label:'Demo · simulated data'};
 const age=now-Date.parse(report.asOf);if(!Number.isFinite(age)||age< -60000)return {stale:true,label:'Observation time unverified'};
 const minutes=Math.max(0,Math.floor(age/60000));return {stale:age>=STALE_MS,label:`Data observed ${minutes} min ago${age>=STALE_MS?' · refresh needed':''}`};
}
export function validateStatusUpdate(report,input,now=Date.now()){
 const last=report.statusHistory?.at(-1),from=last?.status||'waiting';
 if(!report.tradePlan||report.position==='Wait / no trade')throw new Error('No directional trade plan to update.');
 if(input.expectedVersion!==(report.statusHistory?.length||0))throw new Error('Status changed. Refresh before updating.');
 const allowed={waiting:['entered','cancelled'],entered:['target','stopped','cancelled']};
 if(!allowed[from]?.includes(input.status))throw new Error('Invalid status transition. Closed trades cannot be reopened.');
 if(input.status==='entered'&&(freshness(report,now).stale||Date.parse(report.expiresAt)<=now))throw new Error('Stale or expired plans cannot confirm a new entry. Publish a freshly reviewed plan.');
 const observed=Date.parse(input.observedAt);if(!Number.isFinite(observed)||observed>now+60000||observed<Date.parse(last?.observedAt||report.publishedAt))throw new Error('Use an observation time after the previous status and not in the future.');
 if(typeof input.note!=='string'||input.note.trim().length<10||input.note.length>2000)throw new Error('Describe the observed evidence in at least 10 characters.');
 return {status:input.status,observedAt:new Date(observed).toISOString(),recordedAt:new Date(now).toISOString(),note:input.note.trim(),source:'administrator'};
}
