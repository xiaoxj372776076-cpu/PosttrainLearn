import test from 'node:test';
import assert from 'node:assert/strict';
import { skillProjection } from '../lib/hardness-skill-projection.mjs';

test('current generation loads the complete iteration, reviewers receive no prior outcome notes',()=>{
  const source='Common quality constraints\n### 迭代 12 的修改假设\nPrior verdict 5/5\n### 迭代 13 的修改假设\nPrior candidate details';
  for(const stage of ['P1','P2','P2-repair'])assert.equal(skillProjection(source,stage,14).text,source);
  for(const stage of ['P3','P3-repair','P4','P6','P6-repair']) {
    const result=skillProjection(source,stage,14);
    assert.equal(result.text,'Common quality constraints');
    assert.equal(result.mode,'common_quality_rules_without_prior_outcomes');
  }
  assert.equal(skillProjection(source,'P6',13).text,source);
});
