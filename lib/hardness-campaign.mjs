import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const id='legal-bo5-20261115';
const sha=text=>createHash('sha256').update(text).digest('hex');
const baseFiles=new Set(['config.json','summary.json','requests.json','seeds.json','authorities.json','final-audit.json','infrastructure-analysis.json']);
const roundFiles=new Set(['analysis.json','skill-change.json','model-config.json','source.json','material-pack.json','student-files.json','answer-contract.json','engineering-reference.json','engineering-reference-v1.json','expected.json','scenario-record.json','few-shot-selection.json','instruction.md','instruction-v1.md','frozen.json','Bo5-answers.json','Confirm-answers.json','confirmation.json','outcome.json','groups.json','training.jsonl']);
const staged=/^(?:stage-)?P[1-6](?:-repair)?(?:-retry)?(?:-request|-response|-error|-partial-response)?\.json$/;
const trials=/^harbor-(?:oracle|nop|(?:Bo5|Confirm)-[1-5](?:-retry)?)\.json$/;
const completions=/^(?:Bo5|Confirm)-[1-5](?:-retry)?-(?:request|response|error|partial-response)\.json$/;
const roundValid=r=>/^\d{2}$/.test(r)&&Number(r)>=1&&Number(r)<=20;
const fileValid=f=>roundFiles.has(f)||staged.test(f)||trials.test(f)||completions.test(f);
const notFound=()=>Object.assign(new Error('实验产物不存在'),{status:404});

export async function hardnessArtifact(root,round,file) {
  if(round==='campaign'?!baseFiles.has(file):!roundValid(round)||!fileValid(file)) throw notFound();
  const base=path.join(root,'content/campaigns',id);
  const target=round==='campaign'?path.join(base,file):path.join(base,'rounds',round,file);
  const realBase=await fs.realpath(base);const realTarget=await fs.realpath(target);
  const expectedTarget=round==='campaign'?path.join(realBase,file):path.join(realBase,'rounds',round,file);
  if(!realTarget.startsWith(realBase+path.sep)||realTarget!==expectedTarget)throw notFound();
  const stat=await fs.lstat(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2000000)throw notFound();
  return {filename:file,text:await fs.readFile(target,'utf8')};
}

export async function hardnessCampaign(root,requestedRound) {
  const config=JSON.parse((await hardnessArtifact(root,'campaign','config.json')).text);
  const summary=JSON.parse((await hardnessArtifact(root,'campaign','summary.json')).text);
  const ledger=JSON.parse((await hardnessArtifact(root,'campaign','requests.json')).text);
  const round=requestedRound??String(summary.winner??summary.rounds.at(-1)?.round??1).padStart(2,'0');
  if(!roundValid(round))throw notFound();
  const directory=path.join(root,'content/campaigns',id,'rounds',round);
  const artifacts={};
  for(const file of (await fs.readdir(directory)).filter(fileValid).sort()) {
    const artifact=await hardnessArtifact(root,round,file);
    artifacts[file]={...artifact,sha256:sha(artifact.text),data:file.endsWith('.json')?JSON.parse(artifact.text):null};
  }
  const seeds=JSON.parse((await hardnessArtifact(root,'campaign','seeds.json')).text);
  let finalAudit=null;
  try {finalAudit=JSON.parse((await hardnessArtifact(root,'campaign','final-audit.json')).text);}
  catch(error){if(error.code!=='ENOENT')throw error;}
  let infrastructureAnalysis=null;
  try {infrastructureAnalysis=JSON.parse((await hardnessArtifact(root,'campaign','infrastructure-analysis.json')).text);}
  catch(error){if(error.code!=='ENOENT')throw error;}
  return {id,config,summary,round,entry:summary.rounds.find(r=>r.round===Number(round)),artifacts,seeds,finalAudit,infrastructureAnalysis,requests:ledger.length,known_input_tokens:ledger.reduce((n,r)=>n+(r.usage?.input_tokens??0),0),known_output_tokens:ledger.reduce((n,r)=>n+(r.usage?.output_tokens??0),0),unknown_usage_requests:ledger.filter(r=>!r.usage).length,warning:'研究者视图含工程参考和隐藏评分结果，禁止放入学生输入。虚构衍生材料不是原案证据，实测难度不是法律金标。'};
}
