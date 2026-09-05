from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected 1 match, got {count}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


# Internal relationship AI: bump packet/cache version and bound secondary evidence.
replace_once(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    'VERSION="relationship-v11.5-reunion-dimensions"',
    'VERSION="relationship-v11.6-reunion-compact-evidence"',
)
replace_once(
    'supabase/functions/relationship-interpret-v9-preview/index.ts',
    '''function secondarySupportPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const months=(Array.isArray(raw?.months)?raw.months:[]).slice(0,n).map((m:any)=>({calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,dimensions:m?.dimensions??null}));
 return {months,policy:raw?.policy??null,event_probability:"not_calculated"};
}
''',
    '''function secondaryDimensionPacket(x:any,n:number){
 if(!x||typeof x!=="object")return null;
 return {label:x?.label??null,evidence:aspectList(x?.evidence,Math.min(3,n)),independent_primary_layers:Array.isArray(x?.independent_primary_layers)?x.independent_primary_layers.slice(0,4):[],independent_layer_count:Number(x?.independent_layer_count??0),convergence:Boolean(x?.convergence),score:null,policy:x?.policy??null,event_probability:"not_calculated"};
}
function secondarySupportPacket(raw:any,n:number){
 if(!raw||typeof raw!=="object")return null;
 const months=(Array.isArray(raw?.months)?raw.months:[]).slice(0,n).map((m:any)=>({calendar_month:m?.calendar_month??null,representative_date:m?.representative_date??null,dimensions:{contact_recontact:secondaryDimensionPacket(m?.dimensions?.contact_recontact,n),emotional_reactivation:secondaryDimensionPacket(m?.dimensions?.emotional_reactivation,n),relationship_rebuilding:secondaryDimensionPacket(m?.dimensions?.relationship_rebuilding,n)}}));
 return {months,policy:raw?.policy??null,event_probability:"not_calculated"};
}
''',
)

# External-AI prompt: compact both new V14 blocks at every compression level.
anchor = '''function compactRelationshipExternalPacket(calculation: RelationshipApiResponse | null | undefined, reunionContext: ReunionTimingContext | null | undefined, level: number) {
'''
helpers = '''function compactReunionDimensionForExternal(value: unknown, monthLimit: number, evidenceLimit: number, statBest: number, statCaution: number) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const evidencePoint = (item: unknown) => {
    if (!item || typeof item !== 'object') return null
    const x = item as Record<string, unknown>
    const list = (v: unknown) => (Array.isArray(v) ? v : []).slice(0,2).map(compactAspectForExternal).filter(Boolean)
    return {
      date:String(x.date ?? ''), score:Number(Number(x.score ?? 0).toFixed(1)),
      user_score:Number(Number(x.user_score ?? 0).toFixed(1)), counterpart_score:Number(Number(x.counterpart_score ?? 0).toFixed(1)),
      user_evidence:list(x.user_evidence), counterpart_evidence:list(x.counterpart_evidence), event_probability:'not_calculated',
    }
  }
  const months = (Array.isArray(row.months) ? row.months : []).slice(0,monthLimit).map((item)=>{
    const m = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {calendar_month:m.calendar_month ?? null,start:m.start ?? null,end:m.end ?? null,incoming:compactStatForExternal(m.incoming,1,1),outgoing:compactStatForExternal(m.outgoing,1,1),reconnection:compactStatForExternal(m.reconnection,1,1)}
  })
  return {
    incoming:compactStatForExternal(row.incoming,statBest,statCaution),
    outgoing:compactStatForExternal(row.outgoing,statBest,statCaution),
    reconnection:compactStatForExternal(row.reconnection,statBest,statCaution),
    months,
    top_evidence:(Array.isArray(row.top_evidence) ? row.top_evidence : []).slice(0,evidenceLimit).map(evidencePoint).filter(Boolean),
    event_probability:'not_calculated',
  }
}

function compactReunionDimensionsForExternal(value: unknown, caps: { directionalMonths:number; transitDays:number; statBest:number; statCaution:number }) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const one = (key: string) => compactReunionDimensionForExternal(row[key],caps.directionalMonths,caps.transitDays,caps.statBest,caps.statCaution)
  return {period:row.period ?? null,contact_recontact:one('contact_recontact'),emotional_reactivation:one('emotional_reactivation'),relationship_rebuilding:one('relationship_rebuilding'),policy:row.policy ?? null}
}

function compactSecondaryDimensionForExternal(value: unknown, evidenceLimit: number) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  return {
    label:row.label ?? null,
    evidence:(Array.isArray(row.evidence) ? row.evidence : []).slice(0,evidenceLimit).map(compactAspectForExternal).filter(Boolean),
    independent_primary_layers:(Array.isArray(row.independent_primary_layers) ? row.independent_primary_layers : []).slice(0,4),
    independent_layer_count:Number(row.independent_layer_count ?? 0), convergence:Boolean(row.convergence), score:null,
    policy:row.policy ?? null,event_probability:'not_calculated',
  }
}

function compactReunionSecondarySupportForExternal(value: unknown, monthLimit: number, evidenceLimit: number) {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const months = (Array.isArray(row.months) ? row.months : []).slice(0,monthLimit).map((item)=>{
    const m = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const d = (m.dimensions && typeof m.dimensions === 'object' ? m.dimensions : {}) as Record<string, unknown>
    return {calendar_month:m.calendar_month ?? null,representative_date:m.representative_date ?? null,dimensions:{contact_recontact:compactSecondaryDimensionForExternal(d.contact_recontact,evidenceLimit),emotional_reactivation:compactSecondaryDimensionForExternal(d.emotional_reactivation,evidenceLimit),relationship_rebuilding:compactSecondaryDimensionForExternal(d.relationship_rebuilding,evidenceLimit)}}
  })
  return {months,policy:row.policy ?? null,event_probability:'not_calculated'}
}

'''
replace_once('web/src/lib/resultFormatters.ts', anchor, helpers + anchor)
replace_once(
    'web/src/lib/resultFormatters.ts',
    '''    reunion_dimensions: rawResult.reunion_dimensions ?? null,
    reunion_secondary_support: rawResult.reunion_secondary_support ?? null,
''',
    '''    reunion_dimensions: compactReunionDimensionsForExternal(rawResult.reunion_dimensions,caps),
    reunion_secondary_support: compactReunionSecondarySupportForExternal(rawResult.reunion_secondary_support,caps.months,caps.tight),
''',
)

# Browser cache version must track the server interpretation packet version.
replace_once(
    'web/src/lib/readingCache.ts',
    "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.5-reunion-dimensions'",
    "const RELATIONSHIP_AI_CACHE_CONTRACT = 'relationship-v11.6-reunion-compact-evidence'",
)

# Existing source-contract tests follow the packet version and enforce bounded V14 external blocks.
for path in ('web/src/lib/relationshipModeContract.test.mjs','web/src/lib/relationshipEvidencePipeline.test.mjs'):
    replace_once(path, 'relationship-v11\\.5-reunion-dimensions', 'relationship-v11\\.6-reunion-compact-evidence')

p = Path('web/src/lib/relationshipEvidencePipeline.test.mjs')
text = p.read_text(encoding='utf-8')
needle = "  assert.match(formatters, /timing_contract:\\s*\\{/ )\n" if False else "  assert.match(formatters, /timing_contract:\\s*\\{/)\n"
if needle not in text:
    raise SystemExit('relationshipEvidencePipeline test insertion anchor missing')
extra = "  assert.match(formatters, /compactReunionDimensionsForExternal\\(rawResult\\.reunion_dimensions,caps\\)/)\n  assert.match(formatters, /compactReunionSecondarySupportForExternal\\(rawResult\\.reunion_secondary_support,caps\\.months,caps\\.tight\\)/)\n  assert.doesNotMatch(formatters, /reunion_dimensions: rawResult\\.reunion_dimensions \\?\\? null/)\n  assert.doesNotMatch(formatters, /reunion_secondary_support: rawResult\\.reunion_secondary_support \\?\\? null/)\n  assert.match(edge, /secondaryDimensionPacket/)\n"
p.write_text(text.replace(needle, needle + extra, 1), encoding='utf-8')
print('V14 prompt compaction patches applied')
