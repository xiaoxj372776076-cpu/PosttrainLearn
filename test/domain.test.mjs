import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReview, compareLines, seedExport } from '../lib/domain.mjs';
import { markdown, escapeHtml, percent, suggestedVersion } from '../public/utils.js';

const approved = { usage: 'approved', skillVersion: '1.1.0', expert: 'expert-01', note: '先归属金额，再检查例外', answer: '有据答案', rationale: '根据已核验事实与规则', permissionBasis: '用户记录的授权依据', permissionConfirmed: true, answerVerified: true, difficulty: 'D3', patterns: ['amount_classification', 'rule_application'] };
test('approved seed requires verified answer, rationale and permission basis', () => {
  assert.equal(validateReview(approved).usage, 'approved');
  for (const field of ['expert', 'note', 'answer', 'rationale', 'permissionBasis', 'skillVersion']) assert.throws(() => validateReview({ ...approved, [field]: '' }));
  assert.throws(() => validateReview({ ...approved, answerVerified: false }));
  assert.throws(() => validateReview({ ...approved, permissionConfirmed: false }));
});
test('holdout cannot directly become a development seed', () => assert.throws(() => validateReview(approved, { usage: 'holdout' }), /保留评测/));
test('development use remains sticky and cannot become unseen holdout', () => {
  const candidate = validateReview({ usage: 'candidate' });
  assert.equal(candidate.everUsedForDevelopment, true);
  assert.throws(() => validateReview({ usage: 'holdout' }, candidate), /未见/);
});
test('D3 is not merely lookup plus arithmetic and D4 needs three distinct operations', () => {
  assert.throws(() => validateReview({ ...approved, patterns: ['rule_application', 'arithmetic_computation'] }));
  assert.throws(() => validateReview({ ...approved, difficulty: 'D4' }));
  assert.throws(() => validateReview({ ...approved, patterns: ['rule_application', 'rule_application'] }));
});
test('only approved seeds export; export preserves provenance and excludes unseen evaluation', () => {
  const records = [{ id: 'case-001', question: 'Q', questionOrigin: 'source', context: 'C', source: { file: 'a.jsonl' } }, { id: 'case-002' }];
  const seeds = seedExport(records, { 'case-001': { ...approved, updatedAt: '2026-11-14' }, 'case-002': { usage: 'candidate' } }, '1.1.1');
  assert.equal(seeds.length, 1); assert.equal(seeds[0].role, 'development'); assert.equal(seeds[0].reviewed_at, '2026-11-14'); assert.equal(seeds[0].excluded_from_unseen_evaluation, true);
  assert.equal(seeds[0].question_origin, 'source');
  assert.equal(seeds[0].skill_version, '1.1.0');
  assert.equal(seeds[0].exported_with_skill_version, '1.1.1');
});
test('diff preserves both versions and identifies minimal changed lines', () => {
  const lines = compareLines('a\nb\nc', 'a\nx\nc');
  assert.deepEqual(lines.filter(l => l.kind !== 'added').map(l => l.text), ['a', 'b', 'c']);
  assert.deepEqual(lines.filter(l => l.kind !== 'removed').map(l => l.text), ['a', 'x', 'c']);
  assert.equal(lines.filter(l => l.kind === 'same').length, 2);
});
test('markdown is safe: raw HTML and javascript links cannot execute', () => {
  const output = markdown('<script>alert(1)</script>\n[bad](javascript:alert(1))\n[ok](https://example.com)\n[spec](references/data-contract.md)');
  assert.ok(!output.includes('<script>')); assert.ok(!output.includes('href="javascript:')); assert.ok(output.includes('href="https://example.com"')); assert.ok(output.includes('data-file="references/data-contract.md"'));
  assert.equal(escapeHtml('"<>&'), '&quot;&lt;&gt;&amp;');
});
test('markdown handles real skill structures and does not swallow frontmatter', () => {
  const output = markdown('---\nname: test\n---\n# Title\n| A | B |\n|---|---|\n| x | y |\n```text\na<b\n```\n- first\n- second');
  assert.ok(!output.includes('name: test')); assert.ok(output.includes('<h1>Title</h1>')); assert.ok(output.includes('<table')); assert.ok(output.includes('a&lt;b')); assert.ok(output.includes('<li>second</li>'));
});
test('missing grades are distinct from zero and suggested versions are deterministic', () => {
  assert.equal(percent(null), '未评分'); assert.equal(percent(0), '0.0%'); assert.equal(suggestedVersion('1.1.0'), '1.1.1');
});
