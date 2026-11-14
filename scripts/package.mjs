import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const output = path.join(root, 'releases');
await fs.mkdir(output, { recursive: true });
execFileSync(process.execPath, [path.join(root, 'scripts/check-content.mjs')], { stdio: 'inherit' });
const name = `${pkg.name}-${pkg.version}.tar.gz`;
const archive = path.join(output, name);
execFileSync('tar', ['-czf', archive, '--exclude=.git', '--exclude=.local', '--exclude=private-source', '--exclude=releases', '--exclude=node_modules', '--exclude=.DS_Store', '--exclude=.env', '--exclude=.env.*', '--exclude=*.log', '--exclude=*.tmp', '-C', root, '.'], { stdio: 'inherit' });
const sha = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
await fs.writeFile(archive + '.sha256', `${sha}  ${name}\n`);
console.log(`Source archive: ${archive}\nSHA-256: ${sha}\nExcluded private originals, runtime expert records, credentials, Git metadata and dependencies. Review third-party data permissions before publishing.`);
