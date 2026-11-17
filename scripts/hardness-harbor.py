"""Execute one actual Harbor trial and sanitize its public result."""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CAMPAIGN=ROOT/"content/campaigns/legal-bo5-20261115"
HARBOR=ROOT.parent/"harbor-ocr-demo/.venv/bin/harbor"
JOBS=ROOT/".local/bo5-harbor-jobs"


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("round")
    parser.add_argument("stage")
    args=parser.parse_args()
    assert args.round.isdigit() and 1<=int(args.round)<=20
    stage=args.stage
    assert stage in {"oracle","nop"} or re.fullmatch(r"(?:Bo5|Confirm)-[1-5](?:-retry)?",stage)
    folder=CAMPAIGN/"rounds"/args.round
    destination=folder/f"harbor-{stage}.json"
    if destination.exists():
        return
    name=f"legal-bo5-{args.round}-{stage.lower()}"
    job=JOBS/name
    env=os.environ.copy()
    env.update({"LEGAL_BO5_ROOT":str(ROOT),"LEGAL_BO5_ROUND":args.round,"LEGAL_BO5_STAGE":stage,"PYTHONPATH":str(ROOT)+os.pathsep+env.get("PYTHONPATH","")})
    env["LEGAL_BO5_MAX_OUTPUT_TOKENS"]=str(json.loads((folder/"frozen.json").read_text())["max_output_tokens"])
    if not (job/"result.json").exists():
        agent=stage if stage in {"oracle","nop"} else "legal_harbor.hardness_agent:HardnessAgent"
        command=[str(HARBOR),"run","-p",str(folder/"harbor-task"),"-a",agent,"-e","smol","--ek","target=local","--ek","auto_checkpoint=false","-n","1","-o",str(JOBS),"--job-name",name]
        if agent.startswith("legal_harbor"):
            command += ["-m","gpt-6-astra"]
        completed=subprocess.run(command,cwd=ROOT,env=env)
        if not (job/"result.json").exists():
            raise RuntimeError(f"Harbor did not finish a trial: {name}, process={completed.returncode}")
    report_files=list(job.glob("*/steps/audit/verifier/report.json"))
    result_files=list(job.glob("*/result.json"))
    if len(result_files)!=1:
        raise RuntimeError("Cannot locate Harbor trial result")
    trial=json.loads(result_files[0].read_text())
    if not trial.get("finished_at"):
        raise RuntimeError(f"Harbor trial is not finished; inspect the existing job before retrying: {name}")
    exceptions=[s.get("exception_info") for s in trial.get("step_results") or [] if s.get("exception_info")]
    if trial.get("exception_info"):
        exceptions.append(trial["exception_info"])
    result={"job":name,"finished_at":trial.get("finished_at"),"exceptions":exceptions,"completed_answer":False,"infrastructure_failure":bool(exceptions)}
    failure_file=folder/f"{stage}-error.json"
    if failure_file.exists():
        failure=json.loads(failure_file.read_text())
        result["failure_kind"]=failure.get("failure_kind","incomplete_unclassified" if "Incomplete response" in failure.get("error","") else "infrastructure")
        result["infrastructure_failure"]=result["failure_kind"]=="infrastructure"
        result["usage"]=failure.get("usage")
    if report_files:
        report_file=report_files[0]
        step=report_file.parent.parent
        result["report"]=json.loads(report_file.read_text())
        result["reward"]=float(report_file.with_name("reward.txt").read_text())
        response=step/"agent/model-response.json"
        trace=step/"agent/trace.json"
        if response.exists():
            model=json.loads(response.read_text())
            result.update({"completed_answer":True,"model":model["actualModel"],"usage":model["usage"],"latency_ms":model["latencyMs"],"answer_text":model["text"]})
        if trace.exists():
            result["trace"]=json.loads(trace.read_text())
    if stage in {"oracle","nop"}:
        assert not result["infrastructure_failure"] and result.get("reward") == (1 if stage=="oracle" else 0), "Oracle/nop control failed"
    destination.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({"round":args.round,"stage":stage,"completed_answer":result["completed_answer"],"reward":result.get("reward"),"infrastructure_failure":result["infrastructure_failure"]}),flush=True)


if __name__=="__main__":
    main()
