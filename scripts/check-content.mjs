import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { buildDossier, validateDossier, renderCasebook } from '../lib/dossier.mjs';
import { promptSections } from '../lib/exploration.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const dataset = await read('content/datasets/plawbench.json');
const evaluation = await read('content/evaluations/summary.json');
assert.equal(dataset.records.length, 280);
assert.equal(new Set(dataset.records.map(r => r.id)).size, 280);
assert.equal(dataset.meta.rubricGroups, 1000);
assert.equal(evaluation.officialLeaderboard.length, 24);
for (const [file, expected] of Object.entries(dataset.meta.sourceHashes)) assert.equal(sha(await fs.readFile(path.join(root, 'content/datasets/plawbench/source', file))), expected, file);
const counts = {};
for (const record of dataset.records) {
  const detail = await read(`content/evaluations/plawbench/${record.id}.json`);
  assert.equal(detail.id, record.id);
  assert.equal(detail.models.length, 2);
  for (const model of detail.models) {
    counts[model.label] ??= { answers: 0, grades: 0 };
    if (model.answer) counts[model.label].answers++;
    if (model.grade) {
      counts[model.label].grades++;
      assert.equal(model.grade.percentage, record.modelScores[model.label].percentage);
      assert.ok(model.grade.maxPoints > 0);
    } else assert.equal(record.modelScores[model.label], undefined);
  }
  assert.ok(!/"(?:reasoningText|baseUrl|requestId|requestedModel|credentials)"/.test(JSON.stringify(detail)));
  assert.ok(!/\bsk-[A-Za-z0-9_-]{16,}|\bark-[A-Za-z0-9]{8}-[A-Za-z0-9-]{20,}\b|ep-\d{14}-[a-z0-9]+/.test(JSON.stringify(detail)));
}
for (const model of evaluation.models) {
  assert.equal(counts[model.label].answers, model.answered);
  assert.equal(counts[model.label].grades, model.scored);
}
const caseData = await read('content/cases/shanghai-2023-23060.json');
assert.equal(sha(JSON.stringify(caseData.paragraphs)), caseData.viewSha256);
assert.ok(!JSON.stringify(caseData.paragraphs).includes('1991年9月27日'));
assert.ok(!JSON.stringify(caseData.paragraphs).includes('1988年7月2日'));
assert.ok(caseData.paragraphs.find(p => p.id === 'p-020').text.includes('52.41万元'));
for (const version of (await read('content/skills/index.json')).versions) {
  assert.equal(sha(await fs.readFile(path.join(root, 'content/skills', version.version, 'SKILL.md'))), version.sha256);
  for (const file of ['references/material-normalization.md', 'references/few-shot-and-difficulty.md', 'references/prompts.md', 'scripts/audit_release.py']) await fs.access(path.join(root, 'content/skills', version.version, file));
}
const dossier = await read('content/dossiers/shanghai-2023-23060/0.1.0.json');
const dossierSchema = await read('schemas/case-dossier-0.1.schema.json');
const dossierChecks = validateDossier(dossier, dossierSchema, caseData);
assert.deepEqual(dossier, buildDossier(await read('content/dossiers/shanghai-2023-23060/0.1.0.extraction.json'), caseData, dossierSchema));
assert.equal(await fs.readFile(path.join(root, 'content/dossiers/shanghai-2023-23060/casebook.md'), 'utf8'), renderCasebook(dossier));
const pipeline = await read('content/pipelines/case-study-0.1.json');
const prompts = promptSections(await fs.readFile(path.join(root, 'content/skills', pipeline.skill_version, 'references/prompts.md'), 'utf8'));
assert.equal(new Set(pipeline.stages.map(s => s.id)).size, pipeline.stages.length);
for (const stage of pipeline.stages) if (stage.prompt_key) assert.ok(prompts[stage.prompt_key], stage.id);
console.log(JSON.stringify({ status: 'passed', questions: dataset.records.length, rubricGroups: 1000, sourceHashes: 'verified', models: counts, publishedLeaderboardRows: 24, caseRedaction: 'verified', skillSnapshots: 'verified', dossierStructuralChecks: dossierChecks, pipelineStages: pipeline.stages.length, trainingReadiness: dossier.case_metadata.training_readiness }, null, 2));
