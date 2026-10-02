from pathlib import Path

src_path = Path('web/src/lib/fortuneEditorialV3.ts')
src = src_path.read_text()

anchor = """export function editorialSectionReady(value: any) {
  if (!editorialSectionComplete(value)) return false
  const parts = [value.conclusion, value.real_scene, value.action, value.change_condition].map(clean)
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (nearDuplicate(parts[i], parts[j])) return false
    }
  }
  return observableChangeCondition(value.change_condition)
}
"""
addition = anchor + """

export function editorialTopicCoreReady(value: any) {
  if (!editorialSectionUsable(value)) return false
  const parts = [value.conclusion, value.real_scene, value.action].map(clean)
  if (!parts.every(Boolean)) return false
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (nearDuplicate(parts[i], parts[j])) return false
    }
  }
  return true
}

export function topicSectionCopy(value: any) {
  if (!editorialTopicCoreReady(value)) return ''
  const parts = [value.conclusion, value.real_scene, value.action].map(clean)
  const change = clean(value.change_condition)
  if (change && observableChangeCondition(change) && parts.every(part => !nearDuplicate(part, change))) {
    parts.push(change)
  }
  return parts.join(' ')
}
"""
if anchor not in src:
    raise SystemExit('editorialSectionReady anchor not found')
src = src.replace(anchor, addition, 1)
old = '    const value = clean(sectionCopy(section))'
new = '    const value = clean(topicSectionCopy(section))'
if old not in src:
    raise SystemExit('topicEditorial sectionCopy anchor not found')
src = src.replace(old, new, 1)
src_path.write_text(src)

test_path = Path('web/src/lib/fortuneEditorialV3.test.mjs')
test = test_path.read_text()
import_old = "import { buildFortuneEditorialV3, editorialGroupCopy, editorialSectionComplete, editorialSectionReady, sectionCopy } from './fortuneEditorialV3.ts'"
import_new = "import { buildFortuneEditorialV3, editorialGroupCopy, editorialSectionComplete, editorialSectionReady, sectionCopy, topicSectionCopy } from './fortuneEditorialV3.ts'"
if import_old not in test:
    raise SystemExit('test import anchor not found')
test = test.replace(import_old, import_new, 1)
marker = "test('applicability blocks insufficient copy and marks conditional depth without downgrading direct copy',()=>{"
new_test = """test('topic editorial preserves strong core prose when only change condition is weak',()=>{
  const clusters=emptyClusters()
  clusters.work_study.work={
    conclusion:'업무 우선순위를 한 번에 하나로 줄이는 편이 낫다.',
    real_scene:'요청이 겹치면 먼저 마감과 담당자를 다시 정하는 장면이 생기기 쉽다.',
    action:'새 일을 받기 전에 기존 작업의 완료 기준부터 합의해.',
    change_condition:'상황이 바뀌면 다시 봐.',
    evidence_refs:[],
    applicability:'direct',
  }
  assert.equal(sectionCopy(clusters.work_study.work),'')
  assert.match(topicSectionCopy(clusters.work_study.work),/업무 우선순위/)
  const result=buildFortuneEditorialV3(data({clusters}),calc(),base())
  assert.match(result.topicEditorial['직장'],/업무 우선순위/)
  assert.match(result.topicEditorial['직장'],/마감과 담당자/)
  assert.match(result.topicEditorial['직장'],/완료 기준/)
  assert.doesNotMatch(result.topicEditorial['직장'],/상황이 바뀌면/)
})

""" + marker
if marker not in test:
    raise SystemExit('applicability test marker not found')
test = test.replace(marker, new_test, 1)
test_path.write_text(test)

Path('.github/workflows/editorial-core-salvage-v9.yml').unlink(missing_ok=True)
Path('scripts/apply-editorial-core-salvage-v9.py').unlink(missing_ok=True)
