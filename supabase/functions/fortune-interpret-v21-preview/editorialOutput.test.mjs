import test from 'node:test';
import assert from 'node:assert/strict';
import {stabilizeCoreForQuality} from './costGuardV21.ts';
import {inspectInterpretationQuality} from '../fortune-interpret-v6-preview/qualityV2.ts';

function fixture(){
  const evidence_ledger=[
    {id:'w1',system:'western',date:'2026-09-12',topic:'직장',text:'수성-토성 접촉으로 업무 조건을 점검하는 관측 근거',direction:'supportive'},
    {id:'w2',system:'western',date:'2026-09-19',topic:'직장',text:'화성-달 접촉으로 일정 부담을 살피는 관측 근거',direction:'caution'},
    {id:'s',system:'saju',start:'2026-09-01',end:'2026-09-30',text:'월운의 역할과 책임에 관한 독립 맥락',direction:'context'},
  ];
  const payload={period_kind:'month',period:{start:'2026-09-01',end:'2026-09-30'},western:{overall:{}},evidence_ledger};
  const core={overall:{summary:'기존 총평의 문장은 유지한다. '.repeat(15)},cross_checks:[
    {label:'첫 구간',start:'2026-09-12',end:'2026-09-12',mode:'복수체계',evidence_refs:['w1','s'],synthesis:''},
    {label:'둘째 구간',start:'2026-09-19',end:'2026-09-19',mode:'복수체계',evidence_refs:['w2','s'],synthesis:''},
  ]};
  return {payload,core};
}
const prose='서양점성술의 업무 조건 점검은 이 날짜의 접촉에 관한 설명이고, 사주의 역할과 책임은 월 단위 배경이야. 서로 시간 범위가 다르므로 같은 업무 사건의 성사 여부로 묶지 않고 일정과 맡은 역할을 나누어 확인해.';
test('authored cross comparison survives stabilization unchanged',()=>{
  const {payload,core}=fixture();core.cross_checks[0].synthesis=prose;
  const out=stabilizeCoreForQuality(core,payload);
  assert.equal(out.cross_checks[0].synthesis,prose);
  assert.equal(core.cross_checks[0].synthesis,prose);
  assert.equal(out.overall.summary,core.overall.summary.trim());
});
test('fallback comparisons distinguish actual linked observations',()=>{
  const {payload,core}=fixture();const out=stabilizeCoreForQuality(core,payload);
  assert.match(out.cross_checks[0].synthesis,/수성-토성/);
  assert.doesNotMatch(out.cross_checks[0].synthesis,/화성-달/);
  assert.match(out.cross_checks[1].synthesis,/화성-달/);
  assert.notEqual(out.cross_checks[0].synthesis,out.cross_checks[1].synthesis);
});
test('missing refs and changed system mode do not preserve stale synthesis',()=>{
  const {payload,core}=fixture();core.cross_checks[0].synthesis=prose;
  core.cross_checks[0].evidence_refs=['w1','missing'];
  const out=stabilizeCoreForQuality(core,payload);
  assert.equal(out.cross_checks[0].mode,'Western단독');
  assert.notEqual(out.cross_checks[0].synthesis,prose);
  assert.doesNotMatch(out.cross_checks[0].synthesis,/사주 근거/);
});
test('overconfident fusion text is replaced with linked context',()=>{
  const {payload,core}=fixture();core.cross_checks[0].synthesis='삼박자로 맞아떨어져 완벽한 성공을 보장하는 시너지야. '.repeat(3);
  const out=stabilizeCoreForQuality(core,payload);
  assert.doesNotMatch(out.cross_checks[0].synthesis,/삼박자|시너지|성공을 보장/);
  assert.match(out.cross_checks[0].synthesis,/합산하지/);
});
test('quality gate catches repeated cross prose without penalizing distinct comparisons',()=>{
  const {payload,core}=fixture();core.cross_checks.forEach(x=>x.synthesis=prose);
  const issues=data=>inspectInterpretationQuality(data,payload).stages.find(s=>s.stage===5).issues;
  assert.ok(issues(core).some(x=>x.includes('동일한 종합')));
  const out=stabilizeCoreForQuality(fixture().core,payload);
  assert.ok(!issues(out).some(x=>x.includes('동일한 종합')));
});
