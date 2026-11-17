请仅依据随附的 dossier.md、rules.json 和 answer-contract.json，对 dossier.md 中甲的最终诉请作一次完整的财产与责任审查：截至2023-08-01（不计当日利息），甲对乙的请求可支持到何种范围，要求丁、戊、己依各自保证合同立即支付相应债务是否有依据？结论须以相关合同及保证的法律状态支撑，并严格限于材料所列事实、约定和请求范围。这是已明示虚构的闭卷情景，不是真实案件的裁判预测。

交付一个名为 answer.json 的有效JSON文件，完整包含 answer-contract.json 要求的 A_valid、A_restitution、A_guarantee、B_initial_principal、B_protected_total、B_guarantee、C_outstanding_principal、C_outstanding_interest、C_outstanding_expenses、C_guarantee、borrower_total 字段，并提供 basis。金额表示、取分及汇总遵循该契约；状态表达遵循契约语义，不要求固定字段顺序。basis 应以简短、可核验的事实依据、适用法条及必要算式支持结论，事实引用使用材料段落编号，规范引用使用 source_id 与条号；不要求内部思维链。不得修改输入材料或补设事实。

只使用/app/input/dossier.md、rules.json、answer-contract.json，写入/app/output/answer.json。输出契约允许数字或金额字符串、简短依据，语义等价措辞可接受。不要访问研究者参考、验证器或网络。