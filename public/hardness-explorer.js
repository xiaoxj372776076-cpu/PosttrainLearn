import { escapeHtml as e, markdown } from './utils.js';

const stages=[
  ['analysis','A0','原因分析与 Skill 优化',['analysis.json','skill-change.json']],
  ['source','S0','来源与虚构情景边界',['source.json','scenario-record.json']],
  ['pack','P0','统一材料与学生视图',['material-pack.json','student-files.json','answer-contract.json']],
  ['units','P1','必要判断与依赖图',['stage-P1.json','P1-request.json','P1-response.json']],
  ['seeds','FS','Few-Shot 结构选择',['few-shot-selection.json']],
  ['question','P2','合成题目',['instruction.md','stage-P2.json','P2-request.json','P2-response.json','instruction-v1.md','stage-P2-repair.json']],
  ['sufficiency','P3','可回答性与捷径审查',['stage-P3.json','stage-P3-repair.json','P3-request.json','P3-response.json']],
  ['teacher','P4','有据答案与工程复算',['stage-P4.json','engineering-reference.json','engineering-reference-v1.json','P4-request.json','P4-response.json']],
  ['blind','Bo5','五次真实 Harbor 盲答',['frozen.json','Bo5-answers.json','harbor-oracle.json','harbor-nop.json']],
  ['audit','P6','逐答语义审计与难度',['stage-P6.json','P6-request.json','P6-response.json']],
  ['confirm','C5','冻结题面的新五答确认',['Confirm-answers.json','confirmation.json','stage-P6-repair.json']],
  ['export','E0','本轮结论与分组隔离',['outcome.json','groups.json','training.jsonl']],
];
const titles={hypothesis:'修改假设',analysis:'问题分析',causes:'上一轮原因',skill_changes:'Skill 改动',question_valid:'题目有效',reference_supported:'参考有据',difficulty_mechanism_valid:'难度机制有效',assessed_difficulty:'结构审定',results:'逐答审计',failed_concepts:'实质错误点',error_kind:'错误分类',reason:'依据',next_focus:'下一轮方向',correct:'实质正确',evidence:'证据',instruction:'新增指令',why:'修改原因',measured:'五答难度结果',confirmation:'新五答确认',confirmed_target_hit:'已确认命中',full_chain_completed:'全链路完成',release_status:'发布状态'};
function value(v,depth=0) {
  if(v===null||v===undefined)return '<span class="run-null">未取得 / 待执行</span>';
  if(typeof v!=='object')return `<span>${e(String(v))}</span>`;
  if(depth>2)return `<pre>${e(JSON.stringify(v,null,2))}</pre>`;
  if(Array.isArray(v))return `<div class="run-array">${v.map((x,i)=>`<div><span class="run-index">${i+1}</span>${value(x,depth+1)}</div>`).join('')}</div>`;
  return `<dl class="run-fields">${Object.entries(v).map(([k,x])=>`<div><dt>${e(titles[k]??k)}</dt><dd>${value(x,depth+1)}</dd></div>`).join('')}</dl>`;
}
const dots=(correct,n=5)=>Array.from({length:n},(_,i)=>`<span class="hardness-dot ${correct===undefined?'pending':i<correct?'correct':'incorrect'}" aria-label="${correct===undefined?'未完成':i<correct?'正确':'错误'}"></span>`).join('');
const roundCaption=r=>r.status==='question_quarantined_before_blind'?'盲答前隔离':r.measured?.reason==='incomplete_batch'?'答案未完成 · 不可测':r.measured?`${r.measured.correct}/5 实质正确`:'等待五答审计';
const componentCaption=component=>component?`${component.correct}/${component.n}`:'未分层';
function finalResults(report,href) {
  if(!report)return '';
  return `<section class="panel hardness-results"><header><div><span class="eyebrow">CALIBRATION RESULTS</span><h2>法律判断与金额计算，分开看。</h2><p>实际尝试 ${report.started_rounds} 轮，完成五答全链路 ${report.completed_rounds} 轮。${report.target_confirmed?'已命中并通过新五答确认。':'未确认达到 1–2/5 的目标。'}以下是语义审计，不是固定标签检查或专家法律认证。</p></div><a class="button" download href="/api/hardness/artifact?round=campaign&file=final-audit.json">完整审计</a></header><div class="hardness-table-scroll"><table><thead><tr><th>轮次 / Skill</th><th>整题</th><th>法律判断</th><th>最终金额</th><th>决定性依据</th><th>新五答确认</th><th>测量状态</th></tr></thead><tbody>${report.rounds.map(row=>{const batch=row.first_batch;const parts=batch?.semantic_components??{};return `<tr><td><a href="${href(row.round,'audit')}">R${String(row.round).padStart(2,'0')} <small>${e(row.skill_version)}</small></a></td><td>${batch?`${batch.measured.correct}/5`:'未盲答'}</td><td>${batch?componentCaption(parts.legal_correct):'—'}</td><td>${batch?componentCaption(parts.final_amount_correct):'—'}</td><td>${batch?componentCaption(parts.basis_correct):'—'}</td><td>${row.confirmation?`${row.confirmation.measured.correct}/5`:'未运行'}</td><td>${e(!batch?'盲答前隔离':batch.measured.valid?'可用':batch.measured.reason==='reference_not_supported'?'参考未获支持':batch.measured.reason==='nonsemantic_or_inconsistent_grading'?'评分混入非实质错误':'未证明所测难度')}</td></tr>`;}).join('')}</tbody></table></div><p class="section-caveat">“未分层”表示早期审计没有独立的三层字段，不从历史文字或固定检查反推。全部是自适应开发样本；正式训练行与专家审核均为 0。</p></section>`;
}

export async function renderHardness({main,api,heading,icon,tag,notice},isCurrent) {
  const params=new URLSearchParams(location.hash.split('?')[1]??'');
  const campaign=await api(`/api/hardness/campaign${params.get('round')?`?round=${encodeURIComponent(params.get('round'))}`:''}`);
  if(!isCurrent())return;
  const stage=stages.find(s=>s[0]===params.get('stage'))??stages[0];
  const artifact=file=>campaign.artifacts[file];const a=file=>artifact(file)?.data;
  const entry=campaign.entry??{};
  const outcome=a('outcome.json');const measurement=outcome?.measured;
  const stageFiles=stage[3].filter(f=>artifact(f));
  if(stage[0]==='blind'||stage[0]==='confirm') {
    const prefix=stage[0]==='blind'?'Bo5':'Confirm';
    stageFiles.push(...Object.keys(campaign.artifacts).filter(f=>new RegExp(`^(?:harbor-)?${prefix}-[1-5](?:-retry)?(?:-request|-response|-error|-partial-response)?\\.json$`).test(f)));
  }
  const href=(round,id=stage[0])=>`#exploration?run=${campaign.id}&round=${String(round).padStart(2,'0')}&stage=${id}`;
  let body='';
  if(stage[0]==='question')body=artifact('instruction.md')?`<article class="run-instruction prose">${markdown(artifact('instruction.md').text)}</article>`:'<p class="muted">尚未产生真实题面。</p>';
  else if(stage[0]==='blind'||stage[0]==='confirm') {
    const list=a(stage[0]==='blind'?'Bo5-answers.json':'Confirm-answers.json')??[];
    const frozen=a('frozen.json')??a('model-config.json')??campaign.config;
    body=`${notice(`本轮固定 ${frozen.model} · ${frozen.effort} · ${frozen.max_output_tokens} 输出 token。Harbor/Smol 中真实读取文件并调用API，五答互不见历史和评分；受限文件代理，不是任意终端代理。旧轮次保留原配置，不混作同配置对照。`)}${value(a('frozen.json'))}<h3>实际完成答案 ${list.filter(x=>x.completed_answer).length}/5</h3>${list.map(x=>`<article class="run-attempt"><header><div><code>ATTEMPT ${x.index}</code><h3>${e(x.model??'无完成模型响应')}</h3></div>${tag(x.completed_answer?'已完成':x.failure_kind??'未完成',x.completed_answer?'teal':'amber')}<b class="run-score">${x.report?`${Math.round(x.report.score*100)}%`:'—'}</b></header><p class="section-caveat">此处百分比是冻结数值/状态检查，不直接表示语义正确。实质难度见P6。</p><details class="run-raw"><summary>查看本次完整答案和失败记录</summary>${x.answer_text?`<pre>${e(x.answer_text)}</pre>`:value(x.exceptions)}</details>${value(x.report)}</article>`).join('')||'<p class="muted">尚未执行盲答。</p>'}`;
  } else if(stage[0]==='audit')body=value(a('stage-P6.json'));
  else if(stage[0]==='analysis') {
    const change=a('skill-change.json');
    body=`${value(a('analysis.json'))}${change?value({version:change.version,parent:change.parent,skill_sha256:change.skill_sha256}):''}${entry.skill_version?`<a class="button" href="#skills?version=${e(entry.skill_version)}">阅读完整 Skill ${e(entry.skill_version)} ${icon('book')}</a>`:''}`;
  }
  else if(stage[0]==='seeds')body=a('few-shot-selection.json')?`${value(a('few-shot-selection.json'))}${notice('以下三个独立假设规则示例仅用于P2示范结构，不是法律金标。PLawBench未参与生成，学生与审计模型不接收这些答案。','amber')}${campaign.seeds.map(seed=>`<article class="hardness-seed"><span class="eyebrow">${e(seed.seed_id)}</span><h3>${e(seed.question)}</h3><p><b>答案：</b>${e(seed.answer)}</p><p>${e(seed.rationale)}</p><small>${e(seed.verification)} · 未专家审核</small></article>`).join('')}`:'<p class="muted">尚未选择种子。</p>';
  else if(stage[0]==='teacher')body=`${notice('工程参考由原案来源或显著虚构题设与冻结法条建立，P4核对并生成依据。没有专家审核；不能继承改编后的原判答案。','amber')}${value(a('stage-P4.json'))}<details class="run-raw"><summary>参考答案与逐期 Decimal 复算证明</summary>${value(a('engineering-reference.json'))}</details>`;
  else if(stage[0]==='export') {
    const auditRound=campaign.finalAudit?.rounds.find(r=>r.round===Number(campaign.round));
    body=`${value(outcome)}${auditRound?.first_batch?`<section class="hardness-seed"><span class="eyebrow">INDEPENDENT LOCAL RECOMPUTATION</span><h3>整题正确与法律状态字段分开看</h3><p>首批整题实质正确 ${auditRound.first_batch.measured.correct}/5；全部固定法律状态字段正确 ${auditRound.first_batch.legal_state_check_perfect_answers}/5。后一个数字不代表法律解释已获专家认可。</p>${auditRound.confirmation?`<p>新五答确认整题正确 ${auditRound.confirmation.measured.correct}/5；全部固定法律状态字段正确 ${auditRound.confirmation.legal_state_check_perfect_answers}/5。</p>`:''}${value({fixed_check_failures:auditRound.first_batch.fixed_check_failures})}<a class="button" download href="/api/hardness/artifact?round=campaign&file=final-audit.json">下载最终完整审计 ${icon('download')}</a></section>`:''}`;
  }
  else body=stageFiles.map(f=>`<h3>${e(f)}</h3>${artifact(f).data?value(a(f)):`<pre>${e(artifact(f).text)}</pre>`}`).join('')||'<p class="muted">本阶段尚未产生实际产物。</p>';
  const summary=campaign.summary;
  main.innerHTML=`<div class="content-wrap exploration-wrap">${heading('EMPIRICAL HARDNESS / BO5','让难度由五次盲答决定。','逐轮分析捷径、改进 Skill，再跑完整合成与真实盲答。不是把题目写长，而是让必要推理真正改变答案。',`<button class="button" id="hardness-refresh">刷新进展 ${icon('clock')}</button><a class="button" href="#exploration?run=legal-harbor-001">旧三答实验 ${icon('book')}</a>`)}<div class="run-hero hardness-hero"><div><span class="eyebrow">LEGAL BO5 / PROTOCOL 0.2</span><h2>目标：5 次中，只有 1–2 次实质答对</h2><p>固定模型与预算 · 语义与格式分开 · 命中后再做新五答确认</p>${tag(summary.target_hit?'已命中并确认':'尚未确认命中',summary.target_hit?'teal':'amber')}${tag('最多 20 轮','blue')}${tag('全部开发校准 · 未专家审核','amber')}</div><div class="run-hero-numbers"><div><b>${summary.rounds.length}<small>/20</small></b><span>已启动轮次</span></div><div><b>${campaign.requests}</b><span>实际网关提交</span></div><div><b>0</b><span>正式训练行</span></div></div></div>${notice(campaign.warning,'amber')}<section class="panel hardness-history"><header><span class="eyebrow">ITERATION HISTORY</span><span>${e(summary.status)} · ${campaign.unknown_usage_requests} 次用量待返回或未知</span></header><div class="hardness-rounds">${summary.rounds.map(r=>`<a class="hardness-round ${Number(campaign.round)===r.round?'selected':''}" href="${href(r.round)}"><span class="eyebrow">ROUND ${String(r.round).padStart(2,'0')}</span><b>Skill ${e(r.skill_version??'待归档')}</b><div class="hardness-dots">${dots(r.measured?.correct)}</div><strong>${e(roundCaption(r))}</strong><small>${e(r.status==='question_quarantined_before_blind'?'材料缺陷 · 未盲答':r.stage??r.status??'pending')}</small>${r.confirmed_target_hit?tag('新五答也命中','teal'):r.measured&&!r.measured.valid?tag('不能作为难度结论','amber'):''}</a>`).join('')}</div></section><div class="hardness-current"><span>当前 ROUND ${campaign.round} · ${e(entry.skill_version??'待归档')} · ${Number(campaign.round)===1?'原案无脚手架':'显著虚构衍生情景'}</span><b>${measurement?`${measurement.correct}/5 ${measurement.valid?'有效实测':measurement.reason==='difficulty_mechanism_not_valid'?'未证明高难':'测量无效'}`:e(entry.status==='question_quarantined_before_blind'?'材料缺陷 · 盲答前隔离':entry.stage??'准备中')}</b></div><div class="exploration-layout run-layout"><aside class="pipeline-sidebar panel"><div class="sidebar-heading">FULL PIPELINE <span>${stages.length}</span></div><div class="pipeline-stage-list">${stages.map(s=>{const done=s[3].some(f=>artifact(f));return `<a class="pipeline-stage ${s[0]===stage[0]?'selected':''}" href="${href(campaign.round,s[0])}" aria-current="${s[0]===stage[0]?'step':'false'}"><span class="stage-code ${done?'completed':'pending'}">${e(s[1])}</span><span class="stage-label"><b>${e(s[2])}</b><small>${done?'已有真实归档':'尚未产出'}</small></span>${icon('arrow')}</a>`;}).join('')}</div><p class="pipeline-footnote">Skill 在本轮合成之前归档并实际加载。<br>冻结后不改题、不改评分。<br>本地更新，不推代码。</p></aside><section class="stage-workspace panel"><header class="stage-heading"><span class="eyebrow">ROUND ${campaign.round} / ${e(stage[1])}</span><h2>${e(stage[2])}</h2><p>${stageFiles.length} 个实际归档产物</p></header><div class="stage-body run-body">${body}</div><section class="run-artifacts"><h3>实际文件、完整请求与响应</h3>${stageFiles.map(file=>{const item=artifact(file);return `<details class="run-raw"><summary>${e(file)} <span>SHA-256 / 实际归档</span></summary><div class="run-fingerprint"><code>${e(item.sha256)}</code><a class="button small" download href="/api/hardness/artifact?round=${campaign.round}&file=${encodeURIComponent(file)}">下载 ${icon('download')}</a></div><pre>${e(item.text)}</pre></details>`;}).join('')||'<p class="muted">没有真实文件，不用模板冒充。</p>'}</section></section></div></div>`;
  main.querySelector('.hardness-hero .eyebrow').textContent=`LEGAL BO5 / PROTOCOL ${campaign.config.protocol}`;
  main.querySelector('.hardness-history').insertAdjacentHTML('afterend',finalResults(campaign.finalAudit,href));
  main.querySelectorAll('.hardness-results tbody tr').forEach((row,index)=>{
    if(campaign.finalAudit.rounds[index].first_batch?.measured.reason==='incomplete_batch') {
      row.cells[1].textContent='不可测';row.cells[6].textContent='答案未完成';
    }
  });
  if(campaign.infrastructureAnalysis)main.querySelector('.hardness-history').insertAdjacentHTML('beforebegin',notice('第15轮在本机合盖休眠期间请求超时，未获得完整五答，不能当作0/5难题。故障调用和未知用量全部保留；恢复后的第16轮继续独立验证。','amber'));
  main.querySelectorAll('.hardness-rounds .hardness-round').forEach((card,index)=>{
    if(summary.rounds[index].measured?.reason==='incomplete_batch')card.querySelector('.hardness-dots').innerHTML=dots(undefined);
  });
  if(measurement?.reason==='incomplete_batch') {
    main.querySelector('.hardness-current b').textContent='无完整五答 · 难度不可测';
    main.querySelector('.stage-body').insertAdjacentHTML('afterbegin',notice('该轮没有取得完整的五份答案，实质正确率不可计算。原始记录中的 correct=0 只是未取得正确交付的计数，不是 0/5 法律难题。','amber'));
  }
  if(summary.error)main.querySelector('.hardness-history').insertAdjacentHTML('beforebegin',notice(`实验中断：${summary.error}。已完成记录保留；未完成调用不计为法律错答。`,'amber'));
  main.querySelector('#hardness-refresh').addEventListener('click',()=>renderHardness({main,api,heading,icon,tag,notice},isCurrent));
}
