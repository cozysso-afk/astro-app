import { useEffect, useRef, useState } from 'react'
import { exportReadingImages } from './lib/readingImageExport'
import { installReadingPresentationV5 } from './lib/readingPresentationV5'

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

    <section className="reunion-ui-v3" data-qa-block="reunion" style={{marginBottom:28}}>
      <h3>재회 카드 높이 QA</h3>
      <section className="reunion-v3-meaning">
        <article className="reunion-v3-card"><h4>왜 다시 생각날 수 있나</h4><p>공유된 진행 차트의 조화각과 상호 정서적 접점이 다시금 서로를 의식하게 만드는 배경을 형성하고 있어.</p></article>
        <article className="reunion-v3-card"><h4>재회를 판단할 현실 기준</h4><p>연락이 닿더라도 실제 만남과 안정적 재결합으로 이어지기 위해서는 질문과 답이 이어지는지, 구체적인 약속을 잡는지, 예전 문제를 피하지 않고 다르게 다루는지가 함께 확인되어야 해.</p></article>
      </section>
      <section className="reunion-v3-situations">
        <div className="period-ai-section-title"><span>내 현재 상황에 맞춰 읽기</span><strong>연락 상태가 다르면 같은 결과도 의미가 달라</strong></div>
        <article className="reunion-v3-situation"><strong>현재 완전 단절·차단 상태라면</strong><p>연락 신호가 있어도 차단 상태 자체를 넘어서는 행동을 예측하지 않아.</p></article>
        <article className="reunion-v3-situation"><strong>가끔 연락하거나 안부를 주고받는 중이라면</strong><p>연락 횟수보다 질문과 답이 이어지는지, 구체적인 약속을 잡는지, 예전 문제를 피하지 않는지를 구분해.</p></article>
        <article className="reunion-v3-situation"><strong>이미 다시 만나고 있거나 관계가 애매하다면</strong><p>연락 지수보다 만남 뒤 관계 정의와 반복 문제를 다루는 행동이 있는지가 더 중요해.</p></article>
      </section>
    </section>

    <section ref={node => { exportRoot.current = node }} data-reading-export-root="period-fortune" className="fortune-experience period-ai-v4" data-qa-block="export-source">
      <span className="reading-period-date">2026-10-02</span>
      <div className="period-ai-head"><div><span className="period-ai-kicker">맞춤 운세 해설 · 오늘 핵심</span><h3>오늘 이직 문제는 가능성을 열어 두고 현실 조건부터 비교해. 오늘은 집중이 쉽게 흐어질 수 있어.</h3><p className="reading-hero-subtitle">막연한 이동 욕구보다 직무·보상·일정 같은 실제 조건을 비교하기 좋은 날이야. 집중이 흐어지면 여러 과제를 벌이기보다 하나를 끝내는 쪽이 나아.</p></div></div>
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
