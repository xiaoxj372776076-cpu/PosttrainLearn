# 原始法律材料标准化

## 目的与边界

固定格式用于稳定提取、选题、few-shot 匹配和审计，不是把文书摘要当成新的法律依据。保留原始材料、冻结文本和字段定位，生成器可消费结构化视图，审核者仍能回到原文。

流程：解析/OCR -> 规范化文本 -> 字段与关系抽取 -> 原文对齐 -> 脱敏视图 -> 质量分流。原文缺失时输出缺失，不生成“看起来完整”的案例。

## 公共外壳

所有材料包使用 `material_pack_version=1.0`。固定外壳如下，示例仅描述格式，字符串内容不是实际数据：

```json
{
  "material_pack_version": "1.0",
  "material_id": "material-001",
  "material_type": "case",
  "source_ids": ["source-001"],
  "case_ids": ["canonical-case-001"],
  "metadata": {
    "jurisdiction": null,
    "document_date": null,
    "procedural_stage": null,
    "text_sha256": null,
    "normalization_version": "1.0",
    "permission_status": "unresolved"
  },
  "case_data": null,
  "authority_data": null,
  "guidance_data": null,
  "source_spans": [],
  "normalization_quality": {
    "status": "quarantine",
    "missing_fields": [],
    "conflicts": [],
    "alignment_check": "unresolved",
    "review_run_id": null
  }
}
```

`material_type` 为 case/authority/guidance，恰好一个同名 data 对象非 null。source_ids 非空；case_ids 只列案例身份，规范材料可以为空。metadata 的缺失值保持 null 并进入 missing_fields。规范的法条有效期不等于 document_date，也不等于本次任务 legal_as_of。

`source_spans` 保存稳定 span_id、source_id、原文 locator、quote 和源文本版本/哈希。所有抽取事实的 `support_span_ids` 必须解析到真实 span，不能只给模型虚构的段落编号。生成器的脱敏片段保留同一 span_id，并登记 redaction transform，不把改写片段假装成逐字原文。

## 案例内容固定字段

`case_data` 固定包含下表字段。集合类字段始终是数组；空数组表示确未提及或未提取，区分原因要写入质量信息。不能将缺失当作“法院否认”。

| 字段 | 每项需要保存的内容 |
|---|---|
| `entities` | entity_id、角色、匿名名称；原身份映射在私有侧保存 |
| `party_positions` | position_id、主张人、请求/抗辩、support_span_ids |
| `court_found_facts` | fact_id、内容、涉及实体、support_span_ids |
| `disputed_or_unresolved_facts` | 内容、各方说法、未解决原因与来源 |
| `evidence_items` | evidence_id、类型、内容、关联 fact_ids、法院采信状态与来源 |
| `timeline` | event_id、事件、时间/区间、是否确定、fact_ids、来源 |
| `amount_items` | amount_id、原文数值、十进制值、币种/单位、金额角色、主体、是否重复及来源 |
| `issues` | issue_id、法院实际处理的争议、关联事实/证据、来源 |
| `court_reasoning` | reasoning_id、issue_id、前提 fact_ids、evidence_ids、authority_ids、结论及来源 |
| `holdings` | holding_id、issue_id、实际裁判结论、程序/适用范围与来源 |
| `cited_authorities` | authority_id、原文引称、条号、版本线索、核验状态及来源 |
| `conditions_and_exceptions` | 适用条件、例外、关联 issue_id/authority_id、来源 |

party_positions 与 court_found_facts 分开；证据出现不等于法院采信。原文仅陈述但未裁判的争点不能写入 holdings。

amount_items 的 role 使用明确语义，如 disputed_principal、paid_amount、claimed_loss、court_awarded_amount、interest、fee、criminal_proceeds；未知时 unresolved。多次叙述同一笔金额用同一 amount_id 或 duplicate_of 关联，避免重复相加。

提取后把 fact/evidence/issue/holding/authority 的 ID 引用做一致性检查。命题单元应引用这些 ID，不在下游重新凭摘要编造事实。一个包可产出多个单元，但同一案例必须保持分组身份。

## 规范与指导材料

`authority_data` 固定包含 authority_name、issuer、instrument_type、version、effective_from、effective_to、jurisdiction、validity_check 和 provisions。

provisions 每项保存 provision_id、条号、完整条文、conditions、exceptions、cross_references、support_span_ids。条文不能只保留摘要，例外不能被压缩掉。日期/效力无法查证时保持 unresolved；只有经核验且适用于任务时间的版本进入有据答案。

`guidance_data` 保存 issuer、scope、guidance_status、propositions、cited_authorities、support_span_ids。专家摘要、评论、指导意见、正式法律规范分开标注；不能因为写得像法律就提升其效力等级。

## 长文、OCR 与跨块关系

优先按程序段、争点或章节切块，保留全局 span_id。禁止对每块独立随机出题后丢失上下文；跨块实体、同笔金额、争点与裁判结果需要合并核验。

重点核对 OCR 中的否定词、金额小数点、日期、条号、姓名对应和刑期单位。修正必须保留前后版本，引用区间随版本更新。对不可靠扫描件可先隔离，不用生成器“猜字”。

## 就绪门槛与下游接口

- ready：权限可用，关键字段与原文对齐，关系 ID 完整，足以支持至少一个命题单元。
- partial：有明确缺失/冲突；仅使用与缺口无关且完整核验的单元，不能将整包自动标为已通过。
- quarantine：关键原文、权限、事实身份或裁判结果不可靠，暂不用于出题。

单元及样本记录 material_pack_ids、fact_ids/evidence_ids/issue_ids 和使用的包版本。样本的 material_normalization 检查只能在所用单元的全部必要字段已对齐时 pass，不等于包内所有信息均已审核。

给 Writer 的安全视图包含该单元必要事实、证据、关系和已核验法律线索；源原件、原姓名映射、无关隐私与整案冗余信息不自动外传。需要预测的 holding 只在命题设计/答案侧使用，学生题面不能包含它。
