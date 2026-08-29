from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text()

s = s.replace('    practical_advice: string[]\n', '    practical_advice?: string[]\n', 1)

old = """  const resultMonths = (relationshipResult?.result?.natal_synastry?.partner_time_exact ? relationshipResult?.result?.months : []) ?? []
  const natalAspects = relationshipResult?.result?.natal_synastry?.aspects ?? []
  const partnerTimeExact = Boolean(relationshipResult?.result?.natal_synastry?.partner_time_exact)
  const natalSupportive = natalAspects.filter((aspect) => aspect.tone === 'supportive').length
"""
new = """  const resultMonths = (relationshipResult?.result?.natal_synastry?.partner_time_exact ? relationshipResult?.result?.months : []) ?? []
  const partnerTimeExact = Boolean(relationshipResult?.result?.natal_synastry?.partner_time_exact)
  const rawNatalAspects = relationshipResult?.result?.natal_synastry?.aspects ?? []
  const natalAspects = partnerTimeExact ? rawNatalAspects : rawNatalAspects.filter((aspect) => !relationshipTimeSensitivePoints.has(aspect.a) && !relationshipTimeSensitivePoints.has(aspect.b))
  const natalSupportive = natalAspects.filter((aspect) => aspect.tone === 'supportive').length
"""
if old not in s:
    raise SystemExit('natal aspect precision anchor not found')
s = s.replace(old, new, 1)
p.write_text(s)
