from pathlib import Path

p = Path('web/src/AppNext.tsx')
s = p.read_text(encoding='utf-8')

# Types
anchor = "type FortunePoint = { date: string; label: string; score: number }\n"
block = '''type RelationshipAiResponse = {\n  ok: boolean\n  error?: string\n  model?: string\n  fallback_from?: string\n  interpreter_version?: string\n  usage?: { prompt_tokens?: number; candidate_tokens?: number; thought_tokens?: number; total_tokens?: number; estimated_usd?: number; estimated_krw?: number }\n  data?: {\n    headline: string\n    overview: string\n    chemistry: string\n    communication: string\n    stability: string\n    tensions: string\n    timing: string\n    reunion_context: string\n    practical_advice: string[]\n    top_aspects: Array<{ label: string; meaning: string }>\n    limits: string\n  }\n}\n\n'''
if 'type RelationshipAiResponse' not in s:
    assert anchor in s, 'type anchor missing'
    s = s.replace(anchor, block + anchor, 1)

# Helpers + instant interpretation panel
helper_anchor = "const relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']\n"
helper_block = r'''const relationshipSignalOrder = ['수신신호','발신적합','과거인연접점']

function hasPair(aspect: Aspect, a: string, b: string) {
  return (aspect.a === a && aspect.b === b) || (aspect.a === b && aspect.b === a)
}
function relationshipAspectMeaning(aspect: Aspect) {
  const tense = aspect.tone === 'challenging'
  const supportive = aspect.tone === 'supportive'
  if (hasPair(aspect,'Mercury','Mars')) return tense ? '말의 속도와 반응성이 빨라져 논쟁·반박이 쉽게 붙는 접점이야. 누가 맞는지보다 말의 강도를 조절하는 게 핵심이야.' : '생각을 행동으로 옮기는 속도가 잘 맞기 쉬워. 대화를 실제 움직임으로 연결하는 힘이 있어.'
  if (hasPair(aspect,'Mercury','Uranus')) return tense ? '대화가 갑자기 튀거나 예상 밖의 말로 흐름이 끊길 수 있어. 신선함은 크지만 안정적인 소통 규칙이 필요해.' : '서로의 생각을 깨우는 자극이 강해. 새로운 관점과 아이디어가 잘 살아나는 접점이야.'
  if (hasPair(aspect,'Mars','Pluto')) return '추진력과 힘겨루기가 동시에 커질 수 있는 강한 접점이야. 경계·통제·주도권을 어떻게 다루는지가 중요해.'
  if ((aspect.a === 'Neptune' || aspect.b === 'Neptune') && ['ASC','DSC'].some((x)=>aspect.a===x||aspect.b===x)) return tense ? '상대를 보는 이미지와 실제 관계 방식 사이에 흐림이나 이상화가 생기기 쉬워. 추측보다 확인이 중요해.' : '분위기·공감은 잘 생길 수 있지만 현실 확인을 같이 해야 안정적으로 쓰여.'
  if ((aspect.a === 'Sun' || aspect.b === 'Sun') && ['MC','IC'].some((x)=>aspect.a===x||aspect.b===x)) return supportive ? '한 사람의 핵심 방향성이 다른 사람의 진로·생활축과 자연스럽게 연결되는 접점이야.' : '개인의 방향성과 생활·진로축이 부딪힐 수 있어. 관계와 각자의 목표를 분리해 조율해야 해.'
  if (hasPair(aspect,'Venus','Mars')) return supportive ? '호감 표현 방식과 추진력이 자연스럽게 맞물리는 전형적인 끌림 접점이야. 다만 이것만으로 관계 지속이나 재회를 뜻하진 않아.' : '끌림은 강할 수 있지만 원하는 속도나 표현 방식 차이로 마찰도 같이 생길 수 있어.'
  if (aspect.a === 'Saturn' || aspect.b === 'Saturn') return tense ? '책임·거리·기준이 무겁게 느껴질 수 있어. 오래 가려면 의무감보다 합의된 규칙이 필요해.' : '관계에 구조와 지속성을 더해주는 접점이야. 꾸준함과 현실적인 약속으로 쓸 때 힘이 생겨.'
  if (aspect.a === 'Jupiter' || aspect.b === 'Jupiter') return supportive ? '서로의 시야를 넓히고 격려하는 방향으로 쓰이기 쉬워.' : '기대나 낙관이 과해질 수 있어. 실제 상황보다 크게 해석하지 않는 게 중요해.'
  if (aspect.a === 'True Node' || aspect.b === 'True Node') return '익숙함이나 의미 부여가 강해질 수 있지만 운명·재회 확정의 증거는 아니야. 반복 패턴을 살피는 근거로 보는 게 맞아.'
  return supportive ? '이 기능은 비교적 자연스럽게 연결되는 조화 접점이야. 관계 전체가 좋다는 뜻은 아니야.' : tense ? '자극과 마찰이 반복되기 쉬운 긴장 접점이야. 나쁘다는 뜻보다 조율이 필요한 힘이 강하다는 의미야.' : '강한 결합이나 혼합 효과가 나타나는 접점이야. 상황에 따라 협력과 부담이 함께 나타날 수 있어.'
}
function relationshipLimitKo(text: string) {
  if (text.includes('Partner exact birth time/place missing')) return '상대의 정확한 출생시간·장소가 없어 데이비슨·마크스·마크스 3차 진행은 추정하지 않고 제외했어.'
  if (text.includes('Exact partner birth time')) return '상대의 정확한 출생시간이 없어 해당 정밀 진행 레이어는 계산하지 않았어.'
  return text
}
function RelationshipInterpretationPanel({ aspects, partnerExact, ai, aiLoading, aiError, onAi }: { aspects: Aspect[]; partnerExact: boolean; ai: RelationshipAiResponse | null; aiLoading: boolean; aiError: string; onAi: () => void }) {
  const supportive = aspects.filter((a)=>a.tone==='supportive').length
  const challenging = aspects.filter((a)=>a.tone==='challenging').length
  const mixed = aspects.filter((a)=>a.tone==='mixed').length
  const tight = [...aspects].sort((a,b)=>a.orb-b.orb).slice(0,4)
  const communication = aspects.filter((a)=>a.a==='Mercury'||a.b==='Mercury')
  const chemistry = aspects.filter((a)=>['Venus','Mars','Pluto'].includes(a.a)||['Venus','Mars','Pluto'].includes(a.b))
  const structure = aspects.filter((a)=>['Saturn','Jupiter','True Node'].includes(a.a)||['Saturn','Jupiter','True Node'].includes(a.b))
  const headline = challenging > supportive + 3 ? '강한 자극과 마찰이 함께 있는 관계 구조' : supportive > challenging + 3 ? '조화 접점이 상대적으로 많은 관계 구조' : '끌림·조화·긴장이 섞여 있는 복합 관계 구조'
  const communicationText = communication.length ? `소통 관련 접점이 ${communication.length}개 보여. ${communication.slice(0,2).map(relationshipAspectMeaning).join(' ')}` : '수성 관련 주요 접점이 상위권에 많지 않아. 대화 패턴은 다른 접점과 실제 경험을 같이 봐야 해.'
  const chemistryText = chemistry.length ? `끌림·추진력·강도 관련 접점이 ${chemistry.length}개야. ${chemistry.slice(0,2).map(relationshipAspectMeaning).join(' ')}` : '금성·화성·명왕성 관련 강한 접점이 상위권에 적어, 끌림 하나만으로 관계 전체를 설명하기는 어려워.'
  const stabilityText = structure.length ? `지속성·성장·반복 패턴 관련 접점이 ${structure.length}개야. ${structure.slice(0,2).map(relationshipAspectMeaning).join(' ')}` : '토성·목성·노드 관련 상위 접점이 적어 장기 지속성은 현재 계산만으로 강하게 단정하기 어려워.'
  const timing = partnerExact ? '두 사람의 정확한 출생시간·좌표가 있어 진행 시너스트리·데이비슨·마크스 타이밍까지 계산할 수 있어. 아래 접점 수는 사건 확률이 아니야.' : '상대 출생시간/장소가 없어서 진행 시너스트리·진행 컴포지트·데이비슨·마크스 타이밍은 계산에서 제외됐어. 0/0/0은 활성도 0이 아니라 정밀 타이밍 미계산이 맞아.'
  return <>
    <section className="relationship-reading-card">
      <span className="eyebrow">RELATIONSHIP READING</span><h3>{headline}</h3>
      <p className="relationship-overview">시너스트리에서 {aspects.length}개 접점이 잡혔고 조화 {supportive} · 긴장 {challenging} · 혼합 {mixed}이야. 이 숫자는 궁합 점수나 재회 확률이 아니라 두 차트가 어디에서 반복적으로 맞물리는지 보여주는 구조값이야. 오브가 좁을수록 그 주제가 체감되기 쉬워.</p>
      <div className="relationship-reading-grid"><article><strong>대화 · 소통</strong><p>{communicationText}</p></article><article><strong>끌림 · 자극</strong><p>{chemistryText}</p></article><article><strong>지속성 · 성장</strong><p>{stabilityText}</p></article><article><strong>타이밍 정밀도</strong><p>{timing}</p></article></div>
      <div className="relationship-key-aspects"><strong>가장 강한 접점</strong>{tight.map((aspect,index)=><div key={`${aspect.a}-${aspect.aspect}-${aspect.b}-${index}`}><b>{aspectText(aspect)} · 오브 {aspect.orb.toFixed(2)}°</b><p>{relationshipAspectMeaning(aspect)}</p></div>)}</div>
    </section>
    <div className="relationship-ai-toolbar"><button type="button" onClick={onAi} disabled={aiLoading}><Sparkles size={17}/><span>{aiLoading?'Gemini 관계 해석 중…':'Gemini 관계 정밀해석'}</span></button><small>원할 때만 AI 호출 · 완료 후 토큰/예상비용 표시</small></div>
    {aiError && <div className="status-banner error"><AlertTriangle size={16}/><span>{aiError}</span></div>}
    {ai?.ok && ai.data && <section className="relationship-ai-card"><span className="eyebrow">GEMINI RELATIONSHIP INTERPRETATION</span><h3>{ai.data.headline}</h3>{ai.usage?.total_tokens?<div className="relationship-ai-usage"><span>입력 {(ai.usage.prompt_tokens??0).toLocaleString()} · 출력 {(ai.usage.candidate_tokens??0).toLocaleString()} · 사고 {(ai.usage.thought_tokens??0).toLocaleString()} tokens</span><b>예상비용 ${Number(ai.usage.estimated_usd??0).toFixed(4)} ≈ {Math.round(ai.usage.estimated_krw??0).toLocaleString()}원</b></div>:null}<p className="relationship-ai-overview">{ai.data.overview}</p><div className="relationship-ai-grid"><article><strong>끌림 · 자극</strong><p>{ai.data.chemistry}</p></article><article><strong>대화 · 소통</strong><p>{ai.data.communication}</p></article><article><strong>지속성</strong><p>{ai.data.stability}</p></article><article><strong>긴장 포인트</strong><p>{ai.data.tensions}</p></article><article><strong>타이밍</strong><p>{ai.data.timing}</p></article><article><strong>재회 맥락</strong><p>{ai.data.reunion_context}</p></article></div>{!!ai.data.practical_advice?.length&&<div className="relationship-ai-advice"><strong>현실 조언</strong>{ai.data.practical_advice.map((x,i)=><p key={`${i}-${x}`}>{i+1}. {x}</p>)}</div>}{!!ai.data.top_aspects?.length&&<details open><summary>핵심 애스펙트 상세</summary>{ai.data.top_aspects.map((x,i)=><div className="relationship-ai-aspect" key={`${i}-${x.label}`}><b>{x.label}</b><p>{x.meaning}</p></div>)}</details>}{ai.data.limits&&<p className="relationship-ai-limits">{ai.data.limits}</p>}</section>}
  </>
}
'''
if 'function RelationshipInterpretationPanel' not in s:
    assert helper_anchor in s, 'helper anchor missing'
    s = s.replace(helper_anchor, helper_block, 1)

# State
state_anchor = "  const [relationshipError, setRelationshipError] = useState('')\n"
if 'const [relationshipAi,' not in s:
    assert state_anchor in s, 'state anchor missing'
    s = s.replace(state_anchor, state_anchor + "  const [relationshipAi, setRelationshipAi] = useState<RelationshipAiResponse | null>(null)\n  const [relationshipAiLoading, setRelationshipAiLoading] = useState(false)\n  const [relationshipAiError, setRelationshipAiError] = useState('')\n", 1)

# Reset AI when recalculating
reset = "    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null)\n"
if reset in s:
    s = s.replace(reset, "    setRelationshipError(''); setRelationshipResult(null); setRelationshipRequestSnapshot(null); setRelationshipAi(null); setRelationshipAiError('')\n", 1)

# AI invoke function
func_anchor = "\n\n  async function handleCopy(label: string, text: string) {"
if 'const runRelationshipAi = async () =>' not in s:
    assert func_anchor in s, 'handleCopy anchor missing'
    ai_func = r'''

  const runRelationshipAi = async () => {
    if (!relationshipResult) return
    setRelationshipAiLoading(true); setRelationshipAiError('')
    try {
      await ensureSupabaseSession()
      const { data, error } = await supabase.functions.invoke('relationship-interpret', { body: { calculation: relationshipResult, model: aiModel } })
      if (error) throw error
      const payload = data as RelationshipAiResponse
      if (!payload?.ok || !payload.data) throw new Error(payload?.error || '관계 AI 해설 응답이 비어 있어.')
      setRelationshipAi(payload)
    } catch (error) {
      setRelationshipAiError(error instanceof Error ? error.message : '관계 AI 해설을 불러오지 못했어.')
    } finally { setRelationshipAiLoading(false) }
  }
'''
    s = s.replace(func_anchor, ai_func + func_anchor, 1)

# Hide meaningless 0 timing when partner time unknown
s = s.replace("const resultMonths = relationshipResult?.result?.months ?? []", "const resultMonths = (relationshipResult?.result?.natal_synastry?.partner_time_exact ? relationshipResult?.result?.months : []) ?? []", 1)

# Insert panel before raw result
render_anchor = '              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}\n              <section className="result-card">\n'
if '<RelationshipInterpretationPanel' not in s:
    assert render_anchor in s, 'render anchor missing'
    panel = '''              {archiveStatus && <div className="status-banner subtle"><Cloud size={16}/><span>{archiveStatus}</span></div>}\n              <RelationshipInterpretationPanel aspects={natalAspects} partnerExact={Boolean(relationshipResult.result.natal_synastry?.partner_time_exact)} ai={relationshipAi} aiLoading={relationshipAiLoading} aiError={relationshipAiError} onAi={runRelationshipAi} />\n              {!relationshipResult.result.natal_synastry?.partner_time_exact && <section className="result-card timing-unavailable"><div className="result-card-title"><span>TIMING</span><strong>정밀 타이밍 계산 제외</strong></div><p>상대 출생시간·장소가 없어서 진행 시너스트리·진행 컴포지트·데이비슨·마크스 계열은 추정하지 않았어. 이전 화면의 0/0/0은 “아무 접점 없음”이 아니라 계산 불가를 잘못 표시한 거였어.</p></section>}\n              <section className="result-card">\n'''
    s = s.replace(render_anchor, panel, 1)

s = s.replace('<div className="result-card-title"><span>STATIC</span><strong>기본 관계 구조</strong></div>', '<div className="result-card-title"><span>RAW STRUCTURE</span><strong>계산 근거 · 시너스트리</strong></div>', 1)
s = s.replace("relationshipResult.result.limitations?.join(' ')", "relationshipResult.result.limitations?.map(relationshipLimitKo).join(' ')", 1)

p.write_text(s, encoding='utf-8')

main = Path('web/src/main.tsx')
ms = main.read_text(encoding='utf-8')
if "./relationship-analysis.css" not in ms:
    ms = ms.replace("import './ai-interpret.css'\n", "import './ai-interpret.css'\nimport './relationship-analysis.css'\n")
main.write_text(ms, encoding='utf-8')

Path('web/src/relationship-analysis.css').write_text('''.relationship-reading-card,.relationship-ai-card{margin-top:18px;border:1px solid rgba(126,102,156,.18);border-radius:28px;padding:22px;background:linear-gradient(145deg,rgba(251,247,255,.96),rgba(241,250,249,.94));box-shadow:0 12px 34px rgba(90,70,118,.07)}\n.relationship-reading-card h3,.relationship-ai-card h3{margin:6px 0 14px;font-size:25px;line-height:1.3;letter-spacing:-.035em;color:#342b3c}.relationship-overview,.relationship-ai-overview{font-size:17px;line-height:1.75;color:#514957;margin:0 0 16px}.relationship-reading-grid,.relationship-ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.relationship-reading-grid article,.relationship-ai-grid article{padding:16px;border-radius:20px;background:rgba(255,255,255,.76);border:1px solid rgba(132,112,151,.12)}.relationship-reading-grid strong,.relationship-ai-grid strong{font-size:17px;color:#4e4055}.relationship-reading-grid p,.relationship-ai-grid p{margin:8px 0 0;font-size:16px;line-height:1.7;color:#5d555f}.relationship-key-aspects{margin-top:16px;padding-top:16px;border-top:1px dashed rgba(122,102,141,.22)}.relationship-key-aspects>strong{font-size:18px}.relationship-key-aspects>div{margin-top:12px;padding:14px 15px;border-radius:18px;background:rgba(255,255,255,.72)}.relationship-key-aspects b{font-size:16px}.relationship-key-aspects p{font-size:15.5px;line-height:1.65;margin:7px 0 0;color:#655c66}.timing-unavailable{background:linear-gradient(145deg,rgba(255,248,237,.96),rgba(251,246,255,.95))}.timing-unavailable p{font-size:16px;line-height:1.7;color:#62575d}.relationship-ai-toolbar{margin:14px 0;display:flex;flex-direction:column;gap:7px}.relationship-ai-toolbar button{min-height:58px;border:1px solid rgba(132,109,166,.24);border-radius:20px;background:linear-gradient(120deg,#f0e5ff,#e0f5f3);font-size:17px;font-weight:800;color:#4c3c59;display:flex;align-items:center;justify-content:center;gap:9px}.relationship-ai-toolbar small{font-size:13px;color:#81767f;text-align:center}.relationship-ai-usage{display:flex;flex-direction:column;gap:5px;margin:12px 0 16px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.74);font-size:14px;line-height:1.5}.relationship-ai-usage b{font-size:16px;color:#6a4b74}.relationship-ai-advice{margin:15px 0;padding:16px;border-radius:20px;background:rgba(247,241,255,.78)}.relationship-ai-advice strong{font-size:17px}.relationship-ai-advice p{font-size:16px;line-height:1.65;margin:8px 0}.relationship-ai-card details{margin-top:16px}.relationship-ai-card summary{font-size:17px;font-weight:800}.relationship-ai-aspect{padding:14px 0;border-bottom:1px solid rgba(120,105,130,.12)}.relationship-ai-aspect b{font-size:16px}.relationship-ai-aspect p,.relationship-ai-limits{font-size:15px;line-height:1.7;color:#665e67}\n@media(max-width:560px){.relationship-reading-card,.relationship-ai-card{padding:19px 17px;border-radius:24px}.relationship-reading-card h3,.relationship-ai-card h3{font-size:23px}.relationship-overview,.relationship-ai-overview{font-size:16.5px}.relationship-reading-grid,.relationship-ai-grid{grid-template-columns:1fr}.relationship-reading-grid p,.relationship-ai-grid p{font-size:16px}}\n''', encoding='utf-8')

print('relationship interpretation patch ready')
