import assert from "node:assert/strict";
import test from "node:test";

import { PACKET_VERSION, SCHEMA, TOPICS, compactCalculation, validateOutput } from "./integratedInterpretationV2.ts";
import { QUALITY_VERSION, inspectInterpretationQuality } from "./qualityV2.ts";

function stat(avg,bestDate,bestScore,cautionDate,cautionScore){
  return {average:avg,band:avg>=60?"보통 이상":avg<40?"약함":"보통",spread:Math.abs(bestScore-cautionScore),best_days:[{date:bestDate,label:bestDate,score:bestScore}],caution_days:[{date:cautionDate,label:cautionDate,score:cautionScore}]};
}
function lastDay(month){return new Date(Date.UTC(2026,month,0)).getUTCDate();}
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
    months.push({calendar_month:`2026-${mm}`,start:`2026-${mm}-01`,end:`2026-${mm}-${String(lastDay(m)).padStart(2,"0")}`,topics:mt,relationship_signals:mr});
  }
  const dailySeeds=[
    ["2026-02-14",28,false],["2026-02-21",76,false],
    ["2026-05-14",25,true],["2026-05-15",30,true],
    ["2026-07-21",82,true],["2026-07-24",78,true],
    ["2026-10-21",85,true],["2026-10-14",32,true],
    ["2026-12-14",29,true],["2026-12-21",75,true],
  ];
  const investment=new Set(["투자심리","수익실현","신규진입","투자주의"]);
  const daily_scores=dailySeeds.map(([date,base,market_open],rowIndex)=>{
    const scores={};
    for(const [index,topic] of TOPICS.entries()){
      if(investment.has(topic)&&!market_open){scores[topic]=null;continue;}
      const drift=(index%3)-1; scores[topic]=Math.max(5,Math.min(95,Number(base)+drift*2));
    }
    scores.수신신호=Math.max(5,Math.min(95,Number(base)+1));
    scores.발신적합=Math.max(5,Math.min(95,Number(base)+2));
    scores.과거인연접점=Math.max(5,Math.min(95,Number(base)+3));
    return {
      date,label:date,market_open:Boolean(market_open),scores,
      evidence:[{kind:"aspect",sample_time:"12:00",source_topics:[...TOPICS,"수신신호","발신적합","과거인연접점"],contribution:1.2+rowIndex/100,text:`Jupiter→MC trine · orb 0.${20+rowIndex}°`,transit:"Jupiter",target:"MC",aspect:"trine",orb:(20+rowIndex)/100}],
    };
  });
  return {
    api_version:"test",engine:"test",period:{start:"2026-01-01",end:"2026-12-31",day_count:365},
    western:{engine:"western",ephemeris:"DE440s",score_policy:"relative",overall:topics,relationship_signals:rel,months,daily_scores,detail_days:[],market:{}},
    saju:{engine:"saju",pillars:{},annual:[{year:2026,ganzhi:"丙午",stem_ten_god:"정재",branch_links:[],segment_start:"2026-02-04T00:00:00+09:00",segment_end_exclusive:"2027-02-04T00:00:00+09:00"}],monthly:[{calendar_month:"2026-07",ganzhi:"乙未",stem_ten_god:"편재",branch_links:["일지와 六合"],segment_start:"2026-07-07T00:00:00+09:00",segment_end_exclusive:"2026-08-07T00:00:00+09:00",jie_name_ko:"소서"}],not_calculated:["용신"]},
    thai:{engine:"thai",taksajorn:{available:true,method:"test",segments:[{start:"2026-01-01T00:00:00+09:00",end:"2026-12-31T23:59:59+09:00",annual_boriwan:{key:"mars",label:"화성"},landed_center:false,wheel:[]}]},suriyayat:{},not_calculated:[]},
  };
}
function repeat(text,count=5){return Array.from({length:count},()=>text).join(" ");}
function output(packet){
  const ids=packet.evidence_ledger.map(x=>x.id);
  const ref=(prefix)=>ids.find(x=>x.startsWith(prefix)) ?? ids[0];
  const analyses={};
  for(const topic of TOPICS){
    const importance=["직장","이직"].includes(topic)?"핵심":["연애","연락","재회"].includes(topic)?"주목":"참고";
    analyses[topic]={
      importance,
      verdict:`${topic}은 연평균 하나보다 월별 변화와 날짜 피크를 같이 봐야 해.`,
      reason:repeat(`${topic}은 기간 평균과 7월 월평균, 상·하위 날짜가 서로 다른 층의 근거라서 한 날짜만으로 전체 흐름을 과장하면 안 돼.`,importance==="핵심"?3:importance==="주목"?2:1),
      timing:"2026-07-21과 2026-05-14의 대비를 중심으로 봐.",
      action:"강한 구간에는 미리 준비한 일정과 결정을 배치하고 약한 구간에는 검토를 우선해.",
      avoid:"단일 피크를 실제 사건의 보장으로 바꾸지 마.",
      confidence:"보통",
      confidence_reason:"서양점성술의 기간·월 근거가 있지만 사건을 확정하는 데이터는 아니야.",
      evidence_refs:[ref(`W:overall:${topic}`),ref(`W:month:2026-07:${topic}`)],
    };
  }
  const julyWork=ref("W:date:2026-07-21:직장:best");
  const julyOutgoing=ref("W:date:2026-07-24:발신적합:best");
  const mayLove=ref("W:date:2026-05-14:연애:caution");
  const mayOutgoing=ref("W:date:2026-05-15:발신적합:caution");
  const octReconnect=ref("W:date:2026-10-21:과거인연접점:best");
  const octMonth=ref("W:month:2026-10:과거인연접점");
  const febMoney=ref("W:month:2026-02:금전");
  const febStudy=ref("W:month:2026-02:학업");
  const decMoney=ref("W:month:2026-12:금전");
  const decLove=ref("W:month:2026-12:연애");
  const julyDaily=ref("W:daily:2026-07-21:");
  const mayDaily=ref("W:daily:2026-05-14:");
  const octDaily=ref("W:daily:2026-10-21:");
  const febDaily=ref("W:daily:2026-02-14:");
  const decDaily=ref("W:daily:2026-12-14:");
  return {
    headline:"연평균보다 전환구간이 중요한 해",
    overall:{
      summary:repeat("이 해는 연평균만 보면 평범해 보이지만 월별 변동폭과 상·하위 날짜가 크게 갈려서 시기를 나눠 읽어야 해. 관계·일·금전도 같은 달에 항상 같은 방향으로 움직이지 않기 때문에 분야를 분리하고, 사주와 Thai는 Western 점수에 합산하지 않은 채 독립 맥락으로만 확인하는 게 핵심이야.",3),
      dominant_pattern:"7월의 다중 활성과 5월의 반복 저점이 가장 큰 대비고, 10월에는 관계 재접점 신호가 따로 살아나.",
      best_phase:"2026-07-21 전후는 여러 상위 근거가 모여 준비된 결정을 실행하기에 상대적으로 밀도가 높아.",
      caution_phase:"2026-05-14 전후는 여러 하위 근거가 모여 성급한 확정보다 검토가 필요한 구간이야.",
      evidence_refs:[julyWork,mayLove,ref("S:month:")],
    },
    key_windows:[
      {label:"7월 실행창",start:"2026-07-21",end:"2026-07-24",signal:"활용",topics:["직장","이직","발신적합"],summary:repeat("준비해 둔 업무 결정과 연락 시도를 실제 행동으로 옮길 만한 상위 날짜가 같은 주간에 모여 있어.",2),action:"지원·협상·중요한 연락처럼 미리 준비한 행동을 이 구간에 집중해서 실행해.",avoid:"높은 상대지수를 결과 확정이나 성공 보장으로 바꾸지 마.",evidence_refs:[julyWork,julyOutgoing,julyDaily]},
      {label:"5월 점검창",start:"2026-05-14",end:"2026-05-15",signal:"주의",topics:["연애","발신적합"],summary:repeat("관계와 발신 관련 하위 날짜가 연달아 잡혀서 즉흥적인 결론보다 사실 확인과 보완을 먼저 하는 편이 나아.",2),action:"중요한 관계 판단이나 메시지 전송 전에 문맥과 사실관계를 한 번 더 검토해.",avoid:"한 번의 반응만으로 관계 전체를 단정하거나 감정적으로 결론내리지 마.",evidence_refs:[mayLove,mayOutgoing,mayDaily]},
      {label:"10월 재접점창",start:"2026-10-21",end:"2026-10-21",signal:"활용",topics:["과거인연접점"],summary:repeat("과거인연접점의 상위 날짜가 월간 흐름 안에서도 눈에 띄어서 과거 관계 이슈가 다시 의식될 수 있는 시기야.",2),action:"실제 연락이나 우연한 재접촉이 있다면 그때 상대의 현실 행동과 사실관계를 확인해.",avoid:"상위 지수를 실제 재회 가능성이나 상대 속마음으로 바꾸지 마.",evidence_refs:[octReconnect,octMonth,octDaily]},
      {label:"1분기 방향정리",start:"2026-02-14",end:"2026-02-21",signal:"혼합",topics:["금전","학업"],summary:repeat("금전과 학업의 월별 강약이 같지 않아서 한 분야의 흐름을 다른 분야까지 확대해석하면 판단이 흐려질 수 있어.",2),action:"금전 계획과 학업 일정을 따로 나눠 우선순위와 마감 일정을 다시 점검해.",avoid:"한 분야의 좋은 흐름을 전체 운세가 좋다는 뜻으로 일반화하지 마.",evidence_refs:[febMoney,febStudy,febDaily]},
      {label:"연말 분리결산",start:"2026-12-14",end:"2026-12-21",signal:"혼합",topics:["금전","연애"],summary:repeat("연말에도 금전과 연애가 같은 강도로 움직이지 않으니 성과 정리와 관계 판단을 같은 기준으로 묶지 않는 게 중요해.",2),action:"연말 결산은 금전 성과와 관계 상태를 분리해서 각각의 실제 결과와 다음 행동을 정리해.",avoid:"연말 분위기만으로 미뤄둔 결론을 한꺼번에 확정하지 마.",evidence_refs:[decMoney,decLove,decDaily]},
    ],
    year_phases:[
      {label:"Q1",start:"2026-01-01",end:"2026-03-31",theme:"분야별 편차를 파악하는 초반부야.",change:"월별 강약을 확인하면서 우선순위를 정리해.",evidence_refs:[febMoney]},
      {label:"Q2",start:"2026-04-01",end:"2026-06-30",theme:"5월 저점이 끼어 있어 보완과 점검이 중요해.",change:"결론보다 오류 수정과 사실 확인을 우선해.",evidence_refs:[mayLove]},
      {label:"Q3",start:"2026-07-01",end:"2026-09-30",theme:"7월의 실행 피크가 가장 눈에 띄는 구간이야.",change:"미리 준비한 행동을 실제 실행 쪽으로 옮겨.",evidence_refs:[julyWork]},
      {label:"Q4",start:"2026-10-01",end:"2026-12-31",theme:"관계 재접점과 연말 결산이 함께 들어와.",change:"실제 반응을 확인하면서 분야별로 결산해.",evidence_refs:[octReconnect]},
    ],
    cross_checks:[
      {label:"7월 실행창 교차검증",start:"2026-07-21",end:"2026-07-24",mode:"복수체계",western:"Western에서는 직장·발신 상위 날짜와 실제 일별 트랜짓 근거가 같은 주간에 모여 있어.",saju:"사주 월운은 같은 기간을 포함하는 절입 구간 맥락을 제공하지만 Western 점수와 합산하지 않아.",thai:"Thai는 이 교차검증에서 방향성 투표로 쓰지 않고 해당 기간층이 있다는 사실만 별도로 유지해.",synthesis:"Western의 실행 피크를 중심 근거로 삼고 사주는 같은 시기 배경을 독립적으로 겹쳐 보되, 두 체계가 같은 사건을 예언한다고 해석하지 않는 구간이야.",evidence_refs:[julyWork,julyDaily,ref("S:month:")]},
      {label:"10월 재접점 교차검증",start:"2026-10-21",end:"2026-10-21",mode:"복수체계",western:"Western에서는 과거인연접점 상위 날짜와 실제 일별 근거가 동시에 잡혀 있어.",saju:"해당 날짜를 직접 지지하는 별도 사주 월운 근거가 없으므로 사주로 재회 방향을 보강하지 않아.",thai:"Taksajorn 기간층은 이 날짜를 포함하지만 사건 방향이나 재회 확률을 뜻하지 않는 독립 맥락이야.",synthesis:"재접점 해석의 방향은 Western 근거에 두고 Thai는 같은 기간에 존재하는 비예측 배경층으로만 나란히 표시해야 해.",evidence_refs:[octReconnect,octDaily,ref("T:taksajorn:")]},
      {label:"5월 점검창 단독신호",start:"2026-05-14",end:"2026-05-15",mode:"Western단독",western:"Western에서 연애·발신 하위 날짜와 실제 일별 근거가 함께 잡혀 있어 점검 신호가 명확해.",saju:"같은 결론을 독립적으로 확인하는 직접 근거는 이 교차항목에 연결되지 않았어.",thai:"같은 결론을 독립적으로 확인하는 예측 근거로 사용하지 않아.",synthesis:"이 구간은 여러 체계가 같은 방향을 말한다고 포장하지 말고 Western 계산에서만 강하게 잡힌 주의 신호로 제한해서 읽어야 해.",evidence_refs:[mayLove,mayOutgoing,mayDaily]},
    ],
    decisions:[
      {action:"7월 실행창에는 준비된 업무 결정과 중요한 연락을 실제 행동으로 옮겨.",timing:"2026-07-21~2026-07-24",reason:"직장 상위 날짜와 발신적합 상위 날짜가 같은 구간에 있어.",watch:"지원서·협상안·메시지 초안이 이미 준비됐는지와 상대의 실제 응답 가능 시간을 먼저 확인해.",avoid:"준비 없이 즉흥적으로 범위를 넓히거나 높은 점수를 성공 보장으로 해석하지 마.",evidence_refs:[julyWork,julyOutgoing]},
      {action:"5월 점검창에는 관계 결론보다 메시지와 사실관계를 다시 확인해.",timing:"2026-05-14~2026-05-15",reason:"연애와 발신 관련 하위 날짜가 연속으로 잡혀 있어.",watch:"상대가 실제로 한 말과 행동, 일정 변경 같은 확인 가능한 사실을 감정 해석과 분리해 봐.",avoid:"답장 속도나 한 번의 반응만으로 관계 전체를 확정하거나 연속 메시지를 보내지 마.",evidence_refs:[mayLove,mayOutgoing]},
      {action:"10월 재접점 신호는 실제 상대 행동이 있을 때만 해석 범위를 넓혀.",timing:"2026-10-21",reason:"과거인연접점의 상위 날짜와 월간 근거가 함께 있어.",watch:"실제 연락·만남 제안·우연한 재접촉처럼 관찰 가능한 사건이 생기는지 먼저 확인해.",avoid:"접점 지수만 보고 상대 속마음이나 재회 의사를 미리 확정하지 마.",evidence_refs:[octReconnect,octMonth]},
    ],
    clusters:{relationship:repeat("대인관계·연애·연락·재접점을 하나로 뭉개지 말고 각각의 월별 변화와 날짜 피크를 따로 읽어야 해.",2),work_study:repeat("일과 학업은 월별 강약이 다르므로 중요한 일정 배치를 같은 기준으로 처리하지 않는 게 좋아.",2),money_news:repeat("금전과 소식은 서로 다른 계산축이라 한쪽의 피크가 다른 쪽의 결과를 보장하지 않아.",2),investment:repeat("투자심리·수익실현·신규진입·투자주의는 서로 다른 지수고 특히 투자주의는 높을수록 경계가 커져.",2),condition:repeat("컨디션은 일정 강도와 휴식 배치를 조절하는 참고 흐름으로만 읽어.",2)},
    relationship_reading:{context:"연락과 재회 축은 관계 자체를 확정하는 값이 아니라 수신·발신·과거인연 재접점이 언제 따로 또는 함께 활성화되는지를 보는 구조야.",flow:"7월에는 발신 쪽 실행성이 먼저 살아나고 10월에는 과거인연 재접점이 따로 강해져서, 먼저 내가 움직이기 좋은 흐름과 이후 과거 관계 이슈가 다시 떠오르는 흐름을 구분해서 봐야 해.",focus_timing:"2026-07-24의 발신 적합과 2026-10-21의 과거인연 재접점 구간을 서로 다른 의미로 주목해.",watch:"실제 메시지 수신 여부, 상대의 지속적인 행동, 만남 제안처럼 현실에서 확인되는 반응이 이어지는지 확인해.",avoid:"상대 활성도나 재접점 지수를 상대 속마음, 연락 확정, 재회 확률로 바꾸지 마.",evidence_refs:[ref("W:overall:수신신호"),julyOutgoing,octReconnect]},
    contact_flow:{incoming:"수신신호는 실제 연락의 보장이 아니라 상대→나 방향의 상대 활성도를 보여주는 참고축이야.",outgoing:"발신적합은 내가 행동할 때의 상대적 적합 흐름이지 상대 반응을 확정하는 값이 아니야.",reconnection:"과거인연접점은 과거 관계가 다시 활성화되는 맥락을 뜻할 뿐 실제 재회를 보장하지 않아."},
    investment_reading:{psychology:"투자심리는 심리적 판단 환경을 보는 지수고 가격 방향을 예측하지 않아.",realization:"수익실현은 이미 형성된 흐름을 정리하기 좋은 상대적 조건이지 실제 수익을 보장하지 않아.",entry:"신규진입은 진입 판단 환경을 보는 지수이지 매수 성공률을 뜻하지 않아.",risk:"투자주의는 높을수록 경계가 커지는 위험 지수라 다른 투자지수와 방향을 뒤집어 읽으면 안 돼."},
    systems:{western:repeat("서양점성술은 연평균과 12개월 궤적, 상·하위 날짜를 계층적으로 읽어야 해.",2),saju:repeat("사주는 입춘과 절입 정확 구간을 유지하고 계산되지 않은 용신 같은 항목을 추정하지 않아.",2),thai:repeat("Thai는 허용된 비예측 맥락만 사용하고 Western 점수에 합산하거나 사건 날짜 투표처럼 쓰지 않아.",2)},
    priorities:["7월 실행 준비를 미리 끝내기","5월 중순에는 사실 확인을 한 번 더 하기","관계 신호는 실제 상대 행동과 대조하기"],
    topic_analysis:analyses,
    limits:"모든 점수는 사건 발생 확률이 아니고 사주·Thai를 Western 점수와 임의로 합산하지 않아. 실제 결과는 현실 행동과 외부 조건에 따라 달라질 수 있어.",
  };
}

test("packet v2 preserves 12-month trajectory and cross-system evidence",()=>{
  const packet=compactCalculation(calculation());
  assert.equal(packet.packet_version,PACKET_VERSION);
  assert.equal(packet.western.months.length,12);
  assert.ok(packet.evidence_ledger.length>100);
  assert.ok(packet.key_dates.some(x=>x.date==="2026-07-21"));
  const july=packet.cross_system_timeline.find(x=>x.date==="2026-07-21");
  assert.ok(july?.saju_context_refs.length>0);
  assert.ok(july?.thai_context_refs.length>0);
});

test("full-daily packet preserves market nulls and promotes actual daily evidence",()=>{
  const packet=compactCalculation(calculation());
  const topics=packet.western.daily_score_matrix.topic_order;
  const row=packet.western.daily_score_matrix.rows.find(x=>x[0]==="2026-02-14");
  assert.ok(row);
  const investIndex=topics.indexOf("투자심리");
  assert.equal(row[investIndex+1],null);
  assert.equal(packet.western.daily_pattern_digest.투자심리.days,8);
  const july=packet.key_dates.find(x=>x.date==="2026-07-21");
  assert.ok(july?.western_refs?.some(x=>x.startsWith("W:daily:2026-07-21:")));
  assert.ok(packet.evidence_ledger.some(x=>x.id.startsWith("W:daily:2026-02-14:")));
});

test("five stages accept a deep evidence-backed annual interpretation",()=>{
  const packet=compactCalculation(calculation());
  const data=validateOutput(output(packet));
  const report=inspectInterpretationQuality(data,packet);
  assert.equal(report.version,QUALITY_VERSION);
  assert.equal(report.ok,true,JSON.stringify(report.stages));
  assert.equal(report.score,100);
});

test("a fabricated exact date fails grounding",()=>{
  const packet=compactCalculation(calculation());
  const raw=output(packet);
  raw.key_windows[0].summary += " 2026-07-30도 핵심일이야.";
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[1].passed,false);
  assert.match(report.stages[1].issues.join(" "),/찾을 수 없는 날짜/);
});

test("numeric probability claim fails semantic validation but a negated limitation does not",()=>{
  const packet=compactCalculation(calculation());
  const safe=inspectInterpretationQuality(validateOutput(output(packet)),packet);
  assert.equal(safe.stages[2].passed,true,JSON.stringify(safe.stages[2]));
  const raw=output(packet);
  raw.contact_flow.incoming="연락 확률은 80%야.";
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[2].passed,false);
});

test("cross-system mode without an independent second system fails consistency",()=>{
  const packet=compactCalculation(calculation());
  const raw=output(packet);
  raw.cross_checks[0].evidence_refs=raw.cross_checks[0].evidence_refs.filter((ref)=>ref.startsWith("W:"));
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[3].passed,false);
  assert.match(report.stages[3].issues.join(" "),/독립 체계 2개 미만/);
});

test("high confidence without enough evidence fails consistency",()=>{
  const packet=compactCalculation(calculation());
  const raw=output(packet);
  raw.topic_analysis.연애.confidence="높음";
  raw.topic_analysis.연애.evidence_refs=[raw.topic_analysis.연애.evidence_refs[0]];
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[3].passed,false);
});

test("shallow annual output fails depth and utility",()=>{
  const packet=compactCalculation(calculation());
  const raw=output(packet);
  raw.key_windows=raw.key_windows.slice(0,2);
  raw.overall.summary="짧은 요약";
  const report=inspectInterpretationQuality(validateOutput(raw),packet);
  assert.equal(report.stages[4].passed,false);
});


test("packet emits exact W:window evidence for intraday best and caution windows",()=>{
  const calc=calculation();
  calc.western.detail_days=[{date:"2026-07-21",market_open:true,topics:{직장:{best_window:{start:"08:00",end:"09:30",score:72},caution_window:{start:"16:00",end:"17:00",score:31},evidence:["Jupiter trine MC intraday test"]}}}];
  const packet=compactCalculation(calc);
  const best=packet.evidence_ledger.find(x=>x.id==="W:window:2026-07-21:직장:best");
  const caution=packet.evidence_ledger.find(x=>x.id==="W:window:2026-07-21:직장:caution");
  assert.ok(best);
  assert.ok(caution);
  assert.equal(best.scope,"intraday_window");
  assert.equal(best.window,"08:00~09:30");
  assert.equal(best.direction,"supportive");
  assert.equal(caution.window,"16:00~17:00");
  assert.equal(caution.direction,"caution");
  assert.ok(packet.evidence_ledger.some(x=>x.id==="W:detail:2026-07-21:직장:1"));
});


test("day packet always keeps the selected date in key_dates and uses a day-specific policy",()=>{
  const calc=calculation();
  calc.period={start:"2026-09-03",end:"2026-09-03",day_count:1};
  calc.western.daily_scores=[{
    date:"2026-09-03",label:"2026-09-03",market_open:true,
    scores:Object.fromEntries([...TOPICS,"수신신호","발신적합","과거인연접점"].map(topic=>[topic,50])),
    evidence:[],
  }];
  calc.western.detail_days=[{date:"2026-09-03",market_open:true,topics:{직장:{best_window:{start:"08:00",end:"09:30",score:72},caution_window:{start:"16:00",end:"17:00",score:31},evidence:["Jupiter trine MC intraday test"]}}}];
  const packet=compactCalculation(calc);
  const today=packet.key_dates.find(x=>x.date==="2026-09-03");
  assert.ok(today,"selected day must survive key-date ranking even without a salience hit");
  assert.ok(today.western_refs.includes("W:window:2026-09-03:직장:best"));
  assert.ok(today.western_refs.includes("W:detail:2026-09-03:직장:1"));
  assert.equal(packet.period_kind,"day");
  assert.match(packet.integration_policy.important_date_rule,/오늘/);
  assert.match(packet.integration_policy.important_date_rule,/시간창/);
  assert.doesNotMatch(packet.integration_policy.important_date_rule,/365일/);
});

test("week and month packet policies do not inherit annual 365-day wording",()=>{
  for(const [days,expected] of [[7,/주간/],[30,/월간/]]){
    const calc=calculation();
    calc.period={start:"2026-09-01",end:days===7?"2026-09-07":"2026-09-30",day_count:days};
    const packet=compactCalculation(calc);
    assert.match(packet.integration_policy.important_date_rule,expected);
    assert.doesNotMatch(packet.integration_policy.important_date_rule,/365일/);
  }
});


test("salience contract prevents equal-length filler and caps core topics",()=>{
  const packet=compactCalculation(calculation());
  const bloated=output(packet);
  bloated.topic_analysis.금전.importance="참고";
  bloated.topic_analysis.금전.reason=repeat("참고 분야인데도 같은 설명을 길게 반복해서 분량만 늘리는 문장이야.",20);
  const bloatedReport=inspectInterpretationQuality(validateOutput(bloated),packet);
  assert.equal(bloatedReport.ok,false);
  assert.match(bloatedReport.stages[4].issues.join(" "),/참고 분야 과설명/);

  const crowded=output(packet);
  for(const topic of TOPICS.slice(0,6))crowded.topic_analysis[topic].importance="핵심";
  const crowdedReport=inspectInterpretationQuality(validateOutput(crowded),packet);
  assert.equal(crowdedReport.ok,false);
  assert.match(crowdedReport.stages[3].issues.join(" "),/핵심 분야가 너무 많음/);
});

test("salient reunion reading requires directional evidence and grounded timing",()=>{
  const packet=compactCalculation(calculation());
  const wrongRefs=output(packet);
  wrongRefs.relationship_reading.evidence_refs=[wrongRefs.topic_analysis.직장.evidence_refs[0],wrongRefs.topic_analysis.직장.evidence_refs[1]];
  const wrongRefReport=inspectInterpretationQuality(validateOutput(wrongRefs),packet);
  assert.equal(wrongRefReport.ok,false);
  assert.match(wrongRefReport.stages[3].issues.join(" "),/관계 방향축 근거 없음/);

  const fabricated=output(packet);
  fabricated.relationship_reading.focus_timing += " 2026-11-30도 같은 강도로 주목해.";
  const fabricatedReport=inspectInterpretationQuality(validateOutput(fabricated),packet);
  assert.equal(fabricatedReport.ok,false);
  assert.match(fabricatedReport.stages[1].issues.join(" "),/직접 날짜 근거 미연결/);
});


test("non-salient relationship and investment detail blocks may be omitted",()=>{
  const packet=compactCalculation(calculation());
  const lean=output(packet);
  for(const topic of ["연애","연락","재회","투자심리","수익실현","신규진입","투자주의"])lean.topic_analysis[topic].importance="참고";
  delete lean.relationship_reading;
  delete lean.contact_flow;
  delete lean.investment_reading;
  const validated=validateOutput(lean);
  assert.ok(validated,"optional detail blocks should not invalidate the structured response");
  const report=inspectInterpretationQuality(validated,packet);
  assert.equal(report.ok,true,JSON.stringify(report,null,2));
});


test("Gemini compact topic array schema normalizes back to the stable topic map",()=>{
  const packet=compactCalculation(calculation());
  const objectForm=output(packet);
  const arrayForm={...objectForm,topic_analysis:Object.entries(objectForm.topic_analysis).map(([topic,row])=>({topic,...row}))};
  const validated=validateOutput(arrayForm);
  assert.ok(validated);
  assert.deepEqual(Object.keys(validated.topic_analysis),TOPICS);
  assert.equal(SCHEMA.properties.topic_analysis.type,"ARRAY");
  assert.equal(SCHEMA.properties.topic_analysis.minItems,TOPICS.length);
  const duplicate={...arrayForm,topic_analysis:[...arrayForm.topic_analysis.slice(0,-1),arrayForm.topic_analysis[0]]};
  assert.equal(validateOutput(duplicate),null);
});
