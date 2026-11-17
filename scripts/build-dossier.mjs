import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildDossier, renderCasebook } from '../lib/dossier.mjs';

const root = new URL('../', import.meta.url);
const read = async name => JSON.parse(await fs.readFile(new URL(name, root), 'utf8'));
const folder = 'content/dossiers/shanghai-2023-23060/';
const dossier = buildDossier(await read(folder + '0.1.0.extraction.json'), await read('content/cases/shanghai-2023-23060.json'), await read('schemas/case-dossier-0.1.schema.json'));
await fs.writeFile(new URL(folder + '0.1.0.json', root), JSON.stringify(dossier, null, 2) + '\n');
await fs.writeFile(new URL(folder + 'casebook.md', root), renderCasebook(dossier));
console.log(`已生成案件包 ${dossier.dossier_version} 和全文整理稿：${fileURLToPath(new URL(folder, root))}\n归档 partial；训练 blocked；未进行专家审核或模型合成。`);
