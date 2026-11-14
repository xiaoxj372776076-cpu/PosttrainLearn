import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('one-time importer refuses to overwrite existing research snapshots', async () => {
  const index = new URL('../content/skills/index.json', import.meta.url);
  const before = await fs.readFile(index, 'utf8');
  assert.throws(() => execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/import-workspace.mjs', import.meta.url))], { stdio: 'pipe' }), error => error.stderr.toString().includes('拒绝重新导入'));
  assert.equal(await fs.readFile(index, 'utf8'), before);
});
