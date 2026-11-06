import {evaluateForecast} from './learning.mjs';
import {applyStrategy,groupKey,strategyGroup} from './strategy.mjs';
export function evaluateCandidate(candidate,reports,snapshots,cutoff=Date.now()){
 const eligible=reports.filter(r=>Date.parse(r.createdAt)>Date.parse(candidate.createdAt)&&Date.parse(r.createdAt)<=cutoff&&r.id!==candidate.triggerReportId).map(r=>({...r,forecast:r.proposedForecast||r.forecast})).filter(r=>r.forecast&&r.forecast.direction!=='wait'&&groupKey(strategyGroup(r.forecast))===groupKey(candidate.group)).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
 let lastEnd=-Infinity;const rows=[];
 for(const r of eligible){if(Date.parse(r.createdAt)<lastEnd)continue;const result=evaluateForecast(r,snapshots,cutoff);if(result.status!=='resolved')continue;lastEnd=Date.parse(r.forecast.dueAt);const accepted=applyStrategy(r.forecast,r.parts||[],candidate).decision.accepted;rows.push({reportId:r.id,correct:result.correct,accepted});}
 const retained=rows.filter(r=>r.accepted),baselineCorrect=rows.filter(r=>r.correct).length,correct=retained.filter(r=>r.correct).length;
 const baselineRate=rows.length?baselineCorrect/rows.length:null,candidateRate=retained.length?correct/retained.length:null,coverage=rows.length?retained.length/rows.length:0;
 const ready=rows.length>=10&&retained.length>=5&&coverage>=.3&&candidateRate>baselineRate;
 return {evaluated:rows.length,retained:retained.length,correct,baselineCorrect,baselineRate,candidateRate,coverage,ready,rows,explanation:'Forward observations collected after proposal creation; same market group; overlapping windows excluded. Minimum 10 resolved windows, 5 retained, 30% coverage, and improvement over the unfiltered proposals are required. Evidence checks use model declarations; this is exploratory validation, not proof of profitability.'};
}
