import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildDossier, validateDossier, renderCasebook, DOSSIER_SECTIONS } from '../lib/dossier.mjs';
import { buildExploration, promptSections } from '../lib/exploration.mjs';

const read = async file => JSON.parse(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
const schema = await read('schemas/case-dossier-0.1.schema.json');
const source = await read('content/cases/shanghai-2023-23060.json');
const extraction = await read('content/dossiers/shanghai-2023-23060/0.1.0.extraction.json');
const dossier = buildDossier(extraction, source, schema);
const clone = () => structuredClone(dossier);
const validate = value => validateDossier(value, schema, source);

test('dossier covers all modules and the entire frozen view without certifying completeness', async () => {
  assert.deepEqual(dossier, await read('content/dossiers/shanghai-2023-23060/0.1.0.json'));
  assert.equal(dossier.source_spans.length, source.paragraphs.length);
  for (const key of Object.keys(DOSSIER_SECTIONS)) assert.ok(Array.isArray(dossier[key]));
  assert.equal(dossier.documents.length, 7);
  assert.equal(dossier.evidence_items.length, 6);
  assert.equal(dossier.issues.length, 4);
  assert.equal(dossier.case_metadata.normalization_status, 'partial');
  assert.equal(dossier.case_metadata.training_readiness, 'blocked');
  assert.equal(dossier.case_metadata.expert_review_status, 'not_reviewed');
  assert.equal(dossier.evidence_responses.length, 0);
  assert.ok(dossier.gaps_and_review.gaps.some(g => g.id === 'gap-cross'));
  assert.equal(validate(dossier).formulas, 4);
});

test('dossier rejects missing modules, duplicate IDs, dangling and wrong-type references', () => {
  let bad = clone(); delete bad.claims; assert.throws(() => validate(bad), /缺少 claims/);
  bad = clone(); bad.events[0].id = bad.claims[0].id; assert.throws(() => validate(bad), /重复/);
  bad = clone(); bad.issues[0].fact_ids.push('missing-fact'); assert.throws(() => validate(bad), /悬空/);
  bad = clone(); bad.issues[0].fact_ids.push('claim-principal-v1'); assert.throws(() => validate(bad), /错类型/);
  bad = clone(); bad.gaps_and_review.gaps[0].id = bad.issues[0].id; assert.throws(() => validate(bad), /重复/);
});

test('dossier rejects invented originals and cross-proceeding conclusions', () => {
  let bad = clone(); bad.documents[1].original_obtained = true; assert.throws(() => validate(bad), /原件/);
  bad = clone(); bad.evidence_items[0].original_obtained = true; assert.throws(() => validate(bad), /原件状态/);
  bad = clone(); bad.proceedings.push({ ...bad.proceedings[0], id: 'proc-appeal' });
  bad.court_assessments.find(a => a.id === 'assess-first').proceeding_id = 'proc-appeal';
  assert.throws(() => validate(bad), /其他程序/);
});

test('source integrity rejects quote, locator, text version, missing appendix and rewritten full text', () => {
  let bad = clone(); bad.source_spans[0].quote += '假内容'; assert.throws(() => validate(bad), /冻结原文/);
  bad = clone(); bad.source_spans[0].locator.source_line = 99; assert.throws(() => validate(bad), /冻结原文/);
  bad = clone(); bad.source_spans[0].text_version = 'original'; assert.throws(() => validate(bad), /冻结原文/);
  bad = clone(); bad.source_spans.pop(); assert.throws(() => validate(bad), /全文附录|悬空/);
  bad = clone(); bad.documents[0].paragraphs[0].text = '改写原文'; assert.throws(() => validate(bad), /全文附录/);
  bad = clone(); bad.case_metadata.case_id = 'wrong-case'; assert.throws(() => validate(bad), /案件身份/);
});

test('money formulas reject double counting, cycles, mixed operands and rounding errors', () => {
  let bad = clone(); bad.amount_ledger.find(a => a.id === 'amt-total').components.push('amt-750'); assert.throws(() => validate(bad), /重复计入/);
  bad = clone(); bad.amount_ledger.find(a => a.id === 'amt-later').components = ['amt-total']; assert.throws(() => validate(bad), /成环/);
  bad = clone(); bad.amount_ledger.find(a => a.id === 'amt-total').value = '524100.01'; assert.throws(() => validate(bad), /公式不一致/);
  bad = clone(); bad.amount_ledger.find(a => a.id === 'amt-first').value = '502000.001'; assert.throws(() => validate(bad), /精确到分/);
  bad = clone(); bad.amount_ledger.find(a => a.id === 'amt-total').components = ['rate-gf']; assert.throws(() => validate(bad), /混合/);
  assert.equal(dossier.amount_ledger.find(a => a.id === 'rate-sh').value, '11.016');
  assert.equal(dossier.amount_ledger.find(a => a.id === 'rate-contract').value, '0.005');
});

test('equal values preserve distinct roles and source disagreement remains unresolved', () => {
  const transfer = dossier.amount_ledger.find(a => a.id === 'amt-later');
  const claim = dossier.amount_ledger.find(a => a.id === 'amt-claim-interest');
  assert.equal(transfer.value, claim.value); assert.notEqual(transfer.role, claim.role);
  assert.deepEqual(dossier.amount_ledger.find(a => a.id === 'amt-total').components, ['amt-first', 'amt-later']);
  assert.ok(!dossier.amount_ledger.find(a => a.id === 'amt-total').components.includes(claim.id));
  assert.equal(dossier.gaps_and_review.checks.find(c => c.name === 'source_net_interest_conflict').status, 'needs_review');
  assert.ok(dossier.gaps_and_review.gaps.find(g => g.id === 'gap-net-interest').text.includes('19900'));
  assert.equal(dossier.claims.find(c => c.id === 'claim-interest-v1').status, 'not_carried_forward');
  assert.equal(dossier.decisions.find(d => d.id === 'decision-return').deadline.absolute_date, null);
});

test('cannot fabricate expert approval or training readiness', () => {
  let bad = clone(); bad.case_metadata.expert_review_status = 'reviewed'; assert.throws(() => validate(bad), /没有审核/);
  bad = clone(); bad.case_metadata.training_readiness = 'eligible_for_unit_review'; assert.throws(() => validate(bad), /权限或法律版本/);
});

test('human-readable casebook is deterministic and preserves every source span and record', async () => {
  const book = renderCasebook(dossier);
  assert.equal(book, await fs.readFile(new URL('../content/dossiers/shanghai-2023-23060/casebook.md', import.meta.url), 'utf8'));
  for (const span of dossier.source_spans) assert.ok(book.includes(span.id) && book.includes(span.quote));
  for (const key of Object.keys(DOSSIER_SECTIONS)) for (const item of dossier[key]) assert.ok(book.includes(item.id));
  assert.ok(book.includes('未取得或未形成记录'));
  assert.ok(!book.includes('1991年9月27日'));
});

test('pipeline shows actual drafts, separates seed use from extraction and isolates prompt sections', async () => {
  const pipeline = await read('content/pipelines/case-study-0.1.json');
  const dataset = await read('content/datasets/plawbench.json');
  const prompts = await fs.readFile(new URL('../content/skills/1.1.0/references/prompts.md', import.meta.url), 'utf8');
  assert.deepEqual(Object.keys(promptSections(prompts)), ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  const result = buildExploration({ pipeline, dossier, dataset, state: { reviews: {} }, prompts, fewShotGuide: 'seed guide' });
  assert.equal(result.stages.length, 12);
  assert.equal(result.stages.find(s => s.id === 'dossier').status, 'partial');
  assert.equal(result.stages.find(s => s.id === 'units').status, 'draft');
  assert.equal(result.stages.find(s => s.id === 'questions').status, 'not_run');
  assert.ok(result.stages.find(s => s.id === 'questions').prompt.includes('{verified_few_shot_examples}'));
  assert.ok(!result.stages.find(s => s.id === 'questions').prompt.includes('## P3:'));
  assert.equal(result.seedBank.selectionLog, null); assert.equal(result.trainingSamples, 0); assert.equal(result.modelRuns, 0);
  assert.ok(pipeline.stages.findIndex(s => s.id === 'seeds') > pipeline.stages.findIndex(s => s.id === 'units'));
  assert.ok(pipeline.stages.findIndex(s => s.id === 'seeds') < pipeline.stages.findIndex(s => s.id === 'questions'));
});
