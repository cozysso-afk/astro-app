from pathlib import Path

panel_path = Path('web/src/ReunionHierarchyPanelV3.tsx')
s = panel_path.read_text()
old = '''    if (Math.abs(diff) < 5) {\n      const micro = diff > 0 ? '상대 → 나' : '나 → 상대'\n      const pointGap = Math.abs(roundedA - roundedB)\n      return {\n        label:`판정상 동률권 · ${micro} +${pointGap}`,\n        text:`굳이 수치만 비교하면 ${micro}가 ${pointGap}점 높아. 상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}지만 이 차이는 실제 선연락 주체를 확정할 수준은 아니야.`,\n      }\n    }\n    const side = diff > 0 ? '상대 → 나' : '나 → 상대'\n    const weak = a < 40 && b < 40\n    return {\n      label: weak ? `${side} 약우세` : `${side} 우세`,\n      text: weak\n        ? `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 두 방향 모두 강하지 않지만 상대 비교에서는 ${side} 쪽이 조금 앞서.`\n        : `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. ${side} 쪽이 반대 방향보다 상대적으로 더 두드러져.`,\n    }\n'''
new = '''    if (Math.abs(diff) < 5) {\n      const micro = diff > 0 ? '상대 → 나' : '나 → 상대'\n      const pointGap = Math.abs(roundedA - roundedB)\n      return {\n        label:`${micro} 근소 우세`,\n        text:`연락 자체 강도와 별개로 상대 비교에서는 ${micro}가 ${pointGap}점 앞서. 상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 다만 차이가 근소해서 실제 선연락 주체를 확정한다는 뜻은 아니야.`,\n      }\n    }\n    const side = diff > 0 ? '상대 → 나' : '나 → 상대'\n    const pointGap = Math.abs(roundedA - roundedB)\n    const weak = a < 40 && b < 40\n    return {\n      label:`${side} 우세`,\n      text: weak\n        ? `두 방향 모두 연락 자체 강도는 낮지만 상대 비교에서는 ${side}가 ${pointGap}점 앞서. 상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}.`\n        : `상대 → 나 ${roundedA}, 나 → 상대 ${roundedB}. 상대 비교에서는 ${side}가 ${pointGap}점 앞서.`,\n    }\n'''
if old not in s:
    raise SystemExit('initiative block anchor not found')
s = s.replace(old, new, 1)
old2 = "  const initiativeText = readerSentences(consultation?.initiative, 2) || initiative.text\n"
new2 = "  const initiativeText = initiative.text\n"
if old2 not in s:
    raise SystemExit('initiative text anchor not found')
s = s.replace(old2, new2, 1)
panel_path.write_text(s)

test_path = Path('web/src/lib/relationshipReunionV3.contract.test.mjs')
t = test_path.read_text()
old_test = '''test('contact parent strength is independent from sender direction and tied direction still reports the tiny numeric edge',()=>{\n  assert.match(hierarchy,/function contactReading\\(hierarchy: ReunionHierarchy\\)/)\n  assert.match(hierarchy,/hierarchy\\.stages\\?\\.contact_recontact\\?\\.activation/)\n  const contactBody=hierarchy.slice(hierarchy.indexOf('function contactReading'),hierarchy.indexOf('function directionRow'))\n  assert.doesNotMatch(contactBody,/directionRows/)\n  assert.doesNotMatch(contactBody,/incomingBand|outgoingBand/)\n  assert.match(hierarchy,/function initiativeReading\\(rows: DirectionRow\\[\\]\\)/)\n  assert.match(hierarchy,/Math\\.abs\\(diff\\) < 5/)\n  assert.match(hierarchy,/판정상 동률권/)\n  assert.match(hierarchy,/\\+\\$\\{pointGap\\}/)\n  assert.match(hierarchy,/굳이 수치만 비교하면/)\n})\n'''
new_test = '''test('contact strength stays separate from relative initiative and even a small edge is shown',()=>{\n  assert.match(hierarchy,/function contactReading\\(hierarchy: ReunionHierarchy\\)/)\n  assert.match(hierarchy,/hierarchy\\.stages\\?\\.contact_recontact\\?\\.activation/)\n  const contactBody=hierarchy.slice(hierarchy.indexOf('function contactReading'),hierarchy.indexOf('function directionRow'))\n  assert.doesNotMatch(contactBody,/directionRows/)\n  assert.doesNotMatch(contactBody,/incomingBand|outgoingBand/)\n  assert.match(hierarchy,/function initiativeReading\\(rows: DirectionRow\\[\\]\\)/)\n  assert.match(hierarchy,/Math\\.abs\\(diff\\) < 5/)\n  assert.match(hierarchy,/근소 우세/)\n  assert.match(hierarchy,/연락 자체 강도와 별개로 상대 비교에서는/)\n  assert.doesNotMatch(hierarchy,/판정상 동률권/)\n  assert.match(hierarchy,/const initiativeText = initiative\\.text/)\n  assert.doesNotMatch(hierarchy,/readerSentences\\(consultation\\?\\.initiative/)\n})\n'''
if old_test not in t:
    raise SystemExit('contract test anchor not found')
t = t.replace(old_test, new_test, 1)
test_path.write_text(t)
