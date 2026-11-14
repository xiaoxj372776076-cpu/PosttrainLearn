export const USAGES = ['unassigned', 'candidate', 'approved', 'holdout'];
export const PATTERNS = ['rule_application', 'multi_condition_application', 'exception_check', 'evidence_comparison', 'temporal_applicability', 'amount_classification', 'multi_issue_composition', 'arithmetic_computation', 'information_extraction'];

export function validateReview(input, previous = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('审核内容必须是对象');
  const usage = input.usage ?? 'unassigned';
  if (!USAGES.includes(usage)) throw new Error('未知样本用途');
  if (previous.usage === 'holdout' && ['candidate', 'approved'].includes(usage)) {
    throw new Error('保留评测题不能直接成为种子。请先明确解除保留用途，再单独审核；使用后不能声称是未见评测。');
  }
  if (previous.everUsedForDevelopment && usage === 'holdout') throw new Error('已进入开发或种子池的题不能重新标为未见保留评测');
  const string = (key, max) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new Error(`${key} 格式或长度不合法`);
    return value.trim();
  };
  const patterns = input.patterns ?? [];
  if (!Array.isArray(patterns) || patterns.some(p => !PATTERNS.includes(p)) || new Set(patterns).size !== patterns.length) throw new Error('推理结构标签不合法');
  const difficulty = input.difficulty ?? 'D3';
  if (!['D1', 'D2', 'D3', 'D4'].includes(difficulty)) throw new Error('难度必须为 D1-D4');
  const review = {
    usage, expert: string('expert', 120), note: string('note', 8000), answer: string('answer', 30000),
    rationale: string('rationale', 12000), permissionBasis: string('permissionBasis', 2000),
    skillVersion: string('skillVersion', 20),
    difficulty, patterns, permissionConfirmed: input.permissionConfirmed === true,
    answerVerified: input.answerVerified === true,
    everUsedForDevelopment: Boolean(previous.everUsedForDevelopment || ['candidate', 'approved'].includes(usage)),
  };
  if (usage === 'approved') {
    if (!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(review.skillVersion)) throw new Error('批准种子需关联审核时的 Skill 版本');
    if (!review.expert || !review.note || !review.answer || !review.rationale || !review.patterns.length) throw new Error('批准种子需填写专家标识、审核说明、核验答案、依据说明和推理结构');
    if (!review.permissionConfirmed || !review.permissionBasis || !review.answerVerified) throw new Error('批准种子需确认答案已核验，并记录材料使用依据');
    const nontrivial = review.patterns.some(p => !['information_extraction', 'rule_application', 'arithmetic_computation'].includes(p));
    if (['D3', 'D4'].includes(difficulty) && (!nontrivial || patterns.length < (difficulty === 'D4' ? 3 : 2))) throw new Error('D3/D4 需足够的不同必要推理操作，且含非直接查找结构；标签本身仍不证明真实难度');
  }
  return review;
}

export function compareLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length * b.length > 3000000) return [...a.map(text => ({ kind: 'removed', text })), ...b.map(text => ({ kind: 'added', text }))];
  const rows = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const result = [];
  let i = 0; let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ kind: 'same', text: a[i++] }); j++; }
    else if (i < a.length && (j === b.length || rows[i + 1][j] >= rows[i][j + 1])) result.push({ kind: 'removed', text: a[i++] });
    else result.push({ kind: 'added', text: b[j++] });
  }
  return result;
}

export function seedExport(records, reviews, skillVersion) {
  return records.filter(record => reviews[record.id]?.usage === 'approved').map(record => {
    const review = validateReview(reviews[record.id]);
    return {
      seed_id: `plawbench-${record.id}`, role: 'development', origin_role: 'public_benchmark',
      source_record_id: record.id, source: record.source, question: record.question,
      question_origin: record.questionOrigin ?? 'not_recorded', context: record.context,
      answer: review.answer, rationale: review.rationale, reasoning_patterns: review.patterns,
      difficulty_level: review.difficulty, difficulty_basis: review.note,
      permission_basis: review.permissionBasis, expert_id: review.expert,
      reviewed_at: review.updatedAt ?? reviews[record.id].updatedAt,
      skill_version: review.skillVersion, exported_with_skill_version: skillVersion,
      legal_quality: 'user_recorded_expert_review_not_independently_certified',
      excluded_from_unseen_evaluation: true,
    };
  });
}
