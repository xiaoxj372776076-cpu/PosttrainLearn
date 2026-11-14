import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../lib/store.mjs';

test('serialized durable edits do not lose updates, and survive reopening', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'legal-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new Store(root);
  await Promise.all(Array.from({ length: 20 }, (_, index) => store.update(state => { state.history.push({ index }); })));
  assert.equal((await new Store(root).read()).history.length, 20);
  assert.equal((await store.read()).revision, 20);
  await assert.rejects(store.update(() => { throw new Error('invalid'); }));
  await store.update(state => state.feedback.push({ text: 'recovered' }));
  assert.equal((await store.read()).feedback.length, 1);
});
