import assert from "node:assert/strict";
import test from "node:test";

import { TOPICS } from "./integratedInterpretationV2.ts";
import { inspectInterpretationQuality } from "./qualityV2.ts";

function long(text, n=4){ return Array.from({length:n},()=>text).join(" "); }

function buildCase(kind){
  const configs={
    day:{start:"2026-09-03",end:"2026-09-03",dates:["2026-09-03"],summaryMin:4},
    week:{start:"2026-09-01",end:"2026-09-07",dates:["2026-09-03","2026-09-06"],summaryMin:4},
    month:{start:"2026-09-01",end:"2026-09-30",dates:["2026-09-05","2026-09-15","2026-09-25"],summaryMin:6},
  };
  const cfg=configs[kind];
  const evidence_ledger=cfg.dates.map((date,index)=>({
    id:`W:test:${kind}:${index+1}`,
    system:"western",
    scope:"test_window",
    topic:"직장",
    direction:index===1?"neutral":"supportive",
    date,
    score:60+index,
    text:`${date} 테스트용 실제 계산 근거`,
  }));
  const refs=evidence_ledger.map(x=>x.id);
  const key_windows=cfg.dates.map((date,index)=>({
    label:`${kind} 핵심구간 ${index+1}`,
    start:date,
    end:date,
    signal:index===1?"배경":"활용",
    topics:["직장"],
    summary:long("해당 시점의 계산 근거를 기준으로 실제 행동 우선순위를 구분하고 단일 지수를 사건 확정으로 확대하지 않는 핵심 구간이야.",2),
    action:"준비된 일정과 확인 가능한 현실 신호를 기준으로 다음 행동을 실행해.",
    avoid:"점수 하나만 보고 결과를 확정하거나 상대의 의도를 단정하지 마.",
    evidence_refs:[refs[index]],
  }));
  const decisions=[0,1,2].map((index)=>({
    action:`${index+1}번째 행동은 확인 가능한 현실 정보와 준비 상태를 먼저 점검한 뒤 실행해.`,
    timing:index===0?"우선 구간":index===1?"중간 점검":"마무리 점검",
    reason:"핵심 시기 계산 근거와 연결된 행동이라서 막연한 일반론보다 실제 일정과 확인 절차를 우선해야 해.",
    watch:"상대 반응, 일정 확정, 필요한 자료가 실제로 준비됐는지 확인해.",
    avoid:"확인되지 않은 기대만으로 결론을 앞당기거나 한 번에 여러 결정을 밀어붙이지 마.",
    evidence_refs:[refs[Math.min(index,refs.length-1)]],
  }));
  const topic_analysis=Object.fromEntries(TOPICS.map((topic,index)=>[topic,{
    verdict:`${topic}은 현재 기간의 상대적 활성도를 현실 판단과 분리해서 읽어야 해.`,
    reason:long(`${topic} 해석은 계산된 기간 근거와 핵심 시기의 변화만 사용하고 단일 점수를 실제 사건 발생이나 성공 확률로 바꾸지 않는 방식으로 읽어야 해.`,2),
    timing:"계산된 기간 안에서 핵심 구간을 중심으로 확인해.",
    action:"실제 일정, 상대 반응, 준비 상태처럼 확인 가능한 정보를 우선해서 행동해.",
    avoid:"한 번의 점수나 반응으로 전체 기간의 결과를 단정하지 마.",
    confidence:"보통",
    confidence_reason:"Western 계산 근거는 있지만 실제 사건을 확정하는 자료는 아니기 때문이야.",
    evidence_refs:[refs[index%refs.length]],
  }]));
  const data={
    headline:`${kind} 기간별 품질검증 테스트`,
    overall:{
      summary:long("이 기간은 평균 한 줄보다 실제 핵심 시기와 현실에서 확인할 조건을 함께 읽는 게 중요해. 분야별 상대 활성도는 사건 확률이 아니므로 계산 근거와 행동 조건을 분리해서 판단해야 하고, 강한 구간도 결과 보장으로 해석하면 안 돼.",cfg.summaryMin),
      dominant_pattern:"핵심 구간의 상대 활성도 차이를 현실 확인 조건과 함께 읽는 패턴이야.",
      best_phase:"준비가 끝난 행동을 계산 근거가 있는 핵심 구간에 배치하는 편이 상대적으로 적합해.",
      caution_phase:"확인되지 않은 기대만으로 결론을 당기지 말고 현실 신호를 먼저 확인해야 해.",
      evidence_refs:[refs[0]],
    },
    key_windows,
    year_phases:[],
    cross_checks:[],
    decisions,
    clusters:{relationship:"관계는 실제 반응과 계산 근거를 분리해 읽어.",work_study:"일과 학업은 준비 상태와 일정 확인을 우선해.",money_news:"금전과 소식은 확정 정보가 있는지 먼저 확인해.",investment:"투자는 가격 방향 예측이 아니라 심리와 위험 신호를 분리해.",condition:"컨디션은 무리한 일정 집중을 피하고 실제 상태를 확인해."},
    contact_flow:{incoming:"수신 지수는 연락 확률이 아니라 상대 방향 활성도야.",outgoing:"발신 적합은 연락 성공 보장이 아니라 행동 적합도야.",reconnection:"재접점 지수는 재회 확률이 아니라 과거 인연 관련 활성도야."},
    investment_reading:{psychology:"투자심리 흐름만 설명해.",realization:"수익실현 적합도만 설명해.",entry:"신규진입 적합도만 설명해.",risk:"투자주의는 높을수록 경계가 필요한 지수야."},
    systems:{western:"Western 계산 근거를 중심으로 읽어.",saju:"사주는 독립 배경 맥락으로만 유지해.",thai:"Thai는 방향성 투표가 아니라 허용된 배경 맥락으로만 유지해."},
    priorities:["현실 확인 조건 점검","핵심 시기별 행동 분리","단일 점수 과대해석 금지"],
    topic_analysis,
    limits:"상대 활성도는 실제 사건 발생, 상대 속마음, 합격, 수익을 확정하지 않아.",
  };
  const payload={period_kind:kind,period:{start:cfg.start,end:cfg.end},evidence_ledger};
  return {data,payload};
}

for(const kind of ["day","week","month"]){
  test(`${kind} quality guard accepts period-sized output without annual-only sections`,()=>{
    const {data,payload}=buildCase(kind);
    const report=inspectInterpretationQuality(data,payload);
    assert.equal(report.ok,true,JSON.stringify(report,null,2));
    assert.equal(report.score,100);
    assert.equal(data.year_phases.length,0);
    assert.equal(data.cross_checks.length,0);
  });
}
