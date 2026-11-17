import { seedExport } from './domain.mjs';
import { DOSSIER_SECTIONS } from './dossier.mjs';

export function promptSections(text) {
  return Object.fromEntries([...text.matchAll(/^## (P[0-7]):[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(match => [match[1], match[0].trim()]));
}

export function buildExploration({ pipeline, dossier, dataset, state, prompts, fewShotGuide }) {
  const seeds = seedExport(dataset.records, state.reviews, pipeline.skill_version);
  const approvedIds = new Set(seeds.map(s => s.source_record_id));
  const candidateIds = Object.entries(state.reviews).filter(([, r]) => r.usage === 'candidate').map(([id]) => id);
  const counts = Object.fromEntries(Object.keys(DOSSIER_SECTIONS).map(key => [key, dossier[key].length]));
  const materialCount = dossier.documents.filter(d => d.acquisition === 'published_judgment_view' || d.acquisition === 'original_obtained').length;
  const sections = promptSections(prompts);
  const statuses = {
    source: { status: 'needs_review', label: '来源已归档 · 权限待核', artifacts: [`${materialCount} 份已取得文书展示视图`, `${dossier.source_spans.length} 个冻结原文片段`, '原始证据文件未取得；使用权限待确认'] },
    dossier: { status: 'partial', label: '已试填 · 待专家核验', artifacts: [`案件包 v${dossier.dossier_version} · Schema ${dossier.schema_version}`, `${counts.issues} 张争点卡 · ${counts.amount_ledger} 条金额/利率记录`, `${dossier.gaps_and_review.gaps.length} 项显式缺口 · 训练准入阻断`] },
    units: { status: 'draft', label: '研究候选 · 未批准', artifacts: [`${counts.issues} 张争点卡可供选题研究`, '未形成完整 decision_unit，也未通过材料包准入'] },
    seeds: { status: seeds.length ? 'available' : 'needs_review', label: seeds.length ? '种子可用 · 未选择' : '待筛选与审核', artifacts: [`${dataset.records.length} 道公开评测题可浏览`, `${seeds.length} 道记录为专家批准的开发种子 · ${candidateIds.length} 道候选`, '本案实际 few-shot 选择日志尚未产生'] },
  };
  return {
    ...pipeline, counts, trainingSamples: 0, modelRuns: 0,
    stages: pipeline.stages.map(stage => ({ ...stage, ...(statuses[stage.id] ?? { status: stage.optional ? 'optional' : 'not_run', label: stage.optional ? '未启用' : '未执行', artifacts: ['尚未产生本阶段的本案运行结果；下方为待执行规范，不是生成日志。'] }), prompt: stage.prompt_key ? sections[stage.prompt_key] : null })),
    seedBank: { total: dataset.records.length, approved: seeds.length, candidates: candidateIds.length, selectionLog: null, records: dataset.records.filter(r => approvedIds.has(r.id) || candidateIds.includes(r.id)).map(r => ({ id: r.id, title: r.title, type: r.type, usage: state.reviews[r.id].usage })) },
    fewShotGuide,
  };
}
