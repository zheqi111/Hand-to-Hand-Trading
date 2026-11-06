export function validateOption(value,position,now=Date.now()){
 if(position==='Wait / no trade')return null;
 if(!value)throw new Error('Add the exact option and observed bid/ask.');
 const {type,strike,expiration,bid,ask,asOf,source}=value;
 if(type!==(position==='Call scenario'?'call':'put')||!Number.isFinite(strike)||strike<=0)throw new Error('Option type and strike must match the scenario.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expiration||'')||new Date(expiration+'T00:00:00Z').toISOString().slice(0,10)!==expiration||Date.parse(expiration+'T23:59:59Z')<now)throw new Error('Use an unexpired YYYY-MM-DD option expiration.');
 if(!Number.isFinite(bid)||!Number.isFinite(ask)||bid<0||ask<=0||bid>ask)throw new Error('Bid must be nonnegative and no greater than the positive ask.');
 const age=now-Date.parse(asOf);if(!Number.isFinite(age)||age<0||age>=300000)throw new Error('Use an observed option quote less than 5 minutes old.');
 if(typeof source!=='string'||source.trim().length<3||source.length>300)throw new Error('Identify the option quote source.');
 return {type,strike,expiration,bid,ask,asOf:new Date(asOf).toISOString(),source:source.trim(),multiplier:100,quoteMode:'manual observation'};
}
export function validateChart(value,asOf){
 if(!value)return null;
 if(!Array.isArray(value.points)||value.points.length<2||value.points.length>500)throw new Error('Chart needs 2–500 timestamp, price, RSI rows.');
 if(typeof value.timeframe!=='string'||!value.timeframe.trim()||value.timeframe.length>100||typeof value.source!=='string'||!value.source.trim()||value.source.length>300||!Number.isInteger(value.period)||value.period<2||value.period>200)throw new Error('Specify chart timeframe, source and RSI period (2–200).');
 let previous=-Infinity;const points=value.points.map(p=>{const time=Date.parse(p.time);if(!Number.isFinite(time)||time<=previous||time>Date.parse(asOf)+60000||!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.rsi)||p.rsi<0||p.rsi>100)throw new Error('Chart rows must be chronological, aligned to the observation, with positive price and RSI 0–100.');previous=time;return {time:new Date(time).toISOString(),price:p.price,rsi:p.rsi};});
 if(Math.abs(previous-Date.parse(asOf))>600000)throw new Error('Last chart point must be within 10 minutes of the snapshot.');
 return {points,timeframe:value.timeframe.trim(),source:value.source.trim(),period:value.period};
}
