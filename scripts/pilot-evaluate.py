"""Execute real local Harbor controls and three fresh-context file-agent trials."""
import argparse
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
RUN=ROOT/"content/runs/legal-harbor-001"
JOBS=ROOT/".local/harbor-jobs"


def read(file):
    return json.loads(file.read_text())


def collect(job_name):
    job_dir=JOBS/job_name
    job=read(job_dir/"result.json")
    stats=job.get("stats",{})
    if not job.get("finished_at") or job.get("n_total_trials")!=1 or stats.get("n_completed_trials")!=1 or stats.get("n_errored_trials")!=0:
        raise RuntimeError(f"Incomplete/error Harbor job: {job_name}")
    reports=list(job_dir.glob("*/steps/audit/verifier/report.json"))
    if len(reports)!=1:
        raise RuntimeError(f"Missing verifier report: {job_name}")
    report_file=reports[0]
    trial=read(report_file.parents[3]/"result.json")
    if not trial.get("finished_at") or trial.get("exception_info") or any(s.get("exception_info") for s in trial.get("step_results") or []):
        raise RuntimeError(f"Failed trial/step: {job_name}")
    reward=float(report_file.with_name("reward.txt").read_text())
    report=read(report_file)
    if abs(reward-report["score"])>1e-9:
        raise RuntimeError("Reward/report mismatch")
    step=report_file.parent.parent
    model_file=step/"agent/model-response.json"
    answer_file=step/"artifacts/legal-audit/audit.json"
    trace_file=step/"agent/trace.json"
    request_file=step/"agent/model-request.json"
    return {"job":job_name,"report":report,"reward":reward,"model_result":read(model_file) if model_file.exists() else None,"model_request":read(request_file) if request_file.exists() else None,"answer":read(answer_file) if answer_file.exists() else None,"trace":read(trace_file) if trace_file.exists() else None,"harbor_finished_at":job["finished_at"],"harbor_errors":stats["n_errored_trials"]}


def timeout_record(job_name):
    job_dir=JOBS/job_name
    results=list(job_dir.glob("*/result.json"))
    if len(results)!=1:
        raise RuntimeError("Cannot identify failed trial")
    trial=read(results[0])
    exceptions=[s.get("exception_info") for s in trial.get("step_results") or [] if s.get("exception_info")]
    if len(exceptions)!=1 or "Gateway failed" not in exceptions[0].get("exception_message","") or "timeout" not in exceptions[0].get("exception_message","").lower():
        raise RuntimeError("Retry is allowed only for the recorded gateway timeout")
    return {"job":job_name,"status":"infrastructure_timeout","requested_model":"gpt-6-astra","quality_score":None,"harbor_recorded_reward":0.0,"completed_model_answer":False,"usage":None,"unknown_usage_reservation":{"input_tokens":9544,"max_output_tokens":10000},"reason":"网关超时，未收到完成响应或学生答案；不是法律答错，也不把计费情况当作零。","original_trial_finished_at":trial.get("finished_at"),"replacement_job":"legal-pilot-blind-3-retry-1"}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--harbor",default=shutil.which("harbor") or str(ROOT.parent/"harbor-ocr-demo/.venv/bin/harbor"))
    parser.add_argument("--retry-third-timeout",action="store_true",help="One bounded infrastructure retry; preserve original failure")
    args=parser.parse_args()
    if read(RUN/"stage-P3-r2.json")["question_sufficiency"]!="pass" or not (RUN/"stage-P4.json").exists():
        raise RuntimeError("P3/P4 not ready; no blind answer before question gate")
    subprocess.run(["node","scripts/pilot-build-harbor.mjs"],cwd=ROOT,check=True)
    env=os.environ.copy()
    env["PYTHONPATH"]=str(ROOT)+os.pathsep+env.get("PYTHONPATH","")
    def execute(name,agent):
        if not (JOBS/name/"result.json").exists():
            command=[args.harbor,"run","-p",str(ROOT/"harbor/tasks/loan-restitution"),"-a",agent,"-e","smol","--ek","target=local","--ek","auto_checkpoint=false","-n","1","-o",str(JOBS),"--job-name",name]
            if agent.startswith("legal_harbor"):
                command.extend(["-m","gpt-6-astra"])
            subprocess.run(command,cwd=ROOT,env=env,check=True)
        return collect(name)
    oracle=execute("legal-pilot-oracle-r2","oracle")
    nop=execute("legal-pilot-nop-r2","nop")
    if oracle["reward"]!=1 or not oracle["report"]["passed"] or nop["reward"]!=0:
        raise RuntimeError("Oracle/nop controls failed")
    attempts=[]
    answers=[]
    traces=[]
    requests=[]
    failures=[]
    if args.retry_third_timeout:
        failures.append(timeout_record("legal-pilot-blind-3"))
    for index in range(1,4):
        name=f"legal-pilot-blind-{index}"
        if index==3 and args.retry_third_timeout:
            name="legal-pilot-blind-3-retry-1"
        result=execute(name,"legal_harbor.file_agent:LegalFileAgent")
        model=result.pop("model_result")
        requests.append({"index":index,"request":result.pop("model_request")})
        if not model or not result["answer"] or not result["trace"]:
            raise RuntimeError("Missing actual model response, VM answer or trace")
        answers.append({"index":index,"answer":result.pop("answer")})
        traces.append({"index":index,"trace":result.pop("trace"),"requested_model":model["requestedModel"],"actual_model":model["actualModel"],"status":model["status"],"completed_at":model["completedAt"]})
        attempts.append({"index":index,**result,"model":model["actualModel"],"usage":model["usage"],"latency_ms":model["latencyMs"]})
        print(f"Blind {index}: {result['report']['score']:.3f}, strict={result['report']['passed']}",flush=True)
        best=max(attempts,key=lambda a:a["report"]["score"])
        evaluation={"n_requested":3,"n_completed":len(attempts),"physical_trials":len(attempts)+len(failures),"infrastructure_failures":failures,"attempts":attempts,"strict_successes":sum(a["report"]["passed"] for a in attempts),"best_index":best["index"],"best_score":best["report"]["score"],"selection":"oracle_max_fixed_verifier_score_not_deployable_selector","feedback_between_attempts":False,"same_family_fresh_context":True,"controls":{"oracle":{"report":oracle["report"],"reward":oracle["reward"],"harbor_errors":0},"nop":{"report":nop["report"],"reward":nop["reward"],"harbor_errors":0}},"note":"每个完成模型响应在真实Harbor trial内完成；超时单列且仅补跑一次。受限文件适配器，非通用终端代理。单题BoN不估计总体pass@k。"}
        (RUN/"evaluation.json").write_text(json.dumps(evaluation,ensure_ascii=False,indent=2))
        (RUN/"blind-answers.json").write_text(json.dumps(answers,ensure_ascii=False,indent=2))
        (RUN/"harbor-traces.json").write_text(json.dumps(traces,ensure_ascii=False,indent=2))
        (RUN/"blind-requests.json").write_text(json.dumps(requests,ensure_ascii=False,indent=2))
        (RUN/"infrastructure-failures.json").write_text(json.dumps(failures,ensure_ascii=False,indent=2))
    # Verify the actual teacher response separately; never substitute the oracle.
    subprocess.run([str(Path(args.harbor).parent/"python"),"scripts/pilot-teacher-check.py"],cwd=ROOT,check=True)


if __name__=="__main__":
    main()
