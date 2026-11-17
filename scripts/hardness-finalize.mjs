import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CAMPAIGN, ROOT, read, save, sha } from './hardness-call.mjs';
import { measureHardness, legalStateFieldChecks } from '../lib/hardness-metrics.mjs';

const studentText = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n';

const config = await read(path.join(CAMPAIGN, 'config.json'));
const summary = await read(path.join(CAMPAIGN, 'summary.json'));
const ledger = await read(path.join(CAMPAIGN, 'requests.json'));
assert.ok(['completed_target_confirmed', 'completed_max_rounds'].includes(summary.status),
  'Do not finalize a running or interrupted campaign');
assert.ok(summary.rounds.length <= config.max_rounds);
assert.ok(ledger.length <= config.budget.max_requests);
assert.equal(ledger.filter(r => r.status === 'submitted').length, 0, 'A gateway request is still pending');
const unique = new Set(ledger.map(r => `${r.round}/${r.stage}`));
assert.equal(unique.size, ledger.length, 'Duplicate paid submission identifiers');

const rounds = [];
for (const entry of summary.rounds) {
  const round = String(entry.round).padStart(2, '0');
  const folder = path.join(CAMPAIGN, 'rounds', round);
  const outcome = await read(path.join(folder, 'outcome.json'));
  const source = await read(path.join(folder, 'source.json'));
  const skillChange = await read(path.join(folder, 'skill-change.json'));
  const skillFile = path.join(ROOT, 'content/skills', skillChange.version, 'SKILL.md');
  assert.equal(skillChange.skill_sha256, sha(await fs.readFile(skillFile, 'utf8')));
  for(const submission of ledger.filter(row=>row.round===round&&/^P[46](?:-|$)/.test(row.stage))) {
    const stage=submission.stage;
    const request=await read(path.join(folder,`${stage}-request.json`));
    assert.equal(sha(request.messages),submission.input_sha256,'Archived reviewer messages differ from the reserved input hash');
    const payload=request.messages[1].content.split('<DATA>\n')[1]?.split('\n</DATA>')[0];
    assert.ok(payload,'Reference consumer has no archived DATA payload');
    assert.deepEqual(JSON.parse(payload).engineering_reference,await read(path.join(folder,'engineering-reference.json')),
      `Reference differs from actual ${stage} submission in round ${round}`);
  }
  if(entry.round===14) {
    const reference=await read(path.join(folder,'engineering-reference.json'));
    const original=await fs.readFile(path.join(folder,'engineering-reference-v1.json'),'utf8');
    assert.equal(reference.reference_repairs[0].before_sha256,sha(original));
    assert.deepEqual(reference.answer,JSON.parse(original).answer,'Locator repair changed the answer');
  }
  if(entry.round>=14) {
    for(const submission of ledger.filter(row=>row.round===round&&/^P[346](?:-|$)/.test(row.stage))) {
      const input=await read(path.join(folder,`${submission.stage}-request.json`));
      assert.equal(input.skill_projection,'common_quality_rules_without_prior_outcomes');
      assert.equal(input.skill_full_sha256,skillChange.skill_sha256);
      const skillSection=input.messages[1].content.split('</SKILL>')[0];
      assert.ok(!/\n### 迭代 \d+ 的修改假设/.test(skillSection),'Reviewer received prior outcome notes');
    }
  }
  assert.equal(outcome.training_rows ?? 0, 0);
  assert.equal(source.new_scenario, entry.round !== 1);
  if (!outcome.full_chain_completed) {
    const priorRequest=ledger.find(r=>r.round===round);
    rounds.push({ round: entry.round, status: outcome.status, valid_measurement: false,
      reason: 'quarantined_before_blind', source_mode: source.kind, skill_version: skillChange.version,max_output_tokens:priorRequest?.output_reservation??null });
    continue;
  }

  const files = await read(path.join(folder, 'student-files.json'));
  const expected = await read(path.join(folder, 'expected.json'));
  const instruction = await fs.readFile(path.join(folder, 'instruction.md'), 'utf8');
  const frozen = await read(path.join(folder, 'frozen.json'));
  assert.equal(frozen.instruction_sha256, sha(instruction));
  assert.equal(frozen.student_sha256, sha(files));
  assert.equal(frozen.reference_sha256, sha(expected));
  const step = path.join(folder, 'harbor-task/steps/audit');
  assert.equal(frozen.verifier_sha256, sha(await fs.readFile(path.join(step, 'tests/verify.py'), 'utf8')));
  assert.equal(sha(await read(path.join(step, 'tests/expected.json'))), frozen.reference_sha256);
  for (const [name, text] of Object.entries(files)) {
    assert.equal(sha(await fs.readFile(path.join(step, 'workdir/input', name), 'utf8')), sha(studentText(text)));
  }
  assert.equal((await read(path.join(folder, 'harbor-oracle.json'))).reward, 1);
  assert.equal((await read(path.join(folder, 'harbor-nop.json'))).reward, 0);
  const teacher = await read(path.join(folder, 'stage-P4.json'));
  if(entry.round>=14)assert.equal(teacher.reference_supported, true, `Unsupported P4 reference in guarded round ${round}`);
  let sufficiency = await read(path.join(folder, 'stage-P3.json'));
  try { sufficiency = await read(path.join(folder, 'stage-P3-repair.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  assert.equal(sufficiency.question_sufficiency, 'pass');
  assert.equal(sufficiency.answer_leakage, false);

  const first = await inspectBatch(folder, 'Bo5', 'P6', files, frozen, expected);
  assert.deepEqual(first.measured, outcome.measured, 'Recomputed measurement differs from stored outcome');
  let confirmation = null;
  if (outcome.confirmation) {
    confirmation = await inspectBatch(folder, 'Confirm', 'P6-repair', files, frozen, expected);
    assert.deepEqual(confirmation.measured, outcome.confirmation);
    assert.equal(confirmation.identical_input_sha256, first.identical_input_sha256,
      'Confirmation received a different prompt');
  }
  const confirmed = first.measured.target_hit && confirmation?.measured.target_hit === true;
  assert.equal(outcome.confirmed_target_hit, confirmed);
  const modelSettings=await read(path.join(folder,'model-config.json')).catch(error=>{
    if(error.code!=='ENOENT')throw error;
    return null;
  });
  rounds.push({ round: entry.round, skill_version: skillChange.version, source_mode: source.kind,
    student_projection: source.student_projection?.policy ?? 'legacy_frozen_projection',
    cross_branch_coupling: source.cross_branch_coupling ?? null,
    procedural_coupling: source.procedural_coupling ?? null,
    cap_shortcut_repair: source.cap_shortcut_repair ?? null,
    temporal_rate_coupling: source.temporal_rate_coupling ?? null,
    co_guarantee_coupling: source.co_guarantee_coupling ?? null,
    relative_rights_variant: source.relative_rights_variant ?? null,
    third_party_sequence_coupling: source.third_party_sequence_coupling ?? null,
    reviewer_skill_projection:entry.round>=14?'common_quality_rules_without_prior_outcomes':'legacy_full_iteration_skill',
    teacher_reference_supported:teacher.reference_supported===true,
    blind_concurrency: modelSettings?.blind_concurrency ?? null,
    configuration_evidence:modelSettings?'model_config_and_frozen_requests':'legacy_frozen_requests_without_separate_model_config',
    frozen_at: frozen.frozen_at, max_output_tokens:frozen.max_output_tokens, valid_measurement: first.measured.valid,
    first_batch: first, confirmation, confirmed_target_hit: confirmed, analysis: outcome.analysis });
}

async function inspectBatch(folder, prefix, auditStage, files, frozen, expected) {
  const answers = await read(path.join(folder, `${prefix}-answers.json`));
  const audit = await read(path.join(folder, `stage-${auditStage}.json`));
  const measured = measureHardness(audit, answers);
  const inputHashes = [];
  const fixedCheckFailures = {};
  const normalizedFieldFailures = {};
  let legalStateCheckPerfect = 0;
  let rawLegalStateCheckPerfect = 0;
  for (const answer of answers) {
    assert.ok(answer.finished_at, 'A trial has no completion timestamp');
    const submission = ledger.find(r => r.round === path.basename(folder) && r.stage === answer.stage);
    assert.ok(submission, 'Missing request ledger record');
    assert.ok(Date.parse(frozen.frozen_at) <= Date.parse(submission.submitted_at));
    if (!answer.completed_answer) continue;
    const completed = await read(path.join(folder, `${answer.stage}-response.json`));
    const request = await read(path.join(folder, `${answer.stage}-request.json`));
    assert.equal(request.model, config.model);
    assert.equal(request.effort, config.effort);
    assert.equal(request.maxOutputTokens, frozen.max_output_tokens);
    assert.equal(request.input_sha256, sha(request.messages));
    assert.equal(completed.input_sha256, request.input_sha256);
    assert.equal(completed.output_sha256, sha(answer.answer_text));
    assert.ok(Date.parse(frozen.frozen_at) <= Date.parse(completed.completedAt));
    inputHashes.push(request.input_sha256);
    const actions = answer.trace?.actions ?? [];
    assert.deepEqual(actions.filter(a => a.action === 'adapter_read_file').map(a => a.path).sort(),
      Object.keys(files).map(name => `/app/input/${name}`).sort());
    assert.equal(answer.trace?.fresh_api_completion, true);
    assert.equal(answer.trace?.hidden_answer_input, false);
    assert.equal(answer.trace?.arbitrary_shell_enabled, false);
    for (const [name, text] of Object.entries(files)) {
      assert.ok(actions.some(a => a.action === 'adapter_read_file' && a.path === `/app/input/${name}`
        && a.sha256 === sha(studentText(text))), `Missing exact input read: ${name}`);
    }
    const checks = Object.entries(answer.report?.checks ?? {});
    const legal = checks.filter(([key]) => /valid|guarantee|traced|admission|_type$/.test(key));
    if (legal.length && legal.every(([, passed]) => passed)) rawLegalStateCheckPerfect++;
    const normalized=legalStateFieldChecks(expected,answer.answer_text);
    if(normalized.passed)legalStateCheckPerfect++;
    for (const [key, passed] of checks) if (!passed) {
      fixedCheckFailures[key] = (fixedCheckFailures[key] ?? 0) + 1;
      if(normalized.checks[key]!==true)normalizedFieldFailures[key]=(normalizedFieldFailures[key]??0)+1;
    }
  }
  if (inputHashes.length) assert.equal(new Set(inputHashes).size, 1, 'Blind answers did not receive identical inputs');
  const components=Object.fromEntries(['legal_correct','final_amount_correct','basis_correct'].map(key=>{
    const rows=audit.results.filter(row=>typeof row[key]==='boolean');
    return [key,rows.length===5?{correct:rows.filter(row=>row[key]).length,n:5}:null];
  }));
  return { measured, completed_answers:answers.filter(answer=>answer.completed_answer===true).length, identical_input_sha256: inputHashes[0], legal_state_check_perfect_answers: legalStateCheckPerfect,
    semantic_components: components,
    raw_frozen_legal_check_perfect_answers:rawLegalStateCheckPerfect, fixed_check_failures: fixedCheckFailures,
    normalized_field_failures:normalizedFieldFailures,
    failure_analysis: audit.results.filter(r => !r.correct).map(r => ({ index: r.index,
      error_kind: r.error_kind, failed_concepts: r.failed_concepts, reason: r.reason })),
    note: 'Fixed legal-state fields are not semantic legal certification; inspect P6 explanations separately.' };
}

assert.equal(summary.target_hit, rounds.some(r => r.confirmed_target_hit));
const report = {
  campaign: config.id, completed_at: new Date().toISOString(), status: summary.status,
  configuration_history:config.configuration_history??[],
  completed_rounds: rounds.filter(r => r.first_batch?.completed_answers===5).length,
  full_chain_attempted_rounds:rounds.filter(r=>r.first_batch).length, started_rounds: rounds.length,
  target_confirmed: summary.target_hit, winner: summary.winner ?? null, rounds,
  calls: { submissions: ledger.length, completed: ledger.filter(r => r.status === 'completed').length,
    failed_usage_unknown: ledger.filter(r => r.status !== 'completed' && !r.usage).length,
    failed_with_known_usage: ledger.filter(r => r.status !== 'completed' && r.usage).length,
    known_input_tokens: ledger.reduce((n, r) => n + (r.usage?.input_tokens ?? 0), 0),
    known_output_tokens: ledger.reduce((n, r) => n + (r.usage?.output_tokens ?? 0), 0),
    cost_usd: null },
  integrity: { frozen_inputs_verified: true, identical_five_answer_prompts: true,
    within_round_fixed_configuration: true, actual_harbor_controls: true, no_student_seed_or_reference_input: true },
  scope: { split: 'adaptive_dev', model: config.model, adapter: 'restricted_file_completion_no_calculator',
    same_family_semantic_audit: true, expert_review: false, training_rows: 0, local_only: true,
    caveats: ['Single-family small-sample adaptive selection, not generalization evidence.',
      'Numerical errors count as substantive but do not alone establish hard legal reasoning.',
      'Fictional derivative scenarios are not actual litigation records or judgments.',
      'Source permissions, expert law review, contamination checks and independent-family validation remain open.'] },
};
await save(path.join(CAMPAIGN, 'final-audit.json'), report);
console.log(JSON.stringify({ status: report.status, rounds: report.completed_rounds,
  target_confirmed: report.target_confirmed, calls: report.calls }, null, 2));
