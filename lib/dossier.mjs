import { createHash } from 'node:crypto';

export const DOSSIER_SECTIONS = {
  proceedings: '程序链', documents: '材料清单', participants: '主体与关系', events: '事实与程序时间线',
  claims: '诉请沿革', fact_propositions: '事实命题', assertions: '各方陈述', evidence_items: '证据与证明目的',
  evidence_responses: '举证质证记录', court_assessments: '各程序法院认定', issues: '争点卡',
  amount_ledger: '金额与交易台账', authorities: '引称法律与版本状态', decisions: '裁判及履行条件',
};
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const cents = value => {
  if (!/^\d+\.\d{2}$/.test(value)) throw new Error(`人民币金额必须精确到分：${value}`);
  return BigInt(value.replace('.', ''));
};

// Implements the keywords used by our checked-in schema, not a general JSON Schema engine.
export function validateSchema(value, schema, root = schema, at = '$') {
  if (schema.$ref) return validateSchema(value, schema.$ref.split('/').slice(1).reduce((node, key) => node[key], root), root, at);
  if ('const' in schema && value !== schema.const) throw new Error(`${at}: const 不匹配`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${at}: enum 不匹配`);
  if (schema.type) {
    const valid = schema.type === 'array' ? Array.isArray(value) : schema.type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : typeof value === schema.type;
    if (!valid) throw new Error(`${at}: 需要 ${schema.type}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) throw new Error(`${at}: 字符串过短`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error(`${at}: 格式不匹配`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) throw new Error(`${at}: 数组项不足`);
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) throw new Error(`${at}: 重复数组项`);
    if (schema.items) value.forEach((item, i) => validateSchema(item, schema.items, root, `${at}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) throw new Error(`${at}: 缺少 ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) validateSchema(child, schema.properties[key], root, `${at}.${key}`);
      else if (schema.additionalProperties === false) throw new Error(`${at}: 未知字段 ${key}`);
    }
  }
}

const references = {
  proceeding_id: 'proceedings', related_proceeding_id: 'proceedings', document_id: 'documents',
  actor_id: 'participants', from_id: 'participants', to_id: 'participants', obligor_id: 'participants', beneficiary_id: 'participants', submitted_by: 'participants',
  support_span_ids: 'source_spans', claim_ids: 'claims', supersedes: 'claims', fact_ids: 'fact_propositions',
  assertion_ids: 'assertions', evidence_ids: 'evidence_items', assessment_ids: 'court_assessments',
  authority_ids: 'authorities', amount_ids: 'amount_ledger', components: 'amount_ledger', decision_ids: 'decisions',
};

export function validateDossier(dossier, schema, source) {
  validateSchema(dossier, schema);
  const maps = {};
  const allIds = new Set();
  for (const key of [...Object.keys(DOSSIER_SECTIONS), 'source_spans', 'gaps']) {
    maps[key] = new Map();
    for (const record of key === 'gaps' ? dossier.gaps_and_review.gaps : dossier[key]) {
      if (!record.id || allIds.has(record.id)) throw new Error(`记录 ID 缺失或重复：${record.id}`);
      allIds.add(record.id); maps[key].set(record.id, record);
    }
  }
  const walk = (value, path) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (references[key]) {
        for (const id of Array.isArray(child) ? child : child === null ? [] : [child]) {
          if (!maps[references[key]].has(id)) throw new Error(`${path}.${key}: 悬空或错类型引用 ${id}`);
        }
      } else if (child && typeof child === 'object') walk(child, `${path}.${key}`);
    }
  };
  walk(dossier, '$');
  for (const document of dossier.documents) {
    if (document.acquisition !== 'original_obtained' && document.original_obtained) throw new Error('转述或展示视图不能声明取得原件');
  }
  for (const item of dossier.evidence_items) {
    if (item.original_obtained && !maps.documents.get(item.document_id).original_obtained) throw new Error('证据原件状态与文档不一致');
  }
  for (const issue of dossier.issues) for (const field of ['assessment_ids', 'decision_ids']) {
    for (const id of issue[field] ?? []) if (maps[references[field]].get(id).proceeding_id !== issue.proceeding_id) throw new Error('争点绑定了其他程序的认定或裁判');
  }
  if (dossier.case_metadata.expert_review_status !== 'not_reviewed' && !dossier.gaps_and_review.reviews.length) throw new Error('不能在没有审核记录时声明专家审查');
  if (dossier.case_metadata.training_readiness === 'eligible_for_unit_review' && (dossier.case_metadata.permission_status !== 'verified' || dossier.authorities.some(a => a.version_status !== 'verified'))) throw new Error('训练准入的权限或法律版本未核验');
  const leafIds = (id, trail = new Set()) => {
    if (trail.has(id)) throw new Error('金额计算关系成环');
    const item = maps.amount_ledger.get(id); const next = new Set([...trail, id]);
    if (!item.components?.length) return [id];
    return item.components.flatMap(child => leafIds(child, next));
  };
  for (const item of dossier.amount_ledger) if (item.currency === 'CNY') {
    cents(item.value);
    if (item.components?.length) {
      const leaves = leafIds(item.id);
      if (new Set(leaves).size !== leaves.length) throw new Error('金额汇总重复计入同一笔款项');
      const sum = item.components.reduce((total, id) => {
        const operand = maps.amount_ledger.get(id);
        if (operand.currency !== 'CNY') throw new Error('不能混合币种或利率求和');
        return total + cents(operand.value);
      }, 0n);
      if (sum !== cents(item.value)) throw new Error(`金额公式不一致：${item.id}`);
    }
  }
  if (source) {
    if (dossier.case_metadata.case_id !== source.id) throw new Error('案件身份与来源不一致');
    if (sha256(JSON.stringify(source.paragraphs)) !== source.viewSha256) throw new Error('源展示视图指纹不一致');
    const paragraphs = new Map(source.paragraphs.map(p => [p.id, p]));
    for (const span of dossier.source_spans) {
      const paragraph = paragraphs.get(span.locator.paragraph_id);
      if (span.document_id !== 'doc-judgment' || !paragraph || paragraph.text !== span.quote || paragraph.sourceLine !== span.locator.source_line || span.id !== `doc-judgment:${paragraph.id}` || span.text_version !== 'redacted-view-1' || span.view_sha256 !== source.viewSha256) throw new Error('来源片段未与冻结原文对齐');
    }
    const document = maps.documents.get('doc-judgment');
    if (dossier.source_spans.length !== source.paragraphs.length || JSON.stringify(document?.paragraphs) !== JSON.stringify(source.paragraphs) || document.view_sha256 !== source.viewSha256) throw new Error('全文附录不完整或被改写');
  }
  return { records: allIds.size, sourceSpans: dossier.source_spans.length, formulas: dossier.amount_ledger.filter(a => a.components?.length).length };
}

export function buildDossier(extraction, source, schema) {
  if (extraction.case_metadata.case_id !== source.id) throw new Error('案件身份与来源不一致');
  const dossier = structuredClone(extraction);
  const prefix = 'doc-judgment:';
  const convert = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'support_span_ids') value[key] = child.map(id => id.startsWith(prefix) ? id : prefix + id);
      else if (child && typeof child === 'object') convert(child);
    }
  };
  convert(dossier);
  Object.assign(dossier.documents[0], {
    source_url: source.sourceUrl, source_text_sha256: source.sourceTextSha256, raw_sha256: source.rawSha256,
    view_sha256: source.viewSha256, paragraphs: source.paragraphs, redaction_count: source.redactions.length,
  });
  dossier.source_spans = source.paragraphs.map(p => ({ id: prefix + p.id, document_id: 'doc-judgment', text_version: 'redacted-view-1', locator: { paragraph_id: p.id, source_line: p.sourceLine }, quote: p.text, view_sha256: source.viewSha256 }));
  const summary = validateDossier(dossier, schema, source);
  dossier.gaps_and_review.checks = [
    { name: 'schema_and_typed_references', status: 'pass', method: 'local_structural_validator', detail: `${summary.records} 个记录 ID 与引用已检查；不验证法律真值。` },
    { name: 'source_alignment', status: 'pass', method: 'frozen_redacted_view_exact_match', detail: `${summary.sourceSpans} 个片段与展示视图逐字比对；不认证原件真实性。` },
    { name: 'amount_formulas', status: 'pass', method: 'BigInt_fixed_point_cents', detail: `${summary.formulas} 条汇总公式精确到分且无重复计入。` },
    { name: 'source_net_interest_conflict', status: 'needs_review', method: 'source_arithmetic_comparison', detail: '42000.00 - 22100.00 = 19900.00，与原告自述21900.00不同，保留差异。' },
    { name: 'legal_validity_and_permission', status: 'unresolved', method: 'not_performed', detail: '适用法律版本、权限和专家审核未完成，训练准入阻断。' },
  ];
  return dossier;
}

export function renderCasebook(dossier) {
  const lines = [`# ${dossier.case_metadata.title}`, '', `Schema ${dossier.schema_version} · 案件包 ${dossier.dossier_version}`, '', dossier.case_metadata.scope, '', dossier.case_metadata.summary, '', '## 案件元数据', '', '```json', JSON.stringify(dossier.case_metadata, null, 2), '```', ''];
  for (const [key, title] of Object.entries(DOSSIER_SECTIONS)) {
    lines.push(`## ${title}`, '');
    if (!dossier[key].length) lines.push('未取得或未形成记录，具体原因见缺口，不推断为未发生。', '');
    for (const record of dossier[key]) {
      lines.push(`### ${record.id} ${record.title}`, '', record.text ?? '取得范围见文档元数据。', '');
      const { title: ignoredTitle, text: ignoredText, paragraphs, ...details } = record;
      lines.push('```json', JSON.stringify(details, null, 2), '```', '');
    }
  }
  lines.push('## 缺口及实际检查', '', '```json', JSON.stringify(dossier.gaps_and_review, null, 2), '```', '', '## 已取得材料全文附录', '', '以下为保留原行号的脱敏展示视图，不是签章原件。', '');
  for (const span of dossier.source_spans) lines.push(`### ${span.id}`, '', span.quote, '');
  return lines.join('\n') + '\n';
}
