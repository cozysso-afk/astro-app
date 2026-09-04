from pathlib import Path

p=Path('web/src/AppNext.tsx')
s=p.read_text()

old="import { RelationshipInterpretationPanel } from './RelationshipInterpretationPanel'\n"
new=old+"import { PersonalMarriagePanel, type PersonalMarriageResponse } from './PersonalMarriagePanel'\n"
if old not in s: raise SystemExit('import anchor missing')
s=s.replace(old,new,1)

old="  const [marriageMode, setMarriageMode] = useState<MarriageMode>('unmarried')\n"
new=old+"  const [marriageScope, setMarriageScope] = useState<'personal'|'partner'>('personal')\n  const [personalMarriage, setPersonalMarriage] = useState<PersonalMarriageResponse | null>(null)\n  const [personalMarriageLoading, setPersonalMarriageLoading] = useState(false)\n  const [personalMarriageError, setPersonalMarriageError] = useState('')\n"
if old not in s: raise SystemExit('state anchor missing')
s=s.replace(old,new,1)

old="  const relationshipPeriodKey: PeriodKey = relationshipCalendarYear || clampedRelationshipDays >= 365 ? 'year' : clampedRelationshipDays >= 28 ? 'month' : 'week'\n"
new=old+"  const isPersonalMarriage = selectedTool === 'marriage' && marriageMode === 'unmarried' && marriageScope === 'personal'\n  const needsCounterpart = selectedTool === 'compatibility' || (selectedTool === 'marriage' && !isPersonalMarriage)\n"
if old not in s: raise SystemExit('derived anchor missing')
s=s.replace(old,new,1)

anchor="  const runRelationship = async () => {\n"
personal='''  const runPersonalMarriage = async () => {\n    setPersonalMarriageError(''); setPersonalMarriage(null); setRelationshipResult(null); setRelationshipAi(null); setReunionTiming(null)\n    if (!birthProfile.birthDate || !birthProfile.birthTime) { setPersonalMarriageError('먼저 내정보에서 본인 생년월일과 출생시간을 저장해줘.'); return }\n    const latitude = parseOptionalNumber(birthProfile.latitude)\n    const longitude = parseOptionalNumber(birthProfile.longitude)\n    if (latitude === null || longitude === null) { setPersonalMarriageError('먼저 내정보에서 본인 출생지역까지 저장해줘. 개인 결혼운의 4·5·7·8하우스 계산에는 위치 좌표가 필요해.'); return }\n    const body = {\n      profile: {\n        name: birthProfile.name || '나', birth_date: birthProfile.birthDate, birth_time: birthProfile.birthTime,\n        latitude, longitude, utc_offset_hours: Number(birthProfile.utcOffset || 9), gender: birthProfile.gender, place_key: birthProfile.placeKey,\n      },\n      start_date: relationshipStartDate, end_date: relationshipEndDate,\n    }\n    setPersonalMarriageLoading(true)\n    try {\n      const response = await fetch(`${API_BASE}/v1/marriage/personal`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })\n      const payload = await response.json().catch(()=>({}))\n      if (!response.ok || !payload?.ok) throw new Error(payload?.detail || payload?.error || '개인 결혼운 계산 요청에 실패했어.')\n      setPersonalMarriage(payload as PersonalMarriageResponse)\n    } catch (error) {\n      setPersonalMarriageError(error instanceof Error ? error.message : '개인 결혼운 계산 중 오류가 발생했어.')\n    } finally { setPersonalMarriageLoading(false) }\n  }\n\n\n'''
if anchor not in s: raise SystemExit('runRelationship anchor missing')
s=s.replace(anchor,personal+anchor,1)

old="    if (!counterpart.birthDate) { setRelationshipError('상대 생년월일은 반드시 필요해.'); return }\n"
new="    if (!needsCounterpart) { setRelationshipError('상대가 없는 미혼 결혼운은 개인 결혼운 계산 경로를 사용해.'); return }\n"+old
if old not in s: raise SystemExit('counterpart guard missing')
s=s.replace(old,new,1)

old="{selectedTool==='marriage' && <div className=\"relationship-purpose-row marriage-purpose-row\"><button type=\"button\" className={marriageMode==='unmarried'?'is-active':''} onClick={()=>{setMarriageMode('unmarried');setRelationshipAi(null)}}><strong>미혼</strong><span>결혼 전 · 장기 결속과 결혼생활 적합 구조</span></button><button type=\"button\" className={marriageMode==='married'?'is-active':''} onClick={()=>{setMarriageMode('married');setRelationshipAi(null)}}><strong>기혼</strong><span>결혼 후 · 현재 결속과 갈등·회복 주기</span></button></div>}"
new="{selectedTool==='marriage' && <div className=\"relationship-purpose-row marriage-purpose-row\"><button type=\"button\" className={marriageMode==='unmarried'?'is-active':''} onClick={()=>{setMarriageMode('unmarried');setRelationshipAi(null);setRelationshipResult(null);setPersonalMarriage(null)}}><strong>미혼</strong><span>상대 유무에 따라 개인 결혼운 또는 특정 상대 결혼궁합</span></button><button type=\"button\" className={marriageMode==='married'?'is-active':''} onClick={()=>{setMarriageMode('married');setMarriageScope('partner');setRelationshipAi(null);setRelationshipResult(null);setPersonalMarriage(null)}}><strong>기혼</strong><span>배우자와 현재 결속·생활·갈등·회복 주기</span></button></div>}"
if old not in s: raise SystemExit('marriage mode row missing')
s=s.replace(old,new,1)

old="{selectedTool==='marriage'&&<div className=\"status-banner marriage-intro\"><Gem size={16}/><span>{marriageMode==='unmarried'?'결혼 여부 예언이 아니라, 이 관계가 결혼생활로 이어질 때의 생활궁합·책임·갈등·지속성을 깊게 봐.':'이미 결혼한 관계 기준으로 현재 결속·정서적 거리·역할분담·갈등과 회복 흐름을 봐.'}</span></div>}"
new="{selectedTool==='marriage'&&marriageMode==='unmarried'&&<div className=\"relationship-purpose-row marriage-scope-row\"><button type=\"button\" className={marriageScope==='personal'?'is-active':''} onClick={()=>{setMarriageScope('personal');setRelationshipResult(null);setRelationshipAi(null);setPersonalMarriage(null);setRelationshipError('')}}><strong>상대 없음 · 개인 결혼운</strong><span>내 결혼생활 성향 · 동반자 구조 · 주목 시기</span></button><button type=\"button\" className={marriageScope==='partner'?'is-active':''} onClick={()=>{setMarriageScope('partner');setRelationshipResult(null);setRelationshipAi(null);setPersonalMarriage(null);setPersonalMarriageError('')}}><strong>특정 상대 있음 · 결혼궁합</strong><span>이 사람과의 생활궁합 · 결속 · 갈등 · 친밀감</span></button></div>}\n            {selectedTool==='marriage'&&<div className=\"status-banner marriage-intro\"><Gem size={16}/><span>{marriageMode==='married'?'이미 결혼한 관계 기준으로 현재 결속·정서적 거리·역할분담·공유자원·갈등과 회복 흐름을 봐.':marriageScope==='personal'?'특정 상대를 가정하지 않고 내 출생차트의 동반자·가정·친밀감·책임 구조와 선택 기간의 상대활성도를 봐. 결혼 성사 확률이나 미래 배우자 신원은 예언하지 않아.':'결혼 여부 예언이 아니라, 이 특정 상대와 결혼생활로 들어갈 때의 결속·생활·친밀감·돈/공유자원·갈등·지속성을 깊게 봐.'}</span></div>}"
if old not in s: raise SystemExit('marriage intro missing')
s=s.replace(old,new,1)

start='            <div className="subsection-title">상대 출생정보</div>\n'
end='            <div className="calculation-range"><CalendarDays size={17}/><span>관계 분석기간 {relationshipStartDate} ~ {relationshipEndDate} · {relationshipDayCount}일</span></div>\n'
si=s.find(start)
ei=s.find(end,si)
if si<0 or ei<0: raise SystemExit('counterpart block bounds missing')
block=s[si:ei]
s=s[:si]+'            {needsCounterpart&&<>\n'+block+'            </>}\n'+s[ei:]

old=end
new='            <div className="calculation-range"><CalendarDays size={17}/><span>{isPersonalMarriage?\'개인 결혼운\':\'관계\'} 분석기간 {relationshipStartDate} ~ {relationshipEndDate} · {relationshipDayCount}일</span></div>\n'
if old not in s: raise SystemExit('range label missing')
s=s.replace(old,new,1)

old='            {relationshipError && <div className="status-banner error"><AlertTriangle size={17}/><span>{relationshipError}</span></div>}\n            <button className="primary-button" type="button" onClick={runRelationship} disabled={relationshipLoading||reunionTimingLoading||apiStatus===\'offline\'}>{(relationshipLoading||reunionTimingLoading)?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{(relationshipLoading||reunionTimingLoading)?(selectedTool===\'marriage\'?\'결혼운 계산 중…\':relationshipPurpose===\'reunion\'?\'재회운 계산 중…\':\'궁합 계산 중…\'):(selectedTool===\'marriage\'?(marriageMode===\'unmarried\'?\'미혼 결혼운 정밀 계산\':\'기혼 결혼운 정밀 계산\'):relationshipPurpose===\'reunion\'?\'재회운 정밀 계산\':\'궁합 정밀 계산\')}</span></button>\n\n            {relationshipResult && <div className="results-wrap">\n'
new='            {(isPersonalMarriage?personalMarriageError:relationshipError) && <div className="status-banner error"><AlertTriangle size={17}/><span>{isPersonalMarriage?personalMarriageError:relationshipError}</span></div>}\n            <button className="primary-button" type="button" onClick={isPersonalMarriage?runPersonalMarriage:runRelationship} disabled={personalMarriageLoading||relationshipLoading||reunionTimingLoading||apiStatus===\'offline\'}>{(personalMarriageLoading||relationshipLoading||reunionTimingLoading)?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}<span>{personalMarriageLoading?\'개인 결혼운 계산 중…\':(relationshipLoading||reunionTimingLoading)?(selectedTool===\'marriage\'?\'결혼운 계산 중…\':relationshipPurpose===\'reunion\'?\'재회운 계산 중…\':\'궁합 계산 중…\'):isPersonalMarriage?\'상대 없이 개인 결혼운 계산\':selectedTool===\'marriage\'?(marriageMode===\'unmarried\'?\'특정 상대와 결혼궁합 정밀 계산\':\'기혼 결혼운 정밀 계산\'):relationshipPurpose===\'reunion\'?\'재회운 정밀 계산\':\'궁합 정밀 계산\'}</span></button>\n\n            {isPersonalMarriage&&personalMarriage&&<div className="results-wrap"><div className="result-headline"><CheckCircle2 size={20}/><div><strong>개인 결혼운 계산 완료</strong><span>{personalMarriage.period.start} ~ {personalMarriage.period.end} · {personalMarriage.period.day_count}일</span></div></div><PersonalMarriagePanel data={personalMarriage}/></div>}\n\n            {!isPersonalMarriage&&relationshipResult && <div className="results-wrap">\n'
if old not in s: raise SystemExit('calculate/results block missing')
s=s.replace(old,new,1)

p.write_text(s)
