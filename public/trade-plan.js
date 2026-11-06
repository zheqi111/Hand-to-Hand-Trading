// Shared by publication validation and the customer presentation.
export function validateTradePlan(position,value){
 if(position==='Wait / no trade')return null;
 if(!['Call scenario','Put scenario'].includes(position)||!value)throw new Error('Add a complete trade plan.');
 const plan={basis:'underlying',contract:String(value.contract||'').trim()};
 if(plan.contract.length<5||plan.contract.length>250)throw new Error('Specify the option contract, strike and expiration.');
 for(const key of ['entryPrice','targetPrice','stopPrice']){if(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<=0)throw new Error('Entry, take-profit and stop-loss must be positive prices.');plan[key]=value[key];}
 if(!Number.isInteger(value.holdMinutes)||value.holdMinutes<1||value.holdMinutes>10080)throw new Error('Estimated holding time must be 1–10080 minutes.');plan.holdMinutes=value.holdMinutes;
 const {entryPrice:e,targetPrice:t,stopPrice:s}=plan;
 if(position==='Call scenario'&&!(s<e&&e<t))throw new Error('For a call, stop must be below entry and take-profit above entry.');
 if(position==='Put scenario'&&!(t<e&&e<s))throw new Error('For a put, take-profit must be below entry and stop above entry.');
 return plan;
}
export function planState(report,now=Date.now()){
 if(report.position==='Wait / no trade')return {status:'wait',action:'Wait. No trade.'};
 if(!report.demo&&(!Number.isFinite(Date.parse(report.expiresAt))||Date.parse(report.expiresAt)<=now))return {status:'expired',action:'Expired. Do not enter.'};
 try{const plan=validateTradePlan(report.position,report.tradePlan);return {status:'conditional',action:report.position==='Call scenario'?'Call · wait for entry':'Put · wait for entry',plan};}catch{return {status:'incomplete',action:'Wait. Plan incomplete.'};}
}
