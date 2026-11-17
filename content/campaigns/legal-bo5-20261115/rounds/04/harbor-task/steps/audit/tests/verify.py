"""Frozen tolerant value checks; semantic correctness is reviewed separately."""
import json
import os
from decimal import Decimal, InvalidOperation
from pathlib import Path

ALIASES = {
    "invalid_accessory": {"invalid_accessory", "保证合同无效", "从合同无效", "invalid"},
    "expired": {"expired", "保证期间届满", "不再承担保证责任", "保证责任免除"},
    "joint": {"joint", "连带责任保证", "可请求连带支付", "joint_liability"},
    "general_preserved_not_yet_enforceable": {"general_preserved_not_yet_enforceable", "一般保证保全但有先诉抗辩", "一般保证未可立即执行", "general_preserved"},
}


def parse(text):
    value = text.strip()
    if value.startswith("```"):
        value = value.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    obj = json.loads(value)
    if isinstance(obj, dict):
        for wrapper in ("answer", "answers"):
            if isinstance(obj.get(wrapper), dict):
                obj = obj[wrapper]
                break
    return obj


def same(actual, expected):
    if isinstance(expected, bool):
        return actual is expected or str(actual).lower() == str(expected).lower()
    try:
        number = Decimal(str(expected))
        observed = Decimal(str(actual).replace(",", "").replace("元", "").strip())
        return observed.is_finite() and abs(observed-number) <= Decimal("0.01")
    except (InvalidOperation, ValueError):
        return str(actual).strip() in ALIASES.get(expected, {expected})


def verify(text, expected):
    try:
        answer = parse(text)
        if not isinstance(answer, dict):
            raise ValueError("Answer is not an object")
    except (ValueError, KeyError, TypeError) as error:
        return {"passed": False, "score": 0, "failure_class": "format_only_pending_semantic_review", "error": str(error), "checks": {}, "failed_checks": list(expected)}
    checks = {key: same(answer.get(key), value) for key,value in expected.items()}
    return {"passed": all(checks.values()), "score": sum(checks.values())/len(checks), "checks": checks,
            "failed_checks": [key for key,passed in checks.items() if not passed],
            "note": "金额或状态固定核对，不证明法律解释；语义等价与错误类型由P6另审，不以此直接计低成功率。"}


def main():
    expected = json.loads(Path(os.getenv("EXPECTED", "/tests/expected.json")).read_text())
    path = Path(os.getenv("ANSWER", "/app/output/answer.json"))
    text = path.read_text() if path.exists() else ""
    report = verify(text, expected)
    target = Path(os.getenv("VERIFIER_LOGS", "/logs/verifier"))
    target.mkdir(parents=True,exist_ok=True)
    (target/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    (target/"reward.txt").write_text(str(report["score"])+"\n")
    print(json.dumps(report,ensure_ascii=False))


if __name__ == "__main__":
    main()
