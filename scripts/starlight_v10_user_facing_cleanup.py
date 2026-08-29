from pathlib import Path
p=Path('web/src/AppNext.tsx')
text=p.read_text(encoding='utf-8')

def rep(old,new,count=1,required=True):
    global text
    if old not in text:
        if required: raise SystemExit('missing marker: '+old[:140])
        return
    text=text.replace(old,new,count)

# Home tool click: marriage defaults to an annual horizon.
rep("onClick={()=>setSelectedTool(key)}", "onClick={()=>{setSelectedTool(key); if(key==='marriage') setPeriod('year')}}")

# Korean-first decorative labels / no raw developer strings in primary UI.
for old,new in [
    ('LIVE INTEGRATED ENGINE','통합 흐름 계산'),
    ('LIVE PRECISION ENGINE','정밀 계산'),
    ('LIVE CELESTIAL REPORT','천체 흐름 리포트'),
    ('CONTACT SIGNALS','연락 방향'),
    ('MARKET FLOW','투자 흐름'),
    ('CORE FLOW','핵심 흐름'),
    ('<span>TIMING</span>','<span>시기</span>'),
    ('<span>STATIC</span>','<span>기본 궁합</span>'),
]: text=text.replace(old,new)

text=text.replace("Thai(태국) 출생요일층", "Thai(태국점성술) 출생요일층")
text=text.replace("Thai는 현재 출생요일 baseline만 사용해.", "Thai(태국점성술)는 현재 출생요일 기준값만 사용해.")
text=text.replace("Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON까지 확인할 수 있어.", "Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON(제이슨·데이터 형식)까지 확인할 수 있어.")
text=text.replace("통합운세와 같은 `/v1/fortune/integrated` 실제 엔진을 재사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 응답을 정밀 화면에서 그대로 펼쳐 보여줘.", "통합운세와 같은 실계산 결과를 재사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 결과를 정밀 화면에서 펼쳐 보여줘.")
text=text.replace("원본 JSON 전체 펼치기", "원본 JSON(제이슨·데이터 형식) 전체 펼치기")

# Hide implementation-version strings from normal status rows.
text=text.replace("<span>{integratedResult.engine} · {integratedResult.period.day_count}일 · {integratedResult.period.month_segments}개 월 구간</span>", "<span>{integratedResult.period.day_count}일 분석 · {integratedResult.period.month_segments}개 월 구간</span>")
text=text.replace("<span>{integratedResult.engine} · {integratedResult.period.day_count}일 · 원자료 확장 보기</span>", "<span>{integratedResult.period.day_count}일 분석 · 원자료 확장 보기</span>")
text=text.replace("<span>{integratedResult.engine} · {integratedResult.period.day_count}일 분석</span>", "<span>{integratedResult.period.day_count}일 분석</span>")
text=text.replace("<span>{relationshipResult.engine} · {relationshipResult.period.month_segments}개 월 구간</span>", "<span>{relationshipResult.period.start} ~ {relationshipResult.period.end} · {periodRangeLabel(period)}</span>")

# AI labels / model name kept out of primary reading.
text=text.replace('<span className="eyebrow">AI INTERPRETATION</span>', '<span className="eyebrow">AI(인공지능) 해설</span>')
text=text.replace("<small>{result.model || 'Gemini'} · 계산 후 해설층</small>", "<small>실계산 결과를 바탕으로 한 자연어 해설</small>")
text=text.replace("<b>Western</b> {data.systems.western}", "<b>Western(서양점성술)</b> {data.systems.western}")
text=text.replace("<b>Thai</b> {data.systems.thai}", "<b>Thai(태국점성술)</b> {data.systems.thai}")

# Relationship calculation-range gets explicit day count everywhere.
text=text.replace("<div className=\"calculation-range\"><CalendarDays size={17}/><span>{queryDate} → {periodEnd(queryDate,period)} · {periods.find((item)=>item.key===period)?.label} 범위</span></div>", "<div className=\"calculation-range\"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>")

# Explain static vs timing for compatibility, and expose explicit timing choices for marriage too.
needle="""              <div className=\"relationship-range-block\">
                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong><span>{queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>
                <div className=\"relationship-range-buttons\">{periods.map((item)=><button key={item.key} type=\"button\" className={period===item.key?'is-active':''} onClick={()=>setPeriod(item.key)}>{item.key==='today'?'1일':item.key==='week'?'7일':item.key==='month'?'31일':'1년'}</button>)}</div>
              </div>"""
replacement="""              <div className=\"relationship-range-block\">
                <div><strong>{relationshipPurpose==='reunion'?'재회운 분석기간':'궁합 시기 분석기간'}</strong><span>{queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>
                <div className=\"relationship-range-buttons\">{periods.map((item)=><button key={item.key} type=\"button\" className={period===item.key?'is-active':''} onClick={()=>setPeriod(item.key)}>{item.key==='today'?'1일':item.key==='week'?'7일':item.key==='month'?'31일':'1년'}</button>)}</div>
                <small className=\"relationship-range-note\">{relationshipPurpose==='reunion'?'재회는 기본 1년으로 열리고, 수신·발신·재접점의 강한 날짜와 약한 날짜를 이 범위 안에서 비교해.':'기본 궁합 구조는 출생차트끼리 보는 고정 구조야. 여기서 고르는 기간은 관계의 시기 흐름에만 적용돼.'}</small>
              </div>"""
rep(needle,replacement)

marriage_intro="""            {selectedTool==='marriage'&&<div className=\"status-banner marriage-intro\"><Gem size={16}/><span>{marriageMode==='unmarried'?'결혼 여부 예언이 아니라, 이 관계가 결혼생활로 이어질 때의 생활궁합·책임·갈등·지속성을 깊게 봐.':'이미 결혼한 관계 기준으로 현재 결속·정서적 거리·역할분담·갈등과 회복 흐름을 봐.'}</span></div>}"""
marriage_new=marriage_intro+"""
            {selectedTool==='marriage'&&<div className=\"relationship-range-block marriage-range-block\"><div><strong>{marriageMode==='unmarried'?'미혼 결혼운 분석기간':'기혼 결혼운 분석기간'}</strong><span>{queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div><div className=\"relationship-range-buttons\">{periods.map((item)=><button key={item.key} type=\"button\" className={period===item.key?'is-active':''} onClick={()=>setPeriod(item.key)}>{item.key==='today'?'1일':item.key==='week'?'7일':item.key==='month'?'31일':'1년'}</button>)}</div><small className=\"relationship-range-note\">결혼운은 기본 1년으로 열고, 관계 구조 자체와 선택 기간의 긴장·완화 흐름을 분리해서 봐.</small></div>}"""
rep(marriage_intro,marriage_new)

# Remove the first duplicated giant no-birth-time timing card.
duplicate="""              {!relationshipResult.result.natal_synastry?.partner_time_exact && <section className=\"result-card timing-unavailable\"><div className=\"result-card-title\"><span>시기</span><strong>정밀 타이밍 계산 제외</strong></div><p>상대 출생시간·장소가 없어서 진행 시너스트리·진행 컴포지트·데이비슨·마크스 계열은 추정하지 않았어. 이전 화면의 0/0/0은 “아무 접점 없음”이 아니라 계산 불가를 잘못 표시한 거였어.</p></section>}
"""
text=text.replace(duplicate,'',1)

# Calculation evidence should be secondary / collapsed.
open_old="""              <section className=\"result-card\">
                <div className=\"result-card-title\"><span>기본 궁합</span><strong>기본 관계 구조 · 계산 근거</strong></div>"""
open_new="""              <details className=\"result-card relationship-evidence-details\">
                <summary>기본 관계 구조 · 계산 근거 펼치기</summary>
                <div className=\"relationship-evidence-body\">
                <div className=\"result-card-title\"><span>기본 궁합</span><strong>계산 근거</strong></div>"""
rep(open_old,open_new)
close_old="""                <div className=\"aspect-list\">{natalAspects.slice(0,8).map((aspect,index)=><div className=\"aspect-row\" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><span className={`tone-dot ${aspect.tone}`}/><div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone==='supportive'?'조화':aspect.tone==='challenging'?'긴장':'혼합'}</span></div></div>)}</div>
              </section>
              {!partnerTimeExact ?"""
close_new="""                <div className=\"aspect-list\">{natalAspects.slice(0,8).map((aspect,index)=><div className=\"aspect-row\" key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><span className={`tone-dot ${aspect.tone}`}/><div><strong>{aspectText(aspect)}</strong><span>오브 {aspect.orb.toFixed(2)}° · {aspect.tone==='supportive'?'조화':aspect.tone==='challenging'?'긴장':'혼합'}</span></div></div>)}</div>
                </div>
              </details>
              {!partnerTimeExact ?"""
rep(close_old,close_new)

# A single concise precision limitation, no raw English layer names.
text=text.replace("<div className=\"result-card-title\"><span>시기</span><strong>정밀 시기층 미계산</strong></div>", "<div className=\"result-card-title\"><span>정밀도</span><strong>출생시간 미상 · 일부 시기층 제외</strong></div>")
text=text.replace("진행 시너스트리·진행 합성·Davison(데이비슨)·Marks(마크스) 정밀 시기층", "진행 궁합차트·진행 합성차트·Davison(데이비슨)·Marks(마크스) 정밀 시기층")
text=text.replace("현재는 출생시간 없이도 계산 가능한 기본 시너스트리만 해석 근거로 사용해.", "현재는 출생시간 없이도 확정 가능한 행성 간 기본 궁합 접점만 해석 근거로 사용해.")

p.write_text(text,encoding='utf-8')

css=Path('web/src/visual-overhaul-v6.css')
c=css.read_text(encoding='utf-8')
c += '''\n\n/* v10 · user-facing cleanup */\n.relationship-range-note{display:block;margin-top:8px;font-size:.65rem;line-height:1.55;color:#817687}.marriage-range-block{margin-bottom:5px}.relationship-evidence-details>summary{cursor:pointer;list-style:none;font-family:\"AppleMyungjo\",\"Noto Serif KR\",serif;font-size:.86rem;font-weight:700;color:#594d61}.relationship-evidence-details>summary::-webkit-details-marker{display:none}.relationship-evidence-details>summary:before{content:\"＋\";display:inline-block;margin-right:7px;color:#8a739c}.relationship-evidence-details[open]>summary:before{content:\"－\"}.relationship-evidence-body{margin-top:13px;padding-top:12px;border-top:1px solid rgba(128,112,148,.1)}\n'''
css.write_text(c,encoding='utf-8')
print('v10 user-facing cleanup applied')
