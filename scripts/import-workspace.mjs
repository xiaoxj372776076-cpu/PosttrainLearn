import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const workspace = path.resolve(process.argv[2] ?? path.join(root, '..'));
try {
  await fs.access(path.join(root, 'content/skills/index.json'));
  throw new Error('已有内容快照，拒绝重新导入以保护 Skill 版本与研究历史。请在新的空白项目中导入。');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const write = async (file, data) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n'); };
const groups = [
  ['case', '案例分析', 'practical_case_analysis_250.jsonl'], ['consultation', '法律咨询', 'public_legal_consultation_18.json'],
  ['plaintiff', '起诉状', 'Plantiffs_Statement.json'], ['defendant', '答辩状', 'Defendants_Statement.json'],
];
const records = []; const sourceHashes = {}; const taskTypes = [];
for (const [type, typeLabel, file] of groups) {
  const bytes = await fs.readFile(path.join(root, 'content/datasets/plawbench/source', file));
  sourceHashes[file] = hash(bytes);
  const rows = file.endsWith('.jsonl') ? bytes.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : JSON.parse(bytes.toString('utf8'));
  taskTypes.push({ key: type, label: typeLabel, count: rows.length });
  rows.forEach((raw, index) => {
    const context = raw.context ?? raw.conversation ?? '';
    const question = raw.question || (type === 'consultation' ? '根据以下咨询内容，提出需要进一步澄清的关键问题。' : `根据以下情景起草${typeLabel}。`);
    const title = (raw.tag || (type === 'case' ? context.split(/[。！？]/)[0] : context.replace(/\s+/g, ' ').slice(0, 68))).slice(0, 88);
    const rubrics = raw.rubrics ?? raw.Rubrics;
    const warnings = [];
    if (type === 'case' && index === 0) warnings.push('法条组文本含四个 +5 分，但 points 为 15；分值口径待专家核对。');
    if (type === 'consultation' && index === 16) warnings.push('文字总分为 12，正分细项合计为 13；保留原始评分口径。');
    if (type === 'consultation' && index >= 11 && index <= 15) warnings.push('原始 rubric 未明确总分，不能自动视为统一满分。');
    if (type === 'defendant' && index === 0) warnings.push('部分 rubric 与题干事实、职业伦理可能存在冲突，需要专家复核。');
    if (raw.label === '跨国事务') warnings.push('逐题核对法域；本领域同时包含涉外法与外国法。');
    records.push({
      id: `${type}-${String(index + 1).padStart(3, '0')}`, type, typeLabel, label: raw.label || raw.tag || '法律咨询', title,
      context, question, questionOrigin: raw.question ? 'source' : 'task_label_not_official_generation_prompt',
      referenceAnswer: raw.answer ?? raw.reference_answer ?? null,
      rubrics, pointsTotal: Array.isArray(rubrics) ? rubrics.reduce((sum, r) => sum + Number(r.points), 0) : null,
      originalScoreField: raw.score ?? null, warnings,
      source: { repository: 'https://github.com/SKYLENAGE-AI/PLawBench', file, ordinal: index + 1, originalId: raw.id ?? null, sha256: sourceHashes[file] },
      modelScores: {},
    });
  });
}
const comparisonRoot = path.join(workspace, 'plawbench-eval/ark-comparisons/ark-seed-judge-protocol-v4');
const comparison = await read(path.join(comparisonRoot, 'summary.json'));
const optionalRead = async file => { try { return await read(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const labels = ['seed-2.0-lite', 'seed-2.1-pro'];
const safeText = text => String(text ?? '').replace(/\b(?:sk-|ark-)[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]').replace(/ep-\d{14}-[a-z0-9]+/g, '[ENDPOINT_REDACTED]');
const safe = value => JSON.parse(safeText(JSON.stringify(value)));
for (const record of records) {
  const models = [];
  for (const label of labels) {
    const base = path.join(comparisonRoot, 'runs', label);
    const answer = await optionalRead(path.join(base, 'answers', `${record.id}.json`));
    const grade = await optionalRead(path.join(base, 'grades', `${record.id}.json`));
    const validGrade = answer && grade && Number.isFinite(grade.percentage) ? grade : null;
    if (validGrade) record.modelScores[label] = { points: grade.points, maxPoints: grade.maxPoints, percentage: grade.percentage };
    models.push({
      label, actualModel: answer?.actualModel ?? null, status: validGrade ? 'scored' : answer ? 'answered_unscored' : 'missing',
      answer: answer ? safe({ text: answer.text, completedAt: answer.completedAt, latencyMs: answer.latencyMs }) : null,
      grade: validGrade ? safe({ points: grade.points, maxPoints: grade.maxPoints, percentage: grade.percentage, groups: grade.groups, warnings: grade.warnings ?? [], judgeModel: grade.actualJudgeModel ?? grade.judgeModel, judgedAt: grade.judgedAt, selfJudged: grade.selfJudged ?? label === 'seed-2.1-pro' }) : null,
    });
  }
  await write(path.join(root, 'content/evaluations/plawbench', `${record.id}.json`), { id: record.id, comparisonId: comparison.comparison.comparisonId, models });
}
const readme = await fs.readFile(path.join(root, 'content/datasets/plawbench/source/README.md'), 'utf8');
const leaderboard = [];
for (const line of readme.split('\n')) {
  if (!line.startsWith('|') || !/^\|\s*(Claude|DeepSeek|Doubao|Ernie|Gemini|GLM|GPT|Grok|Kimi|Qwen)\s*\|/.test(line)) continue;
  const columns = line.split('|').slice(1, -1).map(v => v.trim().replaceAll('**', ''));
  leaderboard.push({ family: columns[0], model: columns[1], overall: Number(columns[2]), caseAverage: Number(columns[3]), consultation: Number(columns[8]), documentAverage: Number(columns[9]) });
}
let commit = comparison.comparison.commit;
try { commit = execFileSync('git', ['-C', path.join(workspace, 'PLawBench'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
await write(path.join(root, 'content/datasets/plawbench.json'), {
  meta: { name: 'PLawBench', snapshotDate: '2026-11-10', repository: 'https://github.com/SKYLENAGE-AI/PLawBench', commit, total: records.length, taskTypes, sourceHashes,
    referenceAnswerNote: '公开快照没有独立参考答案字段。rubric 含参考结论和依据，但不等于单独核验过的标准答案。',
    licenseStatus: 'unresolved', role: 'public_benchmark_unassigned', paperTotal: 850,
    rubricGroups: records.filter(r => r.type === 'case').reduce((n, r) => n + r.rubrics.length, 0),
    labels: [...new Set(records.filter(r => r.type === 'case').map(r => r.label))],
  }, records,
});
await write(path.join(root, 'content/evaluations/summary.json'), {
  comparisonId: comparison.comparison.comparisonId, updatedAt: comparison.comparison.updatedAt, promptVersion: comparison.comparison.promptVersion,
  source: 'local_experiment_snapshot', judge: 'doubao-seed-2-1-pro-260628', selfJudgeWarning: true, expected: 280,
  models: comparison.models.map(m => ({ label: m.label, actualModel: m.actualModel, answered: m.answered, scored: m.scored, failed: m.failed, aggregate: safe(m.aggregate) })),
  paired: { evaluated: comparison.paired.evaluated, complete: comparison.paired.complete, models: labels.map(label => ({ label, aggregate: safe(comparison.paired.byModel[label]) })) },
  officialLeaderboard: leaderboard, officialLeaderboardSource: 'https://github.com/SKYLENAGE-AI/PLawBench/blob/' + commit + '/README.md',
  notes: ['本地实验未完成全部评分；未评分不计为零分。', '同题共同已评分子集用于模型比较，与各模型自己的已评分样本汇总不同。', 'seed-2.1-pro 也是裁判模型，存在自评/家族偏差。', '评分表示 rubric 对齐，不等于专家认证的法律正确性。', '上游 README 榜单的样本范围和口径与本地 280 题实验不同，不可直接横向比较。'],
});
const originalRoot = path.join(workspace, 'legal-synthesis-pilot/01-source/shanghai-2023-23060');
const manifest = await read(path.join(originalRoot, 'source_manifest.json'));
const sourceText = await fs.readFile(path.join(originalRoot, 'judgment.extracted.txt'), 'utf8');
const lines = sourceText.trimEnd().split('\n');
const redactions = [];
const paragraphs = lines.map((text, index) => {
  const original = text;
  if (index === 3) text = '原告：马某。';
  if (index === 4) text = '被告：皮某。';
  text = text.replace(/（X+9272）/g, '（账户已脱敏）').replace(/尾号为5759/g, '账户信息已脱敏').replace(/尾号9272/g, '账户信息已脱敏');
  if ([26, 27, 28, 29].includes(index)) text = index === 26 ? '审判员及书记员署名已省略' : '';
  if (text !== original) redactions.push({ sourceLine: index + 1, transform: 'Omit unnecessary personal identity/account suffix/judicial staff identifiers', originalTextHash: hash(original) });
  return { id: `p-${String(index + 1).padStart(3, '0')}`, sourceLine: index + 1, text, section: index < 6 ? '文书与程序' : index < 9 ? '诉讼请求与证据' : index < 18 ? '法院查明事实' : index < 22 ? '裁判理由' : '裁判结果与落款' };
}).filter(p => p.text);
await write(path.join(root, 'content/cases/shanghai-2023-23060.json'), {
  id: manifest.canonical_case_id, title: manifest.title, caseNumber: manifest.case_number, court: manifest.court, date: manifest.document_date,
  sourceUrl: manifest.source_url, retrievedAt: manifest.retrieved_at, sourceTextSha256: manifest.text_sha256, rawSha256: manifest.raw_sha256,
  viewSha256: hash(JSON.stringify(paragraphs)), paragraphs, redactions,
  status: 'acquired_not_normalized', permissionStatus: 'unresolved', appealStatus: 'unresolved', evidenceExhibitsObtained: false,
  note: '本页为明确标记的脱敏展示视图，不冒充逐字原件；原件保存在 private-source（不进入 Git/发布包）。公开文书并非完整卷宗。',
});
const skill = await fs.readFile(path.join(root, 'content/skills/1.1.0/SKILL.md'), 'utf8');
await write(path.join(root, 'content/skills/index.json'), {
  versions: [{ version: '1.1.0', title: '材料标准化与 Few-Shot 难度控制', createdAt: '2026-11-14T16:00:00+08:00', importedAt: new Date().toISOString(), author: '工作区已有 Skill', note: '首个可追溯快照。保存当前真实内容，未伪造不存在的历史版本。1.1.0 为本站快照版本号，不是上游官方版本。', parent: null, sha256: hash(skill), schemaVersion: '1.1', materialPackVersion: '1.0' }],
});
console.log(`Imported ${records.length} questions, ${leaderboard.length} published model rows, 560 model answers, one case and one skill snapshot. No model API called.`);
