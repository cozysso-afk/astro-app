import { ReunionHierarchyPanel } from './ReunionHierarchyPanel'
import { DailyReadingQaPreview } from './DailyReadingQaPreview'
import { hierarchyView } from './lib/reunionHierarchy'
import { ReadingTimeline } from './ReadingSignals'
import { useState } from 'react'
import App from './AppNext'
import { BirthTimeReliabilityFields } from './BirthTimeReliabilityFields'
import type { BirthProfile } from './appTypes'

export function VisualQaPreview() {
  if (new URLSearchParams(location.search).get('screen') === 'partner-form') return <App/>
  return <ReadingFixtures/>
}
function ReadingFixtures() {
  const [birthProfile, setBirthProfile] = useState<BirthProfile>({
    name:'QA', birthDate:'1992-02-29', birthTime:'21:25', placeKey:'', latitude:'37.5665', longitude:'126.9780', utcOffset:'9', gender:'female',
    timeSource:'rectified', timeConfidence:'low', rectifiedWindowStart:'19:55', rectifiedWindowEnd:'22:55',
  })

  return <main className="app-shell visual-qa-preview" data-qa-ready="true" style={{maxWidth:760,margin:'0 auto',padding:'18px 16px 100px'}}>
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
    <DailyReadingQaPreview/>

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
      <h3>시기 표시 검수</h3>
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
        evidence={[]}
        directionRows={[{kind:'incoming',label:'상대 차트',score:21.1,band:'약함',text:'활성도 21.1'},{kind:'outgoing',label:'내 차트',score:24.1,band:'약함',text:'활성도 24.1'}]}
/>
    </section>

  </main>
}
