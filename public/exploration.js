import { escapeHtml as e, markdown } from './utils.js';
import { renderRun } from './run-explorer.js';
import { renderHardness } from './hardness-explorer.js';
import { renderBenchmark } from './benchmark-explorer.js';

const tabs = [
  ['overview', '案件概览', []], ['timeline', '程序与时间线', ['proceedings', 'events']],
  ['parties', '主体与诉请', ['participants', 'claims']], ['evidence', '材料与证据', ['documents', 'evidence_items', 'evidence_responses']],
  ['facts', '陈述与认定', ['fact_propositions', 'assertions', 'court_assessments']], ['issues', '争点卡', ['issues']],
  ['amounts', '金额台账', ['amount_ledger']], ['decisions', '法律与裁判', ['authorities', 'decisions']],
  ['gaps', '缺口与检查', []], ['source', '原文全文', []], ['schema', 'Schema 规范', []], ['json', '完整 JSON', []],
];
const names = { proceedings: '程序链', documents: '材料清单', participants: '主体与角色', events: '事实与程序双时间线', claims: '诉请沿革', fact_propositions: '待判断的事实命题', assertions: '当事人陈述', evidence_items: '证据及证明目的', evidence_responses: '举证质证', court_assessments: '一审法院查明与认定', issues: '整理者归纳的争点卡', amount_ledger: '金额与利率对象', authorities: '原文引称的法律', decisions: '裁判事项与条件' };
const labels = { proceeding_id: '所属程序', actor_id: '主体', status: '记录状态', kind: '类型', origin: '归纳来源', attribution: '表述归属', acquisition: '取得范围', original_obtained: '原件取得', submitted_by: '提交者（上下文归纳）', proof_purpose_origin: '证明目的来源', stance: '陈述状态', role: '金额角色', ledger_kind: '台账类型', effective_status: '生效状态', version_status: '版本核验', court_conclusion: '一审结论', from_id: '付款方', to_id: '收款方', date_start: '日期', date_end: '区间结束', date_precision: '日期精度', version: '诉请版本', assessment_scope: '认定范围' };
const values = { not_available: '未取得', unresolved: '待核 / 未知', not_mentioned: '原文未提及', superseded: '后版本替代', not_carried_forward: '变更后未列入', last_recorded: '最后记载版本', published_judgment_view: '已取得：公开判决展示视图', judgment_reference: '仅被判决书提及', original_obtained: '原件已取得', analyst_inferred: '整理者归纳，未独立核验', analyst_organized_court_reasoning: '整理者组织裁判理由', asserted: '当事人主张', asserted_unverified: '当事人自述，待核', collective_statement_only: '整体确认，非逐项采信', fact: '事实事件', procedure: '程序事件', day: '日', range: '区间', bank_disbursement: '银行放贷', contract_face: '合同记载', claimed_principal: '诉请本金', claimed_interest: '诉请利息', claimed_penalty: '诉请违约金', actual_transfer: '实际交付', prepaid_interest: '预扣利息', claimed_net_interest: '自述净利息', court_return: '法院返还', fee: '费用', rate: '利率', transaction: '交易', aggregate: '汇总', contract: '合同', claim: '请求', assessment: '认定金额', judgment_order: '判决主文', conditional_order: '条件性事项', cost_order: '费用负担', remedy_notice: '救济权利告知', civil_first_instance: '一审民事', not_reviewed: '未审核' };
const amount = item => item.currency === 'CNY' ? `${Number(item.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元` : `${item.value}%${item.unit?.endsWith('/day') ? ' / 天' : ' / 年'}`;

export function createExplorer({ main, api, heading, icon, tag, notice, dialog, closeButton }) {
  let pipeline; let dossier; let schema; let stageId = 'dossier'; let tabId = 'overview'; let index;
  const sourceButtons = ids => ids?.length ? `<div class="source-links"><span>来源</span>${ids.map(id => `<button data-action="explore-source" data-id="${e(id)}" title="查看冻结原文 ${e(id)}">${e(id.replace('doc-judgment:', ''))}${icon('arrow')}</button>`).join('')}</div>` : '<div class="source-links"><span>无来源片段：研究范围或待核缺口说明</span></div>';
  const translation = value => typeof value === 'boolean' ? value ? '已取得' : '未取得' : values[value] ?? index.get(value)?.title ?? String(value);
  function records(key) {
    let items = dossier[key];
    if (key === 'events') items = [...items].sort((a, b) => (a.date_start ?? '9999').localeCompare(b.date_start ?? '9999'));
    const caveat = key === 'evidence_items' ? '提交者、证明目的与证据—事实关联由整理者依据文书上下文归纳；未取得证据原件或逐项采信笔录。' : key === 'fact_propositions' ? '这里记录需要判断什么，不宣告真假，也不是已生成训练题。' : key === 'authorities' ? '只保留原裁判引称；以下条号、适用版本与全文尚未独立核验，不是现行法金标。' : key === 'events' ? '按已知日期展示；未知日期单列，不借排序补造时间。事实发生时点不等于材料可获得时点。' : null;
    return `<section class="dossier-section"><div class="dossier-section-heading"><h3>${names[key]}</h3>${tag(`${items.length} 项`)}</div>${caveat ? `<p class="section-caveat">${caveat}</p>` : ''}${items.length ? `<div class="dossier-records ${key === 'events' ? 'timeline-records' : ''}">${items.map(item => record(item, key)).join('')}</div>` : `<div class="stage-empty"><h4>未取得完整质证记录</h4><p>判决书只有整体证据确认语句。空数组不表示无异议，也不表示被告默认自认。</p></div>`}</section>`;
  }
  function record(item, key) {
    const details = Object.fromEntries(Object.entries(item).filter(([field]) => !['text', 'title', 'paragraphs'].includes(field)));
    const metadata = Object.entries(item).filter(([field, value]) => labels[field] && !['court_conclusion'].includes(field) && value !== null && !Array.isArray(value));
    return `<article class="dossier-record ${key === 'amount_ledger' ? 'amount-record' : ''}"><div class="record-heading"><div><code>${e(item.id)}</code><h4>${e(item.title)}</h4></div>${key === 'amount_ledger' ? `<b class="ledger-value">${amount(item)}</b>` : ''}</div>${item.text ? `<p>${e(item.text)}</p>` : '<p>取得范围、时间与文档版本见字段记录。</p>'}${metadata.length ? `<dl class="record-attributes">${metadata.map(([field, value]) => `<div><dt>${labels[field]}</dt><dd>${e(translation(value))}</dd></div>`).join('')}</dl>` : ''}${item.court_conclusion ? `<div class="conclusion-box"><span>一审结论</span>${e(item.court_conclusion)}</div>` : ''}${item.components?.length ? `<div class="calculation-box"><span>组成公式</span>${item.components.map(id => `<span>${e(index.get(id).title)} <b>${amount(index.get(id))}</b></span>`).join('<i>+</i>')}<i>=</i><b>${amount(item)}</b></div>` : ''}${item.open_questions?.length ? `<ul class="record-open-questions">${item.open_questions.map(q => `<li>${e(q)}</li>`).join('')}</ul>` : ''}${sourceButtons(item.support_span_ids)}<details class="record-fields"><summary>完整字段与关联 ID</summary><pre>${e(JSON.stringify(details, null, 2))}</pre></details></article>`;
  }
  function overview() {
    const meta = dossier.case_metadata;
    const first = dossier.proceedings[0];
    return `<section class="dossier-overview"><div class="dossier-title"><span class="eyebrow">CASE DOSSIER / 001</span><h3>马某与皮某民间借贷纠纷</h3><p>${e(first.case_number)} · ${e(first.court)} · ${e(first.decision_at)}</p><div class="dossier-badges">${tag('归档：partial', 'teal')}${tag('训练：blocked', 'amber')}${tag('专家：未审核')}</div></div><p class="dossier-summary">${e(meta.summary)}</p><div class="dossier-metrics">${[['程序', dossier.proceedings.length], ['证据类别（非原件）', dossier.evidence_items.length], ['研究争点', dossier.issues.length], ['材料与核验缺口', dossier.gaps_and_review.gaps.length]].map(([title, n]) => `<div><b>${String(n).padStart(2, '0')}</b><span>${title}</span></div>`).join('')}</div><div class="money-story"><div class="eyebrow">SAME CASE, DIFFERENT MONEY ROLES</div><h4>记载的 54.40 万元，不等于实际交付。</h4><div class="money-role-grid">${['amt-face', 'amt-first', 'amt-later', 'amt-total'].map(id => { const item = index.get(id); return `<div><span>${e(item.title)}</span><b>${amount(item)}</b>${sourceButtons(item.support_span_ids.slice(0, 1))}</div>`; }).join('')}</div><p>返还金额按首次交付与追加交付汇总。银行贷款、借条记载、诉请金额保留独立角色；同一实际转账的重复叙述不另计一笔。</p><button class="text-button" data-action="explore-tab" data-tab="amounts">查看全部金额及公式 ${icon('arrow')}</button></div>${notice('原文净利息自述存在差异：42,000 − 22,100 = 19,900 元，而原告自述为 21,900 元。保留为待核问题，不自行纠正文书。', 'amber')}<div class="reading-path"><h4>一条可以逐项核验的案件脉络</h4>${[['parties','01','谁主张什么','两版诉请分别保存'], ['evidence','02','用什么材料支持','提及证据与取得原件分开'], ['facts','03','法院如何认定','当事人说法与裁判分开'], ['issues','04','形成哪些判断点','争点绑定事实与来源']].map(([id, n, title, text]) => `<button data-action="explore-tab" data-tab="${id}"><span>${n}</span><b>${title}</b><small>${text}</small>${icon('arrow')}</button>`).join('')}</div><div class="scope-box"><h4>本案取得边界</h4><p>${e(meta.scope)}。</p><p>${e(meta.inference_notes)}</p><p>没有起诉状、证据原件、完整庭审笔录和后续程序材料；上诉、生效和履行状态未知。不能把它当成完整卷宗，也不能还原真实庭前知识状态。</p></div></section>`;
  }
  function dossierBody() {
    if (tabId === 'overview') return overview();
    if (tabId === 'gaps') return `<section class="dossier-section"><div class="dossier-section-heading"><h3>缺口清单与实际检查</h3>${tag('专家审核 0 项', 'amber')}</div><p class="section-caveat">结构、引用与计算检查不证明证据真实性、法律正确性或训练许可。</p><div class="check-list">${dossier.gaps_and_review.checks.map(c => `<div><span class="check-marker ${c.status === 'pass' ? 'pass' : ''}">${icon(c.status === 'pass' ? 'check' : 'flag')}</span><div><code>${e(c.name)}</code><p>${e(c.detail)}</p><small>${e(c.method)}</small></div>${tag(c.status === 'pass' ? '结构检查通过' : c.status === 'needs_review' ? '待复核' : '未解决', c.status === 'pass' ? 'teal' : 'amber')}</div>`).join('')}</div>${dossier.gaps_and_review.gaps.map(item => record(item, 'gaps')).join('')}</section>`;
    if (tabId === 'source') return `<section class="dossier-section"><h3>已取得材料全文</h3><p class="section-caveat">冻结的脱敏展示视图，保留原行号；省略身份信息后的 p-027 至 p-031 间隔不是漏页。</p>${dossier.source_spans.map(span => `<article class="source-full"><button data-action="explore-source" data-id="${e(span.id)}">${e(span.id)}</button><p>${e(span.quote)}</p></article>`).join('')}</section>`;
    if (tabId === 'schema') return `<article class="prose schema-guide">${markdown(schema.guide)}</article><details class="record-fields"><summary>机器可读 JSON Schema 0.1</summary><pre>${e(JSON.stringify(schema.schema, null, 2))}</pre></details><p class="section-caveat">${e(schema.note)}</p><a class="button small" href="/api/export/dossier-schema" download>下载 JSON Schema ${icon('download')}</a>`;
    if (tabId === 'json') return `<section class="dossier-section"><h3>唯一结构化底稿</h3><p class="section-caveat">包含所有模块、关联 ID、检查结果与已取得脱敏原文。网页和 Markdown 从同一 JSON 生成。</p><pre class="dossier-json">${e(JSON.stringify(dossier, null, 2))}</pre></section>`;
    return tabs.find(t => t[0] === tabId)[2].map(records).join('');
  }
  function dossierPanel() {
    return `<div class="dossier-toolbar"><div>${tag(`案件包 v${dossier.dossier_version}`, 'blue')}${tag(`Schema ${dossier.schema_version}`)}</div><div><a href="/api/export/dossier" download>${icon('download')} JSON</a><a href="/api/export/casebook" download>${icon('download')} 全文整理稿</a></div></div><div class="dossier-tabs" role="group" aria-label="案件全景视图">${tabs.map(([id, title]) => `<button data-action="explore-tab" data-tab="${id}" aria-pressed="${tabId === id}" class="${tabId === id ? 'active' : ''}">${title}</button>`).join('')}</div><div class="dossier-body">${dossierBody()}</div>`;
  }
  function stageBody(stage) {
    if (stage.id === 'dossier') return dossierPanel();
    if (stage.id === 'source') return `<div class="stage-body"><div class="dossier-section-heading"><h3>真实来源快照</h3>${tag('非完整卷宗', 'amber')}</div>${records('documents')}<div class="stage-resource-actions"><a class="button" href="#cases">阅读脱敏原文 ${icon('book')}</a><button class="button primary" data-action="explore-stage" data-stage="dossier">查看案件整理结果 ${icon('arrow')}</button></div></div>`;
    if (stage.id === 'units') return `<div class="stage-body">${notice('以下仅为案件整理阶段归纳的研究候选，不是已批准 decision_unit。下一步先核验任务边界、法条版本与材料包映射。', 'amber')}${records('issues')}</div>`;
    if (stage.id === 'seeds') return `<div class="stage-body"><div class="seed-position"><span>原始材料 → 整理 → 判断点</span><b>种子匹配 / Few-Shot</b><span>→ 候选问题生成</span></div><div class="dossier-metrics"><div><b>${pipeline.seedBank.total}</b><span>公开评测题目</span></div><div><b>${pipeline.seedBank.candidates}</b><span>开发种子候选</span></div><div><b>${pipeline.seedBank.approved}</b><span>记录为专家批准</span></div><div><b>0</b><span>本案选择日志</span></div></div>${notice('种子用于 P2 示范题型与必要推理结构，不用于 P0 整理事实，也不把种子的法律答案迁移到本案。模型评分高不等于种子已核验。')}${pipeline.seedBank.records.length ? `<div class="seed-bank-list">${pipeline.seedBank.records.map(r => `<button data-action="open-record" data-id="${r.id}"><code>${e(r.id)}</code><span>${e(r.title)}</span>${tag(r.usage === 'approved' ? '记录为批准' : '待审候选', r.usage === 'approved' ? 'teal' : 'amber')}${icon('arrow')}</button>`).join('')}</div>` : '<div class="stage-empty"><h4>还没有已审核的开发种子</h4><p>先到评测与种子管理中选择、核验，再记录本案的匹配理由与 few_shot_run_id。当前没有实际使用任何 benchmark 题。</p></div>'}<div class="stage-resource-actions"><a class="button primary" href="#benchmarks">进入评测与种子管理 ${icon('arrow')}</a><a class="button" href="/api/export/seeds" download>导出批准种子 ${icon('download')}</a></div><details class="stage-prompt"><summary>查看 Skill v${pipeline.skill_version} 的种子与难度规则</summary><article class="prose">${markdown(pipeline.fewShotGuide)}</article></details></div>`;
    return `<div class="stage-body"><div class="stage-empty"><span class="empty-stage-code">${e(stage.code)}</span><h3>${stage.optional ? '本轮未启用此分支' : '本阶段尚未执行'}</h3><p>当前只有案件整理稿和研究争点。没有本案模型调用、生成答案、盲答或专家验收结果。</p><span>${tag('模型调用 0 次')}${tag('训练样本 0 条')}</span></div><div class="next-review"><h4>执行前需要确认</h4><p>${e(stage.gate)}</p><button class="text-button" data-action="feedback">记录本阶段的标准建议 ${icon('people')}</button></div></div>`;
  }
  function paint() {
    const stage = pipeline.stages.find(s => s.id === stageId);
    main.innerHTML = `<div class="content-wrap exploration-wrap">${heading('TRACE THE SYNTHESIS / CASE STUDY 001', '合成链路探索', '从一份真实材料出发，逐阶段观察产物、依据与门槛。先把整理做对，再研究如何生成有价值的问题。', `<a class="button" href="/api/export/casebook" download>${icon('download')}下载案件整理稿</a>`)}<div class="exploration-banner"><div><span class="eyebrow">CURRENT RESEARCH SNAPSHOT</span><p>一审判决书 → 案件包 v${dossier.dossier_version} → ${dossier.issues.length} 张研究争点卡</p></div><div>${tag(`Skill v${pipeline.skill_version}`, 'blue')}${tag(`链路 v${pipeline.version}`)}${tag('训练样本 0 条', 'amber')}</div></div><div class="exploration-layout"><aside class="pipeline-sidebar panel"><div class="sidebar-heading">SYNTHESIS STAGES <span>${pipeline.stages.length}</span></div><div class="pipeline-stage-list">${pipeline.stages.map(s => `<button class="pipeline-stage ${s.id === stageId ? 'selected' : ''} ${s.optional ? 'optional-stage' : ''}" data-action="explore-stage" data-stage="${s.id}" aria-current="${s.id === stageId ? 'step' : 'false'}"><span class="stage-code ${s.status}">${e(s.code)}</span><span class="stage-label"><b>${e(s.title)}</b><small>${e(s.label)}</small></span>${icon('arrow')}</button>`).join('')}</div><p class="pipeline-footnote">状态来自实际归档与审核记录。模板不等于运行日志，结构通过不等于法律金标。</p></aside><section class="stage-workspace panel"><header class="stage-heading"><div class="stage-heading-top"><span class="eyebrow">STAGE ${e(stage.code)}</span>${tag(stage.label, ['partial', 'draft', 'needs_review'].includes(stage.status) ? 'amber' : '')}</div><h2>${e(stage.title)}</h2><p>${e(stage.subtitle)}</p><div class="stage-artifacts">${stage.artifacts.map(a => `<span>${icon(stage.status === 'not_run' || stage.status === 'optional' ? 'clock' : 'file')}${e(a)}</span>`).join('')}</div></header><details class="stage-contract" ${stage.id === 'dossier' ? '' : 'open'}><summary>本阶段的输入、输出与准入门槛</summary><dl><div><dt>输入</dt><dd>${e(stage.input)}</dd></div><div><dt>输出契约</dt><dd>${e(stage.output)}</dd></div><div><dt>准入门槛</dt><dd>${e(stage.gate)}</dd></div></dl></details>${stageBody(stage)}${stage.prompt ? `<details class="stage-prompt"><summary>查看本阶段提示词 · Skill v${pipeline.skill_version}</summary>${stage.id === 'dossier' ? notice('此处保留 Skill v1.1.0 原始 P0 material_pack 模板。本次整案整理额外使用 Case Dossier Schema 0.1；未改写旧 Skill，也未把试填标为 ready。') : ''}<article class="prose">${markdown(stage.prompt)}</article></details>` : ''}<div class="stage-footer"><span>案件与 Schema 独立版本 · 本轮不自动调用模型</span><button class="text-button" data-action="feedback">记录专家反馈 ${icon('people')}</button></div></section></div></div>`;
  }
  return {
    async render(isCurrent) {
      const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
      if (['legal-benchmark-20261116','legal-benchmark-deepseek-20261116'].includes(params.get('run'))) return renderBenchmark({main,api,heading,icon,tag,notice},isCurrent);
      if (params.get('run') === 'legal-bo5-20261115') return renderHardness({main,api,heading,icon,tag,notice},isCurrent);
      if (params.get('run') === 'legal-harbor-001') return renderRun({ main, api, heading, icon, tag, notice }, isCurrent, 'legal-harbor-001');
      stageId = params.get('stage') ?? 'dossier'; tabId = params.get('tab') ?? 'overview';
      pipeline = await api('/api/exploration'); dossier = await api('/api/dossier'); schema = await api('/api/dossier/schema');
      if (!isCurrent()) return;
      if (!pipeline.stages.some(s => s.id === stageId)) stageId = 'dossier';
      if (!tabs.some(t => t[0] === tabId)) tabId = 'overview';
      index = new Map(Object.values(dossier).filter(Array.isArray).flat().map(r => [r.id, r]));
      paint();
      if (matchMedia('(max-width:860px)').matches) {
        const list = main.querySelector('.pipeline-stage-list');
        const selected = list.querySelector('.selected');
        list.scrollLeft = selected.getBoundingClientRect().left - list.getBoundingClientRect().left - list.clientWidth / 2 + selected.clientWidth / 2;
      }
    },
    handle(button) {
      if (!dossier) return;
      if (button.dataset.action === 'explore-stage') location.hash = `exploration?run=snapshot&stage=${encodeURIComponent(button.dataset.stage)}`;
      if (button.dataset.action === 'explore-tab' && tabs.some(t => t[0] === button.dataset.tab)) {
        tabId = button.dataset.tab;
        history.replaceState(null, '', `#exploration?run=snapshot&stage=dossier&tab=${encodeURIComponent(tabId)}`);
        paint();
      }
      if (button.dataset.action === 'explore-source') {
        const span = dossier.source_spans.find(s => s.id === button.dataset.id);
        if (!span) return;
        dialog(`<div class="modal-heading"><div><div class="eyebrow">PROVENANCE / FROZEN SOURCE</div><h2 id="modal-title">${e(span.id)}</h2></div>${closeButton}</div>${notice('这是冻结的脱敏展示视图片段，不是证据原件；只能证明整理内容有对应文书来源。')}<div class="provenance-meta"><span>文档：${e(index.get(span.document_id).title)}</span><span>版本：${e(span.text_version)}</span><span>原行号：${span.locator.source_line}</span></div><blockquote class="source-quote">${e(span.quote)}</blockquote><div class="source-fingerprint"><b>展示视图 SHA-256</b><code>${e(span.view_sha256)}</code></div><div class="modal-actions"><a class="button" href="${e(dossier.documents[0].source_url)}" target="_blank" rel="noopener noreferrer">法院官网原文</a><button class="button" data-action="close-modal">返回整理结果</button></div>`, 'wide-modal');
      }
    },
  };
}
