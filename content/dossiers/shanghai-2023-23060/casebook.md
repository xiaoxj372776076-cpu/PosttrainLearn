# 马某与皮某民间借贷纠纷案件全景记录

Schema 0.1 · 案件包 0.1.0

仅基于一审公开判决书的脱敏视图试填，不是完整卷宗或真实庭前知识视图

原告以民间借贷起诉，诉请由本金、利息、违约金及费用调整为本金及费用。一审法院将金融机构贷款转贷认定为合同无效，按实际交付款项判令返还52.41万元。上诉、生效和履行情况未取得。

## 案件元数据

```json
{
  "case_id": "cn-shanghai-minhang-2023-civil-first-23060",
  "title": "马某与皮某民间借贷纠纷案件全景记录",
  "jurisdiction": "中国大陆 · 上海",
  "scope": "仅基于一审公开判决书的脱敏视图试填，不是完整卷宗或真实庭前知识视图",
  "snapshot_as_of": "2026-11-14",
  "normalization_status": "partial",
  "training_readiness": "blocked",
  "permission_status": "unresolved",
  "expert_review_status": "not_reviewed",
  "extraction_method": "agent_assisted_source_extraction",
  "inference_notes": "证据提交者及证据到事实的关联由整理者依据判决书上下文归纳，不是原始证据目录或法院逐项采信记录。争点卡为整理者组织裁判理由，未获专家批准。",
  "source_case_file": "content/cases/shanghai-2023-23060.json",
  "summary": "原告以民间借贷起诉，诉请由本金、利息、违约金及费用调整为本金及费用。一审法院将金融机构贷款转贷认定为合同无效，按实际交付款项判令返还52.41万元。上诉、生效和履行情况未取得。"
}
```

## 程序链

### proc-first 一审民事程序

2023年5月6日立案，先适用简易程序，后转普通程序独任审理；2023年9月25日公开开庭，依法缺席审判。

```json
{
  "id": "proc-first",
  "court": "上海市闵行区人民法院",
  "case_number": "（2023）沪0112民初23060号",
  "kind": "civil_first_instance",
  "filed_at": "2023-05-06",
  "decision_at": "2023-11-21",
  "relations": [],
  "finality_status": "unresolved",
  "support_span_ids": [
    "doc-judgment:p-003",
    "doc-judgment:p-006",
    "doc-judgment:p-031"
  ]
}
```

## 材料清单

### doc-judgment 一审民事判决书脱敏展示视图

取得范围见文档元数据。

```json
{
  "id": "doc-judgment",
  "kind": "judgment",
  "acquisition": "published_judgment_view",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "producer": "上海市闵行区人民法院",
  "submitted_by": null,
  "formed_at": "2023-11-21",
  "submitted_at": null,
  "acquired_at": "2026-11-14T15:58:42+08:00",
  "text_version": "redacted-view-1",
  "available_at_in_proceeding": null,
  "availability_status": "unresolved",
  "support_span_ids": [
    "doc-judgment:p-001",
    "doc-judgment:p-002",
    "doc-judgment:p-003",
    "doc-judgment:p-031"
  ],
  "source_url": "https://www.hshfy.sh.cn/shfy/web/flws_view.jsp?pa=adGFoPaOoMjAyM6Opu6YwMTEyw/Gz9TIzMDYwusUmd3N4aD00z",
  "source_text_sha256": "54055dd0f876d61a49445184eabc6a8b2f16e2c2b6050c4c47fa0c3ce5ce170b",
  "raw_sha256": "817aefade5d2455d61208568046eae2ec7549ef2b25ddd7f406680b7a99ba6bc",
  "view_sha256": "5735df246160af2f3f6cc854cbff91ea2719e26bbebdb940604b34be10efbbeb",
  "redaction_count": 8
}
```

### doc-note 借条

取得范围见文档元数据。

```json
{
  "id": "doc-note",
  "kind": "written_evidence",
  "acquisition": "judgment_reference",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "producer": "被告皮某（据判决书转述）",
  "formed_at": "2022-08-24",
  "submitted_at": null,
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-015"
  ]
}
```

### doc-receipt 收条

取得范围见文档元数据。

```json
{
  "id": "doc-receipt",
  "kind": "written_evidence",
  "acquisition": "judgment_reference",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "producer": "被告皮某（据判决书转述）",
  "formed_at": "2022-08-24",
  "submitted_at": null,
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-015"
  ]
}
```

### doc-bank 银行明细

取得范围见文档元数据。

```json
{
  "id": "doc-bank",
  "kind": "bank_records",
  "acquisition": "judgment_reference",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "formed_at": null,
  "submitted_at": null,
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-016"
  ]
}
```

### doc-loan 贷款合同

取得范围见文档元数据。

```json
{
  "id": "doc-loan",
  "kind": "contract",
  "acquisition": "judgment_reference",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "formed_at": "2022-08-24",
  "submitted_at": null,
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-012",
    "doc-judgment:p-013",
    "doc-judgment:p-014"
  ]
}
```

### doc-alipay 支付宝付款截图

取得范围见文档元数据。

```json
{
  "id": "doc-alipay",
  "kind": "payment_screenshots",
  "acquisition": "judgment_reference",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "formed_at": null,
  "submitted_at": null,
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-017"
  ]
}
```

### doc-wechat 微信聊天记录截图

取得范围见文档元数据。

```json
{
  "id": "doc-wechat",
  "kind": "chat_screenshots",
  "acquisition": "judgment_reference",
  "original_obtained": false,
  "proceeding_id": "proc-first",
  "formed_at": null,
  "submitted_at": null,
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-017"
  ]
}
```

## 主体与关系

### party-ma 马某

本案一审原告；个人贷款的借款人与向皮某转款的一方。真实身份映射不在公开包中。

```json
{
  "id": "party-ma",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "plaintiff"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-004",
    "doc-judgment:p-012",
    "doc-judgment:p-016"
  ]
}
```

### party-pi 皮某

本案一审被告；借条与收条出具者、转款收取者。未到庭答辩亦未提供证据，不等于承认全部主张。

```json
{
  "id": "party-pi",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "defendant"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-005",
    "doc-judgment:p-008",
    "doc-judgment:p-015",
    "doc-judgment:p-016"
  ]
}
```

### court-first 上海市闵行区人民法院

本案一审裁判机关。

```json
{
  "id": "court-first",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "court"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-001"
  ]
}
```

### bank-gf 广发银行

据法院查明，于2022年8月24日向原告发放14.40万元贷款。

```json
{
  "id": "bank-gf",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "nonparty_lender"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-012"
  ]
}
```

### bank-js 江苏银行

据法院查明，于2022年8月24日向原告发放20万元贷款。

```json
{
  "id": "bank-js",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "nonparty_lender"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-013"
  ]
}
```

### bank-sh 上海农商银行

判决书使用上海农商业银行、上海农商银行等名称，按同一贷款关系归一，原文名称保留。

```json
{
  "id": "bank-sh",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "nonparty_lender"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-014"
  ]
}
```

### intermediary XX易融公司

贷款中介公司，仅在原告事实与理由中出现，具体身份和行为未独立核验。

```json
{
  "id": "intermediary",
  "roles": [
    {
      "proceeding_id": "proc-first",
      "role": "nonparty_intermediary"
    }
  ],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

## 事实与程序时间线

### ev-contact 请求陪同提贷

原告称被告于微信提出陪同提款并携带征信报告。

```json
{
  "id": "ev-contact",
  "kind": "fact",
  "date_start": "2022-08-22",
  "date_end": null,
  "date_precision": "day",
  "attribution": "原告陈述，判决书转述",
  "actor_id": "party-pi",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### ev-loans 贷款发放与借条收条

三家银行贷款合计54.40万元；被告同日出具记载54.40万元的借条和收条。

```json
{
  "id": "ev-loans",
  "kind": "fact",
  "date_start": "2022-08-24",
  "date_end": null,
  "date_precision": "day",
  "attribution": "一审法院查明",
  "amount_ids": [
    "amt-bank-total",
    "amt-face"
  ],
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-012",
    "doc-judgment:p-013",
    "doc-judgment:p-014",
    "doc-judgment:p-015"
  ]
}
```

### ev-first-transfer 四笔首次转账

原告向被告转账四笔合计50.20万元，各笔金额及时间未取得。

```json
{
  "id": "ev-first-transfer",
  "kind": "fact",
  "date_start": "2022-08-24",
  "date_end": "2022-08-25",
  "date_precision": "range",
  "attribution": "一审法院查明",
  "amount_ids": [
    "amt-first"
  ],
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-016"
  ]
}
```

### ev-dec5 追加转款750元与1350元

法院记载被告提出水电费、还花呗资金需求，原告于当日通过支付宝打款。

```json
{
  "id": "ev-dec5",
  "kind": "fact",
  "date_start": "2022-12-05",
  "date_end": null,
  "date_precision": "day",
  "attribution": "一审法院查明",
  "amount_ids": [
    "amt-750",
    "amt-1350"
  ],
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-017"
  ]
}
```

### ev-dec9 追加转款2万元

法院记载被告表示资金不够，原告于当日通过支付宝打款2万元。

```json
{
  "id": "ev-dec9",
  "kind": "fact",
  "date_start": "2022-12-09",
  "date_end": null,
  "date_precision": "day",
  "attribution": "一审法院查明",
  "amount_ids": [
    "amt-20000"
  ],
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-017"
  ]
}
```

### ev-pay-gf 广发贷款结清

原告于2023年2月9日结清广发银行贷款。

```json
{
  "id": "ev-pay-gf",
  "kind": "fact",
  "date_start": "2023-02-09",
  "date_end": null,
  "date_precision": "day",
  "attribution": "一审法院查明",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-012"
  ]
}
```

### ev-pay-js 江苏贷款结清

原告于2023年2月13日结清江苏银行贷款。

```json
{
  "id": "ev-pay-js",
  "kind": "fact",
  "date_start": "2023-02-13",
  "date_end": null,
  "date_precision": "day",
  "attribution": "一审法院查明",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-013"
  ]
}
```

### ev-pay-sh 农商贷款已结清

判决书记载该贷款已结清，未提供具体日期。

```json
{
  "id": "ev-pay-sh",
  "kind": "fact",
  "date_start": null,
  "date_end": null,
  "date_precision": "unresolved",
  "attribution": "一审法院查明",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-014"
  ]
}
```

### ev-police 报警与民事处理选择

原告自述曾报警、警方不予立案，后表示不再进行刑事立案。未取得公安决定或记录，不作刑事定性。

```json
{
  "id": "ev-police",
  "kind": "fact",
  "date_start": null,
  "date_end": null,
  "date_precision": "unresolved",
  "attribution": "原告自述，判决书转述",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-018"
  ]
}
```

### ev-file 一审立案

法院于2023年5月6日立案。

```json
{
  "id": "ev-file",
  "kind": "procedure",
  "date_start": "2023-05-06",
  "date_end": null,
  "date_precision": "day",
  "attribution": "法院程序记载",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-006"
  ]
}
```

### ev-mode 简易程序转普通程序

法院认为存在不宜适用简易程序的情形，转普通程序独任审理；具体转换日期未提及。

```json
{
  "id": "ev-mode",
  "kind": "procedure",
  "date_start": null,
  "date_end": null,
  "date_precision": "unresolved",
  "attribution": "法院程序记载",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-006"
  ]
}
```

### ev-claim-change 诉讼请求变更

原告在诉讼中变更为本金及相关费用请求；具体变更日期与书面申请未取得。

```json
{
  "id": "ev-claim-change",
  "kind": "procedure",
  "date_start": null,
  "date_end": null,
  "date_precision": "unresolved",
  "attribution": "判决书转述诉请",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### ev-hearing 公开开庭与缺席审理

原告到庭，被告经公告送达开庭传票未到庭，法院依法缺席审判。

```json
{
  "id": "ev-hearing",
  "kind": "procedure",
  "date_start": "2023-09-25",
  "date_end": null,
  "date_precision": "day",
  "attribution": "法院程序记载",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-006",
    "doc-judgment:p-008"
  ]
}
```

### ev-judgment 一审判决作出

判决书落款为2023年11月21日；送达、生效和履行日期未知。

```json
{
  "id": "ev-judgment",
  "kind": "procedure",
  "date_start": "2023-11-21",
  "date_end": null,
  "date_precision": "day",
  "attribution": "判决书落款",
  "proceeding_id": "proc-first",
  "support_span_ids": [
    "doc-judgment:p-031"
  ]
}
```

## 诉请沿革

### claim-principal-v1 原诉请1：借款本金

请求立即返还借款本金54.40万元。

```json
{
  "id": "claim-principal-v1",
  "proceeding_id": "proc-first",
  "actor_id": "party-ma",
  "version": 1,
  "status": "superseded",
  "supersedes": [],
  "amount_ids": [
    "amt-claim-principal"
  ],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### claim-interest-v1 原诉请2：利息

请求自2023年3月至还款时的利息，暂计至2023年8月23日为2.21万元。变更后的诉请没有列入该项，不标成法院已经驳回。

```json
{
  "id": "claim-interest-v1",
  "proceeding_id": "proc-first",
  "actor_id": "party-ma",
  "version": 1,
  "status": "not_carried_forward",
  "supersedes": [],
  "amount_ids": [
    "amt-claim-interest"
  ],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### claim-penalty-v1 原诉请3：逾期违约金

请求自2023年3月1日至还款时的逾期违约金，暂计至2023年8月23日为4787.20元。变更后未列入。

```json
{
  "id": "claim-penalty-v1",
  "proceeding_id": "proc-first",
  "actor_id": "party-ma",
  "version": 1,
  "status": "not_carried_forward",
  "supersedes": [],
  "amount_ids": [
    "amt-claim-penalty"
  ],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### claim-fees-v1 原诉请4：相关费用

请求承担诉讼及执行过程的案件受理费、保全费、执行费等费用。具体金额未给出。

```json
{
  "id": "claim-fees-v1",
  "proceeding_id": "proc-first",
  "actor_id": "party-ma",
  "version": 1,
  "status": "superseded",
  "supersedes": [],
  "amount_ids": [],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### claim-principal-v2 变更后诉请1：本金

请求归还借款本金54.40万元。

```json
{
  "id": "claim-principal-v2",
  "proceeding_id": "proc-first",
  "actor_id": "party-ma",
  "version": 2,
  "status": "last_recorded",
  "supersedes": [
    "claim-principal-v1"
  ],
  "amount_ids": [
    "amt-claim-principal"
  ],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### claim-fees-v2 变更后诉请2：相关费用

请求承担诉讼及执行过程的案件受理费、执行费等费用；判决书这一版本未列保全费。

```json
{
  "id": "claim-fees-v2",
  "proceeding_id": "proc-first",
  "actor_id": "party-ma",
  "version": 2,
  "status": "last_recorded",
  "supersedes": [
    "claim-fees-v1"
  ],
  "amount_ids": [],
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

## 事实命题

### fact-relation 双方关系

双方是什么关系？

```json
{
  "id": "fact-relation",
  "support_span_ids": [
    "doc-judgment:p-011"
  ]
}
```

### fact-deception 贷款办理经过

原告为何办理贷款，是否存在其所称欺骗？

```json
{
  "id": "fact-deception",
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-018"
  ]
}
```

### fact-bank 款项来源

原告获得的54.40万元是否来自金融机构贷款？

```json
{
  "id": "fact-bank",
  "support_span_ids": [
    "doc-judgment:p-012",
    "doc-judgment:p-013",
    "doc-judgment:p-014"
  ]
}
```

### fact-note 借条收条记载

借条、收条记载的金额与还款条件是什么？

```json
{
  "id": "fact-note",
  "support_span_ids": [
    "doc-judgment:p-015"
  ]
}
```

### fact-first 首次实际交付

2022年8月24日至25日实际交付被告多少款项？

```json
{
  "id": "fact-first",
  "support_span_ids": [
    "doc-judgment:p-016"
  ]
}
```

### fact-later 追加实际交付

2022年12月5日和9日实际交付的款项合计多少？

```json
{
  "id": "fact-later",
  "support_span_ids": [
    "doc-judgment:p-017"
  ]
}
```

### fact-later-role 追加款项的性质与来源

2.21万元追加款项应如何解释，其资金来源为何？

```json
{
  "id": "fact-later-role",
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-020"
  ]
}
```

### fact-withheld 预扣利息实际取得

预扣的利息部分是否实际交付并被被告利用？

```json
{
  "id": "fact-withheld",
  "support_span_ids": [
    "doc-judgment:p-016",
    "doc-judgment:p-020"
  ]
}
```

### fact-net-interest 原告自述净利息

原告自述的累计利息金额能否与同段数字核对？

```json
{
  "id": "fact-net-interest",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### fact-attendance 被告到庭与举证

被告是否到庭答辩或提供证据？

```json
{
  "id": "fact-attendance",
  "support_span_ids": [
    "doc-judgment:p-006",
    "doc-judgment:p-008"
  ]
}
```

## 各方陈述

### assert-deception 原告主张受欺骗

原告称原本仅帮助朋友，被告未经其同意安排以其名义申请贷款，并自述曾报警；不将该说法提升为已证实欺诈。

```json
{
  "id": "assert-deception",
  "actor_id": "party-ma",
  "proceeding_id": "proc-first",
  "fact_ids": [
    "fact-deception"
  ],
  "stance": "asserted",
  "source_kind": "judgment_restatement",
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-018"
  ]
}
```

### assert-withheld 原告说明预扣利息

原告自述50.20万元系贷款54.40万元扣除一年利息4.20万元所得。

```json
{
  "id": "assert-withheld",
  "actor_id": "party-ma",
  "proceeding_id": "proc-first",
  "fact_ids": [
    "fact-first",
    "fact-withheld"
  ],
  "amount_ids": [
    "amt-first",
    "amt-withheld"
  ],
  "stance": "asserted",
  "support_span_ids": [
    "doc-judgment:p-016"
  ]
}
```

### assert-refund 原告将2.21万元解释为退还利息

原告称2022年12月交付的2.21万元是退还部分预扣利息。

```json
{
  "id": "assert-refund",
  "actor_id": "party-ma",
  "proceeding_id": "proc-first",
  "fact_ids": [
    "fact-later-role"
  ],
  "amount_ids": [
    "amt-later"
  ],
  "stance": "asserted",
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-020"
  ]
}
```

### assert-net-interest 原告自述累计利息2.19万元

原文自述被告累计支付原告利息2.19万元。保留这一说法，与4.20减2.21等于1.99万元的算术差异列入待核问题。

```json
{
  "id": "assert-net-interest",
  "actor_id": "party-ma",
  "proceeding_id": "proc-first",
  "fact_ids": [
    "fact-net-interest"
  ],
  "amount_ids": [
    "amt-claimed-net"
  ],
  "stance": "asserted_unverified",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### assert-rates 原告所述银行利率

原告所述年利率分别为广发5.80%、农商11.016%、江苏5.13%；本包未取得贷款合同原件核验。

```json
{
  "id": "assert-rates",
  "actor_id": "party-ma",
  "proceeding_id": "proc-first",
  "fact_ids": [
    "fact-bank"
  ],
  "amount_ids": [
    "rate-gf",
    "rate-sh",
    "rate-js"
  ],
  "stance": "asserted_unverified",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

## 证据与证明目的

### evidence-note 借条

判决书转述记载54.40万元、借期、月息、逾期违约金等。证明目的为整理者依据裁判上下文归纳，并非原始证据目录全文。

```json
{
  "id": "evidence-note",
  "document_id": "doc-note",
  "proceeding_id": "proc-first",
  "original_obtained": false,
  "submitted_by": "party-ma",
  "submission_at": null,
  "exhibit_number": null,
  "proof_purpose_origin": "analyst_inferred",
  "fact_ids": [
    "fact-note"
  ],
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-015"
  ]
}
```

### evidence-receipt 收条

判决书转述收条记载收到54.40万元、资金周转、转账收款。记载收到不等于证明实际交付该金额。

```json
{
  "id": "evidence-receipt",
  "document_id": "doc-receipt",
  "proceeding_id": "proc-first",
  "original_obtained": false,
  "submitted_by": "party-ma",
  "submission_at": null,
  "exhibit_number": null,
  "proof_purpose_origin": "analyst_inferred",
  "fact_ids": [
    "fact-note",
    "fact-first"
  ],
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-015"
  ]
}
```

### evidence-bank 银行明细

法院查明四笔转账合计50.20万元；明细原件和各笔完整信息未取得。

```json
{
  "id": "evidence-bank",
  "document_id": "doc-bank",
  "proceeding_id": "proc-first",
  "original_obtained": false,
  "submitted_by": "party-ma",
  "submission_at": null,
  "exhibit_number": null,
  "proof_purpose_origin": "analyst_inferred",
  "fact_ids": [
    "fact-first"
  ],
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-016"
  ]
}
```

### evidence-loan 贷款合同

法院查明三家银行贷款关系及结清信息，未取得三份合同全文。

```json
{
  "id": "evidence-loan",
  "document_id": "doc-loan",
  "proceeding_id": "proc-first",
  "original_obtained": false,
  "submitted_by": "party-ma",
  "submission_at": null,
  "exhibit_number": null,
  "proof_purpose_origin": "analyst_inferred",
  "fact_ids": [
    "fact-bank"
  ],
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-012",
    "doc-judgment:p-013",
    "doc-judgment:p-014"
  ]
}
```

### evidence-alipay 支付宝付款截图

法院查明三笔追加付款合计22100元；截图原件未取得。

```json
{
  "id": "evidence-alipay",
  "document_id": "doc-alipay",
  "proceeding_id": "proc-first",
  "original_obtained": false,
  "submitted_by": "party-ma",
  "submission_at": null,
  "exhibit_number": null,
  "proof_purpose_origin": "analyst_inferred",
  "fact_ids": [
    "fact-later"
  ],
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-017"
  ]
}
```

### evidence-wechat 微信聊天记录截图

法院记载配合贷款审批及追加借款的聊天经过；完整聊天截图未取得。

```json
{
  "id": "evidence-wechat",
  "document_id": "doc-wechat",
  "proceeding_id": "proc-first",
  "original_obtained": false,
  "submitted_by": "party-ma",
  "submission_at": null,
  "exhibit_number": null,
  "proof_purpose_origin": "analyst_inferred",
  "fact_ids": [
    "fact-later",
    "fact-later-role"
  ],
  "support_span_ids": [
    "doc-judgment:p-009",
    "doc-judgment:p-017"
  ]
}
```

## 举证质证记录

未取得或未形成记录，具体原因见缺口，不推断为未发生。

## 各程序法院认定

### assess-relation 双方系朋友

一审法院查明双方系朋友关系。

```json
{
  "id": "assess-relation",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-relation"
  ],
  "evidence_ids": [],
  "support_span_ids": [
    "doc-judgment:p-011"
  ]
}
```

### assess-bank 银行贷款来源

法院查明原告分别获得广发14.40万元、江苏20万元、农商20万元贷款。

```json
{
  "id": "assess-bank",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-bank"
  ],
  "evidence_ids": [
    "evidence-loan"
  ],
  "amount_ids": [
    "amt-bank-total"
  ],
  "support_span_ids": [
    "doc-judgment:p-012",
    "doc-judgment:p-013",
    "doc-judgment:p-014"
  ]
}
```

### assess-note 借条和收条内容

法院查明被告出具借条、收条，均记载54.40万元；借条期限为2022年8月24日至2023年8月23日，月息3500元，逾期违约金0.005%天，并负担额外费用。

```json
{
  "id": "assess-note",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-note"
  ],
  "evidence_ids": [
    "evidence-note",
    "evidence-receipt"
  ],
  "amount_ids": [
    "amt-face",
    "amt-monthly",
    "rate-contract"
  ],
  "support_span_ids": [
    "doc-judgment:p-015"
  ]
}
```

### assess-first 首次实际交付50.20万元

法院查明四笔实际转账合计50.20万元。

```json
{
  "id": "assess-first",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-first"
  ],
  "evidence_ids": [
    "evidence-bank"
  ],
  "amount_ids": [
    "amt-first"
  ],
  "support_span_ids": [
    "doc-judgment:p-016"
  ]
}
```

### assess-later 追加交付2.21万元

法院查明750元、1350元和2万元三笔追加交付；在裁判理由中结合原告退款说法认定资金亦来自原告银行贷款。

```json
{
  "id": "assess-later",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-later",
    "fact-later-role"
  ],
  "evidence_ids": [
    "evidence-alipay",
    "evidence-wechat"
  ],
  "amount_ids": [
    "amt-later"
  ],
  "support_span_ids": [
    "doc-judgment:p-017",
    "doc-judgment:p-020"
  ]
}
```

### assess-withheld 预扣部分不是被告实际取得财产

法院认为预扣利息实际未交付、被告未实际利用；合同及利息约定无效，不作为应返还的实际取得财产。

```json
{
  "id": "assess-withheld",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-withheld"
  ],
  "evidence_ids": [],
  "amount_ids": [
    "amt-withheld"
  ],
  "authority_ids": [
    "authority-157",
    "authority-loan-13"
  ],
  "support_span_ids": [
    "doc-judgment:p-020",
    "doc-judgment:p-022"
  ]
}
```

### assess-evidence-general 法院整体确认在卷证据

法院整体记载提交的借条、收条、银行明细、贷款合同、支付宝及微信截图予以确认并在卷佐证。未逐项披露三性审查，不为每份原件伪造逐项采信理由。

```json
{
  "id": "assess-evidence-general",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [],
  "evidence_ids": [
    "evidence-note",
    "evidence-receipt",
    "evidence-bank",
    "evidence-loan",
    "evidence-alipay",
    "evidence-wechat"
  ],
  "assessment_scope": "collective_statement_only",
  "support_span_ids": [
    "doc-judgment:p-009"
  ]
}
```

### assess-default 缺席的程序后果

法院认为被告无正当理由拒不到庭系放弃相应诉讼权利；不将此改写为承认所有事实。

```json
{
  "id": "assess-default",
  "proceeding_id": "proc-first",
  "actor_id": "court-first",
  "fact_ids": [
    "fact-attendance"
  ],
  "evidence_ids": [],
  "authority_ids": [
    "authority-cpl-147"
  ],
  "support_span_ids": [
    "doc-judgment:p-021",
    "doc-judgment:p-022"
  ]
}
```

## 争点卡

### issue-civil 为何按民间借贷民事处理

法院允许原告不再进行刑事报案、按民间借贷处理的权益处分；本包不判断刑事犯罪是否成立。

```json
{
  "id": "issue-civil",
  "proceeding_id": "proc-first",
  "origin": "analyst_organized_court_reasoning",
  "claim_ids": [
    "claim-principal-v2"
  ],
  "fact_ids": [
    "fact-deception"
  ],
  "assertion_ids": [
    "assert-deception"
  ],
  "evidence_ids": [],
  "assessment_ids": [],
  "authority_ids": [],
  "decision_ids": [],
  "court_conclusion": "准许按民间借贷处理。",
  "open_questions": [
    "未取得公安记录，不能推导刑事实体结论。"
  ],
  "support_span_ids": [
    "doc-judgment:p-018",
    "doc-judgment:p-019"
  ]
}
```

### issue-validity 贷款转贷的合同效力

法院以款项来源于金融机构贷款并转贷，认定双方民间借贷合同无效。此处复述原裁判，不声称当前法律通用结论。

```json
{
  "id": "issue-validity",
  "proceeding_id": "proc-first",
  "origin": "analyst_organized_court_reasoning",
  "claim_ids": [
    "claim-principal-v2"
  ],
  "fact_ids": [
    "fact-bank",
    "fact-first",
    "fact-later-role"
  ],
  "assertion_ids": [
    "assert-refund"
  ],
  "evidence_ids": [
    "evidence-loan",
    "evidence-bank",
    "evidence-alipay",
    "evidence-wechat"
  ],
  "assessment_ids": [
    "assess-bank",
    "assess-first",
    "assess-later"
  ],
  "authority_ids": [
    "authority-loan-13"
  ],
  "decision_ids": [
    "decision-return"
  ],
  "court_conclusion": "一审认定民间借贷合同无效。",
  "open_questions": [
    "适用规范全文及版本尚未独立核验。"
  ],
  "support_span_ids": [
    "doc-judgment:p-020",
    "doc-judgment:p-022"
  ]
}
```

### issue-return 实际应返还金额及预扣利息

法院区分借条/诉请金额和实际交付，计入50.20万元与追加2.21万元，不计入未实际交付的预扣部分。

```json
{
  "id": "issue-return",
  "proceeding_id": "proc-first",
  "origin": "analyst_organized_court_reasoning",
  "claim_ids": [
    "claim-principal-v1",
    "claim-principal-v2",
    "claim-interest-v1"
  ],
  "fact_ids": [
    "fact-note",
    "fact-first",
    "fact-later",
    "fact-later-role",
    "fact-withheld"
  ],
  "assertion_ids": [
    "assert-withheld",
    "assert-refund"
  ],
  "evidence_ids": [
    "evidence-note",
    "evidence-receipt",
    "evidence-bank",
    "evidence-alipay",
    "evidence-wechat"
  ],
  "assessment_ids": [
    "assess-note",
    "assess-first",
    "assess-later",
    "assess-withheld"
  ],
  "authority_ids": [
    "authority-157",
    "authority-loan-13",
    "authority-loan-31"
  ],
  "amount_ids": [
    "amt-face",
    "amt-first",
    "amt-later",
    "amt-total",
    "amt-withheld"
  ],
  "decision_ids": [
    "decision-return"
  ],
  "court_conclusion": "合同无效后按实际取得财产返还52.41万元。",
  "open_questions": [
    "实际转账原件未取得；原告净利息自述存在另行待核的算术差异。"
  ],
  "support_span_ids": [
    "doc-judgment:p-015",
    "doc-judgment:p-016",
    "doc-judgment:p-017",
    "doc-judgment:p-020",
    "doc-judgment:p-022",
    "doc-judgment:p-023"
  ]
}
```

### issue-default 未到庭的法律后果范围

法院缺席审判并认为被告放弃相应诉讼权利，仍依据证据和实际交付确定返还金额。

```json
{
  "id": "issue-default",
  "proceeding_id": "proc-first",
  "origin": "analyst_organized_court_reasoning",
  "claim_ids": [
    "claim-principal-v2"
  ],
  "fact_ids": [
    "fact-attendance"
  ],
  "assertion_ids": [],
  "evidence_ids": [],
  "assessment_ids": [
    "assess-default"
  ],
  "authority_ids": [
    "authority-cpl-147"
  ],
  "decision_ids": [
    "decision-return"
  ],
  "court_conclusion": "缺席程序后果不被整理为事实自认。",
  "open_questions": [
    "未取得送达材料、庭审笔录和完整质证过程。"
  ],
  "support_span_ids": [
    "doc-judgment:p-006",
    "doc-judgment:p-008",
    "doc-judgment:p-021",
    "doc-judgment:p-022"
  ]
}
```

## 金额与交易台账

### amt-gf 广发贷款发放

法院查明贷款14.40万元。

```json
{
  "id": "amt-gf",
  "value": "144000.00",
  "currency": "CNY",
  "role": "bank_disbursement",
  "ledger_kind": "transaction",
  "from_id": "bank-gf",
  "to_id": "party-ma",
  "support_span_ids": [
    "doc-judgment:p-012"
  ]
}
```

### amt-js 江苏贷款发放

法院查明贷款20万元。

```json
{
  "id": "amt-js",
  "value": "200000.00",
  "currency": "CNY",
  "role": "bank_disbursement",
  "ledger_kind": "transaction",
  "from_id": "bank-js",
  "to_id": "party-ma",
  "support_span_ids": [
    "doc-judgment:p-013"
  ]
}
```

### amt-sh 农商贷款发放

法院查明贷款20万元。

```json
{
  "id": "amt-sh",
  "value": "200000.00",
  "currency": "CNY",
  "role": "bank_disbursement",
  "ledger_kind": "transaction",
  "from_id": "bank-sh",
  "to_id": "party-ma",
  "support_span_ids": [
    "doc-judgment:p-014"
  ]
}
```

### amt-bank-total 银行贷款合计

三家贷款合计54.40万元。

```json
{
  "id": "amt-bank-total",
  "value": "544000.00",
  "currency": "CNY",
  "role": "bank_disbursement",
  "ledger_kind": "aggregate",
  "components": [
    "amt-gf",
    "amt-js",
    "amt-sh"
  ],
  "support_span_ids": [
    "doc-judgment:p-012",
    "doc-judgment:p-013",
    "doc-judgment:p-014",
    "doc-judgment:p-020"
  ]
}
```

### amt-face 借条/收条记载金额

54.40万元，不能作为已实际交付金额。

```json
{
  "id": "amt-face",
  "value": "544000.00",
  "currency": "CNY",
  "role": "contract_face",
  "ledger_kind": "contract",
  "support_span_ids": [
    "doc-judgment:p-015"
  ]
}
```

### amt-claim-principal 诉请本金

两版诉请均为54.40万元，身份不同于借条金额和实际交付。

```json
{
  "id": "amt-claim-principal",
  "value": "544000.00",
  "currency": "CNY",
  "role": "claimed_principal",
  "ledger_kind": "claim",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### amt-first 首次交付合计

四笔转账合计50.20万元，逐笔金额未披露；p-007、p-016、p-020 是同一汇总的重复叙述。

```json
{
  "id": "amt-first",
  "value": "502000.00",
  "currency": "CNY",
  "role": "actual_transfer",
  "ledger_kind": "aggregate",
  "from_id": "party-ma",
  "to_id": "party-pi",
  "transaction_count": 4,
  "components": [],
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-016",
    "doc-judgment:p-020"
  ]
}
```

### amt-750 12月5日转款750元

法院查明当日打款。

```json
{
  "id": "amt-750",
  "value": "750.00",
  "currency": "CNY",
  "role": "actual_transfer",
  "ledger_kind": "transaction",
  "from_id": "party-ma",
  "to_id": "party-pi",
  "support_span_ids": [
    "doc-judgment:p-017"
  ]
}
```

### amt-1350 12月5日转款1350元

法院查明当日打款。

```json
{
  "id": "amt-1350",
  "value": "1350.00",
  "currency": "CNY",
  "role": "actual_transfer",
  "ledger_kind": "transaction",
  "from_id": "party-ma",
  "to_id": "party-pi",
  "support_span_ids": [
    "doc-judgment:p-017"
  ]
}
```

### amt-20000 12月9日转款2万元

法院查明当日打款。

```json
{
  "id": "amt-20000",
  "value": "20000.00",
  "currency": "CNY",
  "role": "actual_transfer",
  "ledger_kind": "transaction",
  "from_id": "party-ma",
  "to_id": "party-pi",
  "support_span_ids": [
    "doc-judgment:p-017"
  ]
}
```

### amt-later 追加交付合计

22100元；退款与再次借款是对同一实际交付的不同解释，不另加一笔。

```json
{
  "id": "amt-later",
  "value": "22100.00",
  "currency": "CNY",
  "role": "actual_transfer",
  "ledger_kind": "aggregate",
  "components": [
    "amt-750",
    "amt-1350",
    "amt-20000"
  ],
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-017",
    "doc-judgment:p-020"
  ]
}
```

### amt-total 法院按实际取得确定的返还金额

502000 + 22100 = 524100元，不再叠加追加款子项或银行贷款合计。

```json
{
  "id": "amt-total",
  "value": "524100.00",
  "currency": "CNY",
  "role": "court_return",
  "ledger_kind": "assessment",
  "components": [
    "amt-first",
    "amt-later"
  ],
  "support_span_ids": [
    "doc-judgment:p-020",
    "doc-judgment:p-023"
  ]
}
```

### amt-withheld 预扣一年利息

原告称预扣4.20万元；法院认为相关部分未实际交付，不计入返还金额。

```json
{
  "id": "amt-withheld",
  "value": "42000.00",
  "currency": "CNY",
  "role": "prepaid_interest",
  "ledger_kind": "contract",
  "support_span_ids": [
    "doc-judgment:p-007",
    "doc-judgment:p-016",
    "doc-judgment:p-020"
  ]
}
```

### amt-claimed-net 原告自述累计利息

原告自述2.19万元，未被本包修正或认证。

```json
{
  "id": "amt-claimed-net",
  "value": "21900.00",
  "currency": "CNY",
  "role": "claimed_net_interest",
  "ledger_kind": "claim",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### amt-claim-interest 原诉请利息

暂计利息2.21万元，与追加实际交付同值但不同事项。

```json
{
  "id": "amt-claim-interest",
  "value": "22100.00",
  "currency": "CNY",
  "role": "claimed_interest",
  "ledger_kind": "claim",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### amt-claim-penalty 原诉请逾期违约金

暂计4787.20元。

```json
{
  "id": "amt-claim-penalty",
  "value": "4787.20",
  "currency": "CNY",
  "role": "claimed_penalty",
  "ledger_kind": "claim",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### amt-monthly 借条约定月息

3500元/月，不转为已发生实际交易。

```json
{
  "id": "amt-monthly",
  "value": "3500.00",
  "currency": "CNY",
  "role": "contract_interest",
  "ledger_kind": "contract",
  "support_span_ids": [
    "doc-judgment:p-015"
  ]
}
```

### amt-fee-total 案件受理费

9508.87元，由两方分担。

```json
{
  "id": "amt-fee-total",
  "value": "9508.87",
  "currency": "CNY",
  "role": "fee",
  "ledger_kind": "fee",
  "components": [
    "amt-fee-ma",
    "amt-fee-pi"
  ],
  "support_span_ids": [
    "doc-judgment:p-025"
  ]
}
```

### amt-fee-ma 原告负担受理费

779.30元。

```json
{
  "id": "amt-fee-ma",
  "value": "779.30",
  "currency": "CNY",
  "role": "fee",
  "ledger_kind": "fee",
  "support_span_ids": [
    "doc-judgment:p-025"
  ]
}
```

### amt-fee-pi 被告负担受理费

8729.57元。

```json
{
  "id": "amt-fee-pi",
  "value": "8729.57",
  "currency": "CNY",
  "role": "fee",
  "ledger_kind": "fee",
  "support_span_ids": [
    "doc-judgment:p-025"
  ]
}
```

### amt-announcement 公告费

560元由被告负担，不与案件受理费混为同一总额。

```json
{
  "id": "amt-announcement",
  "value": "560.00",
  "currency": "CNY",
  "role": "fee",
  "ledger_kind": "fee",
  "support_span_ids": [
    "doc-judgment:p-025"
  ]
}
```

### rate-gf 广发年利率自述

原告所述5.80%。

```json
{
  "id": "rate-gf",
  "value": "5.80",
  "currency": "PERCENT",
  "role": "rate",
  "ledger_kind": "rate",
  "unit": "percent/year",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### rate-sh 农商年利率自述

原告所述11.016%，保留精度。

```json
{
  "id": "rate-sh",
  "value": "11.016",
  "currency": "PERCENT",
  "role": "rate",
  "ledger_kind": "rate",
  "unit": "percent/year",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### rate-js 江苏年利率自述

原告所述5.13%。

```json
{
  "id": "rate-js",
  "value": "5.13",
  "currency": "PERCENT",
  "role": "rate",
  "ledger_kind": "rate",
  "unit": "percent/year",
  "support_span_ids": [
    "doc-judgment:p-007"
  ]
}
```

### rate-contract 借条逾期违约金率

原文为0.005%天，不以两位小数截断。

```json
{
  "id": "rate-contract",
  "value": "0.005",
  "currency": "PERCENT",
  "role": "rate",
  "ledger_kind": "rate",
  "unit": "percent/day",
  "support_span_ids": [
    "doc-judgment:p-015"
  ]
}
```

## 引称法律与版本状态

### authority-157 民法典第一百五十七条

《中华人民共和国民法典》第一百五十七条，判决书引称；未独立取得适用版本全文。

```json
{
  "id": "authority-157",
  "version_status": "unresolved",
  "full_text": null,
  "legal_as_of": null,
  "support_span_ids": [
    "doc-judgment:p-022"
  ]
}
```

### authority-loan-13 民间借贷规定第十三条第一款

《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》第十三条第一款，保留原文引称，不自行改写款项编号。

```json
{
  "id": "authority-loan-13",
  "version_status": "unresolved",
  "full_text": null,
  "legal_as_of": null,
  "support_span_ids": [
    "doc-judgment:p-022"
  ]
}
```

### authority-loan-31 民间借贷规定第三十一条第一款

同一司法解释第三十一条第一款，判决书引称；适用版本未核验。

```json
{
  "id": "authority-loan-31",
  "version_status": "unresolved",
  "full_text": null,
  "legal_as_of": null,
  "support_span_ids": [
    "doc-judgment:p-022"
  ]
}
```

### authority-cpl-147 民事诉讼法第一百四十七条

《中华人民共和国民事诉讼法》第一百四十七条，判决书引称；适用版本未核验。

```json
{
  "id": "authority-cpl-147",
  "version_status": "unresolved",
  "full_text": null,
  "legal_as_of": null,
  "support_span_ids": [
    "doc-judgment:p-022"
  ]
}
```

### authority-cpl-260 民事诉讼法第二百六十条

《中华人民共和国民事诉讼法》第二百六十条，迟延履行事项中的引称；适用版本未核验。

```json
{
  "id": "authority-cpl-260",
  "version_status": "unresolved",
  "full_text": null,
  "legal_as_of": null,
  "support_span_ids": [
    "doc-judgment:p-024"
  ]
}
```

## 裁判及履行条件

### decision-return 返还52.41万元

被告于本判决生效之日起十日内归还原告52.41万元。生效日期未知，不生成绝对到期日。

```json
{
  "id": "decision-return",
  "kind": "judgment_order",
  "proceeding_id": "proc-first",
  "document_id": "doc-judgment",
  "obligor_id": "party-pi",
  "beneficiary_id": "party-ma",
  "amount_ids": [
    "amt-total"
  ],
  "effective_status": "unresolved",
  "deadline": {
    "trigger": "judgment_effective",
    "days": 10,
    "absolute_date": null
  },
  "later_changes": [],
  "support_span_ids": [
    "doc-judgment:p-023"
  ]
}
```

### decision-delay 迟延履行债务利息

如未按指定期间履行给付金钱义务，依引称民事诉讼法第二百六十条加倍支付迟延履行期间债务利息；未取得实际履行数据，不算金额。

```json
{
  "id": "decision-delay",
  "kind": "conditional_order",
  "proceeding_id": "proc-first",
  "document_id": "doc-judgment",
  "authority_ids": [
    "authority-cpl-260"
  ],
  "effective_status": "unresolved",
  "later_changes": [],
  "support_span_ids": [
    "doc-judgment:p-024"
  ]
}
```

### decision-fees 受理费与公告费分担

案件受理费9508.87元，原告779.30元、被告8729.57元；公告费560元由被告负担。

```json
{
  "id": "decision-fees",
  "kind": "cost_order",
  "proceeding_id": "proc-first",
  "document_id": "doc-judgment",
  "amount_ids": [
    "amt-fee-total",
    "amt-fee-ma",
    "amt-fee-pi",
    "amt-announcement"
  ],
  "effective_status": "unresolved",
  "later_changes": [],
  "support_span_ids": [
    "doc-judgment:p-025"
  ]
}
```

### decision-appeal-notice 上诉权利告知

送达之日起十五日内可提出上诉，上诉于上海市第一中级人民法院。只是权利告知，不证明实际发生二审。

```json
{
  "id": "decision-appeal-notice",
  "kind": "remedy_notice",
  "proceeding_id": "proc-first",
  "document_id": "doc-judgment",
  "effective_status": "unresolved",
  "deadline": {
    "trigger": "judgment_served",
    "days": 15,
    "absolute_date": null
  },
  "later_changes": [],
  "support_span_ids": [
    "doc-judgment:p-026"
  ]
}
```

## 缺口及实际检查

```json
{
  "gaps": [
    {
      "id": "gap-pleadings",
      "title": "起诉状及诉请变更材料未取得",
      "text": "仅有判决书转述诉请，未取得原始起诉状或变更申请及其日期。",
      "status": "not_available",
      "support_span_ids": [
        "doc-judgment:p-007"
      ]
    },
    {
      "id": "gap-evidence",
      "title": "六类证据原件未取得",
      "text": "原始银行明细、合同、借条、收条和截图未取得；不能把文书提及当成证据文件已入库。",
      "status": "not_available",
      "support_span_ids": [
        "doc-judgment:p-009"
      ]
    },
    {
      "id": "gap-cross",
      "title": "完整举证质证记录未取得",
      "text": "未取得庭审笔录、送达记录和逐项质证。空质证数组不表示无异议或默认自认。",
      "status": "not_available",
      "support_span_ids": [
        "doc-judgment:p-006",
        "doc-judgment:p-008",
        "doc-judgment:p-009"
      ]
    },
    {
      "id": "gap-later",
      "title": "后续程序和生效情况未知",
      "text": "未取得上诉、二审、再审、执行或履行材料；不判定这些程序没有发生。",
      "status": "unresolved",
      "support_span_ids": [
        "doc-judgment:p-023",
        "doc-judgment:p-026"
      ]
    },
    {
      "id": "gap-net-interest",
      "title": "2.19万元净利息自述存在算术差异",
      "text": "原告事实与理由同时出现4.20万元预扣、2.21万元退还和2.19万元累计利息。42000-22100=19900，不等于21900；可能存在未披露事实或原文错误，暂不纠正文书。",
      "status": "unresolved",
      "support_span_ids": [
        "doc-judgment:p-007"
      ]
    },
    {
      "id": "gap-transfer-detail",
      "title": "四笔首次转账明细未知",
      "text": "50.20万元仅为四笔合计，不能虚构逐笔金额、时间或收款账户。",
      "status": "not_mentioned",
      "support_span_ids": [
        "doc-judgment:p-016"
      ]
    },
    {
      "id": "gap-authorities",
      "title": "法律版本和完整条文未核验",
      "text": "保留判决书引称；未将条号核对、当时版本或当前效力标为通过。",
      "status": "unresolved",
      "support_span_ids": [
        "doc-judgment:p-022",
        "doc-judgment:p-024"
      ]
    },
    {
      "id": "gap-permission",
      "title": "训练及外部传输权限未确认",
      "text": "公开访问不等于训练、再分发或外部模型传输许可。该包仅为本地研究整理，训练准入阻断。",
      "status": "unresolved",
      "support_span_ids": []
    },
    {
      "id": "gap-cutoff",
      "title": "无法还原真实庭前知识状态",
      "text": "仅有事后判决书，不能凭事件日期重构当事人在庭前能获得的全部信息。",
      "status": "not_available",
      "support_span_ids": []
    }
  ],
  "reviews": [],
  "checks": [
    {
      "name": "schema_and_typed_references",
      "status": "pass",
      "method": "local_structural_validator",
      "detail": "139 个记录 ID 与引用已检查；不验证法律真值。"
    },
    {
      "name": "source_alignment",
      "status": "pass",
      "method": "frozen_redacted_view_exact_match",
      "detail": "28 个片段与展示视图逐字比对；不认证原件真实性。"
    },
    {
      "name": "amount_formulas",
      "status": "pass",
      "method": "BigInt_fixed_point_cents",
      "detail": "4 条汇总公式精确到分且无重复计入。"
    },
    {
      "name": "source_net_interest_conflict",
      "status": "needs_review",
      "method": "source_arithmetic_comparison",
      "detail": "42000.00 - 22100.00 = 19900.00，与原告自述21900.00不同，保留差异。"
    },
    {
      "name": "legal_validity_and_permission",
      "status": "unresolved",
      "method": "not_performed",
      "detail": "适用法律版本、权限和专家审核未完成，训练准入阻断。"
    }
  ]
}
```

## 已取得材料全文附录

以下为保留原行号的脱敏展示视图，不是签章原件。

### doc-judgment:p-001

上海市闵行区人民法院

### doc-judgment:p-002

民事判决书

### doc-judgment:p-003

案号：（2023）沪0112民初23060号

### doc-judgment:p-004

原告：马某。

### doc-judgment:p-005

被告：皮某。

### doc-judgment:p-006

原告马某与被告皮某民间借贷纠纷一案，本院于2023年5月6日立案后，先适用简易程序，经审理发现有不宜适用简易程序的情形，裁定转为普通程序并由审判员独任审理，于2023年9月25日公开开庭进行了审理。原告马某到庭参加诉讼。被告皮某经公告送达开庭传票，未到庭参加诉讼，本案依法缺席审判。本案现已审理终结。

### doc-judgment:p-007

原告马某向本院提出诉讼请求：1.判令被告立即返还原告借款本金54.40万元；2.判令被告立即支付自2023年3月至还款时的利息，暂计至2023年8月23日为2.21万元；3.判令被告支付从2023年3月1日至还款时所产生的逾期违约金，暂计至2023年8月23日为4,787.20元；4.判令被告承担本案诉讼及执行过程中涉及的案件受理费、保全费、执行费等全部相关诉讼费用。诉讼中，原告变更诉讼请求为：1.判令被告归还借款本金54.40万元；2.判令被告承担本案诉讼及执行过程中涉及的案件受理费、执行费等全部相关诉讼费用。事实与理由：原、被告双方为普通朋友关系，2022年8月22日被告微信上与原告联系，告知自己申请的贷款已批，但提款时需要第三方在场方可提款，并以此为由要求原告以普通朋友身份陪同前往银行提取贷款，并要求原告携带原告本人四大银行征信报告提供给贷款银行查看。原告出于朋友帮忙之心同意了被告的请求，并于2022年8月24日与被告一同前往，但当天被告并未带原告前往银行，而是前往位于静安区XX广场XX楼的XX易融公司（金融贷款中介公司，以下简称“中介公司”）。在未经原告同意的情况下，被告私下告知中介公司原告是其男友，让中介公司协助以原告本人的身份向银行申请贷款审批。因原告从未有过贷款经历、不熟悉相关流程且出于帮助朋友的善意，在未清楚了解状况的情况下，以原告个人名义贷款了54.40万元本金，分别为广发银行14.40万元（年利率5.80%）、上海农商银行20万元（年利率11.016%）元、江苏银行20万元（年利率5.13%）。2022年8月24日，中介公司现场计算54.40万元在一年期间产生的利息共4.20万元，均摊至每月利息为3,500元，中介公司与被告一同私下写好借条交给原告，借条内容为：约定1年期间按月付利息3,500元、到期还款。贷款审批到账后，原告于2022年8月24日至25日分批将本金扣除利息后的50.20万元转至被告工商银行（账户已脱敏）账户中，被告预支1年期间产生的利息。2022年12月5日至9日，被告因资金紧张请求原告退还部分利息2.21万，原告通过支付宝转2.21万给被告，故被告累计支付原告利息2.19万。后原告多次催讨，被告电话关机或停机，微信不回。现原告为维护自身合法权益，诉至法院。

### doc-judgment:p-008

被告皮某未到庭答辩亦未提供证据。

### doc-judgment:p-009

当事人围绕诉讼请求依法提交了借条、收条、银行明细、贷款合同、支付宝付款截图、微信聊天记录截图等证据，本院予以确认并在卷佐证。

### doc-judgment:p-010

本院经审理查明如下事实：

### doc-judgment:p-011

原、被告系朋友关系。

### doc-judgment:p-012

2022年8月24日，原告与广发银行签订贷款合同，由原告向广发银行贷款，当日，广发银行向原告发放贷款14.40万元，后原告于2023年2月9日结清该贷款。

### doc-judgment:p-013

2022年8月24日，原告与江苏银行签订贷款合同，由原告向江苏银行贷款，当日，江苏银行向原告发放贷款20万元，后原告于2023年2月13日结清该贷款。

### doc-judgment:p-014

2022年8月24日，原告与上海农商业银行签订贷款合同，由原告向农商银行贷款20万元，当日，上海农商银行向原告发放贷款20万元，现贷款已结清。

### doc-judgment:p-015

2022年8月24日，被告向原告出具《借条》一份，载明：“今皮某（杨X）向马某借款人民币544000.00/，大写伍拾肆万肆仟元，自2022年8月24日起至2023年8月23日止，双方约定按月付息，到期一次性归还全部本金，每月利息3500./，双方按约定日期定期还款，不得拖欠，如不能按时归还，逾期违约金0.005%天，并承担所产生的额外一切费用及法律责任。借款人：皮某、出借人：马某。”当日，被告向原告出具收条一份，载明收到原告54.40万元，用于资金周转，收款方式为转账。

### doc-judgment:p-016

2022年8月24日至2022年8月25日，原告通过其名下账户信息已脱敏的账户向被告名下账户信息已脱敏的账户转账四笔，共计50.20万元。诉讼中，原告自述上述金额系扣除贷款54.40万元一年的利息4.20万元。

### doc-judgment:p-017

被告曾通过微信指导原告配合办理贷款审批手续，2022年12月5日，被告通过微信向原告借款750元用于缴纳家中水电费，并向原告提供支付宝账户，当日又表示要借款1,350元还花呗。2022年12月9日，被告表示钱不够，原告展示支付宝余额后，被告表示取2万元。上述款项，原告均通过支付宝于当日向被告打款，合计22,100元。

### doc-judgment:p-018

诉讼中，原告自述系受被告欺骗，办理了贷款手续，曾向警方报警，警方表示双方相识且原告持有被告出具的借条，不予立案，原告亦表示不再进行刑事立案。现因被告未能还款，原告以民间借贷为由诉至本院。

### doc-judgment:p-019

本院认为，合法的民间借贷关系应受法律保护。本案中，原告虽称系受被告欺骗办理贷款手续，但原告明确不再进行刑事报案，按民间借贷处理本案，系原告对自身权益的处分，于法不悖，本院予以准许。

### doc-judgment:p-020

根据法律规定，套取金融机构贷款转贷的民间借贷合同无效。原告通过向银行贷款取得款项54.40万元，并于取得款项当日交付被告50.20万元。原告另于2022年12月5日、2022年12月9日因被告再次借款而交付被告2.21万元，并在诉状中自述该些款项属于预扣4.20万元的利息的退还，故本院认定该2.21万元资金亦来源于原告向银行贷款所得，故原告实际向被告出借的52.41万元款项，双方之间的民间借贷合同无效，但原告提供的证据，可以证明原告实际向被告交付上述款项，双方之间民间借贷合同无效后，因该合同取得的财产，应当予以返还，故该52.41万元款项，被告应向原告返还。至于原告预扣利息部分，因实际未向被告交付，被告亦实际未能利用该笔款项，且双方之间民间借贷合同无效，相关借款利息约定亦无效，故该笔款项不应作为被告实际取得的财产予以返还。

### doc-judgment:p-021

被告皮某经本院传票传唤，无正当理由拒不到庭参加诉讼，系其放弃相应的诉讼权利，因此产生的法律后果由其自行承担。

### doc-judgment:p-022

据此，依照《中华人民共和国民法典》第一百五十七条，《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》第十三条第一款、第三十一条第一款，《中华人民共和国民事诉讼法》第一百四十七条规定，判决如下：

### doc-judgment:p-023

被告皮某于本判决生效之日起十日内归还原告马某52.41万元。

### doc-judgment:p-024

如果未按本判决指定的期间履行给付金钱义务，应当依照《中华人民共和国民事诉讼法》第二百六十条之规定，加倍支付迟延履行期间的债务利息。

### doc-judgment:p-025

案件受理费9,508.87元，由原告马某负担779.30元，由被告皮某负担8,729.57元；公告费560元，由被告皮某负担。

### doc-judgment:p-026

如不服本判决，可在判决书送达之日起十五日内，向本院递交上诉状，并按对方当事人或代表人的人数提出副本，上诉于上海市第一中级人民法院。

### doc-judgment:p-027

审判员及书记员署名已省略

### doc-judgment:p-031

二○二三年十一月二十一日

