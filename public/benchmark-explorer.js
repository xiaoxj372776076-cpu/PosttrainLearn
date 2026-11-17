import { escapeHtml as e, markdown } from './utils.js';
const rubricText=r=>Array.isArray(r)?r.map(x=>x.criterion).join('\n\n'):String(r??'');
const pretty=data=>`<pre class="source-code">${e(JSON.stringify(data,null,2))}</pre>`;

export async function renderBenchmark({main,api,heading,icon,tag,notice},isCurrent) {
  const params=new URLSearchParams(location.hash.split('?')[1]??'');
  const run=params.get('run')??'legal-benchmark-20261116';
  const pilot=await api(`/api/benchmark-pilot?id=${encodeURIComponent(run)}`);
  const href=stage=>`#exploration?run=${pilot.id}&stage=${stage}`;
  const requestUrl=file=>`/api/benchmark-pilot/artifact?run=${pilot.id}&file=${encodeURIComponent(file)}`;
  const stage=pilot.stages.find(s=>s.id===params.get('stage'))??pilot.stages.find(s=>s.id==='export');
  const load=async file=>pilot.artifacts.some(a=>a.file===file)?JSON.parse(await (await fetch(requestUrl(file))).text()):null;
  let body='';
  if(stage.id==='probes') {
    const records=await load('benchmark-probes.json');
    body=notice('目标模型只收到原始案情与问题，没有看到原始 rubric 或参考答案。单次作答用于错题候选筛查，不是稳定难度估计。','amber')+
      records.map(r=>`<details class="run-raw"><summary>${e(r.id)} · ${e(r.question)}</summary><div class="plain-text">${e(r.context)}</div><h4>原始 Rubric</h4><div class="plain-text">${e(rubricText(r.rubrics))}</div></details>`).join('');
  } else if(stage.id==='errors') {
    body=pilot.probeResults?pilot.probeResults.grades.map(g=>`<article class="hardness-seed"><div>${tag(g.id,'blue')}${tag(g.wrong_seed_candidate?'实质错题候选':g.rubric_supported?'未发现实质法律错答':'Rubric 待核',g.wrong_seed_candidate?'amber':'teal')}</div><p>${e(g.reason)}</p>${g.substantive_errors.map(x=>`<blockquote><b>模型原句：</b>${e(x.answer_quote)}<br><b>预期：</b>${e(x.expected)}<br>${e(x.reason)}</blockquote>`).join('')}${g.rubric_problems?.length?pretty(g.rubric_problems):''}</article>`).join(''):'<p>错题审核尚未完成。</p>';
    const recheck=await load('seed-eligibility-v2.json');
    if(recheck)body+=`<article class="hardness-seed"><h3>${e(recheck.id)} · 追加有据资格复核</h3>${notice('原始审查没有覆盖。追加复核分开核验目标错误、参考支持及种子资格；法条补正与发布许可单独记录，非专家审核。','amber')}${tag(recheck.eligible_dev_seed?'可作为开发种子':'继续隔离',recheck.eligible_dev_seed?'blue':'amber')}<p>${e(recheck.reason)}</p>${pretty(recheck)}</article>`;
  } else if(stage.id==='seeds') {
    const seeds=await load('seeds.json');const audit=await load('few-shot-load-audit.json');const repairAudit=await load('few-shot-repair-load-audit.json');
    body=notice(`这里使用 ${pilot.config.seed_count} 道完整 PLawBench 原题、案情、原始 rubric 及 rubric 派生答案。${pilot.config.seed_count===1?'本次为 one-shot，不是多示例 few-shot 实验。':''}派生答案不是官方独立金标。`,'amber')+
      (audit?notice(`实际 P2 请求核验：完整示例一致 · ${audit.ids.join('、')} · SHA-256 ${audit.seed_sha256.slice(0,16)}`):'<p>尚未执行 P2 请求核验。</p>')+
      (repairAudit?notice(`P2 修复请求：完整示例及修订材料均与实际请求一致 · ${repairAudit.input_sha256.slice(0,16)}`):'')+
      (seeds?.map(s=>`<article class="hardness-seed"><span class="eyebrow">${e(s.id)} / ${e(s.typeLabel)}</span><h3>${e(s.question)}</h3><details><summary>完整原始案情</summary><div class="plain-text">${e(s.context)}</div></details><h4>Rubric 派生答案</h4><article class="prose">${markdown(s.referenceAnswer)}</article><details><summary>全部原始 Rubric</summary><div class="plain-text">${e(rubricText(s.rubrics))}</div></details><details><summary>目标模型实测错误</summary>${pretty(s.error_probe)}</details></article>`).join('')??'<p>尚未选出可用错题。</p>');
  } else if(stage.id==='candidates') {
    const result=await load('candidates.json');
    body=result?.candidates.map(c=>`<article class="hardness-seed"><span class="eyebrow">${e(c.id)} / ${e(c.imitated_seed_ids.join(' · '))}</span><h3>${e(c.question)}</h3><p>${e(c.imitation_explanation)}</p><details><summary>候选答案与 rubric，尚待独立核验</summary><article class="prose">${markdown(c.answer)}</article>${pretty(c.rubrics)}</details></article>`).join('')??'<p>候选尚未生成。</p>';
    const repair=await load('candidate-repair.json');
    if(repair)body+=`<article class="hardness-seed"><span class="eyebrow">${e(repair.candidate.id)} / 盲答前一次修复</span><h3>${e(repair.candidate.question)}</h3><p>${e(repair.repair_reason)}</p><details><summary>修复生成器答案，仍须独立核验</summary><article class="prose">${markdown(repair.candidate.answer)}</article></details></article>`;
  } else if(stage.id==='blind'||stage.id==='confirmation') {
    const batch=stage.id==='blind'?'first':'confirmation';const answers=await load(`blind-${batch}.json`);const result=batch==='first'?pilot.first:pilot.confirmation;
    body=result?notice(result.valid?`完整有效五答：${result.correct}/5 实质正确 · ${result.target_hit?'命中目标区间':'未命中目标区间'}`:'存在参考或答案完整性问题，难度不可测。','amber'):'<p>尚无完整五答。确认批次仅在首批有效命中后启动。</p>';
    if(result?.criterion_pass_counts)body+=`<h3>逐项观测，不替代整题难度</h3>${result.criterion_pass_counts.map(c=>`<p><code>${e(c.id)}</code>：${c.pass_count}/${c.n} 通过</p>`).join('')}<p>API 完整答卷 ${result.n_completed}/5；冻结全部关键项同时通过 ${result.strict_criteria_correct}/5。有效性门槛未通过时，不据此宣称高难度样本。</p>`;
    body+=answers?.map(a=>{
      const grade=result?.grades.find(g=>g.index===a.index);
      return `<article class="hardness-seed"><span class="eyebrow">ANSWER ${a.index} / ${e(a.call??'原始调用')}</span>${grade?tag(!grade.measurement_valid?'评分无效':grade.overall_correct?'实质正确':'实质错误',grade.overall_correct?'teal':'amber'):tag('完整但未评分','amber')}<details><summary>完整盲答</summary><article class="prose">${markdown(a.answer)}</article></details>${grade?`<p>${e(grade.reason)}</p>${pretty(grade)}`:''}</article>`;
    }).join('')??'';
    if(batch==='first'&&!answers) {
      const partial=await load('blind-first-partial.json');
      if(partial)body=notice(`完整盲答 ${partial.n_completed}/5，截断或中断 ${partial.n_interrupted} 次，尚未评分。不能计算五答成功率，也不能把截断算为法律错误。`,'amber')+
        partial.completed_answers.map(a=>`<article class="hardness-seed"><span class="eyebrow">ANSWER ${a.index} / 完整但未评分</span><article class="prose">${markdown(a.answer)}</article></article>`).join('')+
        partial.interrupted_answers.map(a=>`<article class="hardness-seed"><h3>ANSWER ${a.index} / ${e(a.reason)}</h3>${notice('这一份不计为正确或错误，不参与难度计算。','amber')}<details><summary>截断文本，仅供诊断</summary><article class="prose">${markdown(a.partial_answer??'无文本')}</article></details></article>`).join('');
    }
  } else if(stage.id==='material') {
    const material=await load('student-material.json');
    body=notice(material.note,'amber')+material.paragraphs.map(p=>`<article class="hardness-seed"><span class="eyebrow">${e(p.id)} / ${e(p.attribution)}</span><div class="plain-text">${e(p.text)}</div></article>`).join('');
  } else if(stage.id==='export') {
    const report=pilot.report;
    const selected=await load('selected-question.json');
    const confirmationLabels={completed:'已完成新五答确认',not_run_no_first_batch:'未完成首批，不做确认',not_run_invalid_first_batch:'首批测量无效，不做确认',not_run_first_batch_did_not_hit:'首批未命中，不做确认',not_run_insufficient_budget_for_full_confirmation:'剩余预算不足完整确认，未启动半批',not_run:'未执行确认'};
    const outcome=!report?.first?.valid?'尚未获得有效测量':report.target_confirmed?'命中且确认':report.first.target_hit?'首批命中，未确认':'未命中目标';
    body=report?`<h3>${report.first?.valid?`首批 ${report.first.correct}/5`:'尚无有效五答结果'} · ${outcome}</h3>
      ${selected?`<h4>最终测试题</h4><blockquote class="plain-text">${e(selected.question)}</blockquote>`:''}
      <p>实际服务模型：${e(report.serving_models?.blind_answers?.join('、')||'尚无完整盲答')}。${e(confirmationLabels[report.confirmation_status]??'')}。</p>
      ${report.first?.criterion_pass_counts?`<h4>五答逐项观测</h4>${report.first.criterion_pass_counts.map(c=>`<p><code>${e(c.id)}</code>：${c.pass_count}/${c.n} 通过</p>`).join('')}<p>五份答卷均已完整返回。冻结全部关键项同时通过 ${report.first.strict_criteria_correct}/5；${report.first.valid?'可进入目标区间判断。':'有效性门槛未通过，不作为法律成功率。'}</p>`:''}
      ${report.measurement_review?`<h4>测量复核与下一轮建议</h4>${notice(report.measurement_review.summary,'amber')}<ul>${report.measurement_review.next_round_changes.map(item=>`<li>${e(item)}</li>`).join('')}</ul><details><summary>独立研究复核记录，非专家意见</summary>${pretty(report.measurement_review)}</details>`:''}
      <p>本轮提交 ${report.submissions} 次，完成 ${report.completed} 次；两个试验合计 ${pilot.sharedSubmissions}/${pilot.sharedLimit} 次提交。已知输入 ${report.known_input_tokens.toLocaleString()}、输出 ${report.known_output_tokens.toLocaleString()} token；费用未知。</p>
      ${report.blind_progress?notice(`盲答中断：${report.blind_progress.n_completed} 份完整、${report.blind_progress.n_interrupted} 次中断、评分未完成。剩余共享预算 ${report.blind_progress.remaining_shared_budget} 次，完成五答及评分至少还需 ${report.blind_progress.min_required_additional_submissions} 次。不能报告难度。`,'amber'):''}
      ${notice('专家审核 0，正式训练行 0。一次开发试跑不证明稳定难度、训练收益或法律金标；来源权限尚未核定。','amber')}
      <details class="run-raw"><summary>完整审计报告与五答评分</summary>${pretty(report)}</details>`:'<p>试跑进行中。已完成阶段和完整请求保留在下方，不以模板冒充结果。</p>';
  } else {
    for(const file of stage.files.filter(f=>!f.startsWith('calls/')&&f.endsWith('.json')))body+=`<h3>${e(file)}</h3>${pretty(await load(file))}`;
  }
  if(!isCurrent())return;
  main.innerHTML=`<div class="content-wrap exploration-wrap">${heading('BENCHMARK-GUIDED / LIVE PILOT','让真实错题，示范下一道题。','目标模型错题 → 完整 Few-Shot → 新材料上的同类 QA → 有据校验 → 五答难度筛选。',`<button class="button" id="benchmark-refresh">刷新进展 ${icon('clock')}</button><a class="button" href="#exploration?run=legal-bo5-20261115">旧 20 轮 ${icon('book')}</a>`)}<div class="run-hero hardness-hero"><div><span class="eyebrow">PLAWBENCH / SKILL 1.4.0</span><h2>不预设争点，先模仿真实题型。</h2><p>${e(pilot.config.status)} · ${e(pilot.config.model.model)} / ${e(pilot.config.model.effort)}</p>${tag('完整真实 Benchmark','blue')}${tag('闭卷案例分析')}${tag('未专家审核','amber')}</div><div class="run-hero-numbers"><div><b>${pilot.probeResults?.probe_n??pilot.config.probe_count}</b><span>Benchmark 筛查题</span></div><div><b>${pilot.sharedSubmissions}<small>/${pilot.sharedLimit}</small></b><span>两次试验共享提交</span></div><div><b>${pilot.first?.valid?pilot.first.correct:'—'}<small>/5</small></b><span>首批实质正确</span></div></div></div>${notice(pilot.warning,'amber')}<div class="exploration-layout run-layout"><aside class="pipeline-sidebar panel"><div class="sidebar-heading">FULL PIPELINE <span>${pilot.stages.length}</span></div><div class="pipeline-stage-list">${pilot.stages.map(s=>`<a class="pipeline-stage ${s.id===stage.id?'selected':''}" href="${href(s.id)}" aria-current="${s.id===stage.id?'step':'false'}"><span class="stage-code ${s.completed?'completed':'pending'}">${e(s.code)}</span><span class="stage-label"><b>${e(s.title)}</b><small>${s.completed?'已执行':'未完成'} · ${s.files.length} 个归档</small></span>${icon('arrow')}</a>`).join('')}</div><p class="pipeline-footnote">旧 20 轮不改。<br>真实调用、完整 few-shot 可核对。<br>盲答后不改题、不改标准。</p></aside><section class="stage-workspace panel"><header class="stage-heading"><span class="eyebrow">STAGE ${e(stage.code)}</span><h2>${e(stage.title)}</h2><p>${stage.files.length} 个产物；实际完成调用 ${pilot.completed} 次，失败 ${pilot.failed} 次。</p></header><div class="stage-body run-body">${body}</div><section class="run-artifacts"><h3>完整请求、响应与文件</h3>${stage.files.map(file=>`<details class="run-raw" data-artifact="${e(file)}"><summary>${e(file)}</summary><div class="run-fingerprint"><code>${e(pilot.artifacts.find(a=>a.file===file)?.sha256)}</code><a class="button small" href="${requestUrl(file)}" download>下载</a></div><pre>展开后读取完整归档</pre></details>`).join('')||'<p>尚无产物。</p>'}</section></section></div></div>`;
  main.querySelector('#benchmark-refresh').addEventListener('click',()=>renderBenchmark({main,api,heading,icon,tag,notice},isCurrent));
  main.querySelector('.heading-actions').insertAdjacentHTML('beforeend',`<a class="button" href="#exploration?run=${pilot.id==='legal-benchmark-20261116'?'legal-benchmark-deepseek-20261116':'legal-benchmark-20261116'}">${pilot.id==='legal-benchmark-20261116'?'DeepSeek 独立试验':'Astra 限流记录'}</a>`);
  main.querySelector('.hardness-hero p').append(` · 全部实验合计 ${pilot.sharedSubmissions}/${pilot.sharedLimit} 次提交`);
  main.querySelectorAll('[data-artifact]').forEach(node=>node.addEventListener('toggle',async()=>{
    if(!node.open||node.dataset.loaded)return;node.dataset.loaded='true';
    try{const response=await fetch(requestUrl(node.dataset.artifact));if(!response.ok)throw new Error('读取失败');node.querySelector('pre').textContent=await response.text();}
    catch(error){node.querySelector('pre').textContent=error.message;delete node.dataset.loaded;}
  }));
}
