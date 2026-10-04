from pathlib import Path

p = Path('web/src/koreaBirthplaces.tsx')
s = p.read_text()
old = '''  useEffect(() => {\n    if (sourceValueRef.current !== value) {\n      sourceValueRef.current = value\n      if (!stagedValueRef.current || !sameBirthplaceValue(value, stagedValueRef.current)) {\n        stagedValueRef.current = null\n        stagedSelectionRef.current = null\n      }\n    }\n    if (stagedSelectionRef.current) return\n'''
new = '''  useEffect(() => {\n    if (sourceValueRef.current !== value) {\n      sourceValueRef.current = value\n      if (stagedValueRef.current && sameBirthplaceValue(value, stagedValueRef.current)) {\n        // A region-only selection has an empty placeKey until the district is chosen.\n        // Keep that partial UI selection staged when the parent acknowledges the cleared coordinates.\n        if (stagedSelectionRef.current?.district) {\n          stagedValueRef.current = null\n          stagedSelectionRef.current = null\n        }\n      } else {\n        stagedValueRef.current = null\n        stagedSelectionRef.current = null\n      }\n    }\n    if (stagedSelectionRef.current) return\n'''
if old not in s:
    raise SystemExit('sync effect anchor not found')
s = s.replace(old, new, 1)
old2 = '''    stagedSelectionRef.current = null\n    stagedValueRef.current = null\n    onChange(next)\n'''
new2 = '''    // Stage the selection before notifying the parent. For the first (region) step,\n    // placeKey is intentionally empty, so deriving local UI state from placeKey on the\n    // next render would otherwise snap the selector back to the placeholder.\n    stagedSelectionRef.current = selection\n    stagedValueRef.current = next\n    onChange(next)\n'''
if old2 not in s:
    raise SystemExit('commit anchor not found')
s = s.replace(old2, new2, 1)
p.write_text(s)

t = Path('web/src/lib/reunionV31Regression.test.mjs')
ts = t.read_text()
anchor = "  assert.match(birthplace, /if \\(!stagedValueRef\\.current \\|\\| !sameBirthplaceValue\\(value, stagedValueRef\\.current\\)\\)/)\n"
replacement = "  assert.match(birthplace, /stagedValueRef\\.current && sameBirthplaceValue\\(value, stagedValueRef\\.current\\)/)\n  assert.match(birthplace, /stagedSelectionRef\\.current\\?\\.district/)\n"
if anchor not in ts:
    raise SystemExit('regression anchor not found')
ts = ts.replace(anchor, replacement, 1)
extra = '''\ntest('birthplace region step stays staged while placeKey is empty', () => {\n  assert.match(birthplace, /stagedSelectionRef\\.current = selection[\\s\\S]*stagedValueRef\\.current = next[\\s\\S]*onChange\\(next\\)/)\n  assert.match(birthplace, /A region-only selection has an empty placeKey/)\n})\n'''
if "birthplace region step stays staged while placeKey is empty" not in ts:
    ts += extra
t.write_text(ts)
