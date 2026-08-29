from pathlib import Path

p=Path('web/src/AppNext.tsx')
text=p.read_text(encoding='utf-8')
old='<div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {relationshipEndDate} · {clampedRelationshipDays}일</span></div>'
new='<div className="calculation-range"><CalendarDays size={17}/><span>분석기간 {queryDate} ~ {periodEnd(queryDate,period)} · {periodRangeLabel(period)}</span></div>'
if old not in text: raise SystemExit('integrated range marker missing')
text=text.replace(old,new,1)
old="""  async function runLocationFit() {
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setLocationError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return }
    setLocationLoading(true); setLocationError(''); setLocationResult(null)"""
new="""  async function runLocationFit() {
    if (!birthProfile.birthDate || !birthProfile.birthTime) { setLocationError('먼저 내정보에서 생년월일과 출생시간을 저장해줘.'); return }
    if (parseOptionalNumber(birthProfile.latitude) === null || parseOptionalNumber(birthProfile.longitude) === null) { setLocationError('내정보에서 출생지역을 먼저 선택해줘.'); return }
    setLocationLoading(true); setLocationError(''); setLocationResult(null)"""
if old not in text: raise SystemExit('location validation marker missing')
text=text.replace(old,new,1)
p.write_text(text,encoding='utf-8')
print('v12b corrected')
