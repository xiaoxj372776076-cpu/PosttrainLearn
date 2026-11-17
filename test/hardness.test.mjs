import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { measureHardness,legalStateFieldChecks } from '../lib/hardness-metrics.mjs';
import { hardnessCampaign,hardnessArtifact } from '../lib/hardness-campaign.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const answers=Array.from({length:5},(_,i)=>({index:i+1,completed_answer:true,report:{passed:i<2}}));
const audit={question_valid:true,reference_supported:true,difficulty_mechanism_valid:true,results:Array.from({length:5},(_,i)=>({index:i+1,correct:i<2,error_kind:i<2?'none':'substantive'}))};
test('difficulty counts five complete substantive answers, not BoN max or strict JSON',()=>{
  const result=measureHardness(audit,answers);
  assert.equal(result.target_hit,true);assert.equal(result.correct,2);
  assert.equal(measureHardness({...audit,results:audit.results.map(x=>({...x,correct:true,error_kind:'none'}))},answers).target_hit,false);
  assert.equal(measureHardness({...audit,reference_supported:false},answers).target_hit,false);
  assert.equal(measureHardness({...audit,question_valid:false},answers).target_hit,false);
  assert.equal(measureHardness(audit,answers.map((x,i)=>i===4?{...x,completed_answer:false}:x)).target_hit,false);
  for(const kind of ['format_only','truncation','infrastructure','question_invalid','unresolved']) {
    assert.equal(measureHardness({...audit,results:audit.results.map((x,i)=>i===4?{...x,error_kind:kind}:x)},answers).target_hit,false);
  }
  assert.equal(measureHardness({...audit,results:audit.results.map(x=>({...x,index:1}))},answers).target_hit,false);
  assert.equal(measureHardness(audit,answers.map(x=>({...x,index:1}))).target_hit,false);
  assert.equal(measureHardness(audit,answers.map(x=>({...x,completed_answer:'true'}))).target_hit,false);
});
test('equivalent validity labels do not masquerade as legal-state failures',()=>{
  const expected={A_valid:false,A_guarantee:'invalid_accessory',B_guarantee:'joint'};
  for(const label of [false,'false','invalid','无效']) {
    assert.equal(legalStateFieldChecks(expected,JSON.stringify({answers:{A_valid:label,A_guarantee:'invalid_accessory',B_guarantee:'joint'}})).passed,true);
  }
  assert.equal(legalStateFieldChecks(expected,JSON.stringify({...expected,A_valid:true})).passed,false);
  assert.equal(legalStateFieldChecks(expected,JSON.stringify({...expected,B_guarantee:'expired'})).passed,false);
  assert.equal(legalStateFieldChecks(expected,'Host cannot write here. '+JSON.stringify(expected)).passed,true);
  assert.equal(legalStateFieldChecks(expected,JSON.stringify({...expected,A_valid:true})+'\n'+JSON.stringify(expected)).passed,false);
});
test('campaign artifact access is bounded to real public artifacts and valid rounds',async()=>{
  const view=await hardnessCampaign(root,'01');assert.equal(view.config.max_rounds,20);
  assert.equal(view.config.target.n,5);assert.equal(view.config.model,'gpt-6-astra');
  assert.equal(view.artifacts['source.json'].data.new_scenario,false);
  for(const [round,file]of [['../01','config.json'],['21','source.json'],['01','../../.env'],['01','harbor-task/steps/audit/tests/expected.json'],['campaign','.env']]) {
    await assert.rejects(hardnessArtifact(root,round,file));
  }
});
