"""Deterministic, fixed-contract verifier. Does not prove legal rationale semantics."""
import argparse
import json
import re
from decimal import Decimal
from pathlib import Path


def verify(answer, expected):
    checks = {}
    checks["schema"] = isinstance(answer, dict) and answer.get("schema_version") == expected["schema_version"]
    if not isinstance(answer, dict):
        answer = {}
    legal = answer.get("legal") if isinstance(answer.get("legal"), dict) else {}
    checks["historical_law"] = isinstance(legal.get("needs_2015_extra_conditions"), bool) and all(legal.get(k) == expected["legal"][k] for k in ["lending_version", "invalidity_article", "transition_article", "civil_code_article", "validity", "needs_2015_extra_conditions"])
    checks["legal_sources"] = isinstance(legal.get("source_ids"), list) and {"lending-2020-12", "civil-code-2020"}.issubset(legal["source_ids"])
    rows = answer.get("ledger") or []
    by_id = {r.get("id"): r for r in rows if isinstance(r, dict) and isinstance(r.get("id"), str)} if isinstance(rows, list) else {}
    ids = {r["id"] for r in expected["ledger"]}
    exact_ids = set(by_id) == ids and isinstance(rows, list) and len(rows) == len(ids)
    checks["ledger_values"] = exact_ids and all(by_id[r["id"]].get("value") == r["value"] for r in expected["ledger"])
    checks["amount_roles"] = exact_ids and all(by_id[r["id"]].get("role") == r["role"] for r in expected["ledger"])
    checks["dedup_and_inclusion"] = exact_ids and all(by_id[r["id"]].get("treatment") == r["treatment"] for r in expected["ledger"])
    allowed = {"p-006", "p-007", "p-008", "p-009", "p-010", "p-011", "p-012", "p-013", "p-014", "p-015", "p-016", "p-017", "p-018", "lending-2015", "lending-2020-08", "lending-2020-12", "civil-code-2020"}
    def grounded(row, required):
        refs = row.get("source_ids")
        return isinstance(refs, list) and all(isinstance(r,str) for r in refs) and set(required).issubset(refs) and set(refs).issubset(allowed)
    checks["ledger_provenance"] = exact_ids and all(grounded(by_id[r["id"]], r["source_ids"]) for r in expected["ledger"])
    checks["recomputable_total"] = False
    try:
        included = [r for r in rows if r["treatment"] == "include"]
        total = sum((Decimal(r["value"]) for r in included), Decimal("0"))
        checks["recomputable_total"] = answer.get("restitution_total") == "524100.00" and total == Decimal(answer["restitution_total"]) and answer.get("not_delivered_net") == "19900.00" and all(isinstance(r["value"], str) and re.fullmatch(r"\d+\.\d{2}", r["value"]) for r in rows)
    except (KeyError, TypeError, ArithmeticError):
        pass
    conflict = answer.get("interest_conflict") if isinstance(answer.get("interest_conflict"), dict) else {}
    checks["conflict_preserved"] = all(conflict.get(k) == expected["interest_conflict"][k] for k in ["reported", "computed", "difference", "status"]) and grounded(conflict, ["p-007", "p-016", "p-017"])
    limits = answer.get("evidence_limits") if isinstance(answer.get("evidence_limits"), dict) else {}
    checks["unknowns_not_fabricated"] = all(k in limits and limits[k] == expected["evidence_limits"][k] for k in ["first_transfer_breakdown", "actual_interest_paid", "additional_origin", "defendant_admission", "evidence_originals"]) and grounded(limits, ["p-008", "p-009", "p-016"])
    explain_rows = [legal, conflict, limits, *by_id.values()]
    checks["basis_present_not_semantics"] = len(explain_rows) == 18 and all(isinstance(r.get("reason"), str) and len(r["reason"].strip()) >= 6 for r in explain_rows)
    checks["no_fabricated_sources"] = all(grounded(r, []) for r in explain_rows)
    score = sum(checks.values()) / len(checks)
    return {"passed": all(checks.values()), "score": score, "checks": checks, "failed_checks": [k for k, v in checks.items() if not v], "rubric_version": "0.1", "implementation_version": "0.1.1", "semantic_limitation": "来源仅检查存在与必要定位，说明只检查非空；不证明解释法律语义正确。"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--answer", default="/app/output/audit.json")
    parser.add_argument("--expected", default="/tests/expected.json")
    parser.add_argument("--report-dir", default="/logs/verifier")
    args = parser.parse_args()
    expected = json.loads(Path(args.expected).read_text())
    candidate = Path(args.answer)
    try:
        if candidate.is_symlink() or candidate.stat().st_size > 2000000:
            raise ValueError("Unsafe output file")
        answer = json.loads(candidate.read_text())
        report = verify(answer, expected)
    except (OSError, ValueError, TypeError) as exc:
        report = {"passed": False, "score": 0.0, "checks": {}, "failed_checks": ["missing_or_invalid_artifact"], "error": type(exc).__name__, "rubric_version": "0.1"}
    out = Path(args.report_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (out / "reward.txt").write_text(str(report["score"]) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
