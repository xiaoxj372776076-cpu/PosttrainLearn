依据提供的 dossier.md、rules.json 和 answer-contract.json，就马某对皮某的请求完成一项整体财产返还及责任审查。结论应由相关法律状态和材料的证明程度支撑，并完整回应 answer-contract.json 要求的全部事项。遵守 dossier.md 末尾的范围限定，不得新增或改变材料中的事实、法条或约定。本任务是限定材料下的规则适用与证据审查，不是复述或预测原案判决。

交付格式：提交一个有效 JSON 对象，包含 restitution、unadvanced_arithmetic、interest_statement_gap、loan_valid、additional_origin_independently_traced、defendant_substantive_admission 和 basis。各字段含义遵循 answer-contract.json；金额使用人民币元的数字或十进制金额字符串，最终四舍五入至分；三个状态字段使用布尔值。basis 提供支持整体结论的简短事实、法律依据和必要算式，引用材料段落及规范来源、版本和条号。只提供公开可核验的依据说明，不要求内部思维链。

只使用/app/input/dossier.md、rules.json、answer-contract.json，写入/app/output/answer.json。输出契约允许数字或金额字符串、简短依据，语义等价措辞可接受。不要访问研究者参考、验证器或网络。