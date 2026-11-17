"""Trusted host-side verifier mutation controls, separate from Harbor VM controls."""
import copy
import importlib.util
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("verifier",root/"harbor/verify.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
run=root/"content/runs/legal-harbor-001"
expected=json.loads((run/"reference.json").read_text())
tests=[]
mutations=[
    ("wrong_total",lambda a:a.update(restitution_total="544000.00")),
    ("double_count",lambda a:a["ledger"][10].update(treatment="include")),
    ("mixed_version",lambda a:a["legal"].update(invalidity_article="14(1)")),
    ("invent_unknown",lambda a:a["evidence_limits"].update(first_transfer_breakdown=["125500.00"]*4)),
    ("fabricated_source",lambda a:a["ledger"][0].update(source_ids=["p-999"])),
    ("resolved_conflict",lambda a:a["interest_conflict"].update(status="resolved")),
    ("empty_explanation",lambda a:a["legal"].update(reason="")),
    ("invalid_nested_types",lambda a:a.update(legal=[],ledger=[{"id":[]}],interest_conflict=[],evidence_limits=[])),
    ("boolean_type_confusion",lambda a:a["legal"].update(needs_2015_extra_conditions=0)),
]
assert module.verify(expected,expected)["passed"]
for name,mutate in mutations:
    answer=copy.deepcopy(expected)
    mutate(answer)
    report=module.verify(answer,expected)
    assert not report["passed"],name
    tests.append({"name":name,"detected":True,"report":report})
(run/"verifier-controls.json").write_text(json.dumps({"mode":"trusted_host_mutation_tests_not_VM_rollouts","positive_reference_pass":True,"negative_count":len(tests),"all_detected":True,"tests":tests},ensure_ascii=False,indent=2))
print(f"Reference pass; {len(tests)} negative controls rejected")
