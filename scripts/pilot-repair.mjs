import fs from 'node:fs/promises';
import { RUN, read, save, hash } from './pilot-prepare.mjs';

const files=await read(`${RUN}/student-files.json`);
const before=await fs.readFile(`${RUN}/instruction.md`,'utf8');
await save('student-files-v1.json',files);
await save('instruction-v1.md',before);
for(const item of files['mentions.json']) item.label=`段落 ${item.span_id} 中的金额提及 ${item.id}`;
files['output-contract.json'].ledger={container:'array',item:{id:'原mentions的id，恰好一次',value:'保留原值，两位小数字符串',role:'下列role定义的一个枚举值',treatment:'下列treatment定义的一个枚举值',source_ids:'包含对应原段落的string[]；只允许所提供p-xxx与法源ID',reason:'不少于6个字符的简短依据'},role_definitions:{bank_disbursement:'金融机构向出借人发放的贷款',contract_face:'借条或合同约定的金额',receipt_face:'收条记载的收到金额；记载内容不自动等于实际取得',actual_transfer:'独立实际交付项；原文仅有合计而无可用明细时，将该合计作为一个实际交付项',transfer_duplicate:'另一处对已列交付或交付集合的重复称谓/叙述',transfer_summary:'同段已经给出可分别计入的明细的汇总项',claimed_interest:'当事人请求的利息，不是新交付',withheld_interest:'未交付而预先扣留的利息自述',asserted_net_interest:'累计/净利息收付的自述'},treatment_definitions:{include:'按所附规则可纳入返还范围的一次实际交付，包括没有明细的独立交付合计',exclude:'非本次应纳入的实际交付，不仅凭票据、诉请或自述计入',duplicate:'别处已经列入的交付复述，不另计',aggregate:'同段明细已分别列入的汇总项，不再计入'}};
files['output-contract.json'].restitution_total='两位小数字符串：scope限定的来源推断前提下材料可支持的返还范围，不是已独立流水核验的无条件事实；在legal.reason与evidence_limits.reason中交代前提';
let instruction=before.replace('# 无效借贷返还范围与证据账目审计','# 金融转贷款项的返还范围与证据账目审计');
instruction+='\n\n## 公开分类约定\n\nledger是数组。分类定义见output-contract.json，严格区分没有可用逐笔明细的独立交付合计，与同段已有可计入明细的汇总项；后者不得重复计入。另一段对同一已记载交付的复述为transfer_duplicate/duplicate。不能只按金额相同认定重复。返还总额表示限定来源推断前提下的审计金额，不是独立流水鉴定结论。\n';
await save('instruction.md',instruction);
await save('student-files.json',files);
await save('repair-history.json',{repair_round:1,trigger:'P3 required_repairs',method:'engineering_format_and_leakage_repair_not_model_generated_new_facts',old_instruction_sha256:hash(before),new_instruction_sha256:hash(instruction),old_student_sha256:hash(await read(`${RUN}/student-files-v1.json`)),new_student_sha256:hash(files),changes:['标题不预设效力结论','金额提及中性定位，不给角色或重复关系答案','公开角色/计数约定，保持严格评分原有经济语义','总额明确为限定来源前提的结果','P3补足D1-D4定义'],facts_changed:false,required_reruns:['P3','P4','P5','P6'],old_P3_preserved:true});
console.log('Repair1 saved; no facts or expected economic result changed. Re-run P3 before P4.');
