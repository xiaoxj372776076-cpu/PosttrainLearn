# 数据契约

## 分层产物

建议一轮运行保留以下逻辑层，可按已有平台格式映射，不要求机械采用这些文件名：

| 产物 | 用途 |
|---|---|
| `run-config.json` | 法域、时点、任务、预算、模型与提示词版本 |
| `sources.jsonl` | 原文、许可、版本、哈希、案例身份及程序信息 |
| `material-packs.jsonl` | 固定格式材料包、字段关系、金额角色和对齐状态 |
| `seeds.jsonl` | 经核验的 few-shot 问答、推理模式、难度与来源角色 |
| `few-shot-selection.jsonl` | 每次示例选择、顺序、理由及完整提示指纹 |
| `decision-units.jsonl` | 可命题的裁判判断点与原文支持 |
| `sample-history.jsonl` | 所有候选及修复版本，保留失败与修改历史 |
| `samples.jsonl` | 每个候选最终版本的发布视图，含验收状态和来源 |
| `verification.jsonl` | 每轮检查的输入指纹、实际结果及依据 |
| `groups.jsonl` | 案例/判断点/衍生题关联与分组切分 |
| `exports/` | 仅由合格记录产生的目标训练格式 |
| `audit-report.json` | 真实计数、错误分层、隔离原因和审计局限 |

保留历史版本，不把 rejected 覆盖成“从来没有失败过”。相同 ID 的修复应记录版本和原记录哈希；发布视图只包含每个 `sample_id` 的最终版本。

## 来源记录

源材料记录至少包含：`source_id`、`kind`、原始来源 URL 或用户文件定位、文本 SHA-256、规范化版本、许可/使用权限结论、司法辖区、材料日期、规范化文本位置。

- 案例加 `canonical_case_id`、法院、案号、裁判日期、程序阶段、是否完整。不同下载地址/格式的同一案件身份一致；同一争议的上下级审理按评估目标归组。
- 规范加 `authority_name`、条款编号、版本、有效起止时间、效力核验来源。条号正确但引用了错误版本也不通过。
- seed 加 `seed_id`、来源角色、是否允许生成衍生数据。角色为 `independent`、`benchmark_train`、`official_example` 或 `development`；test/heldout 不能进入生成器。development 被用于开发后不得继续作为未见评测。
- 对未知许可、未知现行效力或不可核验的材料记录 `unresolved`。不能用模型自报高置信度替代权限或效力依据。

原文引用统一基于冻结的规范化文本定位。可使用段落/页码/字符区间；字符区间必须明确按 Unicode code point 还是其他规则，默认 Python 字符索引、左闭右开。OCR 修正会产生新版本和新哈希，旧区间不得直接沿用。

材料包的固定字段见 [材料标准化](material-normalization.md)，seed 结构和筛选见 [Few-Shot 与难度](few-shot-and-difficulty.md)。它们与来源记录分层保存，不能用模型生成的材料摘要代替原文。

## 命题单元

`decision_unit` 至少包括：

```json
{
  "unit_id": "unit-001",
  "material_pack_ids": ["material-001"],
  "case_ids": ["case-001"],
  "issue": "需要法院判断的具体争议",
  "court_conclusion": "原案实际认定，不是拟制答案",
  "decisive_facts": ["得出该结论必不可少的事实"],
  "evidence_items": ["支持事实认定的证据内容"],
  "fact_ids": ["fact-001"],
  "evidence_ids": ["evidence-001"],
  "issue_ids": ["issue-001"],
  "authority_refs": ["已核验的规范及版本标识"],
  "conditions_and_exceptions": ["改变结论的条件、例外或适用范围"],
  "support_spans": [
    {"source_id": "case-doc-001", "locator": "paragraph-18", "quote": "该判断对应的原文"}
  ],
  "answerability": "supported",
  "unresolved_issues": []
}
```

示例结构不是可以直接拿去训练的样本。`court_conclusion` 和答案侧原文不可自动拼入需要学生预测结论的输入。

## 标准化样本

发布视图每行一个 JSON 对象。审计脚本接受 accepted/rejected/quarantine 三种状态；完整内容要求适用于 accepted。隔离样本可缺失答案，但必须有稳定 ID、分组、切分和拒绝/隔离原因。

```json
{
  "schema_version": "1.1",
  "sample_id": "sample-001",
  "unit_id": "unit-001",
  "material_pack_ids": ["material-001"],
  "group_id": "group-001",
  "case_ids": ["case-001"],
  "split": "train",
  "task_type": "rule_application",
  "jurisdiction": "明确的司法辖区",
  "legal_as_of": "2025-01-01",
  "question": "最终学生实际看到的完整任务、事实和允许的上下文",
  "answer": "有据的答案",
  "rationale": "短而可审核的依据说明",
  "source_ids": ["case-doc-001", "authority-001"],
  "evidence_spans": [
    {"source_id": "case-doc-001", "locator": "paragraph-18", "quote": "对应原文"}
  ],
  "authority_refs": [
    {"source_id": "authority-001", "provision": "条款编号", "version": "适用版本"}
  ],
  "seed_provenance": [
    {"seed_id": "seed-001", "role": "independent", "selection_reason": "同任务的规则适用与例外辨别示范"}
  ],
  "generation_mode": "few_shot",
  "few_shot_run_id": "few-shot-001",
  "difficulty": {
    "target": "D3",
    "assessed": "D3",
    "reasoning_requirements": ["rule_application", "exception_check"],
    "assessment_reason": "需要先适用一般规则，再判断有据的例外是否成立",
    "assessment_run_id": "difficulty-check-001"
  },
  "checks": {
    "source_permission": "pass",
    "material_normalization": "pass",
    "evidence_alignment": "pass",
    "question_sufficiency": "pass",
    "authority_validity": "pass",
    "answer_support": "pass",
    "blind_answer_agreement": "pass",
    "numeric_consistency": "not_applicable",
    "privacy": "pass",
    "leakage": "pass",
    "difficulty_alignment": "pass",
    "variant_consistency": "not_applicable"
  },
  "verification_run_ids": ["check-run-001"],
  "remaining_issues": [],
  "review_level": "auto_checked",
  "variant_type": "base",
  "status": "accepted"
}
```

`pass` 只表示真实完成的检查结果；模板不是检查证据。`verification_run_ids` 应解析到日志，包含模型实际标识、输入哈希、提示词版本、时间、结果与理由。记录同模型复用、未使用工具、未进行专家审查等限制。

检查状态仅允许 `pass/fail/unresolved/not_applicable`。accepted 的 source_permission、material_normalization、evidence_alignment、question_sufficiency、answer_support、blind_answer_agreement、privacy、leakage、difficulty_alignment 必须 pass。其他检查只可 pass 或经过解释的不适用；有 authority_refs 时 authority_validity 必须 pass，金额题 numeric_consistency 必须 pass，派生题 variant_consistency 必须 pass。

accepted 的 material_pack_ids 非空并解析到已核验的所用材料包。generation_mode 为 few_shot/zero_shot_ablation：few_shot 需非空且不重复的 seed_provenance、每条选择理由和 few_shot_run_id；zero_shot_ablation 需空种子列表和 zero_shot_experiment_id。未使用示例不能冒称 few_shot。只保存元数据不证明真的进行了选择，必须在日志中找到实际提示。

difficulty 的 target/assessed 为 D1-D4，发布前应一致；调整目标需在配置/历史中显式记录，不仅改标签。reasoning_requirements 为非空且不同的已定义推理模式，assessment_reason 和 assessment_run_id 非空。D3 至少两个模式且包含一个非直接查找模式；D4 至少三个。这只是结构门槛，是否确有必要须经过 P3/P6 的内容审核。

本样本契约升级为 1.1，material_pack 独立采用 1.0。旧 1.0 样本保留历史，只有完成材料对齐、few-shot 来源记录和难度审查后才迁入新发布视图，禁止批量补写 pass 伪造迁移。

`task_type` 取 `rule_application/decision_explanation/evidence_qa/numeric_calculation/claim_verification/sentence_extraction`；特殊任务先扩展契约，不伪装成已有类别。

`variant_type` 为 `base/paraphrase/false_claim`。claim_verification 都需 `claim_label=supported/refuted/insufficient`。false_claim 仅用于 claim_verification，且 `claim_label=refuted`；预设 answer 必须正确反驳主张。它不是 DPO rejected answer。证据不足的标签为 insufficient，禁止改叫 refuted。

`review_level` 为 `auto_checked/human_reviewed`。human_reviewed 还需 `human_review` 对象，含 `reviewer_id`、`reviewed_at` 和 `decision=accepted`。匿名审核员 ID 可用，不需要存真实身份。少量抽审不能把全部记录改标为 human_reviewed。

## 分组与训练展开

`group_id` 表示关联组件，`unit_id` 表示同一裁判判断点，`case_ids` 是目标案例的规范身份。一个组/判断点/案例不得跨 train/dev/test。有例外的研究协议必须另行定义审计模式并披露，不能静默绕过本契约。

通用法条的 source_id 可在多个 split 共享；不要把规范复用误判为案件泄漏。相反，仅改名后的案例仍是同案，不能生成新的 case_id 避开检查。切分后才展开直接/解释版。

训练行加 `style=direct/answer_with_rationale` 和 `parent_sample_id`。直接版保留相同 gold answer；解释版添加 rationale，不改变问题实质。标注任务如需检索证据，应把证据文档 ID 单独导出；refuted 主张的反驳文档仍可是检索相关正样本。

统计至少分别报告：源材料/材料包/命题单元数、seed 数与使用集中度、few-shot/zero-shot 数、目标与审定难度、候选数、accepted/rejected/quarantine 数、唯一问题数、各 split/任务/法域/审核等级数、训练行数。文件名和目标数量不是实际数量。
