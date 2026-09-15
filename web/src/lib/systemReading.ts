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
const GANZHI_READINGS: Record<string,string> = {甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계',子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해'}
export function ganzhiWithReading(value: string) {
  const text = String(value ?? '').trim()
  if (!text || text.includes('(')) return text
  const chars = [...text]
  const readings = chars.map(char=>GANZHI_READINGS[char])
  return readings.every(Boolean) ? `${text}(${readings.join('')})` : text
}

// Mahathaksa/Taksajorn areas are translated into everyday Korean only.
// Planet placement remains calculation evidence; this layer does not invent a
// benefic/malefic score or a planet-specific event prediction.
export const BHUMI_LENSES: Record<string,Lens> = {
  boriwan:{key:'boriwan',topic:'대인',title:'주변 사람 · 관계망',meaning:'가족·친구·동료처럼 자주 마주치는 사람, 내가 챙기는 사람, 부탁과 도움을 주고받는 관계를 보는 영역이야.',action:'요즘 자주 연락하거나 함께 움직이는 사람을 떠올리고, 부탁·도움·책임이 한쪽으로만 쏠리지 않는지 확인해.',limit:'새 인연의 등장이나 상대의 행동을 예측하는 영역은 아니야.'},
  ayu:{key:'ayu',topic:'컨디션',title:'생활 리듬 · 지속',meaning:'몸 상태를 좋다·나쁘다로 판정하기보다 수면, 일정, 식사, 회복 시간을 무리 없이 이어갈 수 있는지 보는 영역이야.',action:'이번 일정에서 꼭 해야 할 일과 미뤄도 되는 일을 나누고, 잠과 쉬는 시간을 먼저 확보해.',limit:'질병이나 건강 상태를 진단하는 자료는 아니야.'},
  det:{key:'det',topic:'직업',title:'주도권 · 책임',meaning:'일이나 역할에서 내가 결정할 수 있는 범위, 책임져야 할 부분, 다른 사람과 조율해야 할 부분을 보는 영역이야.',action:'내가 바로 결정할 일과 합의가 필요한 일을 나눠 적고, 책임 범위가 모호한 일은 기준부터 맞춰.',limit:'승진·합격·성공 여부를 예측하는 값은 아니야.'},
  sri:{key:'sri',topic:'전체',title:'평판 · 여유 · 호조',meaning:'평판, 관계의 편안함, 돈과 생활 여유처럼 현재 잘 유지되고 있는 조건을 찾아 무엇을 지킬지 보는 영역이야.',action:'최근 무리 없이 잘 굴러가는 관계나 자원을 하나 고르고, 더 벌이기보다 먼저 유지할 방법을 정리해.',limit:'행운의 크기나 금전 이득을 점수로 판정한 결과는 아니야.'},
  mula:{key:'mula',topic:'금전',title:'돈 · 생활 기반',meaning:'현금만이 아니라 집, 저축, 시간, 공간처럼 생활을 오래 지탱하는 기반과 자원을 보는 영역이야.',action:'이번 계획에 필요한 돈·시간·공간을 같이 적고, 부족한 기반이 무엇인지 먼저 확인해.',limit:'수입 증가나 투자 가격을 예측하는 자료는 아니야.'},
  utsaha:{key:'utsaha',topic:'학업',title:'노력 · 실행',meaning:'계획을 실제 행동으로 옮기고 꾸준히 반복하는 과정을 보는 영역이야. 공부나 업무에서는 시작 규모보다 계속할 수 있는 단위가 중요해.',action:'큰 목표를 오늘 반복할 수 있는 작업으로 잘게 나누고, 실제로 끝낸 양을 기록해.',limit:'시험 합격이나 업무 성과를 확정하는 뜻은 아니야.'},
  montri:{key:'montri',topic:'대인',title:'도움 · 조력',meaning:'혼자 해결하지 않아도 되는 일, 조언을 구할 사람, 역할을 나눌 수 있는 협력 관계를 보는 영역이야.',action:'막혀 있는 일을 하나 고르고 누구에게 무엇을 부탁할지 구체적인 문장으로 정리해.',limit:'특정 조력자의 등장이나 호의를 예언하는 영역은 아니야.'},
  kalakini:{key:'kalakini',topic:'전체',title:'마찰 · 걸림돌',meaning:'반복해서 막히거나 부담이 커지는 부분을 찾아 원인이 시간 부족인지, 자원 문제인지, 관계 조율인지 구분해 보는 영역이야.',action:'최근 두 번 이상 막힌 일을 하나 골라 원인을 시간·돈·정보·사람 중 어디에 가까운지 나눠봐.',limit:'사고·불운·실패가 생긴다고 단정하는 값은 아니야.'},
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
  const sajuSummary = contexts.length ? [...new Set(contexts.map(row=>`${row.layer} ${ganzhiWithReading(row.ganzhi)}의 ${row.stem_ten_god}은 ${tenGodLens(row.stem_ten_god)?.title ?? '계산된 십성'} 맥락이야.`))].slice(0, 3).join(' ') + (contexts.length > 3 ? ' 나머지 절기 구간은 아래에서 날짜별로 이어서 볼 수 있어.' : '') : '선택 기간과 연결된 운 구간이 없어 해석을 확장하지 않았어.'
  const thaiSummary = wheels.length ? `선택한 기간에 적용되는 타크사 연간 배치를 여덟 생활 영역으로 나눠 볼 수 있어. 주변 사람과 관계망, 생활 리듬, 일, 자원, 실행, 도움, 걸림돌 중 필요한 부분부터 펼쳐봐.` : natalWheel.length ? '출생 때의 타크사 배치를 여덟 생활 영역으로 나눠 볼 수 있어. 각 영역은 생활에서 무엇을 확인하면 되는지 먼저 보여줘.' : '이 기간에 읽을 수 있는 태국점성술 배치가 없어.'
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
 const meanings:Record<string,string>={boriwan:'가족·친구·동료와 부탁과 도움을 어떻게 주고받는지',ayu:'수면·일정·회복 시간을 무리 없이 유지할 수 있는지',det:'내가 결정할 일과 남과 조율할 일을 어디서 나눌지',sri:'지금 잘 유지되는 평판·관계·자원 중 무엇을 지킬지',mula:'돈·집·시간 같은 생활 기반이 충분한지',utsaha:'계획을 반복 가능한 행동으로 옮기고 있는지',montri:'조언이나 도움을 누구에게 요청할 수 있는지',kalakini:'반복해서 막히는 조건이 시간·자원·관계 중 어디인지'}
 const selected=[...new Set(keys)].filter(k=>meanings[k]).slice(0,4).map(k=>meanings[k])
 return selected.length ? `${selected.join(', ')} 차례로 확인해봐.` : '이 분야와 연결된 생활 영역 자료가 없어.'
}

export function thaiPeriodLabel(start:string,end:string) {
  return start===end ? `선택 날짜의 연간 배치 · ${start}` : `선택 기간의 연간 배치 · ${start}–${end}`
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
  if (isNatal) return `계산 근거 · 출생 배치에서 ${title} = ${now}`
  const before = natal.find(row=>row.bhumi_key===current.bhumi_key)
  if (!before) return `계산 근거 · 현재 연간 배치에서 ${title} = ${now}`
  const birth = thaiPlanetLabel(before.planet.label)
  return birth === now
    ? `계산 근거 · ${title}: 출생 ${birth} → 현재 연간 ${now} · 같은 행성`
    : `계산 근거 · ${title}: 출생 ${birth} → 현재 연간 ${now}`
}