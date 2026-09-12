import type { IntegratedApiResponse } from '../appTypes'
import { fortuneAiPrecisionReadiness, sanitizeCalculationForExternalAi } from './precisionTransport'
// A dating-only creative view. Never reuse the personal-marriage spouse model.
// Creative image crosswalk, explicitly not an anatomical astrology claim.
export const DATING_VISUAL_STYLES = {
 Venus: {mood:'부드럽고 정돈된 분위기',height:'중간 키 느낌의 연출',body:'슬림~보통의 부드러운 실루엣',face:'모서리가 완만한 계란형 연출',eyes:'차분하고 부드러운 눈매',nose:'자연스러운 콧대',mouth:'미소가 드러나는 입매',hair:'자연스럽게 정돈한 머리',fashion:'미니멀하고 편안한 옷차림',first:'편안하게 말을 걸 수 있는 인상',closer:'표정과 작은 반응이 살아나는 분위기',animal:'사슴상 · 시각적 비유',attractions:['부드러운 눈매','미소','정돈된 스타일'],reference:'편안한 미소와 미니멀한 스타일 · 특정 인물과 무관한 무드 참조',en:'soft oval facial styling, gentle eyes, natural nose, warm smile, neatly relaxed hair, understated clothing'},
 Mars: {mood:'선명하고 활동적인 분위기',height:'중간~큰 키 느낌의 연출',body:'보통~탄탄한 실루엣',face:'윤곽이 또렷한 얼굴형 연출',eyes:'시선이 또렷한 눈매',nose:'선이 분명한 콧대',mouth:'표정이 생동하는 입매',hair:'가볍고 움직임 있는 머리',fashion:'활동적인 캐주얼과 정돈된 핏',first:'자기 표현이 분명한 인상',closer:'장난기와 생동감이 드러나는 분위기',animal:'고양이상 · 시각적 비유',attractions:['또렷한 시선','활동적인 실루엣','생동하는 표정'],reference:'활동적인 캐주얼과 선명한 인상 · 특정 인물과 무관한 무드 참조',en:'defined facial styling, expressive eyes, naturally defined nose, lively expression, relaxed textured hair, active casual clothing'},
} as const
export function buildDatingArchetype(input: IntegratedApiResponse) {
  const ready=fortuneAiPrecisionReadiness(input)
  const safe=sanitizeCalculationForExternalAi(input) as IntegratedApiResponse
  const evidence=ready.ok ? (safe.western.daily_scores??[]).filter(d=>d.date>=safe.period.start&&d.date<=safe.period.end)
    .flatMap(d=>(d.evidence??[]).filter(e=>e.source_topics?.some(t=>['연애','연락'].includes(t)) && ['Venus','Mars'].includes(String(e.transit))).map(e=>({date:d.date,planet:e.transit,aspect:e.aspect,target:e.target}))) : []
  const signatures=[...new Map(evidence.map(e=>[`${e.planet}:${e.aspect}:${e.target}`,e])).values()].slice(0,3)
  const style: keyof typeof DATING_VISUAL_STYLES | undefined=signatures.find(e=>e.planet==='Venus')?'Venus':signatures.find(e=>e.planet==='Mars')?'Mars':undefined
  const visual=style ? DATING_VISUAL_STYLES[style] : undefined
  // Transit evidence can support the scene's theme, not a future person's anatomy.
  return {kind:'dating_partner' as const,title:'다음 연애상대 느낌',signatures,precision:ready.ok&&ready.mode==='exact'?'검증된 생시':'생시 제한 · 분위기만',
    summary:signatures.length?'선택 기간의 연애·연락 근거를 바탕으로 첫 만남 장면을 상상해볼 수 있어. 행성의 움직임만으로 다음 사람의 얼굴이나 몸을 알아내는 것은 아니야.':'현재 계산에는 다음 사람의 외형을 연결할 근거가 없어. 외모를 만들어 예측하는 대신, 원하는 장면의 연출을 직접 골라볼 수 있어.',
    appearanceSupported:false,visual,style,visualPolicy:'실제 금성/화성 연결을 그림의 부드러움/활동성에 대응한 오락용 연출 규칙이야. 신체 측정이나 미래 인물의 외모를 계산한 결과는 아니야.',fields:['키 범위','체형','얼굴형','눈매','코','입매','헤어','동물상','연예인 무드','매력 포인트 TOP 3','내가 끌릴 포인트'],
    limit:'외모는 실제 미래 인물을 맞히는 예측이 아니라, 관계·취향을 재미로 시각화하는 영역이야. 이 모델은 배우자상과 별개야.'}
}
export function defaultDatingPartnerGender(profileGender:unknown):'male'|'female'|'neutral' {
 return profileGender==='female'?'male':profileGender==='male'?'female':'neutral'
}
export type PortraitOptions={gender?:'male'|'female'|'neutral';style:'real'|'dream'|'illustration';frame:'face'|'half'|'full';outfit:'daily'|'date'|'meeting'}
// Editorial mood references, never evidence of a future person's identity or attractiveness.
export function datingCelebrityReference(style: keyof typeof DATING_VISUAL_STYLES, gender: PortraitOptions['gender']) {
 const references = {
  Venus: {male:'정해인의 부드러운 미소 · 공유의 편안하고 단정한 스타일',female:'정유미의 편안한 미소 · 김고은의 담백한 분위기'},
  Mars: {male:'박서준의 활동적인 캐주얼 · 이제훈의 또렷한 인상',female:'한소희의 선명한 눈매 · 김세정의 생동감 있는 표정'},
 }
 return gender==='male'||gender==='female' ? references[style][gender] : '상대 성별을 고르면 그에 맞는 연예인 분위기 참고를 볼 수 있어.'
}
// Closed vocabulary: no name or free-form appearance field enters the image prompt.
export function datingPortraitPrompt(options:PortraitOptions,language:'ko'|'en',style?:keyof typeof DATING_VISUAL_STYLES) {
 const person=options.gender ?? 'neutral'
 const subjectKo={male:'성인 남성',female:'성인 여성',neutral:'성인 인물'}[person]
 const subjectEn={male:'adult man',female:'adult woman',neutral:'adult person'}[person]
 const visual=style ? DATING_VISUAL_STYLES[style] : undefined
 const features=visual ? [visual.face,visual.eyes,visual.nose,visual.mouth,visual.hair,visual.fashion].join(', ') : ''
 const ko={style:{real:'자연스러운 매력이 있는 사람의 일상 실사 · 과한 보정 없음',dream:'달빛처럼 은은한 몽환적 실사',illustration:'섬세한 일러스트'},frame:{face:'얼굴 중심',half:'상반신',full:'전신'},outfit:{daily:'편안한 일상복',date:'단정한 데이트룩',meeting:'첫 만남의 자연스러운 옷차림'}}
 const en={style:{real:'unretouched everyday candid photograph with natural, approachable charm',dream:'soft moonlit dreamy photorealism',illustration:'delicate illustration'},frame:{face:'face portrait',half:'half-body composition',full:'full-body composition'},outfit:{daily:'relaxed everyday outfit',date:'neat date outfit',meeting:'natural first-meeting outfit'}}
 return language==='ko'?`실존 인물이나 미래 배우자가 아닌 가상의 한국인 ${subjectKo}. ${ko.style[options.style]}, ${ko.frame[options.frame]}, ${ko.outfit[options.outfit]}. ${features}. ${person==='male'?'깔끔하게 면도한 얼굴. ':''}편안한 일상 배경과 부드러운 자연광. 자연스러운 피부결. 현실적인 비율 안에서 깔끔하고 호감 가는 분위기. 주름이나 피로감을 일부러 더하지 않고 피부를 플라스틱처럼 매끈하게 만들지 않는다. 특정 연예인을 닮게 하지 말 것. 얼굴과 신체는 창작 모델의 연출이며 계산된 예측이 아니다.`:`A fictional Korean ${subjectEn}, not a real person or a predicted future spouse. ${en.style[options.style]}, ${en.frame[options.frame]}, ${en.outfit[options.outfit]}. ${visual?.en ?? ''}. ${person==='male'?'Clean-shaven face. ':''}Relaxed everyday surroundings and soft daylight. Natural skin texture, realistic proportions with neat, approachable charm. Do not add wrinkles, tiredness or artificially aged features. No plastic-smooth skin or beauty filters. Do not resemble a particular celebrity. Face and body are artistic choices, not calculated predictions.`
}
