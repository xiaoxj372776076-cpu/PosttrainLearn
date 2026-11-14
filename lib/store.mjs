import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(root) { this.root = root; this.queue = Promise.resolve(); }
  async read() {
    try { return JSON.parse(await fs.readFile(path.join(this.root, 'research-state.json'), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { revision: 0, reviews: {}, feedback: [], history: [] }; throw error; }
  }
  update(mutate) {
    const operation = this.queue.then(async () => {
      const state = await this.read();
      const result = await mutate(state);
      state.revision++;
      await fs.mkdir(this.root, { recursive: true });
      const destination = path.join(this.root, 'research-state.json');
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
      await fs.rename(temporary, destination);
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
