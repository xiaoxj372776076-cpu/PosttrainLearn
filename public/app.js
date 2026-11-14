import { escapeHtml as e, markdown, percent, date, usageLabels, patternLabels, suggestedVersion } from './utils.js';

const main = document.querySelector('#main');
const modal = document.querySelector('#modal');
let boot; let page = 'overview'; let renderEpoch = 0; let recordsEpoch = 0;
let skill; let skillFile = 'SKILL.md'; let skillVersion; let skillMode = 'read';
let benchmarkTab = 'records'; let filters = { q: '', type: '', domain: '', usage: '', sort: '', page: 1 }; let listing;
let currentRecord; let activeDialog; let searchTimer;

const icon = name => {
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', book: '<path d="M3 5h6c2 0 3 1 3 3v12c-1-2-2-3-5-3H3zM12 8c0-2 1-3 3-3h6v12h-4c-3 0-4 1-5 3"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>', file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', check: '<path d="m5 12 4 4 10-10"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', flag: '<path d="M5 21V3m0 1h12l-2 4 2 4H5"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.file}</svg>`;
};
const tag = (text, kind = '') => `<span class="tag ${kind}">${e(text)}</span>`;
const usage = value => tag(usageLabels[value ?? 'unassigned'], value ?? 'unassigned');
const empty = (title, subtitle) => `<div class="empty-state">${icon('layers')}<h3>${e(title)}</h3><p>${e(subtitle)}</p></div>`;
const notice = (text, kind = '') => `<div class="notice ${kind}">${icon('flag')}<span>${e(text)}</span></div>`;

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json', 'X-Research-Intent': 'local-edit' } : {}), ...options.headers } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `请求失败 ${response.status}`);
  return value;
}
const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });
function toast(text) { const node = document.querySelector('#toast'); node.textContent = text; node.classList.add('visible'); clearTimeout(node.timer); node.timer = setTimeout(() => node.classList.remove('visible'), 4200); }
function heading(eyebrow, title, description, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${e(eyebrow)}</div><h1>${e(title)}</h1><p>${e(description)}</p></div><div class="heading-actions">${actions}</div></div>`; }
function dialog(content, kind = '') {
  document.querySelector('#modal-content').innerHTML = content; modal.className = kind;
  if (!modal.open) modal.showModal();
}
const closeButton = `<button class="icon-button" data-action="close-modal" aria-label="关闭弹窗">${icon('close')}</button>`;
function reviewCounts() { const counts = { unassigned: boot.dataset.total, candidate: 0, approved: 0, holdout: 0 }; for (const r of Object.values(boot.state.reviews)) { counts.unassigned--; counts[r.usage]++; } return counts; }

function overview() {
  const counts = reviewCounts(); const current = boot.versions.at(-1);
  const paired = boot.evaluation.paired;
  main.innerHTML = `<section class="hero"><div class="hero-grain"></div><div class="hero-copy"><div class="eyebrow"><span class="tiny-line"></span>LEGAL DATA · EXPERT-IN-THE-LOOP</div><h1>让法律经验，成为<br><span>可验证的训练数据。</span></h1><p>从一份真实判决书出发，把材料整理、种子命题与专家判断<br class="desktop-only">连接成可追溯的 Posttrain 数据合成方法。</p><div class="hero-actions"><a class="button primary" href="#skills">探索合成 Skill ${icon('arrow')}</a><a class="button glass" href="#benchmarks">浏览 PLawBench ${icon('grid')}</a></div><div class="hero-meta"><span><i></i>一个方向，逐步验证</span><span>不自动合成 · 不调用模型</span></div></div><div class="hero-diagram"><div class="diagram-top"><span class="eyebrow">THE RESEARCH LOOP</span>${tag('专家参与', 'teal')}</div><div class="diagram-step">${icon('file')}<div><b>真实材料</b><span>事实、证据、法律版本</span></div><span class="step-number">01</span></div><div class="diagram-connector"></div><div class="diagram-step">${icon('layers')}<div><b>结构化命题</b><span>判断点 + Few-Shot + 难度</span></div><span class="step-number">02</span></div><div class="diagram-connector"></div><div class="diagram-step highlight">${icon('people')}<div><b>专家核验与反馈</b><span>修正标准，沉淀下一版 Skill</span></div><span class="step-number">03</span></div><div class="loop-note">证据约束内容，种子示范结构 ${icon('arrow')}</div></div></section>
    <div class="content-wrap"><section class="stats-grid"><div class="stat-card"><span>合成 Skill</span><strong>${boot.versions.length}<small>个版本</small></strong><div>${tag(`v${current.version}`, 'blue')}<span>不可覆盖的快照</span></div></div><div class="stat-card"><span>真实案例材料</span><strong>01<small>份</small></strong><div>${tag('原文已取得', 'teal')}<span>待标准化</span></div></div><div class="stat-card"><span>公开评测题目</span><strong>${boot.dataset.total}<small>题</small></strong><div><span>4 类任务 · ${boot.dataset.rubricGroups.toLocaleString()} 个评分组</span></div></div><div class="stat-card"><span>专家批准种子</span><strong>${String(counts.approved).padStart(2, '0')}<small>题</small></strong><div><span>${counts.candidate} 题待审 · ${counts.holdout} 题保留评测</span></div></div></section>
    <div class="section-title"><div><span class="eyebrow">RESEARCH WORKSPACE</span><h2>从这里，开始这一轮研究</h2></div><span class="muted small-text">材料 → 判断点 → 问题 → 核验 → 迭代</span></div>
    <section class="workspace-grid"><a href="#skills" class="feature-card skill-card"><div class="card-top"><span class="card-icon">${icon('layers')}</span>${tag(`v${current.version}`, 'blue')}</div><h3>方法不是一段 Prompt，<br>而是一条有门槛的链路。</h3><p>完整阅读 Skill、材料格式、Few-Shot 策略与审核要求。每次标准调整，都留下独立版本与变更依据。</p><div class="card-bottom"><span>查看方法与版本历史</span>${icon('arrow')}</div></a><a href="#cases" class="feature-card case-card"><div class="card-top"><span class="card-icon">${icon('book')}</span>${tag('第一份案例', 'teal')}</div><h3>借条上的金额，<br>不一定是实际应返还的金额。</h3><p>马某与皮某民间借贷纠纷。用真实文书检验金额角色、当事人主张与法院认定能否被准确保留。</p><div class="case-mini-meta"><span>上海市闵行区人民法院</span><span>2023.11.21</span></div><div class="card-bottom"><span>阅读原始材料展示视图</span>${icon('arrow')}</div></a><a href="#benchmarks" class="feature-card benchmark-card"><div class="card-top"><span class="card-icon">${icon('grid')}</span>${tag('公开子集', 'amber')}</div><h3>用难题观察能力，<br>用专家判断选择种子。</h3><p>280 道 PLawBench 题目、原始 rubric 与真实模型评分。保留评测和开发种子分开管理。</p><div class="task-dots"><span>案例分析 250</span><span>咨询 18</span><span>文书 12</span></div><div class="card-bottom"><span>进入评测与种子管理</span>${icon('arrow')}</div></a></section>
    <section class="bottom-grid"><div class="panel score-overview"><div class="panel-heading"><div><span class="eyebrow">OBSERVE, NOT CERTIFY</span><h2>模型表现，作为研究线索</h2></div>${tag('本地实验快照')}</div><p class="muted">共同已评分的 ${paired.evaluated} 题 · 逐题百分比均值 · 非官方榜单</p>${paired.models.map((m, i) => `<div class="score-bar-row"><span>${e(m.label)}</span><div class="score-track"><div class="score-fill ${i ? 'teal' : ''}" data-progress="${m.aggregate.macroPercentage}"></div></div><b>${percent(m.aggregate.macroPercentage)}</b></div>`).join('')}<p class="fine-print">仍有未完成评分，且 Pro 同时担任裁判。分数仅衡量 rubric 对齐，不代表法律金标。</p><button class="text-button" data-action="benchmark-scores">查看评分口径与详细结果 ${icon('arrow')}</button></div><div class="panel feedback-overview"><div class="panel-heading"><div><span class="eyebrow">EXPERT COLLABORATION</span><h2>把分歧，变成下一版标准</h2></div>${icon('people')}</div><div class="feedback-flow"><span>发现问题</span><i>→</i><span>专家复核</span><i>→</i><span>调整 Skill</span><i>→</i><span>再次验证</span></div><p>记录事实遗漏、rubric 争议、题目难度与流程建议，并关联到当时的 Skill 版本。</p><div class="feedback-counter"><strong>${boot.state.feedback.length}</strong><span>条已记录反馈</span><button class="button small" data-action="feedback">记录专家反馈</button></div></div></section>
    <section class="recent-section"><div class="section-title"><h2>迭代记录</h2><button class="text-button" data-action="feedback-history">查看专家反馈 ${icon('arrow')}</button></div>${boot.state.history.length ? `<div class="activity-list">${boot.state.history.slice(-5).reverse().map(h => `<div><span class="activity-dot"></span><span>${e(h.action === 'skill_version_created' ? `创建 Skill v${h.version}` : h.action === 'review_saved' ? `保存 ${h.recordId} 专家审核` : '记录专家反馈')}</span><time>${date(h.at)}</time></div>`).join('')}</div>` : `<div class="initial-activity"><span class="activity-dot"></span><div><b>建立首个真实内容快照</b><span>Skill v1.1.0、第一份案例与 PLawBench 公开子集已归档；尚未开始合成。</span></div><time>2026.11.14</time></div>`}</section></div>`;
  main.querySelectorAll('[data-progress]').forEach(node => { node.style.width = `${node.dataset.progress}%`; });
}

async function skillsView(epoch) {
  skillVersion ??= boot.versions.at(-1).version;
  skill = await api(`/api/skills/${skillVersion}?file=${encodeURIComponent(skillFile)}`);
  if (epoch !== renderEpoch) return;
  main.innerHTML = `<div class="content-wrap">${heading('METHOD & VERSION HISTORY', '让方法的每次变化，都有迹可循。', '快照保存整个 Skill 文件夹。正文、参考规范、提示词与审计脚本一起追溯，不覆盖旧版本。', `<button class="button primary" data-action="new-version">${icon('layers')}创建迭代版本</button>`)}<div class="skill-layout"><aside class="panel skill-sidebar"><div class="sidebar-heading">VERSION HISTORY<span>${boot.versions.length}</span></div>${[...boot.versions].reverse().map(v => `<button class="version-option ${v.version === skillVersion ? 'selected' : ''}" data-action="select-version" data-version="${v.version}"><span class="version-marker"></span><div><b>v${e(v.version)} ${v.version === boot.versions.at(-1).version ? '<small>最新</small>' : ''}</b><span>${e(v.title)}</span><time>${date(v.createdAt)}</time></div></button>`).join('')}<div class="sidebar-heading resource-heading">SNAPSHOT FILES</div><div class="resource-list">${skill.files.map(file => `<button class="resource ${file === skillFile ? 'selected' : ''}" data-action="skill-file" data-file="${e(file)}">${icon(file === 'SKILL.md' ? 'book' : 'file')}<span>${e(file.replace('references/', '').replace('scripts/', '').replace('assets/', ''))}</span></button>`).join('')}</div></aside><section class="panel document-panel"><div class="document-toolbar"><div>${tag(`v${skill.version}`, 'blue')}<b>${e(skill.file)}</b></div><div class="segmented"><button data-action="skill-mode" data-mode="read" class="${skillMode === 'read' ? 'active' : ''}">阅读</button><button data-action="skill-mode" data-mode="source" class="${skillMode === 'source' ? 'active' : ''}">源码</button><button data-action="skill-mode" data-mode="diff" class="${skillMode === 'diff' ? 'active' : ''}">版本对比</button></div></div><div class="document-meta"><span>${icon('clock')}${date(skill.createdAt)}</span><span>作者：${e(skill.author)}</span><span title="${e(skill.fileSha256)}">SHA-256 ${skill.fileSha256.slice(0, 12)}</span></div><div id="skill-document" class="document-body">${skillMode === 'source' ? `<pre class="source-code">${e(skill.text)}</pre>` : skillMode === 'read' ? `<article class="prose">${skill.file.endsWith('.md') ? markdown(skill.text) : `<pre>${e(skill.text)}</pre>`}</article>` : ''}</div><div class="document-footnote">${e(skill.note)}<br>样本契约 ${e(skill.schemaVersion)} · 材料包 ${e(skill.materialPackVersion)}（两者独立版本）</div></section></div></div>`;
  if (skillMode === 'diff') await renderDiff();
}
async function renderDiff() {
  const node = document.querySelector('#skill-document'); if (!node) return;
  if (boot.versions.length < 2) { node.innerHTML = empty('目前只有一个真实快照', '创建下一版之后，可逐行查看变更。不会为展示效果伪造历史版本。'); return; }
  node.innerHTML = `<div class="diff-controls"><label>基准版本<select id="diff-from">${boot.versions.map(v => `<option value="${v.version}" ${v.version === skill.parent ? 'selected' : ''}>v${v.version}</option>`).join('')}</select></label><span>→</span><b>v${skill.version}</b><button class="button small" data-action="load-diff">比较当前文件</button></div><div id="diff-lines"></div>`;
  await loadDiff();
}
async function loadDiff() {
  const from = document.querySelector('#diff-from').value;
  const value = await api(`/api/diff?from=${from}&to=${skill.version}&file=${encodeURIComponent(skill.file)}`);
  document.querySelector('#diff-lines').innerHTML = `<div class="diff-summary">${tag(`+${value.lines.filter(l => l.kind === 'added').length} 行`, 'teal')}${tag(`−${value.lines.filter(l => l.kind === 'removed').length} 行`, 'amber')}</div><pre class="diff-code">${value.lines.map(l => `<span class="diff-${l.kind}">${l.kind === 'added' ? '+' : l.kind === 'removed' ? '−' : ' '} ${e(l.text)}\n</span>`).join('')}</pre>`;
}
function newVersion() {
  activeDialog = 'version';
  dialog(`<div class="modal-heading"><div><div class="eyebrow">ITERATE WITH EVIDENCE</div><h2 id="modal-title">创建 Skill 迭代版本</h2></div>${closeButton}</div><p class="muted">基于 v${skill.version} 保存整个文件夹的新快照，仅修改 ${e(skill.file)}；旧版本保持不变。</p><form id="version-form"><div class="form-grid"><label>新版本号<input name="version" required value="${suggestedVersion(boot.versions.at(-1).version)}" pattern="[0-9]+\.[0-9]+\.[0-9]+"></label><label>作者 / 专家标识<input name="author" required placeholder="例如：研究者 A / 专家编号" maxlength="120"></label></div><label>为什么调整这份标准？<input name="note" required placeholder="记录观察到的问题、调整内容与验证依据" maxlength="4000"></label><label>文件内容<textarea class="code-editor" name="text" required spellcheck="false">${e(skill.text)}</textarea></label><div class="notice">保存不会自动证明 Skill 有效。修改脚本后请执行本地测试；数据契约版本需与实际规范一致。</div><div class="form-error" role="alert"></div><div class="modal-actions"><button type="button" class="button" data-action="close-modal">取消</button><button type="submit" class="button primary">保存为新版本</button></div></form>`, 'wide-modal');
}

async function casesView(epoch) {
  const value = await api('/api/case'); if (epoch !== renderEpoch) return;
  main.innerHTML = `<div class="content-wrap">${heading('SOURCE MATERIAL / CASE 001', '先把材料读准确，再谈合成。', '第一份真实案例，按原文段落阅读。当前只完成材料获取，尚未生成 material_pack 或训练题目。', `<a class="button" href="${e(value.sourceUrl)}" target="_blank" rel="noopener noreferrer">法院官网原文 ↗</a>`)}<div class="case-layout"><aside><div class="panel case-info"><div class="eyebrow">CIVIL LITIGATION</div><h2>民间借贷纠纷</h2>${tag('已获取 · 待标准化', 'teal')}<dl><dt>案号</dt><dd>${e(value.caseNumber)}</dd><dt>法院</dt><dd>${e(value.court)}</dd><dt>裁判日期</dt><dd>${e(value.date)}</dd><dt>程序</dt><dd>一审 · 缺席判决</dd><dt>来源核验</dt><dd>官方 HTML · HTTP 200</dd><dt>上诉 / 生效状态</dt><dd>未确认</dd></dl><div class="fine-print">冻结文本 SHA-256<br><code>${e(value.sourceTextSha256)}</code></div></div><div class="panel reading-guide"><h3>这一份材料的观察重点</h3><ol><li>当事人主张与法院认定分开</li><li>名义金额与实际交付分开</li><li>同笔金额重复叙述不重复计算</li><li>合同效力与返还责任分开</li></ol><button class="text-button" data-action="normalization-spec">查看材料格式标准 ${icon('arrow')}</button></div></aside><section class="panel case-document"><div class="document-toolbar"><div>${icon('file')}<b>公开判决书 · 脱敏展示视图</b></div>${tag('非完整卷宗')}</div>${notice('仅省略与研究无关的身份信息，不改写金额、行为时间或裁判理由。段落 ID 保留原文行号；本展示视图不是逐字原件。')}<div class="case-text">${value.paragraphs.map((p, index) => `${index === 0 || p.section !== value.paragraphs[index - 1].section ? `<div class="case-section-label">${e(p.section)}</div>` : ''}<div class="case-paragraph"><span class="paragraph-id">${e(p.id)}</span><p>${e(p.text)}</p></div>`).join('')}</div><div class="document-footnote">${e(value.note)}<br>证据原件未取得；训练权限、法律版本与评测重叠仍待核验。${value.redactions.length} 处展示脱敏记录已保存。</div></section></div></div>`;
}

function benchmarkHeader() {
  const counts = reviewCounts();
  return `${heading('BENCHMARKS & SEED DESIGN', '不只是看分数，更要看为什么。', 'PLawBench 公开快照：题目、参考要点、评分 rubric 与模型逐项结果。选为开发种子后，不再作为未见评测。', `<a class="button" href="${e(boot.dataset.repository)}" target="_blank" rel="noopener noreferrer">上游仓库 ↗</a><a class="button primary" href="/api/export/seeds" download>${icon('download')}导出批准种子</a>`)}<div class="dataset-banner"><div class="dataset-monogram">P<span>Law</span></div><div><h2>PLawBench ${tag('公开子集', 'blue')}</h2><p>法律实务 · Rubric-Based Benchmark</p></div><div class="dataset-fact"><strong>280</strong><span>本地公开题目</span></div><div class="dataset-fact"><strong>1,000</strong><span>案例评分组</span></div><div class="dataset-fact"><strong>${counts.approved}</strong><span>专家批准种子</span></div><div class="dataset-version"><span>快照 2026.11.10</span><code>${boot.dataset.commit.slice(0, 12)}</code></div></div><div class="section-tabs" role="tablist" aria-label="评测集工作区"><button role="tab" data-action="benchmark-tab" data-tab="records" aria-selected="${benchmarkTab === 'records'}">${icon('grid')}题目浏览</button><button role="tab" data-action="benchmark-tab" data-tab="scores" aria-selected="${benchmarkTab === 'scores'}">${icon('layers')}模型成绩</button><button role="tab" data-action="benchmark-tab" data-tab="seeds" aria-selected="${benchmarkTab === 'seeds'}">${icon('people')}种子与专家审核 ${tag(counts.candidate + counts.approved)}</button></div>`;
}
async function benchmarksView(epoch) {
  main.innerHTML = `<div class="content-wrap">${benchmarkHeader()}<div id="benchmark-content"></div></div>`;
  if (benchmarkTab === 'scores') return scoresView();
  const node = document.querySelector('#benchmark-content');
  const counts = reviewCounts();
  node.innerHTML = `${benchmarkTab === 'seeds' ? `<div class="seed-workflow"><div><b>01 / 用途隔离</b><p>候选种子与保留评测分开</p></div><div><b>02 / 专家核验</b><p>记录答案、依据、难度与许可</p></div><div><b>03 / 批准导出</b><p>批准后进入开发，保留审核历史</p></div><span>${counts.candidate} 待审 · ${counts.approved} 批准</span></div>` : ''}<section class="panel benchmark-table-panel"><div class="filter-toolbar"><label class="search-field">${icon('search')}<input id="record-search" aria-label="搜索题目" placeholder="搜索案情、问题、法条或题号…" value="${e(filters.q)}"></label><label>任务<select id="filter-type"><option value="">全部任务</option>${boot.dataset.taskTypes.map(t => `<option value="${t.key}" ${filters.type === t.key ? 'selected' : ''}>${t.label} (${t.count})</option>`).join('')}</select></label><label>法律领域<select id="filter-domain"><option value="">全部领域</option>${boot.dataset.labels.map(l => `<option value="${e(l)}" ${filters.domain === l ? 'selected' : ''}>${e(l)}</option>`).join('')}</select></label><label>用途<select id="filter-usage"><option value="">全部用途</option>${Object.entries(usageLabels).map(([k, v]) => `<option value="${k}" ${filters.usage === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><button class="icon-button" data-action="reset-filters" aria-label="重置筛选">↺</button></div><div class="table-caption"><span id="record-count">正在读取题目…</span><label>排序<select id="filter-sort"><option value="">原始顺序</option><option value="gap" ${filters.sort === 'gap' ? 'selected' : ''}>模型分歧优先</option></select></label></div><div class="table-scroll"><table class="records-table"><thead><tr><th>题目 / 法律领域</th><th>任务</th><th>Lite <small>得分率</small></th><th>Pro <small>得分率</small></th><th>用途</th><th></th></tr></thead><tbody id="records-body"></tbody></table></div><div class="pagination" id="pagination"></div></section><div class="dataset-notes">${notice('公开快照未提供独立标准答案；参考要点来自源 rubric。原始 score 字段不是模型成绩，缺失评分不作为零分。')}${notice('训练 / 再分发许可尚未确认。模型高分不能替代专家核验，使用基准题开发后须排除未见评测。', 'amber')}</div>`;
  await loadRecords(epoch);
}
async function loadRecords(epoch = renderEpoch) {
  const request = ++recordsEpoch;
  const effective = { ...filters }; if (benchmarkTab === 'seeds' && !effective.usage) effective.usage = '';
  listing = await api(`/api/records?${new URLSearchParams(Object.entries(effective).map(([k, v]) => [k, String(v)]))}`);
  if (request !== recordsEpoch || epoch !== renderEpoch || !document.querySelector('#records-body')) return;
  document.querySelector('#record-count').textContent = `共 ${listing.total} 题${benchmarkTab === 'seeds' ? ' · 点击题目进入专家审核' : ' · 点击查看题干、rubric 与模型回答'}`;
  document.querySelector('#records-body').innerHTML = listing.records.length ? listing.records.map(r => `<tr><td><button class="record-title" data-action="open-record" data-id="${r.id}"><span class="record-id">${r.id}${r.warnings.length ? '<i title="来源评分或法域待核">待核</i>' : ''}</span><strong>${e(r.title)}</strong><span>${e(r.label)}</span></button></td><td>${tag(r.typeLabel)}</td>${['seed-2.0-lite', 'seed-2.1-pro'].map(label => `<td><span class="score-number ${r.modelScores[label]?.percentage >= 80 ? 'high' : ''}">${percent(r.modelScores[label]?.percentage)}</span></td>`).join('')}<td>${usage(r.review?.usage)}</td><td><button class="icon-button" data-action="open-record" data-id="${r.id}" aria-label="查看 ${r.id}">${icon('arrow')}</button></td></tr>`).join('') : `<tr><td colspan="6">${empty('没有匹配题目', '调整搜索词或筛选条件。')}</td></tr>`;
  document.querySelector('#pagination').innerHTML = `<span>第 ${listing.page} / ${listing.pages} 页 · 每页 ${listing.pageSize} 题</span><div><button class="button small" data-action="page-prev" ${listing.page <= 1 ? 'disabled' : ''}>上一页</button><button class="button small" data-action="page-next" ${listing.page >= listing.pages ? 'disabled' : ''}>下一页</button></div>`;
}

function scoresView() {
  const evals = boot.evaluation; const paired = evals.paired;
  document.querySelector('#benchmark-content').innerHTML = `<section class="score-cards">${paired.models.map(m => `<div class="panel model-summary"><div class="card-top"><h3>${e(m.label)}</h3>${m.label === 'seed-2.1-pro' ? tag('含自评偏差', 'amber') : tag('固定裁判', 'teal')}</div><strong class="big-score">${percent(m.aggregate.macroPercentage)}</strong><p>共同 ${paired.evaluated} 题的逐题百分比均值</p><div class="score-mini-grid"><div><b>${percent(m.aggregate.taskMacroPercentage)}</b><span>任务等权均值</span></div><div><b>${percent(m.aggregate.microPercentage)}</b><span>总分微平均</span></div></div>${m.aggregate.byTask.map(t => `<div class="task-score"><span>${e(t.label)} <small>${t.evaluated} 题</small></span><b>${percent(t.macroPercentage)}</b></div>`).join('')}</div>`).join('')}</section>${notice(`本地实验快照 ${date(evals.updatedAt)}，共同已评分 ${paired.evaluated}/280 题。两组模型各自完成评分的题目数不同；对比使用共同子集。裁判为 ${evals.judge}，Pro 存在自评偏差。`, 'amber')}<section class="panel local-coverage"><div class="panel-heading"><h2>本地评分覆盖情况</h2>${tag(evals.promptVersion)}</div><div class="table-scroll"><table><thead><tr><th>模型</th><th>回答</th><th>评分</th><th>失败 / 待修复</th><th>各自已评分题目均值</th></tr></thead><tbody>${evals.models.map(m => `<tr><td>${e(m.actualModel)}</td><td>${m.answered}/280</td><td>${m.scored}/280</td><td>${m.failed}</td><td>${percent(m.aggregate.macroPercentage)}</td></tr>`).join('')}</tbody></table></div><p class="fine-print">这是已有结果的只读快照，本站没有发起模型调用或重新评分。</p></section><section class="panel published-scores"><div class="panel-heading"><div><div class="eyebrow">UPSTREAM PUBLISHED RESULTS</div><h2>上游发布的模型榜单</h2></div><a class="text-button" href="${e(evals.officialLeaderboardSource)}" target="_blank" rel="noopener noreferrer">查看原始 README ↗</a></div><p class="muted">原样记录上游快照中的数值。样本范围与口径不同，不与本地 280 题实验混成同一排名。</p><div class="table-scroll"><table><thead><tr><th>模型</th><th>Overall</th><th>案例分析</th><th>法律咨询</th><th>文书写作</th></tr></thead><tbody>${evals.officialLeaderboard.map(m => `<tr><td><b>${e(m.model)}</b><small class="table-subtitle">${e(m.family)}</small></td><td>${m.overall.toFixed(2)}</td><td>${m.caseAverage.toFixed(2)}</td><td>${m.consultation.toFixed(2)}</td><td>${m.documentAverage.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

async function openRecord(id, initialTab = 'question') {
  const record = await api(`/api/records/${id}`); currentRecord = record; activeDialog = 'record';
  const review = record.review ?? { usage: 'unassigned', patterns: [], difficulty: 'D3' };
  const reference = Array.isArray(record.rubrics) ? record.rubrics.find(r => /结论/.test(r.tags))?.criterion : null;
  const tabs = [['question', '题干与参考'], ['rubric', '评分 Rubric'], ['models', '模型回答与评分'], ['review', '专家审核']];
  dialog(`<div class="modal-heading"><div><div class="eyebrow">PLAWBENCH / ${e(id)}</div><h2 id="modal-title">${e(record.title)}</h2></div>${closeButton}</div><div class="record-meta">${tag(record.typeLabel)}${tag(record.label)}${usage(review.usage)}<span>源文件 ${e(record.source.file)} · 第 ${record.source.ordinal} 条</span></div><div class="section-tabs record-tabs" role="tablist" aria-label="题目详情">${tabs.map(([key, label]) => `<button role="tab" data-action="record-tab" data-tab="${key}" aria-selected="${key === initialTab}">${label}</button>`).join('')}</div><section data-record-panel="question" ${initialTab !== 'question' ? 'hidden' : ''}><div class="detail-section"><h3>题目要求 ${record.questionOrigin !== 'source' ? tag('任务标签说明，非原始 Prompt') : ''}</h3><p class="question-callout">${e(record.question)}</p><h3>案情 / 咨询材料</h3><div class="plain-text">${e(record.context)}</div></div><div class="reference-box"><h3>参考答案与依据</h3>${review.answer ? `<div>${tag('用户记录的专家核验答案', 'teal')}<div class="plain-text">${e(review.answer)}</div></div>` : notice('源快照没有独立标准答案。以下仅是 rubric 中的参考要点，不冒充独立法律金标。')}${reference ? `<div class="plain-text">${e(reference)}</div>` : '<p class="muted">本任务的预期内容以评分 rubric 表达，请切换查看完整标准。</p>'}</div>${record.warnings.map(w => notice(w, 'amber')).join('')}</section><section data-record-panel="rubric" ${initialTab !== 'rubric' ? 'hidden' : ''}><div class="rubric-intro"><span>保留上游原文，不自动改分值</span>${tag(record.pointsTotal !== null ? `points 元数据合计 ${record.pointsTotal}` : `源 score 字段：${record.originalScoreField ?? '未提供'}`)}</div>${Array.isArray(record.rubrics) ? record.rubrics.map((r, index) => `<div class="rubric-group"><div><span class="eyebrow">GROUP ${String(index + 1).padStart(2, '0')}</span><h3>${e(r.tags)}</h3>${tag(`${r.points} 分`, 'blue')}</div><div class="plain-text">${e(r.criterion)}</div></div>`).join('') : `<div class="plain-text rubric-text">${e(record.rubrics)}</div>`}${record.warnings.map(w => notice(w, 'amber')).join('')}${notice('原始 rubric 是待核验的监督候选，不是已经认证的法律真值。修改建议请记录到专家审核中。')}</section><section data-record-panel="models" ${initialTab !== 'models' ? 'hidden' : ''}>${notice('已有本地实验结果，不是本站新生成。Pro 同时担任裁判；分数只表示 rubric 对齐。缺失评分不计为零分。', 'amber')}<div class="model-detail-grid">${record.evaluation.models.map(model => `<article class="model-detail"><div class="model-detail-heading"><div><h3>${e(model.label)}</h3><span>${e(model.actualModel || '模型身份未记录')}</span></div><div><b>${percent(model.grade?.percentage)}</b><span>${model.grade ? `${model.grade.points} / ${model.grade.maxPoints} 分` : '回答已生成，评分未完成'}</span></div></div>${model.answer ? `<details class="answer-details" open><summary>模型回答 <small>${date(model.answer.completedAt)}</small></summary><div class="plain-text">${e(model.answer.text)}</div></details>` : empty('未取得回答', '本地快照没有该模型回答。')}${model.grade ? `<div class="grade-heading"><h4>逐项评分与证据</h4>${model.grade.selfJudged ? tag('自评', 'amber') : tag('固定裁判')}</div>${(model.grade.groups ?? []).map(group => `<details class="grade-group"><summary><span>${e(group.label)}</span><b>${group.points} / ${group.maxPoints}</b></summary>${(group.items ?? []).map(item => `<div class="grade-item"><div>${tag(`${item.awarded} / ${item.max_points}`, item.awarded ? 'teal' : 'amber')}<b>${e(item.rubric_excerpt)}</b></div><p>${e(item.reason)}</p>${(item.evidence ?? []).map(text => `<blockquote>${e(text)}</blockquote>`).join('')}</div>`).join('')}${(group.deductions ?? []).length ? `<div class="plain-text">扣分记录：${e(JSON.stringify(group.deductions, null, 2))}</div>` : ''}</details>`).join('')}${(model.grade.warnings ?? []).map(w => notice(w, 'amber')).join('')}` : notice('这份回答尚无有效评分，不用其他题目或其他模型的成绩代填。')}<button class="button small" data-action="draft-model-answer" data-model="${model.label}" ${!model.answer ? 'disabled' : ''}>将回答放入待审草稿</button></article>`).join('')}</div></section><section data-record-panel="review" ${initialTab !== 'review' ? 'hidden' : ''}>${notice('审核记录由用户填写并保存在本机，不构成系统独立专家认证。批准种子必须有核验答案、简短依据、推理结构与使用依据。')}<form id="review-form"><div class="form-grid"><label>样本用途<select name="usage">${Object.entries(usageLabels).map(([key, label]) => `<option value="${key}" ${review.usage === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>专家标识<input name="expert" value="${e(review.expert)}" placeholder="姓名或匿名专家编号" maxlength="120"></label><label>审定难度<select name="difficulty">${['D1', 'D2', 'D3', 'D4'].map(level => `<option ${review.difficulty === level ? 'selected' : ''}>${level}</option>`).join('')}</select></label><label>材料使用依据<input name="permissionBasis" value="${e(review.permissionBasis)}" placeholder="许可、授权或经核验的适用依据" maxlength="2000"></label></div><fieldset><legend>确有必要的推理结构</legend><div class="pattern-checks">${Object.entries(patternLabels).map(([key, label]) => `<label><input type="checkbox" name="patterns" value="${key}" ${(review.patterns ?? []).includes(key) ? 'checked' : ''}>${label}</label>`).join('')}</div></fieldset><label>经核验答案<textarea name="answer" rows="6" placeholder="未提供金标时，不自动把模型回答或 rubric 当作已核验答案">${e(review.answer)}</textarea></label><label>简短有据解释<textarea name="rationale" rows="3" placeholder="记录必要事实、适用规则与支持来源，不要求内部思维链">${e(review.rationale)}</textarea></label><label>审核说明 / 争议与难度依据<textarea name="note" rows="3" placeholder="哪些步骤不可省略？原始 rubric 是否有错误或缺口？">${e(review.note)}</textarea></label><div class="confirmations"><label><input name="answerVerified" type="checkbox" ${review.answerVerified ? 'checked' : ''}>答案及依据已实际核验，不只是模型高分</label><label><input name="permissionConfirmed" type="checkbox" ${review.permissionConfirmed ? 'checked' : ''}>已核验并记录种子使用条件</label></div>${review.everUsedForDevelopment ? notice('这道题已经用于开发，不能重新声明为未见保留评测。', 'amber') : ''}<div class="form-error" role="alert"></div><div class="modal-actions"><span class="muted">${review.updatedAt ? `上次保存 ${date(review.updatedAt)} · 修订 ${review.revision}` : '尚未记录专家审核'}</span><button type="submit" class="button primary">保存审核记录</button></div></form></section>`, 'record-modal');
  modal.querySelector('#review-form .form-grid').insertAdjacentHTML('beforeend', `<label>关联 Skill 版本<select name="skillVersion" aria-label="关联 Skill 版本">${boot.versions.map(v => `<option value="${e(v.version)}" ${v.version === (review.skillVersion || boot.versions.at(-1).version) ? 'selected' : ''}>v${e(v.version)}</option>`).join('')}</select></label>`);
}

function feedbackDialog() {
  activeDialog = 'feedback';
  dialog(`<div class="modal-heading"><div><div class="eyebrow">EXPERT FEEDBACK</div><h2 id="modal-title">记录专家反馈</h2></div>${closeButton}</div><p class="muted">记录本轮发现的问题，关联到 Skill 版本。反馈不会自动修改方法或评分标准。</p><form id="feedback-form"><div class="form-grid"><label>专家标识<input name="expert" required maxlength="120" placeholder="匿名专家编号也可以"></label><label>关联 Skill<select name="skillVersion">${[...boot.versions].reverse().map(v => `<option>${v.version}</option>`).join('')}</select></label></div><label>反馈类别<select name="category"><option value="fact">事实 / 材料整理</option><option value="rubric">Rubric / 监督依据</option><option value="difficulty">问题难度</option><option value="workflow">流程与准入标准</option></select></label><label>问题、证据与建议<textarea name="text" required rows="7" maxlength="8000" placeholder="例如：该金额在案情中出现三次，但属于同一笔款项。建议增加 duplicate_of 字段并单独验证。"></textarea></label><div class="form-error" role="alert"></div><div class="modal-actions"><button class="button primary">保存反馈</button></div></form>`);
}
function feedbackHistory() {
  const categories = { fact: '事实 / 材料', rubric: 'Rubric', difficulty: '难度', workflow: '流程' };
  dialog(`<div class="modal-heading"><div><div class="eyebrow">EXPERT REVIEW LOG</div><h2 id="modal-title">专家反馈记录</h2></div>${closeButton}</div>${boot.state.feedback.length ? boot.state.feedback.slice().reverse().map(item => `<article class="feedback-log"><div>${tag(categories[item.category], 'blue')}${tag(`Skill v${item.skillVersion}`)}<span>${e(item.expert)} · ${date(item.at)}</span></div><p class="plain-text">${e(item.text)}</p><span class="fine-print">记录状态：待处理（记录反馈不等于已完成标准修订）</span></article>`).join('') : empty('还没有专家反馈', '从真实样本和分歧开始，记录第一条可核验的改进建议。')}`);
}

async function render() {
  const epoch = ++renderEpoch; page = location.hash.slice(1).split('?')[0] || 'overview';
  if (!['overview', 'skills', 'cases', 'benchmarks'].includes(page)) page = 'overview';
  document.querySelectorAll('[data-nav]').forEach(node => { node.classList.toggle('active', node.dataset.nav === page); node.setAttribute('aria-current', node.dataset.nav === page ? 'page' : 'false'); });
  main.innerHTML = '<div class="loading-state"><span class="loader"></span>正在读取研究材料…</div>';
  try {
    if (page === 'overview') overview();
    else if (page === 'skills') await skillsView(epoch);
    else if (page === 'cases') await casesView(epoch);
    else await benchmarksView(epoch);
  } catch (error) { if (epoch === renderEpoch) main.innerHTML = `<div class="content-wrap">${notice(error.message, 'amber')}<button class="button" data-action="retry">重新加载</button></div>`; }
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === 'close-modal') modal.close();
    if (action === 'retry') await render();
    if (action === 'select-version') { skillVersion = button.dataset.version; await render(); }
    if (action === 'skill-file') { skillFile = button.dataset.file; if (page !== 'skills') location.hash = 'skills'; else await render(); }
    if (action === 'skill-mode') { skillMode = button.dataset.mode; await render(); }
    if (action === 'new-version') newVersion();
    if (action === 'load-diff') await loadDiff();
    if (action === 'normalization-spec') { skillFile = 'references/material-normalization.md'; location.hash = 'skills'; }
    if (action === 'benchmark-scores') { benchmarkTab = 'scores'; location.hash = 'benchmarks'; }
    if (action === 'benchmark-tab') { benchmarkTab = button.dataset.tab; filters.page = 1; await render(); }
    if (action === 'page-prev' || action === 'page-next') { filters.page = listing.page + (action === 'page-next' ? 1 : -1); await loadRecords(); }
    if (action === 'reset-filters') { filters = { q: '', type: '', domain: '', usage: '', sort: '', page: 1 }; await render(); }
    if (action === 'open-record') await openRecord(button.dataset.id, benchmarkTab === 'seeds' ? 'review' : 'question');
    if (action === 'record-tab') {
      modal.querySelectorAll('[data-record-panel]').forEach(node => { node.hidden = node.dataset.recordPanel !== button.dataset.tab; });
      modal.querySelectorAll('[data-action="record-tab"]').forEach(node => node.setAttribute('aria-selected', String(node === button)));
    }
    if (action === 'draft-model-answer') {
      const model = currentRecord.evaluation.models.find(m => m.label === button.dataset.model);
      const answer = modal.querySelector('[name="answer"]'); answer.value = model.answer.text;
      modal.querySelector('[name="answerVerified"]').checked = false;
      modal.querySelector('[data-action="record-tab"][data-tab="review"]').click();
      toast('已放入待审草稿，未勾选核验，也未自动批准');
    }
    if (action === 'feedback') feedbackDialog();
    if (action === 'feedback-history') feedbackHistory();
  } catch (error) { toast(error.message); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'record-search') { filters.q = event.target.value; filters.page = 1; clearTimeout(searchTimer); searchTimer = setTimeout(() => loadRecords().catch(error => toast(error.message)), 180); }
});
document.addEventListener('change', async event => {
  const fields = { 'filter-type': 'type', 'filter-domain': 'domain', 'filter-usage': 'usage', 'filter-sort': 'sort' };
  if (fields[event.target.id]) { filters[fields[event.target.id]] = event.target.value; filters.page = 1; try { await loadRecords(); } catch (error) { toast(error.message); } }
});
document.addEventListener('submit', async event => {
  const form = event.target; if (!['version-form', 'review-form', 'feedback-form'].includes(form.id)) return;
  event.preventDefault(); const button = form.querySelector('[type="submit"]') ?? form.querySelector('.modal-actions button'); button.disabled = true;
  const data = Object.fromEntries(new FormData(form));
  form.querySelector('.form-error').textContent = '';
  try {
    if (form.id === 'version-form') {
      const created = await post('/api/skills', { ...data, parent: skill.version, file: skill.file, parentFileSha256: skill.fileSha256 });
      skillVersion = created.version; modal.close(); toast(`已保存不可覆盖的 Skill v${created.version}`);
    } else if (form.id === 'review-form') {
      const result = await post(`/api/reviews/${currentRecord.id}`, { ...data, patterns: new FormData(form).getAll('patterns'), permissionConfirmed: data.permissionConfirmed === 'on', answerVerified: data.answerVerified === 'on', expectedRevision: currentRecord.review?.revision ?? 0 });
      currentRecord.review = result; modal.close(); toast('审核已落盘保存，历史修订已保留');
    } else { await post('/api/feedback', data); modal.close(); toast('专家反馈已记录并关联 Skill 版本'); }
    boot = await api('/api/bootstrap'); await render();
  } catch (error) { form.querySelector('.form-error').textContent = error.message; }
  finally { button.disabled = false; }
});
modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
window.addEventListener('hashchange', () => { window.scrollTo({ top: 0, behavior: 'instant' }); render(); });
try { boot = await api('/api/bootstrap'); await render(); }
catch (error) { main.innerHTML = `<div class="content-wrap">${notice(`无法加载研究数据：${error.message}。请通过 npm start 启动本地服务，不要直接打开 HTML 文件。`, 'amber')}</div>`; }
