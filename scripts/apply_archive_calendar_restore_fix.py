from pathlib import Path
p=Path('web/src/AppNext.tsx')
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    if old not in s: raise SystemExit(f'missing {label}')
    s=s.replace(old,new,1)

one(
"    const label = periods.find((item) => item.key === period)?.label ?? period\n    try {\n    const saved = await saveArchive({\n      kind: 'integrated',\n      periodKey: period,\n      title: `${label} 통합운세 · ${integratedResult.period.start}`,",
"    const integratedArchivePeriod: PeriodKey = integratedCalendarYear ? 'year' : period\n    const label = integratedCalendarYear ? `${integratedCalendarYear}년` : (periods.find((item) => item.key === period)?.label ?? period)\n    try {\n    const saved = await saveArchive({\n      kind: 'integrated',\n      periodKey: integratedArchivePeriod,\n      title: `${label} 통합운세 · ${integratedResult.period.start}`,",
'integrated archive period')

one(
"    try {\n    const saved = await saveArchive({\n      kind: 'precision',\n      periodKey: period,\n      title: `정밀분석 · ${integratedResult.period.start}`,",
"    const precisionArchivePeriod: PeriodKey = integratedCalendarYear ? 'year' : period\n    try {\n    const saved = await saveArchive({\n      kind: 'precision',\n      periodKey: precisionArchivePeriod,\n      title: `${integratedCalendarYear ? `${integratedCalendarYear}년 · ` : ''}정밀분석 · ${integratedResult.period.start}`,",
'precision archive period')

one(
"    setQueryDate(item.periodStart)\n    setPeriod(item.periodKey)\n    if (item.kind === 'integrated' || item.kind === 'precision') {\n      setIntegratedResult(item.result as unknown as IntegratedApiResponse)",
"    setQueryDate(item.periodStart)\n    setPeriod(item.periodKey)\n    const archiveYear = Number(item.periodStart.slice(0,4))\n    const isFullCalendarYear = Number.isFinite(archiveYear) && item.periodStart === `${archiveYear}-01-01` && item.periodEnd === `${archiveYear}-12-31`\n    if (item.kind === 'integrated' || item.kind === 'precision') {\n      setIntegratedCalendarYear(isFullCalendarYear ? archiveYear : null)\n      setRelationshipCalendarYear(null)\n      setIntegratedResult(item.result as unknown as IntegratedApiResponse)",
'archive year detect integrated')

one(
"      setRelationshipResult(item.result as unknown as RelationshipApiResponse)\n      setRelationshipRequestSnapshot(request)\n      const restoredDays = Math.max(7, Math.min(365, Math.round((new Date(`${item.periodEnd}T12:00:00Z`).getTime()-new Date(`${item.periodStart}T12:00:00Z`).getTime())/86400000)+1))\n      setRelationshipDays(restoredDays)",
"      setIntegratedCalendarYear(null)\n      setRelationshipCalendarYear(isFullCalendarYear ? archiveYear : null)\n      setRelationshipResult(item.result as unknown as RelationshipApiResponse)\n      setRelationshipRequestSnapshot(request)\n      const restoredDays = Math.max(7, Math.min(365, Math.round((new Date(`${item.periodEnd}T12:00:00Z`).getTime()-new Date(`${item.periodStart}T12:00:00Z`).getTime())/86400000)+1))\n      setRelationshipDays(restoredDays)",
'archive year detect relationship')

p.write_text(s,encoding='utf-8')
print('ARCHIVE_CALENDAR_RESTORE_PATCHED')
