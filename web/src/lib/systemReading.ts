import type { IntegratedApiResponse } from '../appTypes'
import { fortuneAiPrecisionReadiness } from './precisionTransport'

export type SystemId = 'integrated' | 'western' | 'saju' | 'thai'
export type LifeTopic = '전체' | '애정' | '대인' | '학업' | '직업' | '금전' | '컨디션'
export type Lens = { key: string; topic: LifeTopic; title: string; meaning: string; action: string; limit: string }
// Explicit presentation crosswalk. No scores, spouse-star rules, or strength inference.
export const TEN_GOD_LENSES: Record<string, Lens> = {
  '인성': {key:'인성',topic:'학업',title:'학습과 문서 정리',meaning:'배우고 받아들이며 자료를 정리하는 맥락이야. 진도를 얼마나 나갔는지뿐 아니라 이해한 내용을 다시 설명할 수 있는지가 중요해.',action:'자료를 늘리기 전에 핵심 내용을 정리하고, 부족한 부분을 질문이나 복습으로 채워.',limit:'시험 결과나 성적 상승을 보장하는 뜻은 아니야.'},
  '관성': {key:'관성',topic:'직업',title:'책임과 평가 기준',meaning:'맡은 역할과 규칙, 평가 기준을 다루는 맥락이야. 새로운 일을 벌이는 문제와 이미 맡은 책임을 마무리하는 문제를 나눠 읽어야 해.',action:'업무의 완료 기준과 기한을 구체적으로 정리해. 책임 범위가 모호한 요청은 조건부터 맞추는 게 도움이 돼.',limit:'승진·취업이나 결혼 상대의 출현으로 연결하지 않아.'},
  '재성': {key:'재성',topic:'금전',title:'자원과 현실 조건',meaning:'돈과 시간 같은 자원을 배분하고 실무 조건을 다루는 맥락이야. 자원에 관심이 향하는 것과 실제 수입이 늘어나는 것은 다른 문제야.',action:'수입 기대보다 지출 의무, 사용할 수 있는 시간과 예산을 함께 적어 비교해.',limit:'가격 방향이나 투자 수익을 예측하는 자료가 아니야.'},
  '식상': {key:'식상',topic:'대인',title:'표현과 결과물',meaning:'생각을 말이나 결과물로 옮기는 맥락이야. 내 표현이 활발해지는 것과 상대가 그 뜻을 그대로 받아들이는 것은 구분해야 해.',action:'전하려는 내용을 구체적인 제안이나 작은 결과물로 보여줘. 상대가 이해한 내용을 다시 들어보면 간극을 줄일 수 있어.',limit:'호응이나 관계 진전을 확정하는 신호로 읽지 않아.'},
  '비겁': {key:'비겁',topic:'대인',title:'동료와 자기주도',meaning:'내 기준을 세우고 동료와 역할을 나누는 맥락이야. 협력과 경쟁이 모두 포함될 수 있어, 어느 한쪽으로 단정하기 어려워.',action:'함께 하는 일에서는 기여와 책임을 나눠 적고, 내 판단을 지킬 부분과 조율할 부분을 구분해.',limit:'갈등이나 손실이 생긴다는 예고는 아니야.'},
}
const GODS: Record<string,string> = {'比肩(비견)':'비겁','劫財(겁재)':'비겁','食神(식신)':'식상','傷官(상관)':'식상','偏財(편재)':'재성','正財(정재)':'재성','七殺(칠살·편관)':'관성','正官(정관)':'관성','偏印(편인)':'인성','正印(정인)':'인성'}
export function tenGodLens(value: string): Lens | undefined { return TEN_GOD_LENSES[GODS[value]] }
export const BHUMI_LENSES: Record<string,Lens> = {
  boriwan:{key:'boriwan',topic:'대인',title:'주변 사람 · 관계망',meaning:'Boriwan은 주변 사람과 관계망을 살피는 영역이야. 배치된 행성은 이 체계 안의 위치를 보여주며, 상대의 마음이나 연락 여부를 알려주는 점수는 아니야.',action:'누구와 연결돼 있고 어떤 도움이나 요청을 주고받는지 살펴봐.',limit:'애정 성립이나 상대의 접근을 예측하지 않아.'},
  ayu:{key:'ayu',topic:'컨디션',title:'생활력 · 지속',meaning:'Ayu는 생활을 지속하는 힘을 돌아보는 영역이야. 몸 상태를 진단하기보다 일상에서 유지할 수 있는 리듬을 살피는 맥락으로 읽어.',action:'수면과 일정, 회복 시간을 함께 돌아보고 지속 가능한 강도를 정해.',limit:'건강 상태나 질병을 판단하는 자료는 아니야.'},
  det:{key:'det',topic:'직업',title:'권한 · 추진력',meaning:'Det는 권한과 추진을 다루는 영역이야. 일을 움직일 책임과 결정 범위를 생각하는 데 사용할 수 있어.',action:'혼자 결정할 수 있는 일과 협의가 필요한 일을 나눠봐.',limit:'승진이나 성공 가능성을 나타내지 않아.'},
  sri:{key:'sri',topic:'전체',title:'번영 · 호조의 맥락',meaning:'Sri는 이 체계에서 번영과 호조를 뜻하는 영역 이름이야. 여기에 행성이 배치됐다는 사실만으로 이번 기간이 좋다고 판정하지는 않아.',action:'지금 잘 유지되는 자원과 관계를 살피는 질문으로 활용해.',limit:'최종 길흉 판단은 계산되지 않았어.'},
  mula:{key:'mula',topic:'금전',title:'기반 · 자원',meaning:'Mula는 생활의 기반과 자원을 다루는 영역이야. 자원이 들어온다는 예측보다 무엇을 기반으로 움직이는지 살펴보는 맥락이야.',action:'계획을 지탱하는 예산, 시간과 생활 조건을 함께 점검해.',limit:'수입이나 투자 가격을 예측하지 않아.'},
  utsaha:{key:'utsaha',topic:'학업',title:'노력 · 실행',meaning:'Utsaha는 노력을 실제 행동으로 이어가는 영역이야. 공부나 업무의 지속을 돌아볼 수 있지만, 노력의 결과를 보장하지는 않아.',action:'큰 목표를 반복 가능한 작업 단위로 나누고 실제 진행 상황을 기록해.',limit:'시험 합격이나 업무 성과를 확정하지 않아.'},
  montri:{key:'montri',topic:'대인',title:'지원 · 조력',meaning:'Montri는 도움과 조력을 다루는 영역이야. 도움을 받을 사람이 나타난다고 단정하기보다 이미 이용할 수 있는 지원을 살피는 맥락으로 읽어.',action:'혼자 해결하기 어려운 부분은 질문을 구체화해 협력자에게 전달해.',limit:'특정 인물의 등장이나 호의를 예언하지 않아.'},
  kalakini:{key:'kalakini',topic:'전체',title:'마찰 · 주의',meaning:'Kalakini는 마찰과 주의를 다루는 영역 이름이야. 배치 자체를 불운으로 읽지 않고, 진행을 어렵게 만드는 조건을 따로 살피는 데 사용해.',action:'막히는 부분이 시간, 자원, 의견 차이 중 어디에서 생기는지 구분해.',limit:'사고나 실패를 예측하는 자료가 아니야.'},
}

type Segment = { segment_start?:string; segment_end_exclusive?:string }
// Retain exact solar-term boundaries; never select by calendar_month alone.
export function overlapsSegment(row: Segment, period: IntegratedApiResponse['period']) {
  return !!row.segment_start && !!row.segment_end_exclusive && row.segment_start.slice(0,10) <= period.end && row.segment_end_exclusive.slice(0,10) >= period.start && row.segment_end_exclusive > period.start
}
export function buildSystemReading(c: IntegratedApiResponse) {
  const readiness = fortuneAiPrecisionReadiness(c)
  const allowed = readiness.ok && readiness.mode === 'exact'
  const saju = allowed && c.saju?.ok ? c.saju : undefined
  const thai = allowed && c.thai?.ok ? c.thai : undefined
  const monthly = (saju?.monthly ?? []).filter(r=>overlapsSegment(r,c.period))
  const annual = (saju?.annual ?? []).filter(r=>overlapsSegment(r,c.period))
  const dayun = (saju?.dayun ?? []).filter(r=>r.start_year<=Number(c.period.end.slice(0,4)) && r.end_year>=Number(c.period.start.slice(0,4)))
  const contexts = [...monthly.map(r=>({...r,layer:'월운'})),...annual.map(r=>({...r,layer:'세운'}))]
  const lenses = [...new Set(contexts.map(r=>tenGodLens(r.stem_ten_god)?.key).filter(Boolean))].map(key=>TEN_GOD_LENSES[key!])
  const segments = thai?.taksajorn?.available ? thai.taksajorn.segments.filter(r=>r.start.slice(0,10)<=c.period.end && r.end.slice(0,10)>=c.period.start) : []
  const natalWheel = thai?.mahathaksa?.available ? thai.mahathaksa.wheel.filter(r=>BHUMI_LENSES[r.bhumi_key]) : []
  const wheels = segments.map(r=>({...r,wheel:r.wheel.filter(w=>BHUMI_LENSES[w.bhumi_key])}))
  const sajuSummary = contexts.length ? `${contexts[0].layer}의 ${contexts[0].stem_ten_god}은 ${tenGodLens(contexts[0].stem_ten_god)?.title ?? '계산된 십성'} 맥락이야.${contexts.length>1?' 아래에서 다른 운 구간과 함께 읽어볼 수 있어.':''}` : '선택 기간과 연결된 운 구간이 없어 해석을 확장하지 않았어.'
  const thaiSummary = wheels.length ? `이 기간의 Taksajorn은 ${wheels.length}개 구간이야. 연간 Boriwan은 ${wheels.map(r=>r.annual_boriwan.label).join(' → ')}로 기록돼 있어. 주변 사람과 환경을 살피는 배치이며 사건 예측은 아니야.` : natalWheel.length ? '출생 Mahathaksa의 8영역을 생활 맥락으로 읽을 수 있어. 이 배치만으로 선택 기간의 길흉을 정하지 않아.' : '이 기간에 읽을 수 있는 Thai 배치가 없어.'
  return { allowed, saju, thai, monthly, annual, dayun, contexts, lenses, wheels, natalWheel, sajuSummary, thaiSummary, state:'서로 다른 층' as const }
}
export const THREE_SYSTEM_INSTRUCTIONS = '계산 권위는 별빛의 운명 엔진이며 너는 해석자다. 재계산·새 점수·데이터 밖 근거 생성 금지. 점수는 확률이 아니다. 실제 자료가 있는 Western·Saju·Thai를 각각 설명하고 근거의 결합과 충돌, 현실 발현·행동·주의·과해석 한계를 종합하라. 사주·Thai를 한 줄 부록으로 축소하지 말라. 세 체계는 독립적이며 합산하거나 강제로 일치시키지 않는다. 미계산 신강·용신·배우자성, Thai 최종 길흉·사건 확률·정확한 예측 시각을 만들지 말라. 연락 수신/발신은 분리한다. 투자 가격·수익 예측 금지. 일간은 실제 하루, 주간은 실제 구간 변화, 월간은 실제 월운/절 경계, 연간은 실제 대운/세운/월 구간을 사용하라.'

export const SAJU_LIFE_KEYS: Record<LifeTopic,string[]> = {전체:Object.keys(TEN_GOD_LENSES),애정:['식상','비겁'],대인:['식상','비겁'],학업:['인성','식상','관성'],직업:['관성','식상','재성'],금전:['재성'],컨디션:[]}
export const THAI_LIFE_KEYS: Record<LifeTopic,string[]> = {전체:Object.keys(BHUMI_LENSES),애정:['boriwan','sri','montri','kalakini'],대인:['boriwan','montri','kalakini'],학업:['utsaha','montri'],직업:['det','utsaha','montri'],금전:['mula','sri','kalakini'],컨디션:['ayu']}
export function compactSystemPrompt(packet: Record<string,unknown>) {
  for(const limit of [12,8,4,2,1]) {
    const compact = Object.fromEntries(Object.entries(packet).map(([key,value])=>[key,Array.isArray(value)?value.slice(0,limit):value]))
    const text=`${THREE_SYSTEM_INSTRUCTIONS}\n선택 체계와 분야만 상담형으로 해설하라. 다른 체계의 계산을 가져오지 말라. 생략된 구간은 추정하지 말라.\nCALCULATED_DATA=${JSON.stringify(compact)}`
    if(text.length<=7500)return text
  }
  throw new Error('핵심 근거가 7,500자를 넘어 복사하지 못했어. 더 좁은 기간을 선택해줘.')
}
