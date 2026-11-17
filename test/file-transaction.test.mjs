import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { withFileLock, atomicJson } from '../lib/file-transaction.mjs';

test('concurrent reservations preserve all rows and enforce a shared limit', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'legal-ledger-'));
  const file=path.join(directory,'requests.json');
  try {
    await atomicJson(file,[]);
    const results=await Promise.all(Array.from({length:8},(_,index)=>withFileLock(file,async()=>{
      const rows=JSON.parse(await fs.readFile(file,'utf8'));
      if(rows.length>=5)return false;
      rows.push({index,status:'submitted'});
      await atomicJson(file,rows);
      return true;
    })));
    assert.equal(results.filter(Boolean).length,5);
    const rows=JSON.parse(await fs.readFile(file,'utf8'));
    assert.equal(rows.length,5);
    await Promise.all(rows.map(({index})=>withFileLock(file,async()=>{
      const current=JSON.parse(await fs.readFile(file,'utf8'));
      current.find(row=>row.index===index).status='completed';
      await atomicJson(file,current);
    })));
    assert.ok(JSON.parse(await fs.readFile(file,'utf8')).every(row=>row.status==='completed'));
    await assert.rejects(fs.access(`${file}.lock`));
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

test('failed transactions release locks and never remove an existing writer lock', async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'legal-lock-'));
  const file=path.join(directory,'ledger');
  try {
    await assert.rejects(withFileLock(file,async()=>{throw new Error('failed');}),/failed/);
    await assert.rejects(fs.access(`${file}.lock`));
    await fs.writeFile(`${file}.lock`,'another writer');
    await assert.rejects(withFileLock(file,async()=>true,1),/inspect active writer/);
    assert.equal(await fs.readFile(`${file}.lock`,'utf8'),'another writer');
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
