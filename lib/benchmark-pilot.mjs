import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const BENCHMARK_PILOT_ID='legal-benchmark-20261116';
export const BENCHMARK_PILOT_IDS=[BENCHMARK_PILOT_ID,'legal-benchmark-deepseek-20261116'];
const sha=text=>createHash('sha256').update(text).digest('hex');
export const benchmarkStages=[
  ['source','S0','方法与试跑边界',['stage-source.json','run-config.json','development-exposure.json','budget-change.json','model-change.json','submission-budget-amendment.json','run-config-before-budget-amendment.json']],
  ['material','P0','新案件材料与学生视图',['material-pack.json','student-material.json','source-research.json','student-material-before-repair.json','material-pack-before-repair.json']],
  ['probes','B0','目标模型实测 Benchmark',['benchmark-probes.json']],
  ['errors','B1','实质错题筛查',['probe-results.json','seed-source-check.json','seed-eligibility.json','seed-eligibility-v2.json']],
  ['seeds','FS','完整 Benchmark Few-Shot',['seeds.json','few-shot-selection.json','few-shot-load-audit.json','few-shot-repair-load-audit.json']],
  ['candidates','P2','同类 QA 候选',['candidates.json','candidate-repair.json']],
  ['review','P3','题型模仿与可回答性',['candidate-audit.json','candidate-repair-audit.json']],
  ['reference','P4','独立参考与有据审核',['reference.json','reference-audit.json','authorities.json','reference-before-repair.json','reference-audit-before-repair.json','reference-before-reference-repair.json','reference-audit-before-reference-repair.json','reference-repair-reason.json']],
  ['freeze','F0','冻结题面与评分',['selected-question.json','instruction.md','student-request.json','frozen.json','frozen-preflight.json','frozen-before-reference-repair.json']],
  ['blind','B5','五次独立盲答与语义评分',['blind-first.json','evaluation-first.json','evaluation-integrity-first.json','grade-format-clarification.json','blind-first-partial.json','attempts-first.json']],
  ['confirmation','C5','原题新五答确认',['blind-confirmation.json','evaluation-confirmation.json','evaluation-integrity-confirmation.json','attempts-confirmation.json']],
  ['export','E0','结果、用量与隔离',['audit-report.json','measurement-review.json','audit-report-before-continuation.json','training.jsonl']],
];
const topFiles=new Set(benchmarkStages.flatMap(s=>s[3]));
export async function benchmarkArtifact(root,file,id=BENCHMARK_PILOT_ID) {
  if(!BENCHMARK_PILOT_IDS.includes(id))throw Object.assign(new Error('实验不存在'),{status:404});
  if(typeof file!=='string'||!(topFiles.has(file)||/^(calls|probes)\/[A-Za-z0-9-]+-(request|response|error|answer|audit)\.json$/.test(file))) {
    throw Object.assign(new Error('不允许的实验产物'),{status:404});
  }
  const target=path.join(root,'content/runs',id,file);
  for(const prefix of ['content','content/runs',`content/runs/${id}`,...(file.includes('/')?[`content/runs/${id}/${file.split('/')[0]}`]:[])]) {
    if((await fs.lstat(path.join(root,prefix))).isSymbolicLink()) throw Object.assign(new Error('不允许符号链接'),{status:404});
  }
  const stat=await fs.lstat(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>5000000) throw Object.assign(new Error('不允许的产物文件'),{status:404});
  const text=await fs.readFile(target,'utf8');return {file,text,sha256:sha(text)};
}
export async function benchmarkPilot(root,id=BENCHMARK_PILOT_ID) {
  if(!BENCHMARK_PILOT_IDS.includes(id))throw Object.assign(new Error('实验不存在'),{status:404});
  const base=path.join(root,'content/runs',id);const config=JSON.parse((await benchmarkArtifact(root,'run-config.json',id)).text);
  const metadata=[];
  for(const file of topFiles) {
    try {const item=await benchmarkArtifact(root,file,id);metadata.push({file,sha256:item.sha256,bytes:Buffer.byteLength(item.text)});}
    catch(error) {if(error.code!=='ENOENT')throw error;}
  }
  for(const folder of ['calls','probes']) {
    let files=[];try {files=await fs.readdir(path.join(base,folder));}catch(e){if(e.code!=='ENOENT')throw e;}
    for(const name of files.filter(n=>n.endsWith('.json'))) {const file=`${folder}/${name}`;const item=await benchmarkArtifact(root,file,id);metadata.push({file,sha256:item.sha256,bytes:Buffer.byteLength(item.text)});}
  }
  const data=async file=>metadata.some(m=>m.file===file)?JSON.parse((await benchmarkArtifact(root,file,id)).text):null;
  const results=await data('probe-results.json');const report=await data('audit-report.json');
  const first=await data('evaluation-first.json');const confirmation=await data('evaluation-confirmation.json');
  const calls=metadata.filter(m=>m.file.startsWith('calls/'));
  const primary={source:'stage-source.json',material:'student-material.json',errors:'probe-results.json',seeds:'seeds.json',candidates:'candidates.json',review:'candidate-audit.json',reference:'reference-audit.json',freeze:'frozen.json',blind:'evaluation-first.json',confirmation:'evaluation-confirmation.json',export:'audit-report.json'};
  const stages=benchmarkStages.map(([id,code,title,files])=>({id,code,title,
    completed:id==='probes'?config.probe_count===metadata.filter(m=>/^probes\/case-\d{3}-answer\.json$/.test(m.file)).length:metadata.some(m=>m.file===primary[id]),
    files:[...files.filter(f=>metadata.some(m=>m.file===f)),
    ...metadata.filter(m=>id==='probes'?/^probes\/.*-answer\.json$/.test(m.file)||/^calls\/probe-case-/.test(m.file):
      id==='errors'?/^probes\/.*-audit\.json$/.test(m.file)||/^calls\/(probe-audit-|seed-eligibility-)/.test(m.file):
      id==='seeds'?/^calls\/seed-answer-/.test(m.file):id==='candidates'?/^calls\/P2-/.test(m.file):
      id==='review'?/^calls\/P3-/.test(m.file):id==='reference'?/^calls\/P4-/.test(m.file):
      id==='blind'?/^calls\/first-/.test(m.file):id==='confirmation'?/^calls\/confirmation-/.test(m.file):false).map(m=>m.file)]}));
  const budget=await sharedSubmissionBudget(root);
  return {id,config,stages,artifacts:metadata,probeResults:results,report,first,confirmation,sharedSubmissions:budget.submissions,sharedLimit:budget.limit,
    submissions:calls.filter(c=>c.file.endsWith('-request.json')).length,completed:calls.filter(c=>c.file.endsWith('-response.json')).length,
    failed:calls.filter(c=>c.file.endsWith('-error.json')&&!c.file.endsWith('-validation-error.json')).length,
    validationFailed:calls.filter(c=>c.file.endsWith('-validation-error.json')).length,
    warning:'完整真实 benchmark 示例只进入出题模型。学生不看种子、rubric 或参考。所有结果为同家族自动审核，未专家核定；许可未核实，不公开发布或导出训练。'};
}
export async function sharedSubmissionBudget(root) {
  let submissions=0,limit=48;
  for(const id of BENCHMARK_PILOT_IDS) {
    const base=path.join(root,'content/runs',id);
    try {submissions+=(await fs.readdir(path.join(base,'calls'))).filter(f=>f.endsWith('-request.json')).length;}
    catch(error){if(error.code!=='ENOENT')throw error;}
    let config;
    try {config=JSON.parse(await fs.readFile(path.join(base,'run-config.json'),'utf8'));}
    catch(error){if(error.code==='ENOENT')continue;throw error;}
    const requested=config.max_submissions??48;
    if(requested===48)continue;
    const amendment=JSON.parse(await fs.readFile(path.join(base,'submission-budget-amendment.json'),'utf8'));
    if(requested!==52||amendment.previous_limit!==48||amendment.next_limit!==52||amendment.user_authorized!==true||
      JSON.stringify(amendment.shared_run_ids)!==JSON.stringify(BENCHMARK_PILOT_IDS)) throw new Error('Unapproved shared submission limit');
    limit=52;
  }
  return {submissions,limit,remaining:limit-submissions};
}
export function planFrozenAttempts(files,batch,kind,n=5) {
  if(!['first','confirmation'].includes(batch)||!['blind','grade'].includes(kind))throw new Error('Invalid evaluation stage');
  return Array.from({length:n},(_,i)=>{
    const index=i+1,base=`${batch}-${kind}-${index}`;
    const pattern=new RegExp(`^${base}(?:-retry-([1-9][0-9]*))?-request\\.json$`);
    const attempts=files.flatMap(file=>{
      const match=file.match(pattern);return match?[{name:file.replace('-request.json',''),attempt:Number(match[1]??0)}]:[];
    }).sort((a,b)=>a.attempt-b.attempt);
    const complete=attempts.find(a=>files.includes(`${a.name}-response.json`)&&!files.includes(`${a.name}-validation-error.json`));
    if(complete)return {index,call:complete.name,cached:true,attempts:attempts.map(a=>a.name)};
    if(attempts.some(a=>!files.includes(`${a.name}-error.json`)&&!files.includes(`${a.name}-validation-error.json`))) {
      throw new Error(`Unresolved submission for ${base}; do not implicitly resubmit`);
    }
    const next=attempts.length?Math.max(...attempts.map(a=>a.attempt))+1:0;
    return {index,call:next?`${base}-retry-${next}`:base,cached:false,attempts:attempts.map(a=>a.name)};
  });
}
export function validateFrozenBlindAttempt(request,response,frozen) {
  const config={model:request.model,effort:request.effort,maxOutputTokens:request.maxOutputTokens};
  const input=sha(JSON.stringify(request.messages));
  if(JSON.stringify(config)!==JSON.stringify(frozen.model)||input!==frozen.request_sha256||request.input_sha256!==input||
    response.input_sha256!==input||response.status!=='completed'||response.actualModel!==frozen.target_actual_model||
    response.output_sha256!==sha(response.text)||!response.text?.trim()) throw new Error('Frozen blind attempt identity or hash mismatch');
  return response;
}
export function validateFrozenGrade(grade,reference) {
  const required=reference.critical_criteria.map(c=>c.id);
  const actual=grade.criteria?.map(c=>c.id)??[];
  if(new Set(required).size!==required.length||actual.length!==required.length||new Set(actual).size!==actual.length||actual.some(id=>!required.includes(id))) throw new Error('Frozen criterion IDs mismatch');
  if(grade.criteria.some(c=>typeof c.pass!=='boolean')||typeof grade.measurement_valid!=='boolean'||typeof grade.answer_complete!=='boolean'||
    typeof grade.legal_core_correct!=='boolean'||grade.overall_correct!==grade.criteria.every(c=>c.pass)) throw new Error('Inconsistent frozen-criteria grading');
  if(grade.reference_problems?.length&&grade.measurement_valid) throw new Error('Reference problems cannot be a valid legal failure');
  return grade;
}
export function summarizeFrozenGrades(grades,reference) {
  if(grades.length!==5||new Set(grades.map(g=>g.index)).size!==5||grades.some(g=>!Number.isInteger(g.index)||g.index<1||g.index>5))throw new Error('Expected five distinct graded slots');
  grades.forEach(g=>validateFrozenGrade(g,reference));
  const valid=grades.every(g=>g.measurement_valid&&g.answer_complete);
  const strict=grades.filter(g=>g.overall_correct).length;
  return {valid,correct:valid?strict:null,strict_criteria_correct:strict,target_hit:valid&&strict>=1&&strict<=2,
    grader_answer_complete_count:grades.filter(g=>g.answer_complete).length,
    criterion_pass_counts:reference.critical_criteria.map(c=>({id:c.id,pass_count:grades.filter(g=>g.criteria.find(item=>item.id===c.id)?.pass).length,n:5}))};
}
