import fs from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function withFileLock(file, operation, timeoutMs = 30000) {
  const lock = `${file}.lock`;
  const deadline = Date.now() + timeoutMs;
  let handle;
  while (!handle) {
    try { handle = await fs.open(lock, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error(`Ledger locked; inspect active writer before retrying: ${lock}`);
      await delay(50);
    }
  }
  try { return await operation(); }
  finally { await handle.close(); await fs.unlink(lock); }
}

export async function atomicJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temporary, file);
}
