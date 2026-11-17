import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const target = path.join(root, 'content/campaigns/legal-bo5-20261115/guarantee-authorities.json');
const url = 'https://www.court.gov.cn/zixun/xiangqing/282721.html';
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  await fs.access(target);
  console.log('Frozen guarantee authority already exists; preserved.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Authority download HTTP ${response.status}`);
  const raw = Buffer.from(await response.arrayBuffer());
  const text = new TextDecoder().decode(raw)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  if (!text.includes('法释〔2020〕28号') || !text.includes('2021年1月1日起施行')) {
    throw new Error('Downloaded page does not contain expected title/version');
  }
  const retrievedAt = new Date().toISOString();
  const specs = [[25,'第二十五条','第二十六条'],[31,'第三十一条','第三十二条'],[32,'第三十二条','第三十三条'],[34,'第三十四条','第三十五条']];
  const rows = specs.map(([provision,startMarker,endMarker]) => {
    const start = text.indexOf(startMarker), end = text.indexOf(endMarker,start + startMarker.length);
    if (start < 0 || end < start) throw new Error(`Missing article ${provision}`);
    const quote = text.slice(start,end).trim();
    return { source_id:'guarantee-2020',provision:String(provision),quote,url,
      version:'法释〔2020〕28号',effective_from:'2021-01-01',retrievedAt,
      raw_sha256:hash(raw),full_text_sha256:hash(text),excerpt_sha256:hash(quote),
      locator:{start,end,index_unit:'JavaScript UTF-16 code units'},
      verification:'exact_excerpt_from_frozen_official_text' };
  });
  const local = path.join(root,'.local/hardness-laws');
  await fs.mkdir(local,{recursive:true});
  await fs.writeFile(path.join(local,'guarantee-2020.html'),raw);
  await fs.writeFile(path.join(local,'guarantee-2020.txt'),text);
  await fs.writeFile(target,JSON.stringify(rows,null,2)+'\n');
  console.log(`Frozen ${rows.length} official guarantee provisions; ${text.length} characters.`);
}
