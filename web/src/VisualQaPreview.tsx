import { ReunionHierarchyPanel } from './ReunionHierarchyPanel'
import { hierarchyView } from './lib/reunionHierarchy'
import { ReadingTimeline } from './ReadingSignals'
import { westernRankCopy } from './lib/westernRankCopy'
import { useEffect, useRef, useState } from 'react'
import { exportReadingImages } from './lib/readingImageExport'
import { installReadingPresentationV5 } from './lib/readingPresentationV5'
import { BirthTimeReliabilityFields } from './BirthTimeReliabilityFields'
import type { BirthProfile } from './appTypes'

function TopicCard({
  title,
  summary,
  action,
  reason,
  technical,
  timing,
  caution,
}: {
  title: string
  summary: string
  action: string
  reason: string
  technical: string
  timing: string
  caution: string
}) {
  return <article className="period-ai-topic">
    <strong>{title}</strong>
    <b>{summary}</b>
    <p>{action}</p>
    <details className="reading-topic-depth">
      <summary>왜 이렇게 보나</summary>
      <div className="reading-explanation is-reason"><span className="reading-explanation-label">이유</span><p>{reason}</p></div>
      <div className="reading-reason-more"><p>{technical}</p></div>
      <div className="reading-explanation is-timing"><span className="reading-explanation-label">시기</span><p>{timing}</p></div>
      <div className="reading-explanation is-caution"><span className="reading-explanation-label">주의</span><p>{caution}</p></div>
    </details>
  </article>
}

export function VisualQaPreview() {
  const exportRoot = useRef<HTMLElement | null>(null)
  const [ready, setReady] = useState(false)
  const [exportState, setExportState] = useState('idle')
  const [birthProfile, setBirthProfile] = useState<BirthProfile>({
    name:'QA', birthDate:'1992-02-29', birthTime:'21:25', placeKey:'', latitude:'37.5665', longitude:'126.9780', utcOffset:'9', gender:'female',
    timeSource:'rectified', timeConfidence:'low', rectifiedWindowStart:'19:55', rectifiedWindowEnd:'22:55',
  })

  useEffect(() => {
    installReadingPresentationV5()
    const timer = window.setTimeout(() => setReady(true), 120)
    return () => window.clearTimeout(timer)
  }, [])

  const saveFixture = async () => {
    if (!exportRoot.current || exportState === 'working') return
    setExportState('working')
    try {
      const result = await exportReadingImages(exportRoot.current, '오늘 운세')
      setExportState(`done:${result.pages}`)
    } catch (error) {
      setExportState(`error:${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return <main className="app-shell visual-qa-preview" data-qa-ready={ready ? 'true' : 'false'} style={{maxWidth:760,margin:'0 auto',padding:'18px 16px 100px'}}>
    <header style={{marginBottom:20}}>
      <strong>별빛의 운명 · 자동 시각 QA</strong>
      <p style={{margin:'6px 0 0'}}>실사용자가 캡처하지 않아도 모바일 카드 높이와 저장 이미지 결과를 CI에서 검수하기 위한 고정 fixture.</p>
    </header>

    <section data-qa-block="birth-time-range" style={{marginBottom:28}}>
      <h3>생시 범위 모바일 너비</h3>
      <div className="field-grid">
        <BirthTimeReliabilityFields value={birthProfile} onChange={patch=>setBirthProfile(current=>({...current,...patch}))}/>
      </div>
    </section>

    <section className="system-reading system-integrated" data-qa-block="systems" style={{marginBottom:28}}>
      <section className="system-overview">
        <h3>세 체계 한눈에</h3>
        <div className="system-overview-grid">
          <article className="system-western"><strong>서양점성술</strong><p>오늘은 컨디션을 중심으로 봐. 무리해서 끌고 가기보다 쉬는 시간을 먼저 확보해.</p><small>점수는 사건 확률이 아니라 같은 기간 안에서의 상대적 강약이야.</small></article>
          <article className="system-saju"><strong>사주</strong><p>이번 기간의 사주 흐름은 계산됐지만, 이 분야까지 바로 연결할 근거는 부족해. 사주 탭에서 적용된 운 구간을 확인해줘.</p><small>간지·십성은 사주 탭의 계산 근거에서 따로 확인할 수 있어.</small></article>
          <article className="system-thai"><strong>태국점성술</strong><p>수면·일정·회복 시간을 무리 없이 유지할 수 있는지 차례로 확인해봐.</p><small>행성 이름과 배치는 태국점성술 탭의 계산 상세에서 확인해.</small></article>
        </div>
      </section>
    </section>

    <section data-qa-block="interpretation-v2" style={{marginBottom:28}}>
      <h3>해설 품질 회귀 검증</h3>
      <p>{westernRankCopy([['연애',{average:25,band:'약함',spread:0,best_days:[],caution_days:[]}],['연락',{average:20,band:'약함',spread:0,best_days:[],caution_days:[]}],['재회',{average:30,band:'약함',spread:0,best_days:[],caution_days:[]}]],'오늘')}</p>
      <ReadingTimeline context={{now:new Date('2026-10-11T14:08:00Z'),timeZone:'Asia/Seoul',referenceDate:'2026-10-11'}} events={[
        {date:'15:30–17:00',kind:'favorable',label:'연락 · 당시 대화 활성 구간',status:'진행 후보'},
        {date:'23:00–23:30',kind:'mixed',label:'연애 · 호감과 만남의 속도를 구분하는 구간'},
        {date:'23:30–23:59',kind:'favorable',label:'재회 · 과거 인연의 재접촉 관련 구간'},
      ]}/>
    </section>

    <section className="relationship-experience" data-mode="reunion" data-qa-block="reunion" style={{marginBottom:28}}>
      <ReunionHierarchyPanel hierarchyData={hierarchyView({
        version:'qa',as_of_date:'2026-10-22',validation:{status:'PASS',checks:[]},
        stages:{
          emotional_reactivation:{label:'의식',activation:76,candidate_count:1},
          contact_recontact:{label:'연락',activation:59,candidate_count:4},
          in_person_meeting:{label:'만남',activation:null,candidate_count:0},
          relationship_rebuilding:{label:'재구축',activation:32,candidate_count:1},
        },
        top_periods:[{date:'2026-12-22',start:'2026-12-20',end:'2026-12-24',stage:'relationship_rebuilding',label:'관계 재구축',final:32,components:{long_term:10,mid_term:10,event_trigger:10,cross_system:2,final:32}}],
        current_windows:[],past_windows:[],nearest_window:null,limitations:[],score_meaning:'상대 강도',
      })!}
        observation={{state:'messaging',initiator:'user',events:[]}}
        evidence={[]} reunionV2={{
          summary:'연락은 다시 이어졌지만 실제 만남과 관계 합의는 아직 별도 단계다.',
          consultation_answer:{
            current_stage:'현재 연락과 대화는 확인됐다.', contact_type_if_any:'대화 재개는 확인됐다.', initiative:'실제 첫 연락은 사용자가 먼저 했다.',
            continuity:'안부를 넘어 질문과 답이 이어지는지 확인해야 한다.', meeting_gate:'이번 기간에는 실제 만남을 뒷받침하는 뚜렷한 시기가 없다.',
            rebuild_gate:'만남 전 단계가 비어 있어 관계 재구축 신호만으로 재회로 올려 읽지 않는다.',
            behavior_change_evidence:'이전 갈등을 피하지 않고 구체적인 약속을 제안하고 지키는지가 변화의 증거다.',
            next_stage_up_conditions:['날짜와 장소가 정해진 만남 제안이 실제로 오간다.','만난 뒤 다음 연락과 약속이 한 번 이상 이어진다.'],
            down_conditions:['안부와 추억 이야기만 반복되고 만남 제안은 피한다.','불편한 문제를 꺼낼 때 다시 대화가 끊긴다.'],
            repeat_risks:['관계를 정의하지 않은 채 감정 확인만 반복한다.'],
            contextual_application:{complete_cutoff:'',no_contact:'',occasional_contact:'',meeting_again:'',ambiguous_relationship:''},evidence_refs:[],
          },
          why_reconnect:{conclusion:'서로를 다시 의식하게 만드는 정서적 잔존감은 남아 있다.',interpretation:'예전 대화를 다시 꺼내거나 익숙한 안부로 연결되는 장면으로 나타날 수 있다. 다만 익숙함이 곧 이전 문제의 해결을 뜻하지는 않는다.',evidence_refs:[]},
          initiative:{conclusion:'방향 점수 차이는 작다.',interpretation:'실제 첫 연락 기록과 계산 활성도는 나눠 읽는다.',evidence_refs:[]},
          timing:{conclusion:'다음 관문은 실제 만남이다.',windows:[],evidence_refs:[]},
          rebuild:{conclusion:'관계를 다시 시작하려면 연락 횟수보다 만남과 관계 정의가 필요하다.',conditions:['구체적인 만남 약속을 잡고 지킨다.','이전 갈등을 다루는 방식을 함께 합의한다.'],evidence_refs:[]},
          repeat_risks:{conclusion:'가장 큰 위험은 모호한 연락을 관계 회복으로 착각하는 것이다.',patterns:['명확한 약속 없이 감정 교류만 길어진다.'],evidence_refs:[]},
          convergence:[],precision_note:'상대 활성도이며 사건 확률이 아니다.',
        }}
        directionRows={[{kind:'incoming',label:'상대 차트',score:21.1,band:'약함',text:'활성도 21.1'},{kind:'outgoing',label:'내 차트',score:24.1,band:'약함',text:'활성도 24.1'}]}
        sustainabilityText="다시 시작해도 이전 문제를 다루는 방식이 달라지지 않으면 같은 지점에서 대화가 끊길 수 있어요."/>
    </section>

    <section ref={node => { exportRoot.current = node }} data-reading-export-root="period-fortune" className="fortune-experience period-ai-v4" data-qa-block="export-source">
      <span className="reading-period-date">2026-10-02</span>
      <div className="period-ai-head"><div><span className="period-ai-kicker">맞춤 운세 해설 · 오늘 핵심</span><h3>오늘 이직 문제는 가능성을 열어 두고 현실 조건부터 비교해. 오늘은 집중이 쉽게 흐어질 수 있어.</h3><p className="reading-hero-subtitle">막연한 이동 욕구보다 직무·보상·일정 같은 실제 조건을 비교하기 좋은 날이야. 집중이 흐어지면 여러 과제를 벌이기보다 하나를 끝내는 쪽이 나아.</p></div></div>
      <div className="system-overview-grid qa-export-system-source" aria-hidden="true" style={{position:'absolute',left:-10000,top:0,width:640,opacity:0,pointerEvents:'none'}}>
        <article><strong>서양점성술</strong><p>이직 조건은 열어 두되 실제 직무·보상·일정을 먼저 비교해.</p></article>
        <article><strong>사주</strong><p>완료 기준과 기한을 먼저 잡고 넓히기보다 하나를 끝내는 쪽에 무게가 실려.</p></article>
        <article><strong>태국점성술</strong><p>일정과 회복 여유를 먼저 확인하고 무리하게 범위를 넓히지 않는 편이 좋아.</p></article>
      </div>
      <section className="period-ai-user-focus">
        <div className="period-ai-topic-list">
          <TopicCard title="학업" summary="오늘은 집중이 쉽게 흐어질 수 있어. 목표를 넓히기보다 끝낼 단위를 하나로 좁혀." action="실제로는 공부할 분량을 작게 나눠 한 번에 하나씩 처리해." reason="시작 자체보다 집중을 오래 유지하는 쪽에서 마찰이 생기기 쉬워." technical="달과 화성이 긴장을 만들고 수성의 흐름이 분산되는 배치가 겹쳐, 같은 시간 안에서도 이해가 이어지는 단원과 반복해서 막히는 단원이 갈릴 수 있어." timing="오전 후반부터 오후에는 새 범위를 넓히기보다 복습과 오답 정리가 더 안정적이야." caution="막히는 단원이 생겼다고 공부 전체가 안 되는 날로 확대해석하지 마." />
          <TopicCard title="투자주의" summary="오늘 투자 쪽은 평소보다 더 보수적으로 보는 게 좋아. 가격 하락을 예고하는 해석은 아니야." action="실제로는 결정 전에 손실 한도와 중단 기준을 먼저 정해." reason="선택 기간에 투자주의 쪽 마찰 신호가 상대적으로 강하게 모여 있어." technical="수성과 금성이 서로 마주 보는 배치에 토성의 움직임이 겹쳐 판단과 기대 사이의 간격을 키울 수 있어. 개별 근거가 있어도 이 분야 전체 흐름은 강한 편이야." timing="장중에는 이미 움직인 가격을 따라가기보다 정한 기준을 다시 확인하는 쪽이 유리해." caution="손실을 빨리 만회하려고 규모를 키우지 마." />
          <TopicCard title="신규진입" summary="오늘은 신규 진입을 미루고 가격·손실 한도·진입 이유가 모두 맞는지 확인해." action="들어갈 가격과 틀렸을 때 나올 기준을 함께 적어." reason="기회 상실에 대한 조급함보다 조건 충족 여부를 먼저 확인해야 하는 흐름이야." technical="단기 촉발 신호보다 확인 신호가 우세해서 바로 진입을 확정할 근거는 부족해." timing="다음 거래 판단 전까지 조건표를 다시 확인해." caution="기회를 놓친다는 생각만으로 기준을 낮추지 마." />
        </div>
      </section>
      <section className="period-ai-user-windows">
        <div className="reading-event-list"><ol>
          <li><time>13:45–14:30</time><div className="reading-event"><span className="reading-state">확인 필요</span><p>투자주의 · 위험 노출과 손실 한도를 점검.</p></div></li>
          <li><time>12:45–13:30</time><div className="reading-event"><span className="reading-state">확인 필요</span><p>신규진입 · 급한 진입보다 조건 점검.</p></div></li>
        </ol></div>
      </section>
      <button type="button" data-qa-export onClick={saveFixture} style={{marginTop:20,minHeight:44,width:'100%'}}>저장 이미지 QA 생성</button>
      <output data-qa-export-status style={{display:'block',marginTop:8}}>{exportState}</output>
    </section>
  </main>
}
