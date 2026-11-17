#!/usr/bin/env python3
"""Audit structural release gates, not legal truth or verifier honesty."""

import argparse
from collections import Counter
from datetime import date, datetime
import hashlib
import json
from pathlib import Path
import sys
import unicodedata


STATUSES = {"accepted", "rejected", "quarantine"}
SPLITS = {"train", "dev", "test", "quarantine"}
TASKS = {
    "rule_application", "decision_explanation", "evidence_qa",
    "numeric_calculation", "claim_verification", "sentence_extraction",
}
SEED_ROLES = {"independent", "benchmark_train", "official_example", "development"}
DIFFICULTY_LEVELS = {"D1", "D2", "D3", "D4"}
REASONING_PATTERNS = {
    "information_extraction", "rule_application", "arithmetic_computation", "multi_condition_application",
    "exception_check", "evidence_comparison", "temporal_applicability",
    "amount_classification", "multi_issue_composition",
}
NONTRIVIAL_PATTERNS = REASONING_PATTERNS - {"information_extraction", "rule_application", "arithmetic_computation"}
CHECKS = {
    "source_permission", "material_normalization", "evidence_alignment", "question_sufficiency",
    "authority_validity", "answer_support", "blind_answer_agreement",
    "numeric_consistency", "privacy", "leakage", "variant_consistency", "difficulty_alignment",
}
ALWAYS_PASS = CHECKS - {
    "authority_validity", "numeric_consistency", "variant_consistency",
}


def nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def string_list(value, allow_empty=False):
    return (
        isinstance(value, list)
        and (allow_empty or bool(value))
        and all(nonempty_string(item) for item in value)
        and len(value) == len(set(value))
    )


def question_fingerprint(row):
    question = unicodedata.normalize("NFKC", row["question"])
    question = " ".join(question.split()).casefold()
    scope = [row.get(key) for key in ("task_type", "jurisdiction", "legal_as_of")]
    content = json.dumps([scope, question], ensure_ascii=False)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def audit_rows(rows, require_human_review=False, protected_source_ids=None):
    errors = []
    statuses = Counter()
    tasks = Counter()
    reviews = Counter()
    difficulties = Counter()
    generation_modes = Counter()
    sample_ids = {}
    group_splits = {}
    unit_splits = {}
    case_splits = {}
    questions = {}
    accepted_count = 0
    protected = set(protected_source_ids or [])

    def problem(line, sample_id, code, detail):
        errors.append({"line": line, "sample_id": sample_id, "code": code, "detail": detail})

    def bind_split(mapping, key, split, line, sample_id, code):
        if split not in {"train", "dev", "test"} or not nonempty_string(key):
            return
        if key in mapping and mapping[key] != split:
            problem(line, sample_id, code, f"{key}: {mapping[key]} versus {split}")
        else:
            mapping[key] = split

    for line, row in enumerate(rows, 1):
        if not isinstance(row, dict):
            problem(line, None, "invalid_record", "A record must be a JSON object")
            continue
        sid = row.get("sample_id")
        for key in ("sample_id", "unit_id", "group_id"):
            if not nonempty_string(row.get(key)):
                problem(line, sid, "missing_id", key)
        if nonempty_string(sid):
            if sid in sample_ids:
                problem(line, sid, "duplicate_sample_id", f"First seen at line {sample_ids[sid]}")
            else:
                sample_ids[sid] = line
        if row.get("schema_version") != "1.1":
            problem(line, sid, "schema_version", "Expected 1.1; legacy rows need actual upstream revalidation")
        status = row.get("status")
        split = row.get("split")
        if not isinstance(status, str) or status not in STATUSES:
            problem(line, sid, "invalid_status", repr(status))
        else:
            statuses[status] += 1
        if not isinstance(split, str) or split not in SPLITS:
            problem(line, sid, "invalid_split", repr(split))
        else:
            bind_split(group_splits, row.get("group_id"), split, line, sid, "group_leakage")
            bind_split(unit_splits, row.get("unit_id"), split, line, sid, "unit_leakage")
        if not string_list(row.get("case_ids"), allow_empty=True):
            problem(line, sid, "invalid_case_ids", "Expected a unique list of canonical case IDs")
        elif isinstance(split, str) and split in SPLITS:
            for case_id in row["case_ids"]:
                bind_split(case_splits, case_id, split, line, sid, "case_leakage")
        issues = row.get("remaining_issues")
        if not isinstance(issues, list):
            problem(line, sid, "missing_issue_list", "remaining_issues must be a list")
        elif isinstance(status, str) and status in {"rejected", "quarantine"} and not issues:
            problem(line, sid, "missing_rejection_reason", "A non-accepted record needs an issue")
        if status != "accepted":
            continue

        accepted_count += 1
        if split == "quarantine":
            problem(line, sid, "accepted_in_quarantine", "Accepted records need train/dev/test")
        task = row.get("task_type")
        if not isinstance(task, str) or task not in TASKS:
            problem(line, sid, "invalid_task", repr(task))
        else:
            tasks[task] += 1
        for key in ("jurisdiction", "legal_as_of", "question", "answer", "rationale"):
            if not nonempty_string(row.get(key)):
                problem(line, sid, "missing_content", key)
        try:
            as_of = row.get("legal_as_of")
            if not isinstance(as_of, str) or date.fromisoformat(as_of).isoformat() != as_of:
                raise ValueError("Expected YYYY-MM-DD")
        except ValueError:
            problem(line, sid, "invalid_legal_as_of", "Expected a valid YYYY-MM-DD date")
        if isinstance(issues, list) and issues:
            problem(line, sid, "unresolved_issues", repr(issues))
        sources = row.get("source_ids")
        if not string_list(sources):
            problem(line, sid, "invalid_source_ids", "Expected a nonempty unique list")
            source_set = set()
        else:
            source_set = set(sources)
            overlap = source_set & protected
            if overlap:
                problem(line, sid, "protected_source", repr(sorted(overlap)))
        if not string_list(row.get("verification_run_ids")):
            problem(line, sid, "missing_verification_ids", "Need actual upstream verification run IDs")
        if not string_list(row.get("material_pack_ids")):
            problem(line, sid, "missing_material_packs", "Need normalized material pack IDs")

        mode = row.get("generation_mode")
        if not isinstance(mode, str) or mode not in {"few_shot", "zero_shot_ablation"}:
            problem(line, sid, "invalid_generation_mode", repr(mode))
        else:
            generation_modes[mode] += 1
        if mode == "few_shot" and not nonempty_string(row.get("few_shot_run_id")):
            problem(line, sid, "missing_few_shot_run", "Need the actual selection/prompt run ID")
        if mode == "zero_shot_ablation" and not nonempty_string(row.get("zero_shot_experiment_id")):
            problem(line, sid, "missing_zero_shot_experiment", "Zero-shot requires a declared ablation experiment")

        seeds = row.get("seed_provenance")
        if not isinstance(seeds, list):
            problem(line, sid, "invalid_seed_provenance", "Expected a list; an empty list is allowed")
        else:
            if mode == "few_shot" and not seeds:
                problem(line, sid, "few_shot_without_seeds", "Few-shot cannot have an empty seed list")
            if mode == "zero_shot_ablation" and seeds:
                problem(line, sid, "zero_shot_with_seeds", "Zero-shot cannot include few-shot examples")
            seed_ids = []
            for seed in seeds:
                if not isinstance(seed, dict) or not nonempty_string(seed.get("seed_id")):
                    problem(line, sid, "invalid_seed", repr(seed))
                    continue
                seed_ids.append(seed["seed_id"])
                role = seed.get("role")
                if not isinstance(role, str) or role not in SEED_ROLES:
                    problem(line, sid, "forbidden_seed_role", repr(role))
                if not nonempty_string(seed.get("selection_reason")):
                    problem(line, sid, "missing_seed_selection_reason", seed["seed_id"])
            if len(seed_ids) != len(set(seed_ids)):
                problem(line, sid, "duplicate_seed_ids", "Few-shot examples must have distinct seed IDs")

        difficulty = row.get("difficulty")
        if not isinstance(difficulty, dict):
            problem(line, sid, "missing_difficulty", "Need target, assessed and evidence-based assessment")
        else:
            for key in ("target", "assessed"):
                level = difficulty.get(key)
                if not isinstance(level, str) or level not in DIFFICULTY_LEVELS:
                    problem(line, sid, "invalid_difficulty_level", f"{key}={level!r}")
            target = difficulty.get("target")
            assessed = difficulty.get("assessed")
            if target != assessed:
                problem(line, sid, "difficulty_mismatch", f"target={target!r}, assessed={assessed!r}")
            if isinstance(assessed, str) and assessed in DIFFICULTY_LEVELS:
                difficulties[assessed] += 1
            for key in ("assessment_reason", "assessment_run_id"):
                if not nonempty_string(difficulty.get(key)):
                    problem(line, sid, "missing_difficulty_assessment", key)
            patterns = difficulty.get("reasoning_requirements")
            if not string_list(patterns) or not set(patterns).issubset(REASONING_PATTERNS):
                problem(line, sid, "invalid_reasoning_patterns", "Need distinct known reasoning patterns")
            elif isinstance(assessed, str) and assessed in {"D3", "D4"}:
                minimum = 2 if assessed == "D3" else 3
                if len(patterns) < minimum or not set(patterns).intersection(NONTRIVIAL_PATTERNS):
                    problem(line, sid, "difficulty_structure_not_supported", "D3/D4 cannot be direct lookup only")
        evidence = row.get("evidence_spans")
        if not isinstance(evidence, list) or not evidence:
            problem(line, sid, "missing_evidence", "Need traceable evidence spans")
        else:
            for span in evidence:
                if not isinstance(span, dict):
                    problem(line, sid, "invalid_evidence", repr(span))
                    continue
                if any(not nonempty_string(span.get(key)) for key in ("source_id", "locator", "quote")):
                    problem(line, sid, "invalid_evidence", "Need source_id, locator and quote")
                elif span["source_id"] not in source_set:
                    problem(line, sid, "undeclared_evidence_source", span["source_id"])
        authorities = row.get("authority_refs")
        if not isinstance(authorities, list):
            problem(line, sid, "invalid_authority_refs", "Expected a list")
            authorities = []
        for ref in authorities:
            if not isinstance(ref, dict):
                problem(line, sid, "invalid_authority", repr(ref))
                continue
            if any(not nonempty_string(ref.get(key)) for key in ("source_id", "provision", "version")):
                problem(line, sid, "invalid_authority", "Need source_id, provision and version")
            elif ref["source_id"] not in source_set:
                problem(line, sid, "undeclared_authority_source", ref["source_id"])

        checks = row.get("checks")
        if not isinstance(checks, dict):
            problem(line, sid, "missing_checks", "Expected all release checks")
            checks = {}
        for check in sorted(CHECKS):
            result = checks.get(check)
            allowed = {"pass"} if check in ALWAYS_PASS else {"pass", "not_applicable"}
            if not isinstance(result, str) or result not in allowed:
                problem(line, sid, "check_not_passed", f"{check}={result!r}")
        if authorities and checks.get("authority_validity") != "pass":
            problem(line, sid, "authority_check_required", "Authorities cannot be not_applicable")
        if task == "numeric_calculation" and checks.get("numeric_consistency") != "pass":
            problem(line, sid, "numeric_check_required", "Numeric tasks need a calculation check")
        variant = row.get("variant_type")
        if not isinstance(variant, str) or variant not in {"base", "paraphrase", "false_claim"}:
            problem(line, sid, "invalid_variant", repr(variant))
        elif variant != "base" and checks.get("variant_consistency") != "pass":
            problem(line, sid, "variant_check_required", variant)
        if task == "claim_verification":
            label = row.get("claim_label")
            if not isinstance(label, str) or label not in {"supported", "refuted", "insufficient"}:
                problem(line, sid, "invalid_claim_label", repr(label))
        if variant == "false_claim" and (task != "claim_verification" or row.get("claim_label") != "refuted"):
            problem(line, sid, "invalid_false_claim_task", "False claims need a refuted verification target")

        review = row.get("review_level")
        if not isinstance(review, str) or review not in {"auto_checked", "human_reviewed"}:
            problem(line, sid, "invalid_review_level", repr(review))
        else:
            reviews[review] += 1
        if require_human_review and review != "human_reviewed":
            problem(line, sid, "human_review_required", "This release requires every accepted row to be reviewed")
        if review == "human_reviewed":
            human = row.get("human_review")
            if not isinstance(human, dict) or human.get("decision") != "accepted":
                problem(line, sid, "missing_human_review", "Need an accepted review record")
            else:
                if not nonempty_string(human.get("reviewer_id")):
                    problem(line, sid, "missing_reviewer_id", "An anonymous reviewer ID is allowed")
                try:
                    timestamp = human.get("reviewed_at")
                    if not nonempty_string(timestamp) or "T" not in timestamp:
                        raise ValueError("Need ISO date-time")
                    datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                except ValueError:
                    problem(line, sid, "invalid_review_timestamp", "Expected ISO date-time")

        if nonempty_string(row.get("question")):
            fingerprint = question_fingerprint(row)
            if fingerprint in questions:
                first_id, first_answer = questions[fingerprint]
                code = "duplicate_question" if first_answer == row.get("answer") else "conflicting_answers"
                problem(line, sid, code, f"Same scoped normalized question as {first_id}")
            else:
                questions[fingerprint] = (sid, row.get("answer"))

    if accepted_count == 0:
        problem(None, None, "empty_release", "No accepted records to export")
    return {
        "passed": not errors,
        "record_count": len(rows),
        "status_counts": dict(statuses),
        "accepted_count": accepted_count,
        "unique_accepted_question_count": len(questions),
        "accepted_task_counts": dict(tasks),
        "accepted_review_counts": dict(reviews),
        "accepted_difficulty_counts": dict(difficulties),
        "accepted_generation_mode_counts": dict(generation_modes),
        "errors": errors,
        "limitations": [
            "Does not verify source text, authority validity or legal truth",
            "Does not establish model independence or check upstream verification logs",
            "Does not validate material/seed manifests, run configuration or genuine reasoning difficulty",
            "Does not detect semantic near-duplicates or identity changes in case IDs",
            "Input must be the final canonical sample view, not expanded training rows",
        ],
    }


def load_jsonl(path):
    rows = []
    with Path(path).open(encoding="utf-8") as handle:
        for line, text in enumerate(handle, 1):
            if text.strip():
                try:
                    rows.append(json.loads(text))
                except json.JSONDecodeError as exc:
                    raise ValueError(f"{path}:{line}: invalid JSON: {exc.msg}") from exc
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("samples", help="Final canonical samples.jsonl, including rejected/quarantine rows")
    parser.add_argument("--require-human-review", action="store_true")
    parser.add_argument("--protected-source-ids", help="JSON array of source IDs forbidden in accepted rows")
    args = parser.parse_args()
    try:
        protected = []
        if args.protected_source_ids:
            protected = json.loads(Path(args.protected_source_ids).read_text(encoding="utf-8"))
            if not string_list(protected, allow_empty=True):
                raise ValueError("Protected source IDs must be a unique JSON array of strings")
        report = audit_rows(load_jsonl(args.samples), args.require_human_review, protected)
    except (OSError, ValueError) as exc:
        print(json.dumps({"passed": False, "input_error": str(exc)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
