import fs from 'node:fs/promises';
import { callModel } from '../lib/model-gateway.mjs';

const input = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const result = await callModel(input);
await fs.writeFile(process.argv[3], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ model: result.requestedModel, actualModel: result.actualModel, usage: result.usage, latencyMs: result.latencyMs, output: process.argv[3] }));
