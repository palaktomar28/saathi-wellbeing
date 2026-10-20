import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreAssessment,validateCheckin,summarize,recommend,RESOURCES} from '../public/domain.js';

test('PHQ-9 boundary scores map to the documented symptom bands',()=>{
  for(const [total,band] of [[0,'Minimal'],[4,'Minimal'],[5,'Mild'],[9,'Mild'],[10,'Moderate'],[14,'Moderate'],[15,'Moderately severe'],[19,'Moderately severe'],[20,'Severe'],[27,'Severe']]){
    let left=total;const answers=Array.from({length:9},()=>{const value=Math.min(3,left);left-=value;return value;});
    assert.equal(scoreAssessment('phq9',answers).band,band);
  }
});
test('GAD-7 boundaries and maximum',()=>{
  for(const [total,band]of [[0,'Minimal'],[5,'Mild'],[10,'Moderate'],[15,'Severe'],[21,'Severe']]){
    let left=total;const answers=Array.from({length:7},()=>{const v=Math.min(left,3);left-=v;return v;});assert.equal(scoreAssessment('gad7',answers).band,band);
  }
});
test('item 9 support guidance is independent of the total score',()=>{
  const answers=Array(9).fill(0);answers[8]=1;
  assert.equal(scoreAssessment('phq9',answers).needsSupport,true);
  assert.equal(scoreAssessment('phq9',answers).band,'Minimal');
});
test('partial, sparse, out-of-range, nonnumeric questionnaire answers are rejected',()=>{
  for(const answers of [[],Array(9),Array(9).fill(null),Array(9).fill('1'),Array(9).fill(-1),Array(9).fill(4),Array(9).fill(1.2)])assert.throws(()=>scoreAssessment('phq9',answers));
});
test('daily input is allowlisted and untrusted fields are discarded',()=>{
  const clean=validateCheckin({kind:'daily',mood:3,energy:2,sleep:7.5,concerns:['Sleep','Sleep'],session_id:'someone-else',score:99});
  assert.deepEqual(clean,{kind:'daily',mood:3,energy:2,sleep:7.5,concerns:['Sleep']});
  for(const override of [{sleep:NaN},{mood:0},{energy:6},{concerns:['<script>']},{sleep:25}])assert.throws(()=>validateCheckin({...clean,...override}));
});
test('summary does not invent missing days or forecast with one observation',()=>{
  assert.equal(summarize([]).average,null);
  const rows=[{kind:'daily',mood:2,created_at:'2026-01-01'},{kind:'phq9',score:15,created_at:'2026-01-02'},{kind:'daily',mood:4,created_at:'2026-01-12'}];
  assert.equal(summarize(rows).average,3);assert.equal(summarize(rows).count,2);assert.equal(summarize(rows.slice(0,1)).change,null);
});
test('recommendations preserve all options and match stated concerns',()=>{
  assert.equal(recommend(['Sleep']).length,RESOURCES.length);
  assert.ok(recommend(['Sleep'])[0].tags.includes('Sleep'));
  assert.ok(recommend([]).some(r=>r.id==='counselor'));
});
