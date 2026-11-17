import importlib.util
import json
from pathlib import Path

root=Path(__file__).resolve().parents[1]
run=root/"content/runs/legal-harbor-001"
spec=importlib.util.spec_from_file_location("verifier",root/"harbor/verify.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
teacher=json.loads((run/"stage-P4.json").read_text())
reference=json.loads((run/"reference.json").read_text())
report=module.verify(teacher.get("answer"),reference)
(run/"teacher-verification.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({"teacher_fixed_contract":report},ensure_ascii=False))
