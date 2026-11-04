export function parseRows(text){
 const lines=text.trim().split(/\r?\n/).filter(s=>s.trim());
 if(/^strike\s*[,\t]/i.test(lines[0]||''))lines.shift();
 if(!lines.length)throw new Error('Add strike and net GEX rows.');
 return lines.map((line,i)=>{const cells=line.split(/[,\t]/).map(s=>s.trim());if(cells.length!==2||cells.some(s=>!s||!Number.isFinite(Number(s))))throw new Error('Row '+(i+1)+': use two numeric columns without thousands separators.');return {strike:Number(cells[0]),gex:Number(cells[1])};});
}
