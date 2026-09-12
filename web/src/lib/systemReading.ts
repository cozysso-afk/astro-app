import { compactThaiProductSuriyayat } from '../../../supabase/functions/fortune-interpret-v6-preview/thaiContract'
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
  boriwan:{key:'boriwan',topic:'대인',title:'주변 사람 · 관계망',meaning:'주변 사람과 맺고 있는 연결을 읽는 영역이야. 일상에서는 누구와 자주 이야기하고, 어떤 부탁과 도움을 주고받는지로 구체화할 수 있어.',action:'누구와 연결돼 있고 어떤 도움이나 요청을 주고받는지 살펴봐.',limit:'애정 성립이나 상대의 접근을 예측하지 않아.'},
  ayu:{key:'ayu',topic:'컨디션',title:'생활력 · 지속',meaning:'생활을 꾸준히 이어가는 리듬을 읽는 영역이야. 하루를 버티는 강도보다 며칠이고 유지할 수 있는 일정과 회복 시간을 돌아보는 데 써.',action:'수면과 일정, 회복 시간을 함께 돌아보고 지속 가능한 강도를 정해.',limit:'건강 상태나 질병을 판단하는 자료는 아니야.'},
  det:{key:'det',topic:'직업',title:'권한 · 추진력',meaning:'일을 움직일 권한과 책임을 읽는 영역이야. 내가 결정할 범위가 분명한지, 다른 사람과 조율해야 하는 부분은 어디인지 구분해 볼 수 있어.',action:'혼자 결정할 수 있는 일과 협의가 필요한 일을 나눠봐.',limit:'승진이나 성공 가능성을 나타내지 않아.'},
  sri:{key:'sri',topic:'전체',title:'번영 · 호조의 맥락',meaning:'번영과 호조라는 주제를 다루는 영역이야. 지금 잘 유지되는 생활 조건과 관계를 찾아, 무엇을 지키고 키울지 생각하는 관점으로 읽어.',action:'지금 잘 유지되는 자원과 관계를 살피는 질문으로 활용해.',limit:'최종 길흉 판단은 계산되지 않았어.'},
  mula:{key:'mula',topic:'금전',title:'기반 · 자원',meaning:'생활을 지탱하는 기반과 자원을 읽는 영역이야. 돈뿐 아니라 쓸 수 있는 시간과 공간, 이미 갖춘 조건까지 함께 돌아볼 수 있어.',action:'계획을 지탱하는 예산, 시간과 생활 조건을 함께 점검해.',limit:'수입이나 투자 가격을 예측하지 않아.'},
  utsaha:{key:'utsaha',topic:'학업',title:'노력 · 실행',meaning:'계획을 행동으로 옮기고 이어가는 과정을 읽는 영역이야. 공부나 업무에서는 얼마나 크게 시작하느냐보다 반복할 수 있는 작업 단위를 찾는 질문으로 연결돼.',action:'큰 목표를 반복 가능한 작업 단위로 나누고 실제 진행 상황을 기록해.',limit:'시험 합격이나 업무 성과를 확정하지 않아.'},
  montri:{key:'montri',topic:'대인',title:'지원 · 조력',meaning:'도움과 협력을 읽는 영역이야. 필요한 조언을 누구에게 구할 수 있는지, 혼자 하던 일을 어떻게 나눌 수 있는지 돌아볼 수 있어.',action:'혼자 해결하기 어려운 부분은 질문을 구체화해 협력자에게 전달해.',limit:'특정 인물의 등장이나 호의를 예언하지 않아.'},
  kalakini:{key:'kalakini',topic:'전체',title:'마찰 · 주의',meaning:'진행을 막는 마찰과 부담을 살피는 영역이야. 같은 곳에서 자꾸 막힌다면 시간 부족인지, 자원 문제인지, 의견 차이인지 나눠서 생각해볼 수 있어.',action:'막히는 부분이 시간, 자원, 의견 차이 중 어디에서 생기는지 구분해.',limit:'사고나 실패를 예측하는 자료가 아니야.'},
}

type Segment = { segment_start?:string; segment_end_exclusive?:string }
// Retain exact solar-term boundaries; never select by calendar_month alone.
export function overlapsSegment(row: Segment, period: IntegratedApiResponse['period']) {
  if (!row.segment_start || !row.segment_end_exclusive) return false
  // Segment timestamps use the calculation's local time. Compare against local
  // midnight, retaining an intraday solar-term boundary on the selected date.
  const local = (value: string) => value.length === 10 ? value+'T00:00:00' : value.slice(0,19)
  return local(row.segment_start) <= period.end+'T23:59:59' && local(row.segment_end_exclusive) > period.start+'T00:00:00'
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
  const sajuSummary = contexts.length ? [...new Set(contexts.map(row=>`${row.layer} ${row.ganzhi}의 ${row.stem_ten_god}은 ${tenGodLens(row.stem_ten_god)?.title ?? '계산된 십성'} 맥락이야.`))].slice(0, 3).join(' ') + (contexts.length > 3 ? ' 나머지 절기 구간은 아래에서 날짜별로 이어서 볼 수 있어.' : '') : '선택 기간과 연결된 운 구간이 없어 해석을 확장하지 않았어.'
  const thaiSummary = wheels.length ? `이 기간에는 주변 사람과 도움을 주고받는 방식을 살펴볼 수 있어. ${wheels.length>1?'생일을 기준으로 연간 배치가 바뀌므로 구간을 나눠 읽어.':'선택 기간은 하나의 연간 배치 안에 있어.'} 아래 생활 영역에서 관계망, 실행, 자원, 마찰을 각각 살펴봐.` : natalWheel.length ? '출생 때의 배치를 관계망·생활력·자원 등 여덟 생활 영역으로 나눠 읽어. 지금 잘되고 못되는 일을 예측하기보다 각 영역을 돌아보는 질문으로 활용할 수 있어.' : '이 기간에 읽을 수 있는 태국점성술 배치가 없어.'
  const suriyayat = thai?.suriyayat ? compactThaiProductSuriyayat(thai.suriyayat) : null
  return { suriyayat, allowed, saju, thai, monthly, annual, dayun, contexts, lenses, wheels, natalWheel, sajuSummary, thaiSummary, state:'서로 다른 층' as const }
}
export const THREE_SYSTEM_INSTRUCTIONS = '계산 권위는 별빛의 운명 엔진이며 너는 해석자다. 재계산·새 점수·데이터 밖 근거 생성 금지. 점수는 확률이 아니다. 실제 자료가 있는 Western·Saju·Thai를 각각 설명하고 근거의 결합과 충돌, 현실 발현·행동·주의·과해석 한계를 종합하라. 사주·Thai를 한 줄 부록으로 축소하지 말라. 세 체계는 독립적이며 합산하거나 강제로 일치시키지 않는다. 미계산 신강·용신·배우자성, Thai 최종 길흉·사건 확률·정확한 예측 시각을 만들지 말라. 연락 수신/발신은 분리한다. 투자 가격·수익 예측 금지. 일간은 실제 하루, 주간은 실제 구간 변화, 월간은 실제 월운/절 경계, 연간은 실제 대운/세운/월 구간을 사용하라.'

export const SAJU_LIFE_KEYS: Record<LifeTopic,string[]> = {전체:Object.keys(TEN_GOD_LENSES),애정:Object.keys(TEN_GOD_LENSES),대인:['식상','비겁'],학업:['인성','식상','관성'],직업:['관성','식상','재성'],금전:['재성'],컨디션:[]}
export const THAI_LIFE_KEYS: Record<LifeTopic,string[]> = {전체:Object.keys(BHUMI_LENSES),애정:['boriwan','sri','montri','kalakini'],대인:['boriwan','montri','kalakini'],학업:['utsaha','montri'],직업:['det','utsaha','montri'],금전:['mula','sri','kalakini'],컨디션:['ayu']}
export function compactSystemPrompt(packet: Record<string,unknown>) {
  for(const limit of [12,8,4,2,1]) {
    const compact = Object.fromEntries(Object.entries(packet).map(([key,value])=>[key,Array.isArray(value)?value.slice(0,limit):value]))
    const text=`${THREE_SYSTEM_INSTRUCTIONS}\n선택 체계와 분야만 상담형으로 해설하라. 다른 체계의 계산을 가져오지 말라. 생략된 구간은 추정하지 말라.\nCALCULATED_DATA=${JSON.stringify(compact)}`
    if(text.length<=7500)return text
  }
  throw new Error('핵심 근거가 7,500자를 넘어 복사하지 못했어. 더 좁은 기간을 선택해줘.')
}

/** Display-only translation; preserve original packet labels and engine values. */
export function thaiPlanetLabel(value:string) {
 const names:Record<string,string>={Sun:'태양',Moon:'달',Mercury:'수성',Venus:'금성',Mars:'화성',Jupiter:'목성',Saturn:'토성',Rahu:'라후'}
 const name=Object.keys(names).find(k=>value.toLowerCase().includes(k.toLowerCase()))
 return name?names[name]:value
}
export function thaiLifeSummary(keys:string[]) {
 const meanings:Record<string,string>={boriwan:'주변 사람과 어떤 도움을 주고받는지',ayu:'무리 없이 이어갈 생활 리듬은 무엇인지',det:'내가 결정할 일과 협의할 일은 무엇인지',sri:'현재 잘 유지되는 조건은 무엇인지',mula:'시간과 돈을 어디에 배분하고 있는지',utsaha:'계획이 실제 실행으로 이어지는지',montri:'필요한 도움을 누구에게 요청할 수 있는지',kalakini:'반복해서 막히는 조건은 무엇인지'}
 return keys.filter(k=>meanings[k]).slice(0,3).map(k=>meanings[k]).join(', ')+' 살펴보는 관점이야. 아래에서 각 영역의 배치와 읽는 방법을 함께 볼 수 있어.'
}

// Topic-specific explanation of an already calculated ten-god group.
// No spouse-star, strength, favourable-element or event inference is added.
export function lensForTopic(lens: Lens, topic: LifeTopic): Lens {
  if (topic !== '애정') return lens
  const relationship: Record<string, [string,string,string]> = {
    인성:['마음을 받아들이는 방식','상대의 말과 관계 경험을 어떻게 받아들이고 이해하는지 살피는 맥락이야. 다가가려는 마음이 있어도 나에게 편안한 거리와 시간이 필요한지 함께 볼 수 있어.','혼자 해석한 뜻과 실제로 들은 말을 구분하고, 이해되지 않는 부분은 물어봐.'],
    관성:['관계의 약속과 책임','관계에서 기대하는 약속과 책임을 살피는 맥락이야. 가까워지고 싶은 마음과 어느 정도의 관계를 약속할지는 구분해서 이야기할 수 있어.','연락 빈도나 만남 방식, 관계의 이름에 서로 같은 기대를 갖는지 확인해.'],
    재성:['함께 쓸 시간과 현실 조건','관계에 쓸 수 있는 시간과 여유, 생활 조건을 살피는 맥락이야. 호감이 있어도 일정이나 거리 때문에 만남을 구체화하기 어려운지 함께 봐.','만날 수 있는 시간과 이동 부담을 구체적으로 맞춰봐.'],
    식상:['호감과 의사를 표현하는 방식','생각과 호감을 말이나 행동으로 드러내는 맥락이야. 표현이 많아지는 것과 상대가 같은 뜻으로 받아들이는 것은 다를 수 있어.','안부인지 만남 제안인지 원하는 뜻을 분명하게 전하고 상대의 답을 들어봐.'],
    비겁:['내 기준과 관계의 균형','관계 안에서 내 기준을 지키면서 상대와 균형을 맞추는 맥락이야. 친근함이 있어도 각자가 원하는 거리와 관계 방식이 다를 수 있어.','맞춰줄 수 있는 부분과 지키고 싶은 경계를 구체적으로 말해봐.'],
  }
  const copy = relationship[lens.key]
  return copy ? {...lens,title:copy[0],meaning:copy[1],action:copy[2],limit:'계산된 십성을 관계의 생활 맥락으로 읽은 해설이야. 배우자성·상대 마음·연애 성립을 판정한 결과는 아니야.'} : lens
}

export function thaiPlacementComparison(current: {bhumi_key:string;planet:{label:string}}, natal: Array<{bhumi_key:string;planet:{label:string}}>, isNatal: boolean): string {
  const title = BHUMI_LENSES[current.bhumi_key]?.title
  if (!title) return ''
  const now = thaiPlanetLabel(current.planet.label)
  if (isNatal) return `출생 배치에서 ${title} 영역은 ${now}에 놓여 있어. 이 배치는 선택한 날짜가 바뀌어도 같은 출생 배경이야.`
  const before = natal.find(row=>row.bhumi_key===current.bhumi_key)
  if (!before) return `선택한 연간 구간의 ${title} 영역은 ${now}에 놓여 있어. 비교할 출생 배치는 없어.`
  const birth = thaiPlanetLabel(before.planet.label)
  return birth === now
    ? `선택한 연간 구간의 ${title} 영역은 ${now}으로, 출생 배치와 같아. 같은 영역이 유지되는 배치이며 운이 강화됐다는 뜻은 아니야.`
    : `출생 때 ${birth}에 놓인 ${title} 영역이 선택한 연간 구간에서는 ${now}으로 바뀌어. 출생 배경과 현재 구간을 나눠 읽되, 이 이동 자체를 호전·악화로 판정하지는 않아.`
}
