import assert from "node:assert/strict";
import test from "node:test";
import { TOPICS } from "./integratedInterpretationV2.ts";
import { inspectInterpretationQuality } from "./qualityV2.ts";

function payload(){
  const ledger=TOPICS.map((topic,i)=>({id:`W:overall:${topic}`,system:"western",scope:"period_average",topic,direction:"neutral",start:"2026-01-01",end:"2026-12-31",text:`${topic} 기간 평균 근거`}));
  ledger.push(
    {id:"W:date:2026-02-10:직장:best",system:"western",scope:"best_day",topic:"직장",direction:"supportive",date:"2026-02-10",text:"직장 상위 날짜"},
    {id:"W:date:2026-04-12:연애:best",system:"western",scope:"best_day",topic:"연애",direction:"supportive",date:"2026-04-12",text:"연애 상위 날짜"},
    {id:"W:date:2026-07-18:재회:best",system:"western",scope:"best_day",topic:"재회",direction:"supportive",date:"2026-07-18",text:"재회 상위 날짜"},
    {id:"W:date:2026-09-20:학업:best",system:"western",scope:"best_day",topic:"학업",direction:"supportive",date:"2026-09-20",text:"학업 상위 날짜"},
    {id:"W:date:2026-11-11:금전:best",system:"western",scope:"best_day",topic:"금전",direction:"supportive",date:"2026-11-11",text:"금전 상위 날짜"},
  );
  return {period:{start:"2026-01-01",end:"2026-12-31"},period_kind:"annual",evidence_ledger:ledger};
}
function output(p){
  const analyses=Object.fromEntries(TOPICS.map(topic=>[topic,{importance:"참고",verdict:`${topic} 참고`,reason:"직접 계산근거를 확인했어.",timing:"",action:"실제 조건을 확인해.",avoid:"단정하지 마.",confidence:"낮음",confidence_reason:"참고 분야야.",evidence_refs:[`W:overall:${topic}`]}]));
  const windows=[
    ["2026-02-10","직장","W:date:2026-02-10:직장:best"],
    ["2026-04-12","연애","W:date:2026-04-12:연애:best"],
    ["2026-07-18","재회","W:date:2026-07-18:재회:best"],
    ["2026-09-20","학업","W:date:2026-09-20:학업:best"],
    ["2026-11-11","금전","W:date:2026-11-11:금전:best"],
  ].map(([date,topic,ref])=>({label:`${date} ${topic}`,start:date,end:date,signal:"활용",topics:[topic],summary:"실제 근거가 있는 주목 구간이야.",action:"준비한 일을 실행해.",avoid:"결과를 확정하지 마.",evidence_refs:[ref,`W:overall:${topic}`]}));
  return {
    headline:"연간 흐름",overall:{summary:"기간 전체를 실제 근거와 함께 봐.",dominant_pattern:"분야별 편차가 있어.",best_phase:"주목 구간을 확인해.",caution_phase:"검토 구간을 확인해.",evidence_refs:["W:overall:직장","W:overall:연애","W:overall:재회"]},
    key_windows:windows,
    year_phases:[1,2,3,4].map((q,i)=>({label:`Q${q}`,start:`2026-${String(i*3+1).padStart(2,"0")}-01`,end:`2026-${String(i*3+3).padStart(2,"0")}-28`,theme:"실제 근거가 있는 분기야.",change:"분기 흐름을 확인해.",evidence_refs:[windows[i].evidence_refs[0]]})),
    cross_checks:windows.slice(0,3).map((w,i)=>({label:`교차 ${i+1}`,start:w.start,end:w.end,mode:"Western단독",western:"Western 근거가 있어.",saju:"",thai:"",synthesis:"다른 체계의 직접 확인 근거는 없어.",evidence_refs:[w.evidence_refs[0]]})),
    decisions:windows.slice(0,3).map(w=>({action:"준비한 일을 실행해.",timing:w.start,reason:w.summary,watch:"실제 반응을 확인해.",avoid:"결과를 확정하지 마.",evidence_refs:[w.evidence_refs[0]]})),
    clusters:{relationship:"관계 참고",work_study:"일·학업 참고",money_news:"금전·소식 참고",investment:"투자 참고",condition:"컨디션 참고"},
    systems:{western:"Western 근거만 사용해.",saju:"직접 근거가 없으면 확장하지 않아.",thai:"직접 근거가 없으면 확장하지 않아."},
    priorities:["첫째 우선순위","둘째 우선순위","셋째 우선순위"],topic_analysis:analyses,limits:"사건 결과를 확정하지 않아.",
  };
}

test("semantic hardening rejects topic-mismatched evidence",()=>{
  const p=payload(),o=output(p);
  o.topic_analysis.연애.evidence_refs=["W:overall:직장"];
  const report=inspectInterpretationQuality(o,p);
  assert.equal(report.stages.find(x=>x.stage===4).passed,false);
  assert.match(report.stages.find(x=>x.stage===4).issues.join(" "),/다른 분야/);
});

test("semantic hardening rejects unsupported outcome and mind-reading claims",()=>{
  const p=payload(),o=output(p);
  o.relationship_reading={context:"관계 흐름",flow:"상대가 나를 그리워하고 있어.",focus_timing:"2026-07-18",watch:"실제 행동을 확인해.",avoid:"속마음으로 단정하지 마.",evidence_refs:["W:date:2026-07-18:재회:best"]};
  o.topic_analysis.재회.reason="2026-07-18에는 재회 가능성이 높아.";
  const report=inspectInterpretationQuality(o,p);
  const stage4=report.stages.find(x=>x.stage===4);
  assert.equal(stage4.passed,false);
  assert.match(stage4.issues.join(" "),/속마음|가능성/);
});

test("semantic hardening requires windows and phases to overlap their cited dates",()=>{
  const p=payload(),o=output(p);
  o.key_windows[0].evidence_refs=["W:overall:직장"];
  o.year_phases[1].evidence_refs=["W:overall:연애"];
  const report=inspectInterpretationQuality(o,p);
  const issues=report.stages.find(x=>x.stage===4).issues.join(" ");
  assert.match(issues,/key_window 기간을 덮는 직접 근거 없음/);
  assert.match(issues,/year_phase 안에 실제 근거가 없음/);
});
