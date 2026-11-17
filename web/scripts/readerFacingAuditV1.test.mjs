import test from 'node:test'
import assert from 'node:assert/strict'
import { auditReaderFacing, isDefinitionOnly } from './readerFacingAuditV1.mjs'

const codes = (data, kind) => auditReaderFacing(data, { kind }).map(x => x.code)

test('the 2026-11-17 annual reading fails for the reasons the reader saw', () => {
  const data = {
    headline: '약속과 지출의 기준을 다시 세우는 한 해',
    limits: '제공된 특정 날짜 표본을 바탕으로 한 해석이며 일 년 전체의 연속된 사건을 보장하지 않아.',
    systems: { western: '하늘을 지나는 수성이 네 출생 수성과 사분위를 이루며 생각과 표현의 엇갈림을 짚어내. 달이 마주 보며 감정의 파도를 키울 수 있으니 차분한 대응이 필요해.' },
    year_phases: [],
    system_field_readings: [
      { system: 'saju', topic: '금전', reading: '편재의 작용은 고정적인 수입 외에 융통하고 굴리는 재물에 대한 관심을 뜻해.', evidence_refs: ['S:daily:2026-01-20'] },
      { system: 'thai', topic: '대인관계', reading: '브리완은 주변을 둘러싼 대인관계와 인연망을 상징해.', evidence_refs: ['T:taksajorn:1:2026-01-01'] },
    ],
    domain_answers: Array.from({ length: 30 }, (_, i) => ({ topic: '금전', question_key: 'q' + i, answer: '', status: 'not_calculated' })),
    investment_reading: { psychology: '', realization: '', entry: '', risk: '' },
  }
  const found = codes(data, 'annual')
  for (const code of ['READER_INTERNAL_WORDING', 'SYSTEM_FIELD_MISSING', 'SYSTEM_FIELD_DEFINITION_ONLY', 'LONG_PERIOD_FROM_ONE_DAY_PILLAR',
    'ANNUAL_FROM_FAST_PLANET', 'ANNUAL_WITHOUT_PHASES', 'QUESTIONS_MOSTLY_UNANSWERED', 'INVESTMENT_EMPTY']) assert.ok(found.includes(code), code)
})

test('a period-sized, written reading passes', () => {
  const field = topic => [
    { system: 'saju', topic, reading: `올해 세운에 편관이 들어와서 ${topic}에서 맡는 몫이 커져. 기준을 먼저 정하면 덜 흔들려.`, evidence_refs: ['S:annual:1:2026-02-04'] },
    { system: 'thai', topic, reading: `탁사쫀에서 ${topic}을 맡는 자리에 목성이 있어서 기회가 넓어져. 하나를 골라 오래 붙잡아 봐.`, evidence_refs: ['T:taksajorn:1:2026-01-01'] },
  ]
  const data = {
    headline: '맡은 몫이 커지는 만큼 기준을 세우는 한 해',
    systems: { western: '토성이 출생 수성과 사분각을 이루는 봄부터 여름까지 말과 문서에 책임이 실려. 목성이 금성과 삼분각을 이루는 가을에는 사람과 돈이 순하게 풀려.' },
    year_phases: [{ theme: 'a', change: 'b' }, { theme: 'c', change: 'd' }, { theme: 'e', change: 'f' }],
    system_field_readings: ['연애', '대인관계', '학업', '직장', '금전', '컨디션'].flatMap(field),
    domain_answers: [{ topic: '금전', question_key: 'timing', answer: '9~10월에 들어오는 돈이 커져.', status: 'direct' }],
    investment_reading: { psychology: '욕심이 앞서기 쉬워.', realization: '', entry: '', risk: '' },
  }
  assert.deepEqual(codes(data, 'annual'), [])
})

test('definitions, polite endings and jargon are caught', () => {
  assert.equal(isDefinitionOnly('웃사하는 노력과 실행을 상징해.'), true)
  assert.equal(isDefinitionOnly('웃사하는 노력과 실행을 상징해. 이번 달엔 반복해서 붙잡는 일이 성과로 남아.'), false)
  const found = codes({ headline: '두 사람은 직접 만났어요.', overall: { summary: '마크스 차트나 데이비슨 차트 등 정밀한 보조 층은 다루지 못했어.' } }, 'day')
  assert.ok(found.includes('READER_POLITE_ENDING'))
  assert.ok(found.includes('READER_JARGON'))
})
