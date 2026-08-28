from pathlib import Path

archive_path = Path('web/src/lib/archive.ts')
app_path = Path('web/src/AppNext.tsx')
css_path = Path('web/src/archive.css')

# 1) Archive data model: add legacy daily/outcome as first-class archive kinds.
s = archive_path.read_text(encoding='utf-8')
s = s.replace(
    "export type ArchiveKind = 'integrated' | 'compatibility' | 'marriage' | 'precision'",
    "export type ArchiveKind = 'integrated' | 'compatibility' | 'marriage' | 'precision' | 'daily' | 'outcome'",
    1,
)

old_condition = "item.kind === 'integrated' || item.kind === 'precision'"
new_condition = "item.kind === 'integrated' || item.kind === 'precision' || item.kind === 'daily' || item.kind === 'outcome'"
if s.count(old_condition) < 2:
    raise SystemExit('archive readings-route anchors missing')
s = s.replace(old_condition, new_condition)

old_kind = "const kind: ArchiveKind = rawKind === 'marriage' || rawKind === 'compatibility' || rawKind === 'integrated' || rawKind === 'precision'\n    ? rawKind\n    : kindFallback"
new_kind = "const kind: ArchiveKind = rawKind === 'marriage' || rawKind === 'compatibility' || rawKind === 'integrated' || rawKind === 'precision' || rawKind === 'daily' || rawKind === 'outcome'\n    ? rawKind\n    : kindFallback"
if old_kind not in s:
    raise SystemExit('archive kind parser anchor missing')
s = s.replace(old_kind, new_kind, 1)
archive_path.write_text(s, encoding='utf-8')

# 2) App UI: open/copy legacy records safely instead of treating them as relationship/integrated payloads.
s = app_path.read_text(encoding='utf-8')
state_anchor = "  const [archiveError, setArchiveError] = useState('')\n  const [uiSettings, setUiSettings] = useState(() => loadUiSettings())"
state_repl = "  const [archiveError, setArchiveError] = useState('')\n  const [legacyArchiveOpen, setLegacyArchiveOpen] = useState<ArchiveItem | null>(null)\n  const [uiSettings, setUiSettings] = useState(() => loadUiSettings())"
if state_anchor not in s:
    raise SystemExit('legacy state anchor missing')
s = s.replace(state_anchor, state_repl, 1)

restore_anchor = "  function restoreArchive(item: ArchiveItem) {\n    setQueryDate(item.periodStart)"
restore_repl = "  function restoreArchive(item: ArchiveItem) {\n    if (item.kind === 'daily' || item.kind === 'outcome') {\n      setLegacyArchiveOpen(item)\n      setMainView('history')\n      return\n    }\n    setLegacyArchiveOpen(null)\n    setQueryDate(item.periodStart)"
if restore_anchor not in s:
    raise SystemExit('restoreArchive anchor missing')
s = s.replace(restore_anchor, restore_repl, 1)

copy_anchor = "  async function copyArchiveResult(item: ArchiveItem) {\n    if (item.kind === 'integrated' || item.kind === 'precision') {"
copy_repl = "  async function copyArchiveResult(item: ArchiveItem) {\n    if (item.kind === 'daily' || item.kind === 'outcome') {\n      await handleCopy('이전 기록 전체복사', JSON.stringify(item.result, null, 2))\n      return\n    }\n    if (item.kind === 'integrated' || item.kind === 'precision') {"
if copy_anchor not in s:
    raise SystemExit('copyArchiveResult anchor missing')
s = s.replace(copy_anchor, copy_repl, 1)

remove_anchor = "  async function removeArchive(item: ArchiveItem) {\n    try {\n      await deleteArchive(item)"
remove_repl = "  async function removeArchive(item: ArchiveItem) {\n    try {\n      await deleteArchive(item)\n      if (legacyArchiveOpen?.id === item.id) setLegacyArchiveOpen(null)"
if remove_anchor not in s:
    raise SystemExit('removeArchive anchor missing')
s = s.replace(remove_anchor, remove_repl, 1)

sync_line = "          <div className=\"archive-sync-row\"><span><Cloud size={15}/>{archiveLoading ? '기록 연결 상태 확인 중' : archiveStatus || '기록 연결 상태 확인 전'}</span><button type=\"button\" onClick={refreshArchive} disabled={archiveLoading}><RefreshCw className={archiveLoading?'spin':''} size={15}/>새로고침</button></div>"
legacy_detail = sync_line + "\n          {legacyArchiveOpen && <section className={`legacy-archive-detail legacy-${legacyArchiveOpen.kind}`}>\n            <div className=\"legacy-archive-head\"><div><span className={`archive-kind kind-${legacyArchiveOpen.kind}`}>{legacyArchiveOpen.kind==='daily'?'이전 일일운세':'결과 기록'}</span><strong>{legacyArchiveOpen.title}</strong><small>{legacyArchiveOpen.periodStart} · {new Date(legacyArchiveOpen.createdAt).toLocaleString('ko-KR')}</small></div><button type=\"button\" onClick={()=>setLegacyArchiveOpen(null)}>닫기</button></div>\n            <p>{legacyArchiveOpen.kind==='daily'?'이전 앱에서 저장한 일일운세 원문이야. 기존 계산·해석 데이터를 수정하지 않고 그대로 보존했어.':'이전 앱에서 남긴 실제 결과/피드백 기록이야. 당시 메모와 점수를 원본 그대로 보존했어.'}</p>\n            <details open><summary>원문 데이터 보기</summary><pre>{JSON.stringify(legacyArchiveOpen.result,null,2)}</pre></details>\n          </section>}"
if sync_line not in s:
    raise SystemExit('archive sync UI anchor missing')
s = s.replace(sync_line, legacy_detail, 1)

old_label = "{item.kind==='integrated'?'통합운세':item.kind==='precision'?'정밀분석':item.kind==='marriage'?'결혼운':'궁합운'}"
new_label = "{item.kind==='integrated'?'통합운세':item.kind==='precision'?'정밀분석':item.kind==='marriage'?'결혼운':item.kind==='compatibility'?'궁합운':item.kind==='daily'?'이전 일일운세':'결과 기록'}"
if old_label not in s:
    raise SystemExit('archive label anchor missing')
s = s.replace(old_label, new_label, 1)
app_path.write_text(s, encoding='utf-8')

# 3) Legacy record detail styling.
c = css_path.read_text(encoding='utf-8')
marker = '/* Legacy archive restore v1 */'
if marker not in c:
    c += r'''

/* Legacy archive restore v1 */
.archive-kind.kind-daily { color:#6f6a98; background:linear-gradient(135deg,#eee8fb,#e5efff); }
.archive-kind.kind-outcome { color:#5f7d74; background:linear-gradient(135deg,#e2f3ed,#edf5ff); }
.legacy-archive-detail {
  display:grid;
  gap:12px;
  margin-top:14px;
  padding:15px;
  border:1px solid rgba(175,184,202,.34);
  border-radius:18px;
  background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(239,241,252,.90));
  box-shadow:0 12px 28px rgba(86,79,107,.08),0 1px 0 #fff inset;
}
.legacy-archive-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.legacy-archive-head > div { min-width:0; display:grid; gap:5px; }
.legacy-archive-head strong { color:#44394b; font-size:.82rem; line-height:1.45; }
.legacy-archive-head small { color:#918797; font-size:.57rem; }
.legacy-archive-head button {
  flex:0 0 auto; min-height:34px; padding:0 11px; border-radius:11px;
  border:1px solid rgba(166,175,194,.34); color:#685d70; font-weight:750;
  background:rgba(255,255,255,.86);
}
.legacy-archive-detail > p { margin:0; color:#756b7b; font-size:.64rem; line-height:1.55; }
.legacy-archive-detail details { border:1px solid rgba(177,185,202,.28); border-radius:14px; overflow:hidden; background:rgba(255,255,255,.72); }
.legacy-archive-detail summary { padding:11px 12px; color:#675c70; font-size:.63rem; font-weight:800; cursor:pointer; }
.legacy-archive-detail pre {
  max-height:360px; overflow:auto; margin:0; padding:12px; border-top:1px solid rgba(177,185,202,.22);
  color:#514957; background:rgba(248,249,253,.88); font-size:10px; line-height:1.55; white-space:pre-wrap; word-break:break-word;
  -webkit-overflow-scrolling:touch;
}
'''
css_path.write_text(c, encoding='utf-8')

print('legacy archive support patched')
