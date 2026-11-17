import fs from 'node:fs/promises';
import { RUN, read, save, hash } from './pilot-prepare.mjs';

const root='harbor/tasks/loan-restitution'; const step=`${root}/steps/audit`;
for(const dir of ['workdir/input','solution','tests']) await fs.mkdir(`${step}/${dir}`,{recursive:true});
const files=await read(`${RUN}/student-files.json`);
for(const [name,data] of Object.entries(files)) await fs.writeFile(`${step}/workdir/input/${name}`,typeof data==='string'?data:JSON.stringify(data,null,2));
await fs.copyFile(`${RUN}/instruction.md`,`${step}/instruction.md`);
await fs.copyFile(`${RUN}/reference.json`,`${step}/tests/expected.json`);
await fs.copyFile(`${RUN}/reference.json`,`${step}/solution/reference.json`);
await fs.copyFile('harbor/verify.py',`${step}/tests/verify.py`);
await fs.writeFile(`${step}/workdir/setup.sh`,'#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p /app/output\n');
await fs.writeFile(`${step}/solution/solve.sh`,'#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p /app/output\ncp /solution/reference.json /app/output/audit.json\n');
await fs.writeFile(`${step}/tests/test.sh`,'#!/usr/bin/env bash\nset -euo pipefail\nmkdir -p /logs/verifier\nprintf "0\\n" > /logs/verifier/reward.txt\npython /tests/verify.py\n');
await fs.writeFile(`${root}/task.toml`,`schema_version = "1.4"\nartifacts = [{ source = "/app/output", destination = "legal-audit" }]\n\n[metadata]\ndescription = "Historical legal-file restitution audit; D4 design, empirical difficulty not yet established"\ndifficulty = "hard"\ncategory = "legal-document-audit"\ntags = ["legal", "ledger", "version-selection", "research-pilot"]\n\n[agent]\ntimeout_sec = 600.0\nuser = "root"\n\n[verifier]\ntimeout_sec = 60.0\nenvironment_mode = "shared"\n\n[environment]\ndocker_image = "mirror.gcr.io/library/python@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df"\nworkdir = "/app"\ncpus = 2\nmemory_mb = 2048\nstorage_mb = 4096\nbuild_timeout_sec = 600.0\n\n[[steps]]\nname = "audit"\n`);
const verifier=await fs.readFile('harbor/verify.py','utf8');
try {
  const old=await read(`${RUN}/harbor-build.json`);
  if(old.verifier_sha256!==hash(verifier)) await save('harbor-build-v1.json',old);
} catch(e) { if(e.code!=='ENOENT') throw e; }
const inputJSON=JSON.stringify(files);
if(/\[p-020\]|\[p-023\]|52\.41万元|524100/.test(inputJSON)) throw new Error('Student input answer leakage detected');
await save('harbor-build.json',{task_path:root,task_schema:'1.4',files:Object.keys(files),verifier_sha256:hash(verifier),reference_sha256:hash(await fs.readFile(`${RUN}/reference.json`,'utf8')),student_sha256:hash(inputJSON),leakage_check:{method:'explicit hidden-paragraph and target-string exclusion plus prompt review',status:'pass',limitations:'不是全面语义泄漏证明'},oracle_note:'oracle copies source-derived reference, only tests verifier plumbing'});
console.log(`Built ${root}; frozen verifier ${hash(verifier)}`);
