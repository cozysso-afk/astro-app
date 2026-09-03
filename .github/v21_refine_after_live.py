from pathlib import Path

cost = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.ts')
index = Path('supabase/functions/fortune-interpret-v21-preview/index.ts')
test = Path('supabase/functions/fortune-interpret-v21-preview/costGuardV21.test.mjs')

s = cost.read_text()

old = 'function periodLimit(kind:string){ return kind==="annual"?8:kind==="month"?6:kind==="week"?5:2; }\n'
new = old + '''\nfunction topicSubject(topic:string){\n  const last=topic.charCodeAt(Math.max(0,topic.length-1));\n  const hasBatchim=last>=0xAC00&&last<=0xD7A3&&((last-0xAC00)%28)!==0;\n  return `${topic}${hasBatchim?"은":"는"}`;\n}\n\nfunction softenClaimText(value:string){\n  return value\n    .replace(/연중 가장 완벽한 합일/g,"연중에서도 독립 근거가 비교적 뚜렷하게 겹치는 구간")\n    .replace(/가장 완벽한 시기/g,"특히 주목할 시기")\n    .replace(/완벽 해설/g,"핵심 해설")\n    .replace(/완벽한 합일/g,"독립 근거의 시기적 겹침")\n    .replace(/완벽한 시기/g,"주목할 시기")\n    .replace(/대길의 시기/g,"상대활성도가 높은 시기")\n    .replace(/대길/g,"강한 상대활성도")\n    .replace(/매우 긍정적인 시너지를 발휘하는 시기/g,"우호적 맥락이 같은 시기에 나타나는 구간")\n    .replace(/삼박자로 맞아떨어져/g,"각 체계의 맥락이 같은 시기에 겹쳐")\n    .replace(/시너지/g,"시기적 겹침")\n    .replace(/절대 보수적 태도를 유지해야 한다/g,"보수적으로 접근하고 실제 시장 데이터를 우선해야 해")\n    .replace(/절대 금물이다/g,"피하는 편이 안전해")\n    .replace(/절대 금물/g,"피하는 편이 안전해")\n    .replace(/관계 확정/g,"관계 재정립 여부 확인")\n    .replace(/재회 최적기/g,"재회 주목기")\n    .replace(/이뤄질 가능성이 높다/g,"재접점 신호가 상대적으로 강하게 나타난다");\n}\n\nfunction softenObject<T>(value:T):T{\n  if(typeof value==="string")return softenClaimText(value) as T;\n  if(Array.isArray(value))return value.map(v=>softenObject(v)) as T;\n  if(value&&typeof value==="object"){for(const [k,v] of Object.entries(value as any))(value as any)[k]=softenObject(v);}\n  return value;\n}\n'''
assert old in s and 'function topicSubject' not in s
s = s.replace(old, new, 1)

old = '''function bestTopicDate(payload:any,topic:string){\n  const stat=payload?.western?.overall?.[topic]??{};\n  const candidates=[...(stat?.best_days??[]),...(stat?.caution_days??[])].filter((x:any)=>x?.date);\n  const key=(payload?.key_dates??[]).find((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic));\n  if(key?.date)return String(key.date);\n  return candidates[0]?.date?String(candidates[0].date):String(payload?.period?.start??"");\n}\n'''
new = '''function bestTopicDate(payload:any,topic:string){\n  const stat=payload?.western?.overall?.[topic]??{},avg=num(stat?.average);\n  const candidates=[...(stat?.best_days??[]),...(stat?.caution_days??[])].filter((x:any)=>x?.date&&Number.isFinite(Number(x?.score)));\n  candidates.sort((a:any,b:any)=>Math.abs(num(b?.score)-avg)-Math.abs(num(a?.score)-avg));\n  if(candidates[0]?.date)return String(candidates[0].date);\n  const key=(payload?.key_dates??[]).find((row:any)=>Array.isArray(row?.topics)&&row.topics.includes(topic));\n  return key?.date?String(key.date):String(payload?.period?.start??"");\n}\n'''
assert old in s
s = s.replace(old, new, 1)

old = '      verdict:`${topic}은 이번 기간에서 ${direction}으로 읽혀.`,\n'
new = '      verdict:`${topicSubject(topic)} 이번 기간에서 ${direction}으로 읽혀.`,\n'
assert old in s
s = s.replace(old, new, 1)

old = 'const others=[out.saju,out.thai].filter(Boolean).join(" ");out.synthesis=ensureMinText(out?.synthesis,45,others?`Western의 직접 시기 근거와 비Western의 독립 맥락을 나란히 비교해. ${others} 서로 점수를 합산하지 말고 실제 변화가 겹치는지만 확인해.`:"다른 체계의 독립 근거가 충분하지 않아 Western 직접 계산을 중심으로 보고, 실제 변화가 나타나는지 확인해.");return out;};'
new = 'const others=[out.saju,out.thai].filter(Boolean).join(" ");const otherNames=[out.saju?"사주":"",out.thai?"Thai":""].filter(Boolean).join("·");out.synthesis=out.mode==="Western단독"?"다른 체계의 독립 근거가 충분하지 않아 Western 직접 계산을 중심으로 보고, 실제 변화가 나타나는지 확인해.":out.mode==="상반맥락"?`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 서로 다르게 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 관찰에서 어느 맥락이 더 두드러지는지만 확인해.`:`Western 직접 시기 근거와 ${otherNames||"비Western"}의 독립 맥락이 같은 기간에 함께 나타나는지 비교해. 서로 점수나 인과를 합산하지 말고 실제 변화가 각 체계의 맥락과 동시에 관찰되는지만 확인해.`;return out;};'
assert old in s
s = s.replace(old, new, 1)

old = '  if(investmentSalient){data.investment_reading=data?.investment_reading&&typeof data.investment_reading==="object"?data.investment_reading:{};const ir=data.investment_reading,overall=payload?.western?.overall??{};const fill=(field:string,topic:string)=>{ir[field]=ensureMinText(ir?.[field],20,`${topic} 상대활성도 평균 ${scoreText(overall?.[topic]?.average)}점이야. 실제 시장 데이터와 본인 위험 한도를 함께 확인해.`);};fill("psychology","투자심리");fill("realization","수익실현");fill("entry","신규진입");fill("risk","투자주의");}\n  return data;\n}'
new = '''  if(investmentSalient){\n    data.investment_reading=data?.investment_reading&&typeof data.investment_reading==="object"?data.investment_reading:{};\n    const ir=data.investment_reading,overall=payload?.western?.overall??{};\n    ir.psychology=`투자심리 상대활성도 평균 ${scoreText(overall?.투자심리?.average)}점이야. 심리적 과열·위축을 점검하는 보조지표이며 시장 가격 방향 예측은 아니야.`;\n    ir.realization=`수익실현 상대활성도 평균 ${scoreText(overall?.수익실현?.average)}점이야. 실제 수익 가능성이나 매도 적기를 뜻하지 않으므로 보유 종목의 시장 데이터와 손익 기준을 우선해.`;\n    ir.entry=`신규진입 상대활성도 평균 ${scoreText(overall?.신규진입?.average)}점이야. 매수 신호가 아니며 실제 밸류에이션·가격·거래량과 본인 위험 한도를 먼저 확인해.`;\n    ir.risk=`투자주의 상대활성도 평균 ${scoreText(overall?.투자주의?.average)}점이야. 높을수록 판단 오류와 변동성 대응을 더 보수적으로 점검하되 실제 투자 결정은 시장 데이터가 우선이야.`;\n  }\n  return softenObject(data);\n}'''
assert old in s
s = s.replace(old, new, 1)

old = '- 사주·Thai는 Western 점수에 합산하지 말고 독립 맥락으로 비교해.\\n- 중요하지 않은 분야를 억지로 길게 쓰지 마.\\n\\nCALCULATED_DATA='
new = '- 사주·Thai는 Western 점수에 합산하지 말고 독립 맥락으로 비교해. 체계가 겹쳐도 시너지·합일·확정 표현을 쓰지 마.\\n- 대길·완벽·무조건 같은 과장 표현을 쓰지 마.\\n- 투자 관련 지수는 가격방향·수익률·매수매도 적기 예측으로 바꾸지 마.\\n- 중요하지 않은 분야를 억지로 길게 쓰지 마.\\n\\nCALCULATED_DATA='
assert old in s
s = s.replace(old, new, 1)

cost.write_text(s)

s = index.read_text()
s = s.replace('const VERSION="supabase-ai-v21.1-single-core-local-stabilizer";', 'const VERSION="supabase-ai-v21.2-single-core-safe-wording";', 1)
old = '- 사주와 Thai는 Western 점수에 합산하지 않고 독립 맥락으로만 비교한다.\n- 관계가 중요할 때만 상대→나·나→상대·과거인연 재접점의 순서와 현실 확인 신호를 종합한다.\n'
new = '- 사주와 Thai는 Western 점수에 합산하지 않고 독립 맥락으로만 비교한다. 겹친다고 시너지·합일·확정으로 표현하지 않는다.\n- 대길·완벽·무조건 같은 과장 표현을 쓰지 않는다.\n- 투자 관련 상대지수는 시장 가격방향·수익률·매수매도 적기 예측으로 바꾸지 않는다.\n- 관계가 중요할 때만 상대→나·나→상대·과거인연 재접점의 순서와 현실 확인 신호를 종합한다.\n'
assert old in s
s = s.replace(old, new, 1)
old = 'if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,...(preferred===secondModel?{}:{fallback_from:preferred})};'
new = 'if(second?.ok)return {...second,usage:{...combined,quality_validation:qualitySummary(second.validation)},attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,...(preferred===secondModel?{}:{fallback_from:preferred})};'
assert old in s
s = s.replace(old, new, 1)
old = 'return {ok:false,error:`AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}`,model:preferred,usage:combined,attempt_count:budget.used,call_trace:budget.calls,quality_report:second?.quality_report??first?.quality_report};'
new = 'return {ok:false,error:`AI 해설이 검증을 완료하지 못했어. 1차=${first.error}; 2차=${second?.error??"중단"}`,model:preferred,usage:combined,attempt_count:budget.used,call_trace:budget.calls,first_quality_report:first?.quality_report??null,quality_report:second?.quality_report??first?.quality_report};'
assert old in s
s = s.replace(old, new, 1)
old = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub)};'
new = 'cost_guard_version:VERSION,local_thai_scrub:Boolean(r.local_thai_scrub),first_quality_report:r.first_quality_report??null};'
assert old in s
s = s.replace(old, new, 1)
old = 'prompt_copy:true,thai_contract:THAI_CONTRACT_VERSION});'
new = 'prompt_copy:true,safe_wording:true,thai_contract:THAI_CONTRACT_VERSION});'
assert old in s
s = s.replace(old, new, 1)
index.write_text(s)

s = test.read_text()
insert = r'''

test('V21.2 deterministic wording uses correct Korean particles and topic-specific extreme dates',()=>{
  const rows=buildDeterministicTopicAnalysis(packet());
  assert.match(rows.find(x=>x.topic==='연애').verdict,/^연애는 /);
  assert.match(rows.find(x=>x.topic==='직장').verdict,/^직장은 /);
  assert.equal(rows.find(x=>x.topic==='연애').timing,'2027-04-11');
});

test('V21.2 local stabilizer softens overclaim and investment prediction language without Gemini',()=>{
  const p=packet();
  const core={headline:'2027년 완벽 해설',overall:{summary:'짧은 총평',dominant_pattern:'패턴',best_phase:'활용',caution_phase:'주의',evidence_refs:['W:overall:직장']},key_windows:[{label:'재회 최적기',start:'2027-04-11',end:'2027-04-11',signal:'활용',topics:['연애'],summary:'대길의 시기이자 가장 완벽한 시기',action:'확인',avoid:'절대 금물이다',evidence_refs:['W:date:2027-04-11:연애:best']}],year_phases:[],cross_checks:[{label:'교차',start:'2027-04-11',end:'2027-04-11',mode:'복수체계',western:'Western 직접 근거가 존재한다.',saju:'사주 독립 맥락이 존재한다.',thai:'Thai 독립 맥락이 존재한다.',synthesis:'삼박자로 맞아떨어져 매우 긍정적인 시너지를 발휘하는 완벽한 합일',evidence_refs:['W:date:2027-04-11:직장:best','S:annual:1:2027-01-01','T:taksajorn:1:2027-01-01']}],decisions:[],clusters:{relationship:'',work_study:'',money_news:'',investment:'',condition:''},relationship_reading:{context:'관계 맥락을 충분히 설명하는 테스트 문장이다.',flow:'관계 흐름을 충분히 설명하고 실제 행동 신호를 확인하는 테스트 문장이다.',focus_timing:'2027-04-11 직접 관계 근거를 본다.',watch:'실제 연락과 약속 제안을 확인한다.',avoid:'속마음이나 관계 결과를 미리 확정하지 않는다.',evidence_refs:['W:date:2027-04-11:연애:best']},contact_flow:{incoming:'상대 반응을 확인한다.',outgoing:'내 행동을 확인한다.',reconnection:'이뤄질 가능성이 높다.'},investment_reading:{psychology:'과열',realization:'수익에 유리',entry:'매수 적기',risk:'절대 보수적 태도를 유지해야 한다'},systems:{western:'w',saju:'s',thai:'t'},priorities:[],limits:'점수는 확률이 아니다'};
  const fixed=stabilizeCoreForQuality(core,p);
  const prose=JSON.stringify(fixed);
  assert.doesNotMatch(prose,/완벽|대길|시너지|삼박자|절대 금물|이뤄질 가능성이 높다/);
  assert.match(fixed.cross_checks[0].synthesis,/합산하지/);
  assert.match(fixed.investment_reading.realization,/실제 수익 가능성이나 매도 적기를 뜻하지/);
  assert.match(fixed.investment_reading.entry,/매수 신호가 아니며/);
});
'''
anchor = "test('V21 local stabilizer repairs evidence links and minimum prose without Gemini',()=>{"
assert anchor in s and "V21.2 deterministic wording" not in s
s = s.replace(anchor, insert + '\n' + anchor, 1)
test.write_text(s)
