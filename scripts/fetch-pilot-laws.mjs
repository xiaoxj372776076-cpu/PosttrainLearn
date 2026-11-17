import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sources = [
  ['lending-2015', 'https://www.court.gov.cn/zixun/xiangqing/15146.html'],
  ['lending-2020-08', 'https://www.court.gov.cn/zixun/xiangqing/249031.html'],
  ['lending-2020-12', 'https://cicc.court.gov.cn/html/1/380/385/12844.html'],
  ['civil-code-2020', 'https://www.court.gov.cn/zixun/xiangqing/233181.html'],
  ['copyright-2020', 'https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html'],
];
await fs.mkdir('.local/pilot-laws', { recursive: true });
for (const [id, url] of sources) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    const html = new TextDecoder('utf-8').decode(bytes);
    const text = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n').replace(/&nbsp;|&#160;/g, ' ').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&mdash;/g, '-').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    await fs.writeFile(`.local/pilot-laws/${id}.html`, bytes);
    await fs.writeFile(`.local/pilot-laws/${id}.txt`, text);
    await fs.writeFile(`.local/pilot-laws/${id}.meta.json`, JSON.stringify({ id, url, finalUrl: r.url, retrievedAt: new Date().toISOString(), rawSha256: createHash('sha256').update(bytes).digest('hex'), textSha256: createHash('sha256').update(text).digest('hex') }, null, 2));
    console.log(`${id}: saved ${text.length} characters`);
  } catch (e) { console.log(`${id}: ${e.message}`); }
}
