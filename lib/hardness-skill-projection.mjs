export function skillProjection(source, stage, round) {
  const reviewer=Number(round)>=14&&/^P[346](?:-|$)/.test(stage);
  return { text:reviewer?source.split(/\n### 迭代 \d+ 的修改假设/)[0]:source,
    mode:reviewer?'common_quality_rules_without_prior_outcomes':'full_iteration_skill' };
}
