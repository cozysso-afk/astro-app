from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / 'web/src/AppNext.tsx'
app = app_path.read_text(encoding='utf-8')

# 1) Annual integrated fortune must always archive as a calendar-year reading.
old = """    const integratedArchivePeriod: PeriodKey = integratedCalendarYear ? 'year' : period
    const label = integratedCalendarYear ? `${integratedCalendarYear}년` : (periods.find((item) => item.key === period)?.label ?? period)
"""
new = """    const integratedArchivePeriod: PeriodKey = 'year'
    const integratedArchiveYear = Number(integratedResult.period.start.slice(0,4)) || annualFortuneYear
    const label = `${integratedArchiveYear}년`
"""
if old not in app:
    raise SystemExit('integrated archive period marker not found')
app = app.replace(old, new, 1)

# 2) Keep precision conceptually tied to the selected period engine, not the annual integrated product.
old = "새 점수를 만들지 않고 운영 중인 통합 실계산의 원자료를 더 깊게 펼쳐봐. Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON(제이슨·데이터 형식)까지 확인할 수 있어."
new = "새 점수를 만들지 않고 선택한 기간 운세 실계산의 원자료를 더 깊게 펼쳐봐. Western(서양점성술) 세부 지표, 사주 원자료, Thai(태국점성술) 상태와 원본 JSON(제이슨·데이터 형식)까지 확인할 수 있어."
if old not in app:
    raise SystemExit('precision heading copy marker not found')
app = app.replace(old, new, 1)

old = "통합운세와 같은 실계산 결과를 재사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 결과를 정밀 화면에서 펼쳐 보여줘."
new = "기간 운세와 같은 실계산 엔진을 사용해. 같은 날짜·기간 계산이 이미 있으면 다시 호출하지 않고 동일 결과를 정밀 화면에서 펼쳐 보여줘."
if old not in app:
    raise SystemExit('precision note copy marker not found')
app = app.replace(old, new, 1)

# 3) Clear stale shared calculation errors/progress when the user changes period context.
old = "onClick={()=>{setPeriod(key);setSelectedTool(null);setIntegratedCalendarYear(null)}}"
new = "onClick={()=>{setPeriod(key);setSelectedTool(null);setIntegratedCalendarYear(null);setIntegratedError('');setIntegratedProgress(null)}}"
if old not in app:
    raise SystemExit('main period switch marker not found')
app = app.replace(old, new, 1)

old = "onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null)}}"
new = "onClick={()=>{setPeriod(key);setIntegratedCalendarYear(null);setIntegratedError('');setIntegratedProgress(null)}}"
if old not in app:
    raise SystemExit('precision period switch marker not found')
app = app.replace(old, new, 1)

# 4) Make the annual result completion label unambiguous.
old = '<strong>통합 계산 완료</strong><span>{integratedResult.period.day_count}일 분석 · {integratedResult.period.month_segments}개 월 구간</span>'
new = '<strong>연간 통합 계산 완료</strong><span>{integratedResult.period.day_count}일 분석 · {integratedResult.period.month_segments}개 월 구간</span>'
if old not in app:
    raise SystemExit('integrated result headline marker not found')
app = app.replace(old, new, 1)

# Regression guards.
required = [
    "const integratedArchivePeriod: PeriodKey = 'year'",
    "const integratedArchiveYear = Number(integratedResult.period.start.slice(0,4)) || annualFortuneYear",
    '선택한 기간 운세 실계산의 원자료',
    '기간 운세와 같은 실계산 엔진을 사용해',
    "setIntegratedError('');setIntegratedProgress(null)",
    '<strong>연간 통합 계산 완료</strong>',
    '<div className="section-label">기간 운세</div>',
    'aria-label="연간 통합운세 연도 선택"',
]
for token in required:
    if token not in app:
        raise SystemExit(f'missing regression guard token: {token}')

for forbidden in [
    '통합운세 기간 선택',
    '선택한 일일·주간·월간·연간 범위에서',
    "const integratedArchivePeriod: PeriodKey = integratedCalendarYear ? 'year' : period",
    '운영 중인 통합 실계산의 원자료',
]:
    if forbidden in app:
        raise SystemExit(f'forbidden regression token remains: {forbidden}')

app_path.write_text(app, encoding='utf-8')
