import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { RUN, read, save, hash } from './pilot-prepare.mjs';

const config=await read(`${RUN}/run-config.json`);
const evaluation=await read(`${RUN}/evaluation.json`);
const audit=await read(`${RUN}/stage-P6.json`);
const teacher=await read(`${RUN}/teacher-verification.json`);
const question=await fs.readFile(`${RUN}/instruction.md`,'utf8');
let preflight;
try { preflight=await read(`${RUN}/preflight-summary.json`); }
catch(e) {
  if(e.code!=='ENOENT') throw e;
  const r=await read('.local/pilot-preflight-result.json');
  preflight={requested_model:r.requestedModel,actual_model:r.actualModel,usage:r.usage,latency_ms:r.latencyMs,completed_at:r.completedAt,purpose:'gateway_connectivity_only',response_content_excluded:true};
  await save('preflight-summary.json',preflight);
}
if(evaluation.n_completed!==3) throw new Error('BoN incomplete');
const benchmark=await read('content/datasets/plawbench.json');
const norm=text=>text.toLowerCase().replace(/[\p{P}\p{Z}\s]/gu,'');
const grams=text=>{ const s=norm(text); return new Set(Array.from({length:Math.max(0,s.length-7)},(_,i)=>s.slice(i,i+8))); };
const target=grams(JSON.stringify((await read(`${RUN}/student-files.json`))['findings.txt'])+question);
const scores=benchmark.records.map(r=>{
  const g=grams(r.context??''); let shared=0;
  for(const x of g) if(target.has(x)) shared++;
  return {record_id:r.id,jaccard:shared/Math.max(1,target.size+g.size-shared),exact_question: norm(r.question??'')===norm(question),case_number_match:JSON.stringify(r).includes('沪0112民初23060')};
}).sort((a,b)=>b.jaccard-a.jaccard);
await save('overlap-audit.json',{method:'local_normalized_exact_and_8gram_candidate_retrieval_not_semantic_clearance',protected_records:benchmark.records.length,benchmark_sent_to_generation:false,exact_question_matches:scores.filter(s=>s.exact_question).length,case_number_matches:scores.filter(s=>s.case_number_match).length,top_candidates:scores.slice(0,5),status:'unresolved',limitations:['案例身份字段在基准中不完整','8gram仅候选检索，阈值未标注校准','未完成独立语义近重复和源案例溯源审核，不宣称无污染']});
await save('groups.json',{group_id:'group-shanghai-23060',case_ids:[config.source_case_id],unit_ids:['issue-return'],sample_ids:['harbor-loan-restitution-001'],split:'dev',purpose:'已用于调试与合成学习，不再声明未见test',variants:0,case_group_split_check:'pass',benchmark_policy:'PLawBench全量仅本地审计和浏览，不作为few-shot',note:'无实质事实改编；同案原文、匿名化和未来变体必须保持同组'});
const fileList=(await fs.readdir(RUN)).filter(f=>/^(P\d.*-response)\.json$/.test(f));
const calls=[];
for(const file of fileList) { const r=await read(`${RUN}/${file}`); calls.push({stage:file.replace('-response.json',''),requested_model:r.requestedModel,actual_model:r.actualModel,usage:r.usage,latency_ms:r.latencyMs,input_sha256:r.input_sha256,output_sha256:r.output_sha256,completed_at:r.completedAt}); }
for(const a of evaluation.attempts) calls.push({stage:`P5-${a.index}`,actual_model:a.model,usage:a.usage,latency_ms:a.latency_ms});
const inputTokens=calls.reduce((s,c)=>s+(c.usage?.input_tokens??0),preflight.usage.input_tokens);
const outputTokens=calls.reduce((s,c)=>s+(c.usage?.output_tokens??0),preflight.usage.output_tokens);
const unknownCalls=evaluation.infrastructure_failures?.length??0;
const totalApiRequests=calls.length+1+unknownCalls;
if(totalApiRequests>config.budget.max_calls||inputTokens>config.budget.max_input_tokens||outputTokens>config.budget.max_output_tokens) throw new Error('Observed budget exceeded');
const questionAudit=await read(`${RUN}/stage-P3-r2.json`);
const assessedCandidates=[questionAudit.assessed_difficulty,audit.assessed_difficulty].filter(v=>/^D[1-4]$/.test(v));
const assessed=assessedCandidates.sort()[0]??'D3';
const reasons=['source_permission: limited_local_research_only，正式训练/再分发范围未解决','leakage: benchmark语义近重复与源案例溯源未完成','review: 0条专家审核；同家族审计不能视为法律金标'];
for(const gate of ['material_normalization','privacy']) {
  if(audit.checks?.[gate]!=='pass') reasons.push(`${gate}: ${audit.checks?.[gate]??'unresolved'}，原文定位校验和可见脱敏不等于完整发布认证`);
}
for(const [name,state] of Object.entries(audit.checks??{})) {
  if(state==='fail'&&name!=='difficulty_alignment') reasons.push(`P6 ${name}: fail`);
}
if(!teacher.passed) reasons.push(`teacher_fixed_contract_failed: ${teacher.failed_checks.join(', ')}`);
if(!evaluation.strict_successes) reasons.push('blind_answer_agreement: 没有严格全通过盲答');
if(assessed!=='D4') reasons.push(`difficulty_alignment: target D4, assessed ${assessed}`);
const empirical=evaluation.strict_successes===3?'三份完成的盲答均严格通过（超时另记），高难度缺乏经验支持':'单题三次结果不足以确认高难度；须分层区分语义错误与格式/引用错误';
reasons.push(`empirical_hardness: ${empirical}`);
const teacherAnswer=await read(`${RUN}/stage-P4.json`);
const sample={
  schema_version:'1.1', sample_id:'harbor-loan-restitution-001', unit_id:'issue-return',
  material_pack_ids:['material-shanghai-23060'], group_id:'group-shanghai-23060', case_ids:[config.source_case_id],
  split:'dev', task_type:config.task_type, jurisdiction:config.jurisdiction, legal_as_of:config.legal_as_of,
  question, answer:JSON.stringify(teacherAnswer.answer), rationale:teacherAnswer.rationale,
  source_ids:['case-doc-23060','lending-2020-12','civil-code-2020'],
  generation_mode:'few_shot', few_shot_run_id:'fs-legal-harbor-001',
  seed_provenance:(await read(`${RUN}/seeds.json`)).map(s=>({seed_id:s.seed_id,role:'independent',selection_reason:s.difficulty_basis})),
  difficulty:{target:config.target_difficulty,assessed,reasoning_requirements:['temporal_applicability','rule_application','amount_classification','evidence_comparison','arithmetic_computation'],assessment_reason:audit.difficulty_reason??questionAudit.assessment_reason,assessment_run_id:'P6'},
  checks:{...audit.checks,source_permission:'unresolved',privacy:'unresolved',leakage:'unresolved',difficulty_alignment:assessed===config.target_difficulty?'pass':'fail'},
  verification_run_ids:['dossier-map-and-existing-semantic-check','P3-r2','P6','Harbor-BoN-3'],
  remaining_issues:reasons, semantic_remaining_issues:audit.remaining_issues??[], review_level:'auto_checked',
  variant_type:'base', status:'quarantine', quarantine_reason:reasons.join('; '),
  note:'高难度Harbor设计实验已跑通，不是已通过正式发布门槛的训练数据',
};
await save('samples.jsonl',JSON.stringify(sample)+'\n');
await save('training.jsonl','');
const releaseProcess=spawnSync('python3',['content/skills/1.1.0/scripts/audit_release.py',`${RUN}/samples.jsonl`],{encoding:'utf8'});
if(releaseProcess.error) throw releaseProcess.error;
const releaseAudit=JSON.parse(releaseProcess.stdout);
if(releaseProcess.status!==1||releaseAudit.errors.length!==1||releaseAudit.errors[0].code!=='empty_release') throw new Error('Unexpected release audit result');
await save('release-gate-audit.json',{exit_code:releaseProcess.status,command:'python3 content/skills/1.1.0/scripts/audit_release.py content/runs/legal-harbor-001/samples.jsonl',report:releaseAudit,interpretation:'发布审计未通过：0条accepted，不导出训练；隔离记录只做计数和分组检查，不是上游质量认证。'});
await save('operational-metrics.json',{physical_model_trials:evaluation.physical_trials,completed_model_answers:evaluation.n_completed,infrastructure_timeouts:unknownCalls,strict_successes:evaluation.strict_successes,completed_answer_contract_success_rate:evaluation.strict_successes/evaluation.n_completed,end_to_end_trial_success_rate:evaluation.strict_successes/evaluation.physical_trials,raw_harbor_rewards:[evaluation.attempts[0].reward,evaluation.attempts[1].reward,...(evaluation.infrastructure_failures??[]).map(f=>f.harbor_recorded_reward),evaluation.attempts[2].reward],interpretation:'3/3为完成答案的固定契约通过率，不是无条件端到端成功率；4次物理trial有1次网关超时，端到端3/4。均不是法律语义正确率。'});
await save('run-events.json',{network_failures:[{stage:'preflight',scope:'restricted-sandbox',error:'fetch failed',successful_retry:true},{stage:'P1',scope:'restricted-sandbox',error:'fetch failed',successful_retry:true}],vm_failure:{job:'legal-pilot-oracle',error:'Smol readonly state database in restricted sandbox',successful_retry:'legal-pilot-oracle-approved',not_counted_as_model_error:true},infrastructure_model_failures:evaluation.infrastructure_failures??[],total_api_requests:totalApiRequests,repairs:await read(`${RUN}/repair-history.json`),model_calls:calls,preflight_note:'另1次成功连通性预检，18 total tokens；无法送达的网络尝试不冒称计费API响应',cost_usd:null,identity_note:'模型服务别名不是独立认证的固定权重checkpoint'});
await save('audit-report.json',{run_id:config.run_id,status:'completed_experimental_quarantined',completed_at:new Date().toISOString(),summary:'1个原案Harbor任务已完成全流程；保留两次题面修复、三份完成盲答、一次网关超时和所有审计。正式训练发布仍隔离，不将实验看板当作法律金标。',source_cases:1,material_packs:1,decision_units:1,structure_seeds:3,expert_approved_seeds:0,candidates:(await read(`${RUN}/stage-P2.json`)).candidates.length,unique_tasks:1,accepted:0,rejected:0,quarantine:1,training_rows:0,expert_reviewed:0,target_difficulty:'D4',assessed_difficulty:assessed,empirical_hardness:empirical,bon:{n:3,physical_trials:evaluation.physical_trials,first_score:evaluation.attempts[0].report.score,best_score:evaluation.best_score,strict_successes:evaluation.strict_successes,infrastructure_failures:unknownCalls,selector:evaluation.selection},model_calls_successful:calls.length,preflight_successful:1,total_api_requests:totalApiRequests,usage:{input_tokens:inputTokens,output_tokens:outputTokens,total_tokens:inputTokens+outputTokens,known_usage_only:true,timeout_usage_unknown_calls:unknownCalls,timeout_reservations:evaluation.infrastructure_failures?.map(f=>f.unknown_usage_reservation)??[],cost_usd:null},budget_status:'请求数量不超过12；已知token低于预算，超时请求实际计费/用量未返回，保留估算预留，不宣称总费用为零或所有token已完整计量',budget:config.budget,teacher_verifier:teacher,semantic_audit:audit.checks,quarantine_reasons:reasons,limitations:['单案例，不代表完整诉讼卷宗或总体难度','同家族新上下文，不是跨家族独立核验','说明非空/来源存在不等于法律语义正确','BoN有隐藏评分器，非无金标上线选择器','种子结构可核验但高难度未独立实测','未跑zero-shot消融，也未训练或测训练收益','网关超时无完成响应，实际计费与token用量未知'],verifier_sha256:(await read(`${RUN}/harbor-build.json`)).verifier_sha256,question_sha256:hash(question)});
const report=await read(`${RUN}/audit-report.json`);
report.release_checks=sample.checks;
report.semantic_remaining_issues=sample.semantic_remaining_issues;
report.preflight=preflight;
report.usage.includes_connectivity_preflight=true;
report.release_auditor={exit_code:releaseProcess.status,passed:releaseAudit.passed,errors:releaseAudit.errors,artifact:'release-gate-audit.json'};
await save('audit-report.json',report);
console.log(JSON.stringify({status:sample.status,modelCalls:calls.length,inputTokens,outputTokens,strictSuccesses:evaluation.strict_successes,trainingRows:0}));
