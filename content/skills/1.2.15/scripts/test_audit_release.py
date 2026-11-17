"""Synthetic structural fixtures; these are not legally validated examples."""

from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from audit_release import audit_rows


def sample(number=1, split="train"):
    return {
        "schema_version": "1.1",
        "sample_id": f"sample-{number}",
        "unit_id": f"unit-{number}",
        "material_pack_ids": [f"material-{number}"],
        "group_id": f"group-{number}",
        "case_ids": [f"case-{number}"],
        "split": split,
        "task_type": "rule_application",
        "jurisdiction": "synthetic-test-scope",
        "legal_as_of": "2025-01-01",
        "question": f"Synthetic question {number}?",
        "answer": f"Synthetic answer {number}.",
        "rationale": "Synthetic fixture explanation.",
        "source_ids": [f"source-{number}", "shared-authority"],
        "evidence_spans": [{"source_id": f"source-{number}", "locator": "p1", "quote": "Synthetic text."}],
        "authority_refs": [{"source_id": "shared-authority", "provision": "article-1", "version": "test-version"}],
        "seed_provenance": [{"seed_id": "independent-seed", "role": "independent", "selection_reason": "Synthetic task-pattern match."}],
        "generation_mode": "few_shot",
        "few_shot_run_id": "synthetic-few-shot-run",
        "difficulty": {
            "target": "D2", "assessed": "D2", "reasoning_requirements": ["rule_application"],
            "assessment_reason": "Synthetic single-rule fixture.",
            "assessment_run_id": "synthetic-difficulty-run",
        },
        "checks": {
            "source_permission": "pass", "evidence_alignment": "pass",
            "material_normalization": "pass", "difficulty_alignment": "pass",
            "question_sufficiency": "pass", "authority_validity": "pass",
            "answer_support": "pass", "blind_answer_agreement": "pass",
            "numeric_consistency": "not_applicable", "privacy": "pass",
            "leakage": "pass", "variant_consistency": "not_applicable",
        },
        "verification_run_ids": ["synthetic-check-run"],
        "remaining_issues": [],
        "review_level": "auto_checked",
        "variant_type": "base",
        "status": "accepted",
    }


class ReleaseAuditTests(unittest.TestCase):
    def assert_error(self, rows, code, **options):
        report = audit_rows(rows, **options)
        self.assertFalse(report["passed"])
        self.assertIn(code, {error["code"] for error in report["errors"]})

    def test_valid_structural_record(self):
        self.assertTrue(audit_rows([sample()])["passed"])

    def test_failed_check_cannot_be_accepted(self):
        row = sample()
        row["checks"]["answer_support"] = "fail"
        self.assert_error([row], "check_not_passed")

    def test_required_check_cannot_be_not_applicable(self):
        row = sample()
        row["checks"]["source_permission"] = "not_applicable"
        self.assert_error([row], "check_not_passed")

    def test_test_seed_is_rejected(self):
        row = sample()
        row["seed_provenance"][0]["role"] = "benchmark_test"
        self.assert_error([row], "forbidden_seed_role")

    def test_protected_source_is_rejected(self):
        self.assert_error([sample()], "protected_source", protected_source_ids=["source-1"])

    def test_group_cannot_cross_splits(self):
        other = sample(2, "test")
        other["group_id"] = "group-1"
        self.assert_error([sample(), other], "group_leakage")

    def test_unit_cannot_cross_splits_under_new_group(self):
        other = sample(2, "dev")
        other["unit_id"] = "unit-1"
        self.assert_error([sample(), other], "unit_leakage")

    def test_case_cannot_cross_splits_under_new_ids(self):
        other = sample(2, "test")
        other["case_ids"] = ["case-1"]
        self.assert_error([sample(), other], "case_leakage")

    def test_shared_authority_is_not_case_leakage(self):
        self.assertTrue(audit_rows([sample(), sample(2, "test")])["passed"])

    def test_duplicate_ids_are_rejected(self):
        self.assert_error([sample(), deepcopy(sample())], "duplicate_sample_id")

    def test_scoped_question_duplicates_are_rejected(self):
        other = sample(2)
        other["question"] = "  SYNTHETIC   QUESTION 1?  "
        other["answer"] = sample()["answer"]
        self.assert_error([sample(), other], "duplicate_question")

    def test_same_question_conflicting_gold_is_rejected(self):
        other = sample(2)
        other["question"] = sample()["question"]
        self.assert_error([sample(), other], "conflicting_answers")

    def test_unresolved_issue_is_rejected(self):
        row = sample()
        row["remaining_issues"] = ["Unknown statute version"]
        self.assert_error([row], "unresolved_issues")

    def test_human_review_requirement_is_real(self):
        self.assert_error([sample()], "human_review_required", require_human_review=True)
        row = sample()
        row["review_level"] = "human_reviewed"
        row["human_review"] = {"reviewer_id": "reviewer-1", "reviewed_at": "2026-11-14T10:00:00+08:00", "decision": "accepted"}
        self.assertTrue(audit_rows([row], require_human_review=True)["passed"])

    def test_human_review_flag_without_record_is_rejected(self):
        row = sample()
        row["review_level"] = "human_reviewed"
        self.assert_error([row], "missing_human_review")

    def test_invalid_date_is_rejected(self):
        row = sample()
        row["legal_as_of"] = "2025-02-30"
        self.assert_error([row], "invalid_legal_as_of")

    def test_missing_source_for_evidence_is_rejected(self):
        row = sample()
        row["evidence_spans"][0]["source_id"] = "unlisted-source"
        self.assert_error([row], "undeclared_evidence_source")

    def test_numeric_task_needs_numeric_check(self):
        row = sample()
        row["task_type"] = "numeric_calculation"
        self.assert_error([row], "numeric_check_required")

    def test_authority_cannot_skip_validity_check(self):
        row = sample()
        row["checks"]["authority_validity"] = "not_applicable"
        self.assert_error([row], "authority_check_required")

    def test_paraphrase_needs_variant_check(self):
        row = sample()
        row["variant_type"] = "paraphrase"
        self.assert_error([row], "variant_check_required")

    def test_false_claim_is_not_wrong_qa_answer(self):
        row = sample()
        row["variant_type"] = "false_claim"
        row["checks"]["variant_consistency"] = "pass"
        self.assert_error([row], "invalid_false_claim_task")
        row["task_type"] = "claim_verification"
        row["claim_label"] = "refuted"
        self.assertTrue(audit_rows([row])["passed"])

    def test_quarantined_record_is_counted_not_exportable(self):
        row = sample(2, "quarantine")
        row["status"] = "quarantine"
        row["remaining_issues"] = ["Missing evidence"]
        del row["answer"]
        report = audit_rows([sample(), row])
        self.assertTrue(report["passed"])
        self.assertEqual(report["accepted_count"], 1)
        self.assertEqual(report["status_counts"]["quarantine"], 1)

    def test_empty_release_is_not_a_success(self):
        self.assert_error([], "empty_release")

    def test_malformed_field_types_do_not_crash(self):
        for field in ("status", "split", "task_type", "review_level", "variant_type", "question", "legal_as_of", "generation_mode", "difficulty"):
            with self.subTest(field=field):
                row = sample()
                row[field] = []
                self.assertFalse(audit_rows([row])["passed"])
        self.assert_error([[]], "invalid_record")

    def test_material_pack_link_is_required(self):
        row = sample()
        row["material_pack_ids"] = []
        self.assert_error([row], "missing_material_packs")

    def test_material_normalization_cannot_be_skipped(self):
        row = sample()
        row["checks"]["material_normalization"] = "not_applicable"
        self.assert_error([row], "check_not_passed")

    def test_few_shot_needs_real_seed_ids(self):
        row = sample()
        row["seed_provenance"] = []
        self.assert_error([row], "few_shot_without_seeds")

    def test_few_shot_needs_selection_log(self):
        row = sample()
        del row["few_shot_run_id"]
        self.assert_error([row], "missing_few_shot_run")

    def test_seed_selection_reason_is_required(self):
        row = sample()
        del row["seed_provenance"][0]["selection_reason"]
        self.assert_error([row], "missing_seed_selection_reason")

    def test_duplicate_few_shot_seeds_are_rejected(self):
        row = sample()
        row["seed_provenance"].append(deepcopy(row["seed_provenance"][0]))
        self.assert_error([row], "duplicate_seed_ids")

    def test_zero_shot_requires_declared_ablation(self):
        row = sample()
        row["generation_mode"] = "zero_shot_ablation"
        row["seed_provenance"] = []
        self.assert_error([row], "missing_zero_shot_experiment")
        row["zero_shot_experiment_id"] = "synthetic-ablation"
        self.assertTrue(audit_rows([row])["passed"])
        row["seed_provenance"] = deepcopy(sample()["seed_provenance"])
        self.assert_error([row], "zero_shot_with_seeds")

    def test_simple_patterns_cannot_claim_d3(self):
        row = sample()
        row["difficulty"].update(target="D3", assessed="D3")
        row["difficulty"]["reasoning_requirements"] = ["information_extraction", "rule_application"]
        self.assert_error([row], "difficulty_structure_not_supported")
        row["difficulty"]["reasoning_requirements"] = ["rule_application", "exception_check"]
        self.assertTrue(audit_rows([row])["passed"])

    def test_direct_arithmetic_cannot_claim_d3(self):
        row = sample()
        row["difficulty"].update(target="D3", assessed="D3")
        row["difficulty"]["reasoning_requirements"] = ["information_extraction", "arithmetic_computation"]
        self.assert_error([row], "difficulty_structure_not_supported")
        row["difficulty"]["reasoning_requirements"] = ["amount_classification", "arithmetic_computation"]
        self.assertTrue(audit_rows([row])["passed"])

    def test_target_and_assessed_difficulty_must_agree(self):
        row = sample()
        row["difficulty"]["target"] = "D3"
        self.assert_error([row], "difficulty_mismatch")

    def test_duplicate_or_unknown_reasoning_patterns_are_rejected(self):
        for patterns in (["rule_application", "rule_application"], ["looks_complicated"], [["rule_application"]]):
            with self.subTest(patterns=patterns):
                row = sample()
                row["difficulty"]["reasoning_requirements"] = patterns
                self.assert_error([row], "invalid_reasoning_patterns")

    def test_invalid_difficulty_level_types_do_not_crash(self):
        row = sample()
        row["difficulty"]["target"] = []
        self.assert_error([row], "invalid_difficulty_level")

    def test_legacy_rows_cannot_skip_new_gates(self):
        row = sample()
        row["schema_version"] = "1.0"
        self.assert_error([row], "schema_version")

    def run_cli(self, text, *options):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "samples.jsonl"
            path.write_text(text, encoding="utf-8")
            script = Path(__file__).with_name("audit_release.py")
            result = subprocess.run(
                [sys.executable, "-B", str(script), str(path), *options],
                capture_output=True, text=True, check=False,
            )
        self.assertEqual(result.stderr, "")
        return result.returncode, json.loads(result.stdout)

    def test_cli_accepts_valid_structural_release(self):
        code, report = self.run_cli(json.dumps(sample()) + "\n")
        self.assertEqual(code, 0)
        self.assertTrue(report["passed"])
        self.assertEqual(report["accepted_count"], 1)

    def test_cli_rejects_failed_release(self):
        row = sample()
        row["checks"]["leakage"] = "fail"
        code, report = self.run_cli(json.dumps(row) + "\n")
        self.assertEqual(code, 1)
        self.assertFalse(report["passed"])

    def test_cli_reports_malformed_input(self):
        code, report = self.run_cli("{broken json}\n")
        self.assertEqual(code, 2)
        self.assertIn("invalid JSON", report["input_error"])

    def test_cli_human_review_flag_is_enforced(self):
        code, report = self.run_cli(json.dumps(sample()) + "\n", "--require-human-review")
        self.assertEqual(code, 1)
        self.assertIn("human_review_required", {error["code"] for error in report["errors"]})


if __name__ == "__main__":
    unittest.main()
