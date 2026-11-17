import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { benchmarkArtifact,benchmarkPilot,validateFrozenGrade,summarizeFrozenGrades,sharedSubmissionBudget,planFrozenAttempts,validateFrozenBlindAttempt,BENCHMARK_PILOT_ID,BENCHMARK_PILOT_IDS } from '../lib/benchmark-pilot.mjs';

const reference={critical_criteria:[{id:'effect'},{id:'scope'}]};
const correct={measurement_valid:true,answer_complete:true,legal_core_correct:true,overall_correct:true,
  criteria:[{id:'scope',pass:true},{id:'effect',pass:true}],reference_problems:[]};
test('frozen semantic grade accepts equivalent ordering but rejects missing or substituted criteria',()=>{
  assert.equal(validateFrozenGrade(correct,reference),correct);
  assert.throws(()=>validateFrozenGrade({...correct,criteria:[{id:'effect',pass:true},{id:'effect',pass:true}]},reference));
  assert.throws(()=>validateFrozenGrade({...correct,criteria:[{id:'effect',pass:true},{id:'other',pass:true}]},reference));
  assert.throws(()=>validateFrozenGrade({...correct,criteria:[{id:'effect',pass:true}]},reference));
});
test('format and reference defects cannot become valid legal failures',()=>{
  assert.throws(()=>validateFrozenGrade({...correct,reference_problems:['unsupported law']},reference));
  assert.throws(()=>validateFrozenGrade({...correct,overall_correct:false},reference));
  const invalid={...correct,measurement_valid:false,answer_complete:false,overall_correct:false,legal_core_correct:false,
    criteria:[{id:'effect',pass:false},{id:'scope',pass:false}],reference_problems:['unsupported law']};
  assert.equal(validateFrozenGrade(invalid,reference).measurement_valid,false);
});
test('pilot artifacts reject traversal, unknown paths and symlinked source',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'legal-benchmark-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const base=path.join(root,'content/runs',BENCHMARK_PILOT_ID);await fs.mkdir(path.join(base,'calls'),{recursive:true});
  await fs.writeFile(path.join(base,'run-config.json'),JSON.stringify({probe_count:10}));
  await fs.writeFile(path.join(base,'calls/P2-request.json'),'{}');
  assert.equal((await benchmarkArtifact(root,'calls/P2-request.json')).text,'{}');
  const pilot=await benchmarkPilot(root);assert.equal(pilot.submissions,1);assert.equal(pilot.first,null);
  await assert.rejects(()=>benchmarkArtifact(root,'../../secret.json'));
  await assert.rejects(()=>benchmarkArtifact(root,'calls/unknown.json'));
  await fs.symlink(path.join(base,'run-config.json'),path.join(base,'seeds.json'));
  await assert.rejects(()=>benchmarkArtifact(root,'seeds.json'));
});
test('interrupted blind answers remain inspectable without becoming a completed difficulty measurement',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'legal-benchmark-partial-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const id=BENCHMARK_PILOT_IDS[1];const base=path.join(root,'content/runs',id);
  await fs.mkdir(path.join(base,'calls'),{recursive:true});
  await fs.writeFile(path.join(base,'run-config.json'),JSON.stringify({probe_count:4,status:'blind_infrastructure_interrupted'}));
  const partial={n_completed:2,n_interrupted:1,valid_five_answer_measurement:false};
  await fs.writeFile(path.join(base,'blind-first-partial.json'),JSON.stringify(partial));
  await fs.writeFile(path.join(base,'audit-report.json'),JSON.stringify({first:null,blind_progress:partial}));
  const pilot=await benchmarkPilot(root,id);
  assert.equal(pilot.first,null);assert.equal(pilot.report.blind_progress.n_completed,2);
  assert.equal(pilot.stages.find(s=>s.id==='blind').completed,false);
  assert.deepEqual(JSON.parse((await benchmarkArtifact(root,'blind-first-partial.json',id)).text),partial);
});
test('shared cap extension requires the explicit amendment and includes interrupted requests',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'legal-benchmark-budget-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const id of BENCHMARK_PILOT_IDS) {
    const base=path.join(root,'content/runs',id);await fs.mkdir(path.join(base,'calls'),{recursive:true});
    await fs.writeFile(path.join(base,'run-config.json'),JSON.stringify({max_submissions:48}));
    await fs.writeFile(path.join(base,'calls/test-request.json'),'{}');
  }
  assert.deepEqual(await sharedSubmissionBudget(root),{submissions:2,limit:48,remaining:46});
  const base=path.join(root,'content/runs',BENCHMARK_PILOT_IDS[1]);
  await fs.writeFile(path.join(base,'run-config.json'),JSON.stringify({max_submissions:52}));
  await assert.rejects(()=>sharedSubmissionBudget(root));
  await fs.writeFile(path.join(base,'submission-budget-amendment.json'),JSON.stringify({previous_limit:48,next_limit:52,user_authorized:true,shared_run_ids:BENCHMARK_PILOT_IDS}));
  assert.deepEqual(await sharedSubmissionBudget(root),{submissions:2,limit:52,remaining:50});
  await fs.writeFile(path.join(base,'run-config.json'),JSON.stringify({max_submissions:53}));
  await assert.rejects(()=>sharedSubmissionBudget(root));
});
test('slot mapping chooses first completed response and gives only failed calls named retries',()=>{
  const files=['first-blind-1-request.json','first-blind-1-response.json','first-blind-1-retry-1-request.json','first-blind-1-retry-1-response.json',
    'first-blind-3-request.json','first-blind-3-error.json'];
  const plan=planFrozenAttempts(files,'first','blind');
  assert.equal(plan[0].call,'first-blind-1');assert.equal(plan[0].cached,true);
  assert.equal(plan[2].call,'first-blind-3-retry-1');assert.equal(plan[2].cached,false);
  assert.equal(plan[3].call,'first-blind-4');
  assert.throws(()=>planFrozenAttempts(['first-blind-2-request.json'],'first','blind'));
  const grade=planFrozenAttempts(['first-grade-1-request.json','first-grade-1-response.json','first-grade-1-validation-error.json'],'first','grade');
  assert.equal(grade[0].call,'first-grade-1-retry-1');
});
test('completed retries must retain frozen request, output hash, configuration and serving identity',()=>{
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const messages=[{role:'user',content:'fixed question'}],input=hash(JSON.stringify(messages));
  const model={model:'deepseek-v4.1-1017',effort:'high',maxOutputTokens:10000};
  const frozen={model,request_sha256:input,target_actual_model:'deepseek-v4-1-flash-261017'};
  const request={...model,messages,input_sha256:input};
  const response={text:'complete answer',status:'completed',input_sha256:input,output_sha256:hash('complete answer'),actualModel:frozen.target_actual_model};
  assert.equal(validateFrozenBlindAttempt(request,response,frozen),response);
  assert.throws(()=>validateFrozenBlindAttempt({...request,maxOutputTokens:16000},response,frozen));
  assert.throws(()=>validateFrozenBlindAttempt(request,{...response,actualModel:'other'},frozen));
  assert.throws(()=>validateFrozenBlindAttempt(request,{...response,status:'incomplete'},frozen));
  assert.throws(()=>validateFrozenBlindAttempt(request,{...response,text:'edited'},frozen));
});
test('criterion observations remain visible but invalid grading cannot report a difficulty hit',()=>{
  const grades=Array.from({length:5},(_,i)=>({index:i+1,...correct}));
  assert.equal(summarizeFrozenGrades(grades,reference).correct,5);
  grades[0]={...grades[0],answer_complete:false};
  const result=summarizeFrozenGrades(grades,reference);
  assert.equal(result.correct,null);assert.equal(result.strict_criteria_correct,5);assert.equal(result.target_hit,false);
  assert.equal(result.criterion_pass_counts[0].pass_count,5);
  assert.throws(()=>summarizeFrozenGrades(grades.slice(0,4),reference));
  assert.throws(()=>summarizeFrozenGrades([...grades.slice(0,4),grades[0]],reference));
});
