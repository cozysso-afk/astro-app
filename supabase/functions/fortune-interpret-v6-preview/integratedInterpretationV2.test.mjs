import assert from "node:assert/strict";
import test from "node:test";

import {
  PACKET_VERSION,
  QUALITY_VERSION,
  TOPICS,
  compactCalculation,
  inspectInterpretationQuality,
  validateOutput,
} from "./integratedInterpretationV2.ts";

function stat(avg,bestDate,bestScore,cautionDate,cautionScore){
  return {average:avg,band:avg>=60?"보통 이상":avg<40?"약함":"보통",spread:Math.abs(bestScore-cautionScore),best_days:[{date:bestDate,label:bestDate,score:bestScore}],caution_days:[{date:cautionDate,label:cautionDate,score:cautionScore}]};
}

function calculation(){
  const topics={};
  for(const [index,topic] of TOPICS.entries())topics[topic]=stat(48+index%5,"2026-07-21",78-index%4,"2026-05-14",31+index%3);
  const rel={
    수신신호:stat(55,"2026-07-21",82,"2026-05-14",34),
    발신적합:stat(58,"2026-07-24",80,"2026-05-15",36),
    과거인연접점:stat(57,"2026-10-21",84,"2026-10-14",33),
  };
  const months=[];
  for(let m=1;m<=12;m++){
    const mm=String(m).padStart(2,"0"),mt={},mr={};
    for(const [index,topic] of TOPICS.entries())mt[topic]=stat(40+((m+index)%7)*5,`2026-${mm}-21`,70,`2026-${mm}-14`,35);
    for(const topic of Object.keys(rel))mr[topic]=stat(45+(m%5)*4,`2026-${mm}-21`,75,`2026-${mm}-14`,36);
    months.push({calendar_month:`2026-${mm}`,start:`2026-${mm}-01`,end:`2026-${mm}-28`,topics:mt,relationship_signals:mr});
  }
  return {
    api_version:"test",engine:"test",period:{start:"2026-01-01",end:"2026-12-31",day_count:365},
    western:{engine:"western",ephemeris:"DE440s",score_policy:"relative",overall:topics,relationship_signals:rel,months,detail_days:[],market:{}},
    saju:{engine:"saju",pillars:{},annual:[{year:2026,ganzhi:"丙午",stem_ten_god:"정재",branch_links:[],segment_start:"2026-02-04T00:00:00+09:00",segment_end_exclusive:"2027-02-04T00:00:00+09:00"}],monthly:[{calendar_month:"2026-07",ganzhi:"乙未",stem_ten_god:"편재",branch_links:["일지와 六合"],segment_start:"2026-07-07T00:00:00+09:00",segment_end_exclusive:"2026-08-07T00:00:00+09:00",jie_name_ko:"소서"}],not_calculated:["용신"]},
    thai:{engine:"thai",taksajorn:{available:true,method:"test",segments:[{start:"2026-01-01T00:00:00+09:00",end:"2026-12-31T23:59:59+09:00",annual_boriwan:{key:"mars",label:"화성"},landed_center:false,wheel:[]}]},suriyayat:{},not_calculated:[]},
  };
}

function rawOutput(packet){
  const refs=packet.evidence_ledger.map(x=>x.id);
  const ref=(prefix)=>refs.find(x=>x.startsWith(prefix)) ?? refs[0];
  const topicAnalysis={};
  for(const topic of TOPICS){topicAnalysis[topic]={verdict:`${topic}은 연간 평균만 보면 평범하지만 월별 편차를 같이 봐야 해.`,reason:`${topic}은 월별 변동과 상위·하위 날짜가 분리되어 있어 한 날짜를 한 해 전체로 과장하면 안 돼. 7월의 변화와 5월 저점을 비교해 흐름을 읽는 편이 맞아.`,timing:"2026-07-21 전후와 2026-05-14 전후를 비교해.",action:"강한 구간에는 해당 분야의 중요한 일정과 검토를 배치해.",avoid:"하위 구간에는 즉흥적으로 결론을 확정하지 마.",confidence:"보통",confidence_reason:"Western 월별·날짜 근거가 있으나 사건 확률은 아니야.",evidence_refs:[ref(`W:overall:${topic}`),ref(`W:month:2026-07:${topic}`)]};}
  return {
    headline:"연평균보다 월별 전환점이 중요한 해",
    overall:{summary:"이 해는 평균 점수 하나로 설명하기 어렵고, 월별로 강약이 크게 갈리는 구조야. 특히 7월에는 여러 분야의 상위 날짜가 모이지만 5월에는 하위 날짜가 반복돼서 같은 행동을 연중 똑같이 가져가는 것보다 시기를 분리하는 게 중요해. 관계와 일·금전도 같은 달에 항상 같은 방향으로 움직이지 않으므로 분야별로 구분해서 봐야 해. 사주와 Thai는 Western 점수에 합산하지 않고 해당 날짜의 독립적인 기간 맥락으로만 확인해야 해. 따라서 핵심은 강한 달에는 준비된 결정을 실행하고 약한 달에는 검토와 보완을 우선하는 식으로 일정의 강도를 조절하는 거야.",dominant_pattern:"7월의 다중 활성과 5월의 반복 저점이 가장 큰 대비야.",best_phase:"2026-07-21 전후는 여러 Western 상위 근거가 겹쳐 활용도가 높아.",caution_phase:"2026-05-14 전후는 여러 분야의 하위 근거가 겹쳐 보수적으로 운영하는 편이 낫다.",evidence_refs:[ref("W:date:2026-07-21"),ref("W:date:2026-05-14"),ref("S:month:")]},
    key_windows:[
      {label:"7월 1차 상승창",start:"2026-07-21",end:"2026-07-24",signal:"활용",topics:["직장","이직"],summary:"직장·이직 관련 상위 날짜가 한 구간에 모여서 준비해 둔 지원·협상·검토를 실행하기에 상대적으로 밀도가 높은 시기야.",action:"지원서 제출, 협상안 검토, 중요한 업무 결정을 이 구간에 집중해.",avoid:"점수가 높다는 이유만으로 결과 확정을 기대하지 마.",evidence_refs:[ref("W:date:2026-07-21:직장:best"),ref("W:month:2026-07:직장")]},
      {label:"5월 저점",start:"2026-05-14",end:"2026-05-15",signal:"주의",topics:["연애","직장"],summary:"여러 분야의 하위 날짜가 같은 시기에 반복돼서 성급한 확정이나 감정적인 결론을 피하는 편이 좋은 구간이야.",action:"결론보다 점검·보완·자료 확인을 우선해.",avoid:"관계와 업무를 한 번의 반응으로 단정하지 마.",evidence_refs:[ref("W:date:2026-05-14:연애:caution"),ref("W:month:2026-05:연애")]},
      {label:"10월 관계 재접점",start:"2026-10-21",end:"2026-10-21",signal:"활용",topics:["과거인연접점"],summary:"과거인연접점 지수가 연중 상위 날짜에 들어오므로 과거 관계 이슈가 다시 의식되는 흐름을 관찰하기 좋은 시기야.",action:"실제 연락이나 반응이 있다면 그때 사실관계를 확인해.",avoid:"상위 지수를 실제 재회 확률로 바꾸지 마.",evidence_refs:[ref("W:date:2026-10-21:과거인연접점:best"),ref("W:month:2026-10:과거인연접점")]},
      {label:"1분기 정리",start:"2026-02-14",end:"2026-02-21",signal:"혼합",topics:["금전","학업"],summary:"분야별 월평균이 엇갈리는 구간이라 한쪽의 강함을 다른 분야까지 확대해석하지 않는 게 중요해.",action:"분야별 목표를 따로 점검해.",avoid:"한 분야의 좋은 흐름을 전체 운으로 일반화하지 마.",evidence_refs:[ref("W:month:2026-02:금전"),ref("W:month:2026-02:학업")]},
      {label:"연말 점검",start:"2026-12-14",end:"2026-12-21",signal:"혼합",topics:["금전","연애"],summary:"연말에도 분야별 강약이 다르므로 성과 정리와 관계 판단을 같은 기준으로 묶지 않고 따로 보는 게 맞아.",action:"올해 결과를 분야별로 따로 결산해.",avoid:"연말 분위기로 모든 결론을 서두르지 마.",evidence_refs:[ref("W:month:2026-12:금전"),ref("W:month:2026-12:연애")]},
    ],
    year_phases:[
      {label:"Q1",start:"2026-01-01",end:"2026-03-31",theme:"초반은 분야별 편차를 파악하는 구간이야.",change:"월별 강약을 확인하며 우선순위를 정해.",evidence_refs:[ref("W:month:2026-02:금전")]},
      {label:"Q2",start:"2026-04-01",end:"2026-06-30",theme:"5월 저점이 두드러져 보완과 점검이 중요해.",change:"속도를 줄이고 오류를 정리해.",evidence_refs:[ref("W:date:2026-05-14")]},
      {label:"Q3",start:"2026-07-01",end:"2026-09-30",theme:"7월에 활용 가능한 피크가 집중돼.",change:"준비된 결정을 실행 쪽으로 옮겨.",evidence_refs:[ref("W:date:2026-07-21")]},
      {label:"Q4",start:"2026-10-01",end:"2026-12-31",theme:"관계 재접점과 연말 정리가 함께 와.",change:"실제 반응을 확인하면서 결산해.",evidence_refs:[ref("W:date:2026-10-21")]},
    ],
    decisions:[
      {action:"7월에는 준비된 업무 결정을 실행해.",timing:"2026-07-21~2026-07-24",reason:"직장 관련 월·날짜 근거가 겹쳐.",evidence_refs:[ref("W:date:2026-07-21:직장:best"),ref("W:month:2026-07:직장")]},
      {action:"5월 중순에는 결론보다 검토를 우선해.",timing:"2026-05-14~2026-05-15",reason:"여러 하위 날짜가 겹쳐.",evidence_refs:[ref("W:date:2026-05-14:연애:caution"),ref("W:month:2026-05:연애")]},
      {action:"10월 관계 신호는 실제 반응이 있을 때만 해석을 확장해.",timing:"2026-10-21 전후",reason:"과거인연접점 상위 날짜지만 사건 확률은 아니야.",evidence_refs:[ref("W:date:2026-10-21:과거인연접점:best"),ref("W:month:2026-10:과거인연접점")]},
    ],
    clusters:{relationship:"관계는 대인관계·연애·연락·재접점을 분리해서 봐야 해.",work_study:"일과 학업은 월별 강약 차이가 있어 시기 배치가 중요해.",money_news:"금전과 소식도 같은 방향으로 움직인다고 가정하면 안 돼.",investment:"투자주의는 높을수록 경계 지수라는 점을 분리해서 읽어야 해.",condition:"컨디션은 일정 강도 조절용 참고지수로만 써."},
    contact_flow:{incoming:"수신신호는 실제 연락 확률이 아니라 상대→나 방향의 상대 활성도야.",outgoing:"발신적합은 내가 연락을 시도할 때의 상대적 적합 흐름이야.",reconnection:"과거인연접점은 과거 관계가 다시 활성화되는 맥락이지 재회 보장은 아니야."},
    investment_reading:{psychology:"투자심리와 위험지수는 따로 봐야 해.",realization:"수익실현 지수는 가격 상승 예측이 아니야.",entry:"신규진입 지수는 실제 매수 성공률이 아니야.",risk:"투자주의가 높으면 오히려 경계가 커진다는 뜻이야."},
    systems:{western:"월별 궤적과 상·하위 날짜를 중심으로 읽어.",saju:"절입 구간을 독립 맥락으로만 확인해.",thai:"예측 투표로 쓰지 말고 허용된 비예측 맥락만 설명해."},
    priorities:["7월 실행 준비","5월 중순 검토 강화","관계 신호는 실제 반응과 대조"],
    topic_analysis:topicAnalysis,
    limits:"점수는 사건 확률이 아니며 사주·Thai를 Western 점수와 임의 합산하지 않아.",
  };
}

test("packet v2 keeps monthly trajectory and builds traceable evidence",()=>{
  const packet=compactCalculation(calculation());
  assert.equal(packet.packet_version,PACKET_VERSION);
  assert.equal(packet.western.months.length,12);
  assert.ok(packet.evidence_ledger.length>100);
  assert.ok(packet.key_dates.some(x=>x.date==="2026-07-21"));
  const july=packet.cross_system_timeline.find(x=>x.date==="2026-07-21");
  assert.ok(july?.saju_context_refs.length>0);
  assert.ok(july?.thai_context_refs.length>0);
});

test("five-stage validator accepts evidence-backed annual output",()=>{
  const packet=compactCalculation(calculation());
  const data=validateOutput(rawOutput(packet));
  assert.ok(data);
  const report=inspectInterpretationQuality(data,packet);
  assert.equal(report.version,QUALITY_VERSION);
  assert.equal(report.ok,true,JSON.stringify(report.stages));
  assert.equal(report.score,100);
});

test("fabricated date is rejected at grounding stage",()=>{
  const packet=compactCalculation(calculation());
  const raw=rawOutput(packet);
  raw.key_windows[0].summary += " 2026-07-31도 같은 핵심일이야.";
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.ok,false);
  assert.equal(report.stages[1].passed,false);
  assert.match(report.stages[1].issues.join(" "),/찾을 수 없는 날짜/);
});

test("probability language is rejected at semantic stage",()=>{
  const packet=compactCalculation(calculation());
  const raw=rawOutput(packet);
  raw.contact_flow.incoming="연락 확률은 80%야.";
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[2].passed,false);
});

test("high confidence without enough evidence is rejected",()=>{
  const packet=compactCalculation(calculation());
  const raw=rawOutput(packet);
  raw.topic_analysis.연애.confidence="높음";
  raw.topic_analysis.연애.evidence_refs=[raw.topic_analysis.연애.evidence_refs[0]];
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[3].passed,false);
});

test("shallow annual answer is rejected at depth stage",()=>{
  const packet=compactCalculation(calculation());
  const raw=rawOutput(packet);
  raw.key_windows=raw.key_windows.slice(0,2);
  raw.overall.summary="짧은 요약";
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[4].passed,false);
});