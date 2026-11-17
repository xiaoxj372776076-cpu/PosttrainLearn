import fs from 'node:fs/promises';
import path from 'node:path';
import { CAMPAIGN, ROOT, read, save, sha } from './hardness-call.mjs';

const report = await read(path.join(CAMPAIGN, 'final-audit.json'));
const indexFile = path.join(ROOT, 'content/skills/index.json');
const index = await read(indexFile);
const parent = report.rounds.at(-1).skill_version;
const version = '1.3.0';
if (index.versions.some(v => v.version === version)) throw new Error('Do not overwrite the released Skill');
const target = path.join(ROOT, 'content/skills', version);
await fs.cp(path.join(ROOT, 'content/skills', parent), target, { recursive: true, errorOnExist: true, force: false });
const previous = await fs.readFile(path.join(target, 'SKILL.md'), 'utf8');
const base = previous.split('\n## 实测难题探索模式')[0];
const body = `${base}\n## 实测难题探索模式\n\n用户要求低成功率难题时，读取[实测难度](references/empirical-hardness.md)，按「上一轮原因分析 -> 保存Skill新版本 -> 全链路合成 -> 冻结 -> 五次新上下文盲答 -> 逐答语义审计」迭代。沿用用户指定的轮数、预算和模型范围，不从本次案例推导通用调用授权。\n\n命题单位可从单个判断点扩展为一个主问题下的有据依赖图：证据认定、成立与效力、金额保护范围、清偿顺序、责任范围和行权条件必须区分。不能仅按预标金额角色转换标签，也不能只将无关子题或计算字段堆到一起。\n\n金额题先核对实际交付、起息、结息、付款、到期和行权日期。缺失日期不能从借据日期或研究者参考推定；源材料中的附条件清算安排不能预先写成法院已经认定无效。材料缺口须先修复，不能用于制造低正确率。\n\n五答计数须区分整题实质正确、固定法律状态字段正确、数值失误和基础设施/格式错误。数字错误会影响请求金额，但仅靠它不能声称法律推理难。达到用户指定区间后不改输入，再用新批次确认；不挑选作答、不改评分器凑命中。\n\n原案信息不足时可换材料，或在已有授权范围内构建显著标明的虚构新情景；新事实重新建立参考，不继承原判答案。隔离掉的信息不足题与失败调用保留可见。种子仅示范结构，不进入学生或独立审计输入。\n\n本次真实校准与局限见[实验记录](references/calibration-results.md)。该记录不是法律金标、泛化难度或训练收益证明。\n`;
await save(path.join(target, 'SKILL.md'), body);
await fs.copyFile(path.join(ROOT, 'content/skill-resources/empirical-hardness.md'), path.join(target, 'references/empirical-hardness.md'));
const componentText=(batch,key)=>batch?.semantic_components?.[key]?`${batch.semantic_components[key].correct}/5`:'未分层';
const table = report.rounds.map(r => `| ${r.round} | ${r.skill_version} | ${r.source_mode} | ${r.first_batch?.measured.reason==='incomplete_batch'?'无完整五答，不可测':r.first_batch ? `${r.first_batch.measured.correct}/5` : '盲答前隔离'} | ${componentText(r.first_batch,'legal_correct')} | ${componentText(r.first_batch,'final_amount_correct')} | ${r.first_batch?.measured.valid?'是':r.first_batch?.measured.reason??'未盲答'} | ${r.confirmation ? `${r.confirmation.measured.correct}/5` : '未运行'} | ${r.confirmed_target_hit ? '命中且确认' : '未确认命中'} |`).join('\n');
const mechanismNotes=report.rounds.filter(r=>r.first_batch).map(r=>`- 第${r.round}轮：${r.co_guarantee_coupling?'共同保证及相对行权；':''}${r.temporal_rate_coupling?'旧借款与新保证的时间链；':''}${r.third_party_sequence_coupling?'付款之后的第三人文书与主体责任；':''}${r.cap_shortcut_repair?'解除整体上限遮蔽；':''}${r.procedural_coupling?'撤诉、送达、再诉及收件签名；':''}完整来源与审计在该轮目录，测量原因 ${r.first_batch.measured.reason}。`).join('\n');
const resultText=[
  '# 本地 Bo5 校准记录','',
  '仅用于解释此次修订依据，不当作未来任务的固定输出或法律答案。','',
  '| 轮次 | Skill | 来源模式 | 首批整题 | 法律判断 | 最终金额 | 有效难度测量 | 新五答确认 | 结论 |',
  '|---|---|---|---|---|---|---|---|---|',table,'',
  '固定目标模型gpt-6-astra、高推理，受限文件完成代理，没有任意终端或计算器工具。第1—4轮每答10000输出token；第4轮出现明确截断，第5轮起为20000。旧轮次保留原配置，不混作同配置对照。第7轮起明确宿主写文件协议；第10轮起在盲答前澄清中间展示容差，旧审计不改判。五答的并发调度、模型输入与预算分别记入model-config和冻结记录。','',
  mechanismNotes,'',
  '表中同时保留完成五答、盲答前隔离和无完整答案的轮次，预备机制不冒充执行。第2、3轮材料缺口与预设效力已隔离，第15轮因本机休眠导致流式请求超时而不可测；旧输入未覆盖。全部是同家族小样本、自适应开发；命中区间不证明泛化或训练收益，未命中也不以材料长度或静态D4替代实测结论。','',
  '第11轮P4/P6均拒绝参考中的额外反事实排序，五答虽正确也不能验收难度；原参考不改。第13轮有不存在的S14引用，亦保留无效测量。第14轮起独立审核不接收Skill末尾的历史计数与生成修改假设，且P4拒绝参考则盲答前隔离；早期审核仍保存完整历史输入，可能有预期污染。第15轮起取消学生状态答案菜单，移除责任推论，使用带时刻的合同及程序记录和单方法律主张；新固定检查器按最终取分比较，差一分不再误报通过。旧轮次不重算或改判。','',
  '本实验P0由确定性情景构造器提供事实和参考，P2只能在对应输出契约内出题。它没有证明一个不受该构造器限制的开放命题器已能自动找到难题；多项机制同时变化，也不是各项Skill修改的独立因果消融。后续要增加证据认定或抗辩交互，应先获得可审查的完整文书与专家依据，不能靠继续重写题目措辞替代新的必要推理。','',
  `实际提交${report.calls.submissions}次，已知输入${report.calls.known_input_tokens}、输出${report.calls.known_output_tokens}token；${report.calls.failed_usage_unknown}次失败用量未知，费用未知。专家审核0、正式训练行0，本地保存且未推代码。`,''
].join('\n');
await save(path.join(target,'references/calibration-results.md'),resultText);
const promptFile=path.join(target,'references/prompts.md');
const promptText=await fs.readFile(promptFile,'utf8');
await save(promptFile,promptText.replace(/\n\n本轮实测难题模式按empirical-hardness\.md执行；虚构新情景已先建立完整材料与工程参考，不从出题示例移植法律结论。\n?/g,'')+'\n\n用户启用实测难题模式时，按[实测难度](empirical-hardness.md)执行；新情景先建立完整材料和独立参考，种子仅用于结构示范。\n');
index.versions.push({ version, parent, title: '实测难度校准与材料充分性',
  author: '本地研究迭代（非专家）', note: `依据${report.started_rounds}轮实际尝试归纳；${report.target_confirmed ? '已找到并确认目标区间题' : '未确认目标区间'}，不证明泛化或法律金标。`,
  createdAt: new Date().toISOString(), sha256: sha(body), schemaVersion: '1.1', materialPackVersion: '1.0' });
await save(indexFile, index);
console.log(`Released reusable local Skill ${version}; parent ${parent}; no remote publication`);
