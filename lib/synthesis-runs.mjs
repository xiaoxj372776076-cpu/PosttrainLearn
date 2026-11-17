import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const RUN_ID='legal-harbor-001';
const definitions=[
  ['source','S0','来源与运行边界',['stage-source.json','sources.json','authorities.json','run-config.json','preflight-summary.json']],
  ['dossier','P0','固定格式材料包',['stage-dossier.json','material-pack.json']],
  ['units','P1','有据判断单元',['stage-P1.json','P1-request.json','P1-response.json','P1-error.json']],
  ['seeds','FS','结构种子与 Few-Shot',['seeds.json','few-shot-selection.json']],
  ['questions','P2','候选问题与最终题面',['stage-P2.json','candidate-selection.json','instruction.md','student-files.json','P2-request.json','P2-response.json']],
  ['sufficiency','P3','学生视角题面审查',['stage-P3-r2.json','P3-r2-request.json','P3-r2-response.json','stage-P3-r1.json','repair-history.json','instruction-v1.md','student-files-v1.json','student-files-v2.json','P3-r1-request.json','P3-r1-response.json','stage-P3.json','P3-request.json','P3-response.json']],
  ['answer','P4','参考答案与证据解释',['stage-P4.json','reference.json','reference-basis.json','P4-request.json','P4-response.json','teacher-verification.json']],
  ['blind','P5 / BoN','Harbor 盲答与 Best-of-3',['evaluation.json','operational-metrics.json','infrastructure-failures.json','blind-answers.json','blind-requests.json','harbor-build.json','harbor-build-v1.json','harbor-traces.json']],
  ['audit','P6','法律语义与可执行审计',['stage-P6.json','verifier-controls.json','P6-request.json','P6-response.json']],
  ['variants','G0','分组、防污染与局限',['groups.json','overlap-audit.json']],
  ['export','E0','验收与训练发布',['audit-report.json','release-gate-audit.json','samples.jsonl','training.jsonl','run-events.json']],
];
const allow = new Set(definitions.flatMap(d=>d[3]));
const primary={source:'stage-source.json',dossier:'stage-dossier.json',units:'stage-P1.json',seeds:'seeds.json',questions:'instruction.md',sufficiency:'stage-P3-r2.json',answer:'stage-P4.json',blind:'evaluation.json',audit:'stage-P6.json',variants:'groups.json',export:'audit-report.json'};
const sha = text=>createHash('sha256').update(text).digest('hex');

export async function runArtifact(root,id,file) {
  if(id!==RUN_ID || !allow.has(file)) throw Object.assign(new Error('运行产物不存在'),{status:404});
  const target=path.join(root,'content/runs',id,file);
  const stat=await fs.lstat(target);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size>5000000) throw new Error('不允许的产物文件');
  return {text:await fs.readFile(target,'utf8'),filename:file};
}

export async function synthesisRun(root,id=RUN_ID) {
  if(id!==RUN_ID) throw Object.assign(new Error('运行不存在'),{status:404});
  const base=path.join(root,'content/runs',id);
  const config=JSON.parse(await fs.readFile(path.join(base,'run-config.json'),'utf8'));
  const artifacts={};
  for(const file of allow) {
    try { const a=await runArtifact(root,id,file); artifacts[file]={ file,text:a.text,sha256:sha(a.text),data:file.endsWith('.json')?JSON.parse(a.text):null }; }
    catch(e) { if(e.code!=='ENOENT') throw e; }
  }
  const report=artifacts['audit-report.json']?.data;
  const evaluation=artifacts['evaluation.json']?.data;
  const calls=[];
  for(const stage of ['P1','P2','P3','P3-r1','P3-r2','P4','P6']) {
    const a=artifacts[`${stage}-response.json`]?.data;
    if(a) calls.push({stage,model:a.actualModel,requested_model:a.requestedModel,usage:a.usage,latency_ms:a.latencyMs,completed_at:a.completedAt,input_sha256:a.input_sha256,output_sha256:a.output_sha256});
  }
  for(const a of evaluation?.attempts??[]) if(a.model) calls.push({stage:`P5-${a.index}`,model:a.model,usage:a.usage,latency_ms:a.latency_ms});
  const stages=definitions.map(([stage,code,title,files])=>{
    const available=files.filter(f=>artifacts[f]);
    const complete=Boolean(artifacts[primary[stage]]);
    let status=complete?'completed':'pending';
    if(stage==='dossier'&&complete) status='partial';
    if(stage==='seeds') status='experimental';
    if(stage==='blind'&&evaluation?.n_completed!==3) status='pending';
    if(stage==='sufficiency'&&complete) {
      const audit=artifacts['stage-P3-r2.json'].data;
      if(audit.question_sufficiency!=='pass') status='review_pending';
      else if(audit.assessed_difficulty!==config.target_difficulty) status='difficulty_mismatch';
    }
    if(stage==='audit'&&!artifacts['stage-P6.json']) status='pending';
    if(stage==='variants'&&complete&&artifacts['overlap-audit.json']?.data.status!=='pass') status='review_pending';
    if(stage==='export'&&report) status=report.accepted>0?'experimental':'quarantine';
    return {id:stage,code,title,status,files:available};
  });
  return {id,title:'无效借贷返还范围 · Harbor Pilot 001',config,stages,artifacts,evaluation,report,calls,modelRuns:calls.length,trainingSamples:report?.training_rows??0,status:report?'completed_experimental':'running',warning:'研究者视图包含隐藏参考答案与验证器结果，不可拼入学生输入。所有专家审核均未完成，模型同家族新上下文。'};
}
