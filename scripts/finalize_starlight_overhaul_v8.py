from pathlib import Path
import re

# 1) Engine: separate market derivatives so they do not collapse onto one curve.
p = Path('integrated_fortune_v1.py')
s = p.read_text(encoding='utf-8')
old = '''    overheat = max(0.0, float(invest.get("activation", 0.0)) - float(invest.get("favorability", 50.0)))
    realize = _clamp(.40 * float(money.get("activation", 0.0)) + .40 * float(money.get("favorability", 50.0)) + .20 * (100.0 - .70 * overheat))
    entry = _clamp(.25 * float(money.get("activation", 0.0)) + .35 * float(money.get("favorability", 50.0)) + .15 * float(invest.get("activation", 0.0)) + .25 * float(invest.get("favorability", 50.0)) - .25 * overheat)
    risk = _clamp(.55 * float(invest.get("activation", 0.0)) + .45 * (100.0 - float(invest.get("favorability", 50.0))) + .15 * overheat)
'''
new = '''    money_activation = float(money.get("activation", 0.0))
    money_favor = float(money.get("favorability", 50.0))
    invest_activation = float(invest.get("activation", 0.0))
    invest_favor = float(invest.get("favorability", 50.0))
    # A high activation with weak favorability is treated as heat/volatility, not opportunity.
    overheat = max(0.0, invest_activation - invest_favor)
    calm_bias = max(0.0, invest_favor - invest_activation)
    # Realization prefers already-developed money flow and clarity; it does not reward raw heat.
    realize = _clamp(
        .18 * money_activation + .48 * money_favor + .14 * invest_activation + .20 * invest_favor
        - .32 * overheat + .08 * calm_bias
    )
    # New entry needs cleaner investment favorability and is penalized most strongly by overheat.
    entry = _clamp(
        .12 * money_activation + .22 * money_favor + .18 * invest_activation + .48 * invest_favor
        - .48 * overheat + .05 * calm_bias
    )
    # Caution is intentionally a danger index: higher means more restraint is warranted.
    risk = _clamp(
        .30 * invest_activation + .38 * (100.0 - invest_favor)
        + .20 * (100.0 - money_favor) + .42 * overheat
    )
'''
if old not in s:
    raise SystemExit('market formula anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 2) UI: remove generic contact from Core Flow; show directional contact and differentiated investment.
p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')
s = s.replace("const coreTopicOrder = ['금전','학업','시험','직장','이직','연애','연락','재회','소식','컨디션']", "const coreTopicOrder = ['금전','학업','시험','직장','이직','연애','재회','소식','컨디션']", 1)

# Extend AI response shape without breaking old cached readings.
needle = '''    clusters: { relationship: string; work_study: string; money_news: string; investment?: string; condition: string }
    systems: { western: string; saju: string; thai: string }
'''
repl = '''    clusters: { relationship: string; work_study: string; money_news: string; investment?: string; condition: string }
    contact_flow?: { incoming?: string; outgoing?: string; reconnection?: string }
    investment_reading?: { psychology?: string; realization?: string; entry?: string; risk?: string }
    systems: { western: string; saju: string; thai: string }
'''
if needle not in s:
    raise SystemExit('AI response type anchor not found')
s = s.replace(needle, repl, 1)

# Add evidence-first dedicated panels after the generic cluster grid.
needle = '''    </div>
    {!!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}
'''
repl = '''    </div>
    {data.contact_flow && (data.contact_flow.incoming || data.contact_flow.outgoing || data.contact_flow.reconnection) && <div className="ai-direction-grid"><article><strong>수신 · 상대 → 나</strong><p>{data.contact_flow.incoming || '뚜렷한 수신 근거가 없어.'}</p></article><article><strong>발신 · 나 → 상대</strong><p>{data.contact_flow.outgoing || '뚜렷한 발신 적합 근거가 없어.'}</p></article><article><strong>과거 인연 · 재접점</strong><p>{data.contact_flow.reconnection || '재접점 근거가 약해.'}</p></article></div>}
    {data.investment_reading && (data.investment_reading.psychology || data.investment_reading.realization || data.investment_reading.entry || data.investment_reading.risk) && <div className="ai-investment-grid"><article><strong>투자심리</strong><p>{data.investment_reading.psychology}</p></article><article><strong>수익실현</strong><p>{data.investment_reading.realization}</p></article><article><strong>신규진입</strong><p>{data.investment_reading.entry}</p></article><article className="is-risk"><strong>투자주의 · 높을수록 경계</strong><p>{data.investment_reading.risk}</p></article></div>}
    {!!data.priorities?.length && <div className="ai-priorities"><strong>이 기간 우선순위</strong>{data.priorities.map((item, index)=><p key={`${index}-${item}`}>{index+1}. {item}</p>)}</div>}
'''
if needle not in s:
    raise SystemExit('AI cluster render anchor not found')
s = s.replace(needle, repl, 1)

# Contact labels and all four market axes.
s = s.replace("topic === '수신신호' ? '수신 보조신호' : topic === '발신적합' ? '발신 적합도' : '과거인연 접점'", "topic === '수신신호' ? '수신 · 상대 → 나' : topic === '발신적합' ? '발신 · 나 → 상대' : '과거 인연 · 재접점'", 1)
s = s.replace("사건 확률이나 특정 상대의 행동 예측이 아니라 연락축 내부의 상대 활성도야.", "수신은 들어오는 흐름, 발신은 내가 먼저 움직일 때의 적합도, 재접점은 과거 인연 활성도를 따로 본 값이야. 셋 다 사건 확률은 아니야.", 1)
s = s.replace("{['수익실현','신규진입','투자주의'].map((topic)=>", "{['투자심리','수익실현','신규진입','투자주의'].map((topic)=>", 1)
s = s.replace("거래일만 집계한 점성술 상대지수야. 실제 가격·수급·거래량·손절 기준이 우선이야.", "투자심리=판단의 열기, 수익실현=정리 적합도, 신규진입=새 포지션 적합도, 투자주의=위험 경계지수야. 투자주의만 높을수록 좋은 게 아니라 더 조심해야 한다는 뜻이야.", 1)
p.write_text(s, encoding='utf-8')

# 3) AI background interpreter: directional contact + differentiated investment + no raw flags.
p = Path('supabase/functions/fortune-interpret/index.ts')
s = p.read_text(encoding='utf-8')
s = s.replace('const INTERPRETER_VERSION = "supabase-ai-v2-background-jobs";', 'const INTERPRETER_VERSION = "supabase-ai-v3-evidence-first";', 1)
s = s.replace('const TOPICS = ["금전", "학업", "시험", "직장", "이직", "연애", "연락", "재회", "소식", "컨디션", "투자심리", "수익실현", "신규진입", "투자주의"];', 'const TOPICS = ["금전", "학업", "시험", "직장", "이직", "연애", "재회", "소식", "컨디션", "투자심리", "수익실현", "신규진입", "투자주의"];', 1)

old_prompt_line = '직장과 이직, 학업과 시험, 연락과 소식, 금전과 수익실현을 반드시 구분한다.\n투자심리·수익실현·신규진입·투자주의는 market.has_open_session=true인 경우에만 거래일 지표로 해석한다.\n단순 점수 낭독을 금지한다. 각 분야마다 결론, 근거, 시기, 행동, 주의를 구체적으로 쓴다.'
new_prompt_line = '''직장과 이직, 학업과 시험, 금전과 소식을 반드시 구분한다.
연락은 generic '연락운' 하나로 쓰지 마라. relationship_signals의 수신신호(상대→나), 발신적합(나→상대), 과거인연접점(재활성)을 세 방향으로 반드시 분리한다. 세 값은 실제 연락 확률이 아니다.
투자심리·수익실현·신규진입·투자주의는 역할이 다르다. 투자심리는 판단의 열기/과열, 수익실현은 기존 포지션 정리 적합도, 신규진입은 새 진입 적합도, 투자주의는 높을수록 위험 경계가 큰 지수로 해석한다. 네 문단을 같은 말로 반복하지 마라.
market_open, has_open_session, true/false, JSON 키 이름 같은 내부 구현값을 사용자 문장에 절대 노출하지 마라. 필요하면 'KRX 거래일', '휴장일', '거래일 포함 여부'처럼 자연어로 번역한다.
단순 점수 낭독을 금지한다. 각 분야는 계산 근거와 실제 체감 의미를 연결하되 뻔한 조언을 반복하지 마라.'''
if old_prompt_line not in s:
    raise SystemExit('fortune prompt anchor not found')
s = s.replace(old_prompt_line, new_prompt_line, 1)

# Add dedicated shape fields.
needle = '''  clusters: {
    relationship: "연애·연락·재회 교차 해석",
    work_study: "학업·시험·직장·이직 교차 해석",
    money_news: "금전·소식 교차 해석",
    investment: "투자심리·수익실현·신규진입·투자주의 구분 해석",
    condition: "컨디션과 일정 배치 해석",
  },
  systems: {
'''
repl = '''  clusters: {
    relationship: "연애·재회 전체 맥락. 연락 방향은 contact_flow에서 따로 쓸 것",
    work_study: "학업·시험·직장·이직 교차 해석",
    money_news: "금전·소식 교차 해석",
    investment: "주식 4축 전체 비교 요약. 각 축 상세는 investment_reading에서 분리",
    condition: "컨디션과 일정 배치 해석",
  },
  contact_flow: {
    incoming: "수신신호 근거, 강한 날짜/시간, 약한 구간. 상대가 실제 연락한다고 단정 금지",
    outgoing: "발신적합 근거, 내가 먼저 움직이기 상대적으로 좋은/나쁜 시기",
    reconnection: "과거인연접점의 강약과 시기. 재회 확률로 표현 금지",
  },
  investment_reading: {
    psychology: "투자심리: 판단 열기·과열·흔들림",
    realization: "수익실현: 보유분 정리/실현 적합도",
    entry: "신규진입: 새 포지션 진입 적합도",
    risk: "투자주의: 높을수록 경계가 큰 위험 지수",
  },
  systems: {
'''
if needle not in s:
    raise SystemExit('output shape anchor not found')
s = s.replace(needle, repl, 1)

# Validation includes the new fields and tighter prose limits.
needle = '''    clusters: {
      relationship: cleanText(clusters.relationship, 2200),
      work_study: cleanText(clusters.work_study, 2200),
      money_news: cleanText(clusters.money_news, 2200),
      investment: cleanText(clusters.investment, 2400),
      condition: cleanText(clusters.condition, 1800),
    },
    systems: {
'''
repl = '''    clusters: {
      relationship: cleanText(clusters.relationship, 1500),
      work_study: cleanText(clusters.work_study, 1600),
      money_news: cleanText(clusters.money_news, 1400),
      investment: cleanText(clusters.investment, 1600),
      condition: cleanText(clusters.condition, 1200),
    },
    contact_flow: {
      incoming: cleanText(obj?.contact_flow?.incoming, 1500),
      outgoing: cleanText(obj?.contact_flow?.outgoing, 1500),
      reconnection: cleanText(obj?.contact_flow?.reconnection, 1500),
    },
    investment_reading: {
      psychology: cleanText(obj?.investment_reading?.psychology, 1400),
      realization: cleanText(obj?.investment_reading?.realization, 1400),
      entry: cleanText(obj?.investment_reading?.entry, 1400),
      risk: cleanText(obj?.investment_reading?.risk, 1400),
    },
    systems: {
'''
if needle not in s:
    raise SystemExit('validation anchor not found')
s = s.replace(needle, repl, 1)

s = s.replace('summary: cleanText(overall.summary, 3200)', 'summary: cleanText(overall.summary, 2200)', 1)
s = s.replace('dominant_pattern: cleanText(overall.dominant_pattern, 1800)', 'dominant_pattern: cleanText(overall.dominant_pattern, 1200)', 1)
s = s.replace('maxOutputTokens: 10000', 'maxOutputTokens: 8200', 1)
p.write_text(s, encoding='utf-8')

# 4) CSS: tighter result rhythm and special directional/investment panels.
p = Path('web/src/visual-overhaul-v6.css')
s = p.read_text(encoding='utf-8')
marker = '/* v8 · final hierarchy and directional readings */'
if marker not in s:
    s += r'''

/* v8 · final hierarchy and directional readings */
.ai-direction-grid,.ai-investment-grid{display:grid;grid-template-columns:1fr;gap:9px;margin-top:12px}
.ai-direction-grid article,.ai-investment-grid article{padding:14px 15px;border-radius:18px;border:1px solid rgba(134,117,155,.10);background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(246,243,252,.72))}
.ai-direction-grid strong,.ai-investment-grid strong{display:block;font-family:var(--v6-serif);font-size:.96rem;color:#4d4254;margin-bottom:6px}
.ai-direction-grid p,.ai-investment-grid p{margin:0;font-size:.88rem;line-height:1.72;color:#625a67}
.ai-direction-grid article:nth-child(1){background:linear-gradient(145deg,rgba(244,249,255,.88),rgba(249,246,255,.78))}
.ai-direction-grid article:nth-child(2){background:linear-gradient(145deg,rgba(250,246,255,.88),rgba(255,249,250,.78))}
.ai-investment-grid .is-risk{border-style:dashed;background:linear-gradient(145deg,rgba(255,248,244,.9),rgba(252,245,249,.78))}
.signal-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.signal-topic{min-height:72px!important;padding:10px 7px!important}.signal-topic>span{font-size:.62rem!important;line-height:1.35!important}.signal-topic>strong{font-size:1.22rem!important}
.market-flow-card .integrated-topic-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.market-flow-card .integrated-topic{min-height:74px!important}
@media(max-width:430px){.ai-direction-grid article,.ai-investment-grid article{padding:13px 14px}.ai-direction-grid p,.ai-investment-grid p{font-size:.86rem}.signal-grid{gap:6px!important}.signal-topic{min-height:68px!important}.signal-topic>span{font-size:.59rem!important}}
'''
p.write_text(s, encoding='utf-8')

print('v8 patch applied')
