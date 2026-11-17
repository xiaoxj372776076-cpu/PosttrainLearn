仅依据随任务提供的 dossier.md、rules.json 和 answer-contract.json，对其中明确标注的虚构情景完成一项整体财产与保证责任审查：在材料限定的诉请范围内，确定截至2023-08-01、SP-01到账后甲可向乙请求的各项剩余给付及总额，并判断甲要求丁、戊、己依保证合同立即支付的请求是否成立及其责任范围。计息边界遵循材料约定。金额与责任结论须有相应法律状态支持，完整覆盖 answer-contract.json 所问内容；本任务不涉及真实裁判提取或原案判决预测。

交付格式：只返回一个有效JSON对象，包含 answer-contract.json 的 fields 所列全部字段及 basis，遵循其中的状态表达、金额和取分要求。basis 应给出简短、可核验的事实定位、规范 source_id 与条号以及必要计算依据，解释决定性法律判断和保证责任范围，不输出内部思维链。不使用Markdown代码围栏，不在JSON之外附加文字。学生仅返回JSON，宿主负责落盘。

只使用/app/input/dossier.md、rules.json、answer-contract.json。学生仅返回JSON，由宿主适配器写入/app/output/answer.json。输出契约允许数字或金额字符串、简短依据，语义等价措辞可接受。不要访问研究者参考、验证器或网络。