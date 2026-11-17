import fs from 'node:fs/promises';
import { RUN, read, save, hash } from './pilot-prepare.mjs';

const files=await read(`${RUN}/student-files.json`);
await save('student-files-v2.json',files);
const source=await read('content/cases/shanghai-2023-23060.json');
const quotes=['广发银行向原告发放贷款14.40万元','江苏银行向原告发放贷款20万元','上海农商银行向原告发放贷款20万元','544000.00/','载明收到原告54.40万元','转账四笔，共计50.20万元','50.20万元转至被告','借款750元用于缴纳家中水电费','借款1,350元还花呗','被告表示取2万元','合计22,100元','退还部分利息2.21万','暂计至2023年8月23日为2.21万元','一年的利息4.20万元','故被告累计支付原告利息2.19万'];
files['mentions.json'].forEach((m,i)=>{
  const text=source.paragraphs.find(p=>p.id===m.span_id).text;
  const start=text.indexOf(quotes[i]);
  if(start<0 || text.indexOf(quotes[i],start+1)>=0) throw new Error(`Non-unique source locator: ${m.id}`);
  m.locator={start,end:start+quotes[i].length,index_unit:'UTF-16 code units in the frozen paragraph'};
  m.quote=text.slice(start,m.locator.end); m.paragraph_sha256=hash(text);
});
await save('student-files.json',files);
const old=await read(`${RUN}/repair-history.json`);
await save('repair-history.json',{rounds:[old,{repair_round:2,trigger:'P3-r1 fail: same-paragraph equal-value IDs not uniquely located',method:'exact_frozen_source_quote_and_offset_alignment',old_student_sha256:hash(await read(`${RUN}/student-files-v2.json`)),new_student_sha256:hash(files),changes:['所有15个提及增加唯一原文quote与字符起止定位，不补角色/答案标签','区分同段同额的借条/收条、原诉请利息/追加款叙述'],facts_changed:false,locators_all_unique:true,required_reruns:['P3','P4','P5','P6']}],max_repairs:2});
console.log('Repair2: 15 exact, unique frozen-paragraph locators validated.');
