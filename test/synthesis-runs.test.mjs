import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesisRun, runArtifact } from '../lib/synthesis-runs.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
test('real run manifest preserves source limitations and the original prompt/repair history',async()=>{
  const run=await synthesisRun(root);
  assert.equal(run.config.skill_version,'1.1.0');
  assert.equal(run.config.source_case_id,'cn-shanghai-minhang-2023-civil-first-23060');
  assert.equal(run.artifacts['material-pack.json'].data.normalization_quality.status,'partial');
  assert.equal(run.artifacts['seeds.json'].data.length,3);
  assert.ok(run.artifacts['seeds.json'].data.every(s=>s.role==='independent'&&s.quality_review.human_review===null));
  assert.ok(run.artifacts['P2-request.json'].text.includes('independent-integrated-003'));
  assert.ok(!run.artifacts['P3-request.json'].text.includes('verified_structure_examples'));
  assert.ok(run.artifacts['repair-history.json'].data.rounds.every(r=>r.facts_changed===false));
  assert.ok(!run.artifacts['instruction.md'].text.startsWith('# 无效'));
});
test('run artifacts use a filename allowlist; private paths are not readable',async()=>{
  for(const file of ['.env','../run-config.json','student-files-v9.json','harbor/verify.py']) await assert.rejects(runArtifact(root,'legal-harbor-001',file));
  await assert.rejects(runArtifact(root,'../legal-harbor-001','reference.json'));
  const a=await runArtifact(root,'legal-harbor-001','run-config.json');
  assert.equal(a.filename,'run-config.json'); assert.ok(a.text.includes('max_calls'));
});
test('final outcome keeps failed difficulty and unresolved release gates out of training',async()=>{
  const run=await synthesisRun(root);
  assert.equal(run.report.assessed_difficulty,'D3');
  assert.equal(run.config.target_difficulty,'D4');
  assert.equal(run.report.release_checks.difficulty_alignment,'fail');
  assert.equal(run.stages.find(s=>s.id==='sufficiency').status,'difficulty_mismatch');
  assert.equal(run.stages.find(s=>s.id==='variants').status,'review_pending');
  assert.equal(run.stages.find(s=>s.id==='export').status,'quarantine');
  for(const gate of ['source_permission','material_normalization','privacy','leakage']) {
    assert.equal(run.report.release_checks[gate],'unresolved');
    assert.ok(run.report.quarantine_reasons.some(r=>r.startsWith(`${gate}:`)));
  }
  assert.equal(run.report.total_api_requests,12);
  assert.equal(run.report.bon.physical_trials,4);
  assert.equal(run.report.bon.strict_successes,3);
  assert.equal(run.report.usage.timeout_usage_unknown_calls,1);
  assert.equal(run.artifacts['training.jsonl'].text,'');
  const known=[...run.calls.map(c=>c.usage),run.artifacts['preflight-summary.json'].data.usage];
  assert.equal(run.report.usage.total_tokens,known.reduce((sum,u)=>sum+u.input_tokens+u.output_tokens,0));
  assert.equal(run.report.accepted,0); assert.equal(run.report.expert_reviewed,0);
  assert.equal(run.artifacts['release-gate-audit.json'].data.report.passed,false);
  assert.equal(run.artifacts['release-gate-audit.json'].data.report.errors[0].code,'empty_release');
  assert.equal(run.report.semantic_remaining_issues.length,run.artifacts['stage-P6.json'].data.remaining_issues.length);
});
