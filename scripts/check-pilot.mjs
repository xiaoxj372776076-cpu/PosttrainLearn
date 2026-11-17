import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { RUN, read, hash } from './pilot-prepare.mjs';

const config=await read(`${RUN}/run-config.json`);
const source=await read('content/cases/shanghai-2023-23060.json');
const files=await read(`${RUN}/student-files.json`);
for(const m of files['mentions.json']) {
  const p=source.paragraphs.find(p=>p.id===m.span_id);
  assert.ok(p,m.id); assert.equal(p.text.slice(m.locator.start,m.locator.end),m.quote,m.id);
  assert.equal(hash(p.text),m.paragraph_sha256,m.id);
}
assert.equal(files['mentions.json'].length,15);
assert.ok(!/\[p-020\]|\[p-023\]|52\.41万元|524100/.test(JSON.stringify(files)));
assert.ok(!(await read(`${RUN}/few-shot-selection.json`)).seed_ids.some(s=>s.startsWith('case-')));
const secrets=process.env.LLMGW_OPENAI_API_KEY;
for(const file of await fs.readdir(RUN)) {
  const text=await fs.readFile(`${RUN}/${file}`,'utf8');
  if(secrets) assert.ok(!text.includes(secrets),'credential contamination');
  assert.ok(!/"(?:Authorization|authorization|api_key|apiKey)"\s*:/.test(text),`credential-shaped field: ${file}`);
}
let report;
try { report=await read(`${RUN}/audit-report.json`); } catch(e) { if(e.code!=='ENOENT') throw e; }
if(report) {
  const evaluation=await read(`${RUN}/evaluation.json`);
  assert.equal(evaluation.n_completed,3);
  assert.equal(evaluation.attempts.length,3);
  assert.ok(evaluation.attempts.every(a=>a.harbor_errors===0));
  assert.equal(evaluation.controls.oracle.reward,1); assert.equal(evaluation.controls.nop.reward,0);
  assert.equal(report.verifier_sha256,hash(await fs.readFile('harbor/verify.py','utf8')));
  assert.equal(report.question_sha256,hash(await fs.readFile(`${RUN}/instruction.md`,'utf8')));
  assert.equal(report.training_rows,0); assert.equal(report.accepted,0);
  assert.equal(await fs.readFile(`${RUN}/training.jsonl`,'utf8'),'');
  assert.equal(JSON.parse((await fs.readFile(`${RUN}/samples.jsonl`,'utf8')).trim()).status,'quarantine');
  assert.equal(report.total_api_requests,12);
  assert.equal(report.usage.timeout_usage_unknown_calls,1);
  const requests=await read(`${RUN}/blind-requests.json`);
  assert.equal(requests.length,3);
  assert.deepEqual(requests[0].request.messages,requests[1].request.messages);
  assert.deepEqual(requests[0].request.messages,requests[2].request.messages);
  assert.ok(!JSON.stringify(requests).includes('524100'));
  assert.ok(requests.every(r=>r.request.messages.length===2));
  assert.ok(report.usage.input_tokens<=config.budget.max_input_tokens);
  assert.ok(report.usage.output_tokens<=config.budget.max_output_tokens);
}
console.log(JSON.stringify({status:'passed',pilot:config.run_id,uniqueAmountLocators:15,studentHiddenAnswerExclusion:'pass',credentialScan:'pass',finalized:Boolean(report),trainingRows:report?.training_rows??0}));
