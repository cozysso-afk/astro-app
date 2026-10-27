import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

let server
let authored
let origin

test.before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  authored = (await server.ssrLoadModule('/src/lib/fortuneEditorialV3.ts')).buildGeminiAuthoredEditorialV23
  origin = (await server.ssrLoadModule('/src/lib/fortuneNarrativeOrigin.ts')).fortuneNarrativeOrigin
})
test.after(async () => { await server?.close() })

const section = (conclusion) => ({
  applicability: 'direct',
  conclusion,
  real_scene: '실제로 주말에 다음 만남을 제안한 기록이 있어.',
  action: '약속 장소와 날짜를 먼저 확인해.',
  change_condition: '상대가 약속을 취소하면 다음 판단을 보류해.',
})

test('unverified or unidentified model cannot be displayed as Gemini authored', () => {
  assert.equal(origin(''), 'deterministic_safe')
  assert.equal(origin(undefined), 'deterministic_safe')
  assert.equal(origin('mystery-fallback'), 'deterministic_safe')
  assert.equal(origin('gemini-3.6-flash'), 'gemini')
  assert.equal(origin('gemini-3.7-flash', 'deterministic_safe'), 'deterministic_safe')
})

test('Gemini authored-only builder never invents prose for missing sections', () => {
  const blank = { headline: '', overall: {summary:''}, topic_analysis:{}, clusters:{relationship:{}}, contact_flow:{} }
  const integrated = authored(blank)
  assert.equal(integrated.heroHeadline, '')
  assert.equal(integrated.heroSummary, '')
  assert.deepEqual(integrated.topicEditorial, {})
  const love = authored(blank, { id:'love', topics:['연애'] })
  assert.deepEqual(love.loveContexts, [])
  assert.equal(love.loveGeneral, '')
  const contact = authored(blank, { id:'contact', topics:['연락','소식'] })
  assert.equal(contact.contact, undefined)
})

test('Gemini text survives display projection without rewritten or invented sentences', () => {
  const headline = '말로만 오가던 요청을 담당자·마감·완료 기준까지 구체화하기 좋은 날이야.'
  const data = {
    headline, overall:{ summary:'실제 기록만으로 판단해.' },
    topic_analysis:{ 연애:{verdict:'연애는 서두르지 않는 편이 좋아.'}},
    clusters:{ relationship:{ love_general:section('관계를 서두를 필요는 없어.'), love_single:section('새로 알게 된 사람과는 만남을 조율하고 있어.') }},
    contact_flow:{incoming:'예상 연락은 미확정이야.',outgoing:'보낼 메시지를 구체화해.'}
  }
  const full = authored(data)
  assert.equal(full.heroHeadline, headline)
  assert.equal(full.heroSummary,'실제 기록만으로 판단해.')
  const love = authored(data,{id:'love', topics:['연애']})
  assert.equal(love.loveContexts?.length,1)
  assert.equal(love.loveContexts?.[0]?.key,'single')
  assert.match(love.loveContexts?.[0]?.text??'', /새로 알게 된 사람/)
  assert.doesNotMatch(JSON.stringify(love), /특정 상대가 없다면|알아가는 중이라면|친구·지인과는/)
})
