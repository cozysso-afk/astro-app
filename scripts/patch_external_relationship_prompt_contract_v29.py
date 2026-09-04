from pathlib import Path

# 1) Make the relationship copy button unambiguous.
p = Path('web/src/AppNext.tsx')
s = p.read_text()
old = "handleCopy('요청/프롬프트 전체복사', relationshipPromptText(selectedTool==='marriage'?'marriage':relationshipPurpose, relationshipRequestSnapshot, relationshipResult, reunionTiming))}><Copy size={15}/><span>요청/프롬프트 전체복사</span>"
new = "handleCopy('외부 AI용 압축 프롬프트 복사', relationshipPromptText(selectedTool==='marriage'?'marriage':relationshipPurpose, relationshipRequestSnapshot, relationshipResult, reunionTiming))}><Copy size={15}/><span>외부 AI용 압축 프롬프트</span>"
assert old in s, 'relationship copy button anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 2) Invalidate old local relationship-AI cache so V11.1 behavior is used cleanly.
p = Path('web/src/lib/readingCache.ts')
s = p.read_text()
old = "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11-mode-split-cost-guard'"
new = "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.1-adaptive-prompt-pack'"
assert old in s, 'relationship cache contract anchor missing'
s = s.replace(old, new, 1)
p.write_text(s)

# 3) Lock the external-prompt length/packet contract into the existing relationship regression suite.
p = Path('web/src/lib/relationshipModeContract.test.mjs')
s = p.read_text()
s = s.replace("const relationshipFn = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')\n", "const relationshipFn = readFileSync(new URL('../../../supabase/functions/relationship-interpret-v9-preview/index.ts', import.meta.url), 'utf8')\nconst formatters = readFileSync(new URL('./resultFormatters.ts', import.meta.url), 'utf8')\n")
s = s.replace("assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11-mode-split-cost-guard'/)", "assert.match(cache, /RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11\\.1-adaptive-prompt-pack'/)")
addition = r'''

test('external relationship prompt is compact bounded and clearly separated from raw full copy', () => {
  assert.match(formatters, /EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS = 28000/)
  assert.match(formatters, /compactRelationshipExternalPacket/)
  assert.match(formatters, /for \(let level=0; level<=2; level\+\+\)/)
  assert.match(formatters, /prompt\.slice\(0,EXTERNAL_RELATIONSHIP_PROMPT_MAX_CHARS - 180\)/)
  assert.match(formatters, /좌표·원본 API 요청은 이미 계산에 반영됐으므로 외부 AI 입력에서는 중복 제거했다/)
  assert.match(app, /외부 AI용 압축 프롬프트/)
  assert.doesNotMatch(app, /handleCopy\('요청\/프롬프트 전체복사', relationshipPromptText/)
  assert.match(relationshipFn, /relationship-v11\.1-adaptive-prompt-pack/)
})
'''
if "external relationship prompt is compact bounded" not in s:
    s += addition
p.write_text(s)
