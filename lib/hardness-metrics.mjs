export function measureHardness(audit,answers) {
  const rows=audit.results??[];
  const indices=rows.map(r=>r.index).sort((a,b)=>a-b);
  const answerIndices=answers.map(a=>a.index).sort((a,b)=>a-b);
  const complete=answers.length===5&&answers.every(a=>a.completed_answer===true)&&JSON.stringify(indices)==='[1,2,3,4,5]'&&JSON.stringify(answerIndices)==='[1,2,3,4,5]';
  const invalidRows=rows.some(r=>typeof r.correct!=='boolean'||!['none','substantive'].includes(r.error_kind)||r.correct!==(r.error_kind==='none'));
  const valid=complete&&audit.question_valid===true&&audit.reference_supported===true&&audit.difficulty_mechanism_valid===true&&!invalidRows;
  const correct=rows.filter(r=>r.correct===true).length;
  return {valid,correct,n:5,target_hit:valid&&correct>=1&&correct<=2,deterministic_successes:answers.filter(a=>a.report?.passed).length,reason:!complete?'incomplete_batch':invalidRows?'nonsemantic_or_inconsistent_grading':!audit.question_valid?'question_invalid':!audit.reference_supported?'reference_not_supported':!audit.difficulty_mechanism_valid?'difficulty_mechanism_not_valid':'semantic_five_answer_measurement'};
}

export function legalStateFieldChecks(expected,text) {
  let answer;
  try {
    const clean=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
    try { answer=JSON.parse(clean); }
    catch {
      // Normalize a single JSON object surrounded by prose, never select among answers.
      const start=clean.indexOf('{');const end=clean.lastIndexOf('}');
      if(start<0||end<start)throw new Error('No answer object');
      answer=JSON.parse(clean.slice(start,end+1));
    }
    answer=answer.answer??answer.answers??answer;
  } catch { return {passed:false,checks:{},note:'No parseable answer; inspect P6, not a legal error classification.'}; }
  const aliases={
    invalid_accessory:['invalid_accessory','保证合同无效','从合同无效','invalid'],
    expired:['expired','保证期间届满','不再承担保证责任','保证责任免除'],
    joint:['joint','连带责任保证','可请求连带支付','joint_liability'],
    joint_limited_due_lost_recourse:['joint_limited_due_lost_recourse','因丧失追偿减半的连带保证','连带保证责任因丧失追偿部分免除'],
    released_due_debt_transfer:['released_due_debt_transfer','因未同意债务转移不再承担保证责任','债务转移免责'],
    debt_joining:['debt_joining','债务加入'],
    debt_transfer:['debt_transfer','债务转移','债务承担'],
    guarantee:['guarantee','保证'],
    general_preserved_not_yet_enforceable:['general_preserved_not_yet_enforceable','一般保证保全但有先诉抗辩','一般保证未可立即执行','general_preserved'],
  };
  const checks={};
  for(const [key,value]of Object.entries(expected).filter(([key])=>/valid|guarantee|traced|admission|_type$/.test(key))) {
    const actual=answer?.[key];
    const normalized=String(actual).trim().toLowerCase();
    if(typeof value==='boolean') {
      const allowed=key.endsWith('valid')?(value?['true','valid','有效','合同有效']:['false','invalid','无效','合同无效']):[String(value)];
      checks[key]=actual===value||allowed.includes(normalized);
    } else checks[key]=(aliases[value]??[value]).includes(normalized);
  }
  return {passed:Object.keys(checks).length>0&&Object.values(checks).every(Boolean),checks,
    note:'Conservative normalization of fixed state fields, not legal explanation or expert certification.'};
}
