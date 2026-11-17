import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Store } from './lib/store.mjs';
import { compareLines, validateReview, seedExport } from './lib/domain.mjs';
import { validateDossier, renderCasebook } from './lib/dossier.mjs';
import { buildExploration } from './lib/exploration.mjs';
import { synthesisRun, runArtifact } from './lib/synthesis-runs.mjs';
import { hardnessCampaign, hardnessArtifact } from './lib/hardness-campaign.mjs';
import { benchmarkPilot, benchmarkArtifact } from './lib/benchmark-pilot.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('./', import.meta.url));
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const RECORD = /^(case|consultation|plaintiff|defendant)-\d{3}$/;
const sha = text => createHash('sha256').update(text).digest('hex');
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

async function filesUnder(root, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('快照中不允许符号链接');
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(root, name));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort((a, b) => a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b));
}

async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512000) throw Object.assign(new Error('请求超过 500 KB'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('请求不是合法 JSON'), { status: 400 }); }
}

export async function createApp({ root = DEFAULT_ROOT, stateDir = path.join(root, '.local') } = {}) {
  const dataset = await json(path.join(root, 'content/datasets/plawbench.json'));
  const evaluation = await json(path.join(root, 'content/evaluations/summary.json'));
  const caseData = await json(path.join(root, 'content/cases/shanghai-2023-23060.json'));
  const dossier = await json(path.join(root, 'content/dossiers/shanghai-2023-23060/0.1.0.json'));
  const dossierSchema = await json(path.join(root, 'schemas/case-dossier-0.1.schema.json'));
  const dossierGuide = await fs.readFile(path.join(root, 'docs/case-dossier-v0.1.md'), 'utf8');
  const pipeline = await json(path.join(root, 'content/pipelines/case-study-0.1.json'));
  if (!VERSION.test(pipeline.skill_version)) throw new Error('链路 Skill 版本无效');
  const prompts = await fs.readFile(path.join(root, 'content/skills', pipeline.skill_version, 'references/prompts.md'), 'utf8');
  const fewShotGuide = await fs.readFile(path.join(root, 'content/skills', pipeline.skill_version, 'references/few-shot-and-difficulty.md'), 'utf8');
  validateDossier(dossier, dossierSchema, caseData);
  const casebook = renderCasebook(dossier);
  const recordsById = new Map(dataset.records.map(r => [r.id, r]));
  const store = new Store(stateDir);
  let versionQueue = Promise.resolve();
  const indexFile = path.join(root, 'content/skills/index.json');
  const readVersions = async () => (await json(indexFile)).versions;
  const versionDir = version => path.join(root, 'content/skills', version);
  const getVersion = async version => {
    if (!VERSION.test(version)) throw Object.assign(new Error('版本不存在'), { status: 404 });
    const meta = (await readVersions()).find(v => v.version === version);
    if (!meta) throw Object.assign(new Error('版本不存在'), { status: 404 });
    return meta;
  };
  const sendJson = (res, data, status = 200, filename) => {
    res.writeHead(status, { 'Content-Type': mime['.json'], ...(filename ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {}) });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host ?? '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) throw Object.assign(new Error('仅允许本地访问，请勿直接暴露公网'), { status: 403 });
      const url = new URL(req.url, `http://${host}`);
      const route = url.pathname;
      if (req.method === 'POST') {
        if (req.headers.origin && req.headers.origin !== url.origin) throw Object.assign(new Error('拒绝跨站写入'), { status: 403 });
        if (req.headers['x-research-intent'] !== 'local-edit' || !req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('需要本站 JSON 编辑请求'), { status: 403 });
      }
      if (req.method === 'GET' && route === '/api/bootstrap') {
        const state = await store.read();
        return sendJson(res, { appVersion: '0.4.0', dataset: dataset.meta, evaluation, versions: await readVersions(), case: { ...caseData, paragraphs: undefined, redactions: undefined }, dossier: { version: dossier.dossier_version, schemaVersion: dossier.schema_version, normalization: dossier.case_metadata.normalization_status, gaps: dossier.gaps_and_review.gaps.length }, state });
      }
      if (req.method === 'GET' && route === '/api/records') {
        const state = await store.read();
        const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
        const type = url.searchParams.get('type'); const domain = url.searchParams.get('domain'); const usage = url.searchParams.get('usage');
        const filtered = dataset.records.filter(r => (!query || `${r.id} ${r.title} ${r.context} ${r.question} ${JSON.stringify(r.rubrics)}`.toLocaleLowerCase().includes(query)) && (!type || r.type === type) && (!domain || r.label === domain) && (!usage || (state.reviews[r.id]?.usage ?? 'unassigned') === usage));
        const sort = url.searchParams.get('sort');
        if (sort === 'gap') filtered.sort((a, b) => {
          const gap = r => r.modelScores['seed-2.0-lite'] && r.modelScores['seed-2.1-pro'] ? Math.abs(r.modelScores['seed-2.1-pro'].percentage - r.modelScores['seed-2.0-lite'].percentage) : -1;
          return gap(b) - gap(a) || a.id.localeCompare(b.id);
        });
        const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 10));
        const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const page = Math.min(pages, Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)));
        return sendJson(res, { total: filtered.length, page, pageSize, pages, records: filtered.slice((page - 1) * pageSize, page * pageSize).map(r => ({ ...r, context: undefined, rubrics: undefined, question: undefined, referenceAnswer: undefined, review: state.reviews[r.id] ?? null })) });
      }
      if (req.method === 'GET' && route.startsWith('/api/records/')) {
        const id = route.slice('/api/records/'.length);
        const record = recordsById.get(id);
        if (!RECORD.test(id) || !record) throw Object.assign(new Error('题目不存在'), { status: 404 });
        const state = await store.read();
        return sendJson(res, { ...record, review: state.reviews[id] ?? null, evaluation: await json(path.join(root, 'content/evaluations/plawbench', `${id}.json`)) });
      }
      if (req.method === 'GET' && route === '/api/case') return sendJson(res, caseData);
      if (req.method === 'GET' && route === '/api/benchmark-pilot') return sendJson(res,await benchmarkPilot(root,url.searchParams.get('id')??undefined));
      if (req.method === 'GET' && route === '/api/benchmark-pilot/artifact') {
        const artifact=await benchmarkArtifact(root,url.searchParams.get('file'),url.searchParams.get('run')??undefined);
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end(artifact.text);
      }
      if (req.method === 'GET' && route === '/api/hardness/campaign') return sendJson(res,await hardnessCampaign(root,url.searchParams.get('round')??undefined));
      if (req.method === 'GET' && route === '/api/hardness/artifact') {
        const artifact=await hardnessArtifact(root,url.searchParams.get('round'),url.searchParams.get('file'));
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="${artifact.filename}"`});
        return res.end(artifact.text);
      }
      if (req.method === 'GET' && route === '/api/synthesis/run') return sendJson(res, await synthesisRun(root, url.searchParams.get('id') ?? 'legal-harbor-001'));
      if (req.method === 'GET' && route === '/api/synthesis/artifact') {
        const artifact = await runArtifact(root, url.searchParams.get('run'), url.searchParams.get('file'));
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${artifact.filename}"` });
        return res.end(artifact.text);
      }
      if (req.method === 'GET' && route === '/api/dossier') return sendJson(res, dossier);
      if (req.method === 'GET' && route === '/api/dossier/schema') return sendJson(res, { schema: dossierSchema, guide: dossierGuide, note: '基础结构 schema 配合本地有类型引用、来源对齐及金额公式检查；不替代完整语义验证与法律审核。' });
      if (req.method === 'GET' && route === '/api/exploration') return sendJson(res, buildExploration({ pipeline, dossier, dataset, state: await store.read(), prompts, fewShotGuide }));
      if (req.method === 'GET' && route === '/api/export/dossier') return sendJson(res, dossier, 200, 'case-dossier-0.1.0.json');
      if (req.method === 'GET' && route === '/api/export/casebook') {
        res.writeHead(200, { 'Content-Type': mime['.md'], 'Content-Disposition': 'attachment; filename="casebook-0.1.0.md"' });
        return res.end(casebook);
      }
      if (req.method === 'GET' && route === '/api/export/dossier-schema') return sendJson(res, dossierSchema, 200, 'case-dossier-0.1.schema.json');
      if (req.method === 'GET' && route.startsWith('/api/skills/')) {
        const version = route.slice('/api/skills/'.length); const meta = await getVersion(version);
        const files = await filesUnder(versionDir(version));
        const file = url.searchParams.get('file') ?? 'SKILL.md';
        if (!files.includes(file)) throw Object.assign(new Error('快照文件不存在'), { status: 404 });
        const text = await fs.readFile(path.join(versionDir(version), file), 'utf8');
        return sendJson(res, { ...meta, file, files, text, fileSha256: sha(text) });
      }
      if (req.method === 'GET' && route === '/api/diff') {
        const from = url.searchParams.get('from'); const to = url.searchParams.get('to');
        await getVersion(from ?? ''); await getVersion(to ?? '');
        const file = url.searchParams.get('file') ?? 'SKILL.md';
        const filesA = await filesUnder(versionDir(from)); const filesB = await filesUnder(versionDir(to));
        if (!filesA.includes(file) || !filesB.includes(file)) throw Object.assign(new Error('对比文件不存在'), { status: 404 });
        return sendJson(res, { from, to, file, lines: compareLines(await fs.readFile(path.join(versionDir(from), file), 'utf8'), await fs.readFile(path.join(versionDir(to), file), 'utf8')) });
      }
      if (req.method === 'POST' && route === '/api/skills') {
        const input = await body(req);
        const operation = versionQueue.then(async () => {
          if (!VERSION.test(input.version ?? '')) throw new Error('版本号请使用 1.2.0 这样的格式');
          const versions = await readVersions();
          if (versions.some(v => v.version === input.version)) throw new Error('版本已存在，不能覆盖历史快照');
          const parent = await getVersion(input.parent ?? '');
          const files = await filesUnder(versionDir(parent.version));
          const file = input.file ?? 'SKILL.md';
          if (!files.includes(file) || !/\.(md|json|yaml|yml|py)$/.test(file)) throw new Error('只能修改已存在的文本资源');
          if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 100000) throw new Error('版本正文为空或过长');
          if (typeof input.note !== 'string' || !input.note.trim() || input.note.length > 4000) throw new Error('请填写迭代说明');
          if (typeof input.author !== 'string' || !input.author.trim() || input.author.length > 120) throw new Error('请填写作者或专家标识');
          const current = await fs.readFile(path.join(versionDir(parent.version), file), 'utf8');
          if (sha(current) !== input.parentFileSha256) throw new Error('父版本文件指纹不一致，请重新加载再保存');
          const frontmatter = input.text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
          if (file === 'SKILL.md' && (!frontmatter || !/^name:\s*legal-posttrain-synthesis\s*$/m.test(frontmatter) || !/^description:\s*\S/m.test(frontmatter))) throw new Error('SKILL.md 必须保留有效名称和 description frontmatter');
          if (input.text === current) throw new Error('内容未变化，无需创建新版本');
          const temporary = path.join(root, 'content/skills', `${input.version}.${randomUUID()}.tmp`);
          await fs.cp(versionDir(parent.version), temporary, { recursive: true, errorOnExist: true, force: false });
          await fs.writeFile(path.join(temporary, file), input.text);
          await fs.rename(temporary, versionDir(input.version));
          const mainText = await fs.readFile(path.join(versionDir(input.version), 'SKILL.md'), 'utf8');
          const meta = { version: input.version, title: input.note.trim().slice(0, 48), note: input.note.trim(), author: input.author.trim(), parent: parent.version, changedFile: file, createdAt: new Date().toISOString(), sha256: sha(mainText), schemaVersion: parent.schemaVersion, materialPackVersion: parent.materialPackVersion };
          versions.push(meta);
          const temporaryIndex = `${indexFile}.${randomUUID()}.tmp`;
          await fs.writeFile(temporaryIndex, JSON.stringify({ versions }, null, 2) + '\n'); await fs.rename(temporaryIndex, indexFile);
          await store.update(state => state.history.push({ id: randomUUID(), action: 'skill_version_created', version: meta.version, at: meta.createdAt, note: meta.note }));
          return meta;
        });
        versionQueue = operation.catch(() => {});
        return sendJson(res, await operation, 201);
      }
      if (req.method === 'POST' && route.startsWith('/api/reviews/')) {
        const id = route.slice('/api/reviews/'.length);
        if (!recordsById.has(id)) throw Object.assign(new Error('题目不存在'), { status: 404 });
        const input = await body(req);
        const reviewSkillVersion = input.skillVersion ?? (await readVersions()).at(-1).version;
        await getVersion(reviewSkillVersion);
        const result = await store.update(state => {
          const old = state.reviews[id] ?? {};
          if (input.expectedRevision !== (old.revision ?? 0)) throw Object.assign(new Error('该题审核已更新，请重新打开，避免覆盖他人修改'), { status: 409 });
          const review = { ...validateReview({ ...input, skillVersion: reviewSkillVersion }, old), revision: (old.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
          state.reviews[id] = review;
          state.history.push({ id: randomUUID(), recordId: id, action: 'review_saved', previous: old, review, at: review.updatedAt });
          return review;
        });
        return sendJson(res, result);
      }
      if (req.method === 'POST' && route === '/api/feedback') {
        const input = await body(req);
        if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 8000 || typeof input.expert !== 'string' || !input.expert.trim() || input.expert.length > 120) throw new Error('请填写专家标识和不超过 8000 字的反馈');
        await getVersion(input.skillVersion ?? '');
        if (!['fact', 'rubric', 'difficulty', 'workflow'].includes(input.category)) throw new Error('反馈分类不合法');
        const item = { id: randomUUID(), text: input.text.trim(), expert: input.expert.trim(), category: input.category, skillVersion: input.skillVersion, at: new Date().toISOString(), status: 'open' };
        await store.update(state => { state.feedback.push(item); state.history.push({ action: 'feedback_added', id: item.id, at: item.at }); });
        return sendJson(res, item, 201);
      }
      if (req.method === 'GET' && route === '/api/export/seeds') {
        const state = await store.read(); const versions = await readVersions();
        return sendJson(res, { exportedAt: new Date().toISOString(), note: '仅导出用户记录的专家批准种子；开发使用后排除未见评测。来源权限与法律质量仍需独立核验。', seeds: seedExport(dataset.records, state.reviews, versions.at(-1).version) }, 200, 'legal-seed-bank.json');
      }
      if (req.method === 'GET' && route === '/api/export/research') {
        const versions = await readVersions(); const snapshots = [];
        for (const meta of versions) {
          const files = {};
          for (const name of await filesUnder(versionDir(meta.version))) files[name] = await fs.readFile(path.join(versionDir(meta.version), name), 'utf8');
          snapshots.push({ meta, files });
        }
        const synthesisRuns=[await synthesisRun(root)];
        const hardness=[];
        try {
          const campaign=await hardnessCampaign(root);
          for(const round of campaign.summary.rounds)hardness.push(await hardnessCampaign(root,String(round.round).padStart(2,'0')));
        } catch(error) {if(error.code!=='ENOENT')throw error;}
        return sendJson(res, { formatVersion: '1.3', exportedAt: new Date().toISOString(), dataset: dataset.meta, case: caseData, dossier, dossierSchema, dossierGuide, pipeline, synthesisRuns, hardnessCampaignRounds:hardness, skillSnapshots: snapshots, state: await store.read(), note: '本地研究备份含专家记录、实际合成迭代及隐藏答案，请审查个人信息后再共享，勿用于学生输入。原始私有源文件、凭证及VM运行状态未包含。隔离产物不是已准入训练样本。' }, 200, 'legal-research-backup.json');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw Object.assign(new Error('不支持此操作'), { status: 405 });
      if (route.startsWith('/api/')) throw Object.assign(new Error('接口不存在'), { status: 404 });
      const relative = route === '/' ? 'index.html' : decodeURIComponent(route).slice(1);
      const target = path.resolve(root, 'public', relative);
      const publicRoot = path.resolve(root, 'public');
      if (!target.startsWith(publicRoot + path.sep)) throw Object.assign(new Error('路径不可访问'), { status: 403 });
      const realTarget = await fs.realpath(target);
      const realPublicRoot = await fs.realpath(publicRoot);
      if (!realTarget.startsWith(realPublicRoot + path.sep)) throw Object.assign(new Error('路径不可访问'), { status: 403 });
      const bytes = await fs.readFile(realTarget);
      res.writeHead(200, { 'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const status = error.status ?? (error.code === 'ENOENT' ? 404 : 400);
      sendJson(res, { error: status === 404 ? '内容不存在' : error.message }, status);
    }
  });
  return { server, store, dataset };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const { server } = await createApp();
  server.listen(port, '127.0.0.1', () => console.log(`法律数据合成研究学习: http://127.0.0.1:${port}`));
}
