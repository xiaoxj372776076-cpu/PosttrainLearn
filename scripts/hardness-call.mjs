import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { callModel } from '../lib/model-gateway.mjs';
import { withFileLock } from '../lib/file-transaction.mjs';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const CAMPAIGN=path.join(ROOT,'content/campaigns/legal-bo5-20261115');
export const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
export async function save(file,value) {
  const temporary=`${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
  await fs.rename(temporary,file);
}
export function parse(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
}

export async function request(round,stage,input) {
  if(!/^\d{2}$/.test(round)||Number(round)<1||Number(round)>20||! /^(P[1-6](?:-repair)?(?:-retry)?|Bo5-[1-5](?:-retry)?|Confirm-[1-5](?:-retry)?)$/.test(stage)) throw new Error('Invalid campaign stage');
  const folder=path.join(CAMPAIGN,'rounds',round);
  const file=path.join(folder,`${stage}-response.json`);
  try { return await read(file); } catch(e) { if(e.code!=='ENOENT')throw e; }
  const ledgerFile=path.join(CAMPAIGN,'requests.json');
  const config=await read(path.join(CAMPAIGN,'config.json'));
  const estimatedInput=JSON.stringify(input.messages).length;
  const outputReservation=input.maxOutputTokens??10000;
  const record={round,stage,status:'submitted',submitted_at:new Date().toISOString(),input_sha256:sha(input.messages),input_reservation:estimatedInput,output_reservation:outputReservation,usage:null};
  await withFileLock(ledgerFile,async()=>{
    const ledger=await read(ledgerFile);
    const inputReserved=ledger.reduce((sum,r)=>sum+(r.usage?.input_tokens??r.input_reservation),0);
    const outputReserved=ledger.reduce((sum,r)=>sum+(r.usage?.output_tokens??r.output_reservation),0);
    if(ledger.length>=config.budget.max_requests||inputReserved+estimatedInput>config.budget.max_input_tokens||outputReserved+outputReservation>config.budget.max_output_tokens) throw new Error('Campaign model budget exhausted');
    if(ledger.some(r=>r.round===round&&r.stage===stage)) throw new Error('Request already submitted without a completed response; explicit bounded retry stage is required');
    ledger.push(record);
    await save(ledgerFile,ledger);
  });
  const updateLedger=()=>withFileLock(ledgerFile,async()=>{
    const ledger=await read(ledgerFile);
    const index=ledger.findIndex(r=>r.round===round&&r.stage===stage);
    if(index<0)throw new Error('Missing reserved ledger request');
    ledger[index]=record;
    await save(ledgerFile,ledger);
  });
  await save(path.join(folder,`${stage}-request.json`),{...input,input_sha256:record.input_sha256,skill_version:`1.2.${Number(round)-1}`});
  console.log(`Round ${round} ${stage}: submitted`);
  try {
    const response=await callModel(input);
    await save(file,{...response,input_sha256:record.input_sha256,output_sha256:sha(response.text)});
    record.status='completed'; record.usage=response.usage; record.actual_model=response.actualModel; record.completed_at=response.completedAt;
    await updateLedger();
    console.log(`Round ${round} ${stage}: completed (${response.usage?.total_tokens??'unknown'} tokens)`);
    return response;
  } catch(e) {
    const partial=e.publicResponse;
    record.usage=partial?.usage??null;
    record.status=record.usage?'failed_with_known_usage':'failed_usage_unknown';
    record.failure_kind=partial?.incompleteDetails?.reason==='max_output_tokens'?'truncation':partial?'incomplete_response':'infrastructure';
    record.error=e.message; record.failed_at=new Date().toISOString();
    if(partial) {
      record.actual_model=partial.actualModel;
      record.incomplete_details=partial.incompleteDetails;
      await save(path.join(folder,`${stage}-partial-response.json`),partial);
    }
    await updateLedger();
    await save(path.join(folder,`${stage}-error.json`),record);
    throw e;
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [, ,round,stage,inputFile,outputFile]=process.argv;
  const response=await request(round,stage,await read(inputFile));
  await save(outputFile,response);
}
