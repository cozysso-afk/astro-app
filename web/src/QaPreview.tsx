import { useState } from 'react'

type Tab = 'daily' | 'weekly' | 'reunion'

const card: React.CSSProperties = {
  borderRadius: 28,
  border: '1px solid rgba(110,90,140,.14)',
  background: 'linear-gradient(135deg, rgba(255,255,255,.94), rgba(244,240,255,.86))',
  boxShadow: '0 14px 35px rgba(84,66,110,.10)',
  padding: '24px 22px',
  marginBottom: 18,
}

const pill = (active:boolean): React.CSSProperties => ({
  borderRadius: 999,
  border: active ? '1.5px solid #7f54a6' : '1px solid rgba(110,90,140,.18)',
  background: active ? 'rgba(129,89,168,.10)' : 'rgba(255,255,255,.75)',
  padding: '11px 16px',
  fontWeight: 700,
  color: active ? '#6f448e' : '#555064',
})

function Daily() {
  return <>
    <section style={card}>
      <div style={{fontSize:14,fontWeight:800,color:'#7b4f92',marginBottom:12}}>맞춤 운세 해설 · 오늘 핵심</div>
      <div style={{fontSize:14,color:'#737080',marginBottom:16}}>2026-09-21</div>
      <h2 style={{fontSize:26,lineHeight:1.55,margin:'0 0 18px'}}>대인관계에서 오늘 가장 눈에 띄는 건 대화의 요점과 실제 합의를 맞추는 쪽이야. 한 번의 말투나 답장만으로 관계 전체를 결론 내리지 않는 편이 좋아.</h2>
      <p style={{fontSize:16,lineHeight:1.75,color:'#66616f',margin:0}}>말·정리 자극의 정점은 지났지만 여운이 남아 있어. 오늘은 대인관계에서 움직일 장면과 학업에서 한 번 더 확인할 장면이 갈려. 점수보다 아래 실제 상황 설명을 먼저 봐.</p>
    </section>
    <section style={card}>
      <h3 style={{marginTop:0}}>한눈에 보는 흐름</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[['대인관계','58','말의 요점보다 실제 합의가 남는지 확인'],['이직','55','관심 표현이 실제 조건·일정으로 이어지는지 보기'],['학업','41','계획을 늘리기보다 끝낸 분량부터 확인'],['연락','41','답장 속도보다 대화가 이어질 여지가 있는지 보기']].map(([t,s,m])=><div key={t} style={{padding:16,borderRadius:20,background:'rgba(255,255,255,.82)',border:'1px solid rgba(90,80,120,.10)'}}><div style={{fontWeight:800,fontSize:18}}>{t} <span style={{float:'right'}}>{s}</span></div><div style={{marginTop:10,lineHeight:1.5,color:'#625e69'}}>{m}</div></div>)}
      </div>
    </section>
  </>
}

function Weekly() {
  return <>
    <section style={card}>
      <div style={{fontSize:14,fontWeight:800,color:'#7b4f92',marginBottom:12}}>맞춤 운세 해설 · 이번 주 핵심</div>
      <div style={{fontSize:14,color:'#737080',marginBottom:16}}>2026-09-21 → 2026-09-27</div>
      <h2 style={{fontSize:26,lineHeight:1.55,margin:'0 0 18px'}}>이번 주는 초반에 사람과 역할을 맞추는 일이 먼저 생기고, 중반의 압박을 지나 후반에는 미뤄둔 일과 공부를 실제로 끝내는 쪽으로 무게가 옮겨가.</h2>
      <p style={{fontSize:16,lineHeight:1.75,color:'#66616f',margin:0}}>주초에는 관계와 책임 범위를 정리하는 일이 눈에 띄고, 중반에는 해야 할 일과 마음의 속도가 엇갈릴 수 있어. 후반으로 갈수록 직장·학업처럼 결과가 남는 일에 집중하기 쉬워져. 같은 조언을 7일 반복하기보다 이번 주 안에서 무엇이 먼저 오고 무엇이 뒤따르는지를 보는 해설이야.</p>
    </section>
    <section style={card}>
      <h3 style={{marginTop:0}}>초반 → 중반 → 후반</h3>
      <p style={{lineHeight:1.8}}><b>초반</b> · 사람과 일정 조율. 말보다 역할·약속을 구체화.</p>
      <p style={{lineHeight:1.8}}><b>중반</b> · 목표 압박이 올라오기 쉬움. 한꺼번에 벌이지 말고 우선순위 정리.</p>
      <p style={{lineHeight:1.8,marginBottom:0}}><b>후반</b> · 직장·학업 실행력 회복. 미뤄둔 일을 실제 결과로 마무리.</p>
    </section>
  </>
}

function Reunion() {
  return <>
    <section style={card}>
      <div style={{fontSize:14,fontWeight:800,color:'#7b4f92',marginBottom:12}}>재회 흐름 · 사람말 해설 QA</div>
      <h2 style={{fontSize:26,lineHeight:1.55,margin:'0 0 18px'}}>다시 대화가 열릴 여지는 있지만, 지금은 ‘감정이 남아 있는가’와 ‘실제로 관계를 다시 만들 수 있는가’를 따로 봐야 하는 흐름이야.</h2>
      <p style={{fontSize:16,lineHeight:1.8,color:'#5f5b66'}}>둘 사이에는 다시 신경 쓰이거나 이야기를 확인하고 싶은 자극이 살아 있어. 다만 그 감정이 바로 선연락이나 재결합을 뜻하는 건 아니야. 현재 흐름에서는 감정 재활성화가 먼저이고, 연락·만남·관계 재구축은 각각 다음 관문으로 남아 있어.</p>
    </section>
    {[
      ['지금 두 사람 사이에서 살아 있는 흐름','서로를 완전히 지운 상태라기보다, 과거 관계를 다시 떠올리거나 아직 끝나지 않은 대화를 의식하기 쉬운 쪽이야. 다만 현재 계산만으로 누가 먼저 연락할지는 가르기 어렵고, 생각이 난다는 것과 행동에 옮긴다는 것은 구분해서 봐야 해.'],
      ['왜 다시 신경 쓰이거나 연결될 수 있나','정서적 유대와 대화 욕구를 다시 자극하는 근거가 겹쳐 있어. 그래서 무관심보다는 “한 번쯤 다시 확인하고 싶은 마음”이 살아나기 쉬워. 하지만 좋은 기억이 올라오는 것과 예전 갈등이 해결됐다는 건 다른 문제야.'],
      ['지금 어디까지 와 있나','현재는 감정 활성 → 연락 → 만남 → 재구축 중 앞단이 더 살아 있는 흐름이야. 연락이 생겨도 그 자체를 재회 확정으로 읽지 않고, 대화가 이어지는지와 실제 만남이 잡히는지를 다음 확인 신호로 봐.'],
      ['연락이 닿은 뒤, 재회까지는 뭐가 남나','다시 연결되더라도 예전처럼 감정이 커지는 속도보다 현실적인 규칙과 의사소통 방식이 먼저 정리돼야 해. 누가 옳았는지를 따지는 대화보다 앞으로 연락 빈도·거리·약속을 어떻게 맞출지가 더 중요해.'],
      ['다시 멀어질 수 있는 지점','가까워진 직후 상대 반응을 과하게 해석하거나, 한 번의 냉담함을 관계 전체 결론으로 키우면 예전 패턴이 재현되기 쉬워. 다시 붙는 것보다 “붙은 뒤 같은 방식으로 깨지지 않는가”가 실제 재회 판단의 핵심이야.'],
    ].map(([h,b])=><section key={h} style={card}><h3 style={{marginTop:0,fontSize:21}}>{h}</h3><p style={{fontSize:16,lineHeight:1.85,color:'#5f5b66',marginBottom:0}}>{b}</p></section>)}
  </>
}

export function QaPreview(){
  const [tab,setTab]=useState<Tab>('daily')
  return <main style={{minHeight:'100vh',padding:'22px 16px 80px',background:'linear-gradient(145deg,#eefaf8 0%,#faf6ff 48%,#fff7fb 100%)',color:'#2f2c38',fontFamily:'-apple-system,BlinkMacSystemFont,"Pretendard",sans-serif'}}>
    <div style={{maxWidth:720,margin:'0 auto'}}>
      <div style={{...card,background:'rgba(255,255,255,.88)'}}>
        <div style={{fontSize:13,fontWeight:800,color:'#6d4c86'}}>PREVIEW QA · API 0원</div>
        <h1 style={{fontSize:27,margin:'8px 0'}}>해설 문구 검수 화면</h1>
        <p style={{margin:0,lineHeight:1.7,color:'#686270'}}>로그인 없음 · 이메일 코드 없음 · 프로필 입력 없음 · AI/API 호출 없음. 아래 내용은 화면 구조와 문장 품질만 확인하는 fixture야.</p>
      </div>
      <div style={{display:'flex',gap:8,margin:'0 0 18px'}}>
        <button style={pill(tab==='daily')} onClick={()=>setTab('daily')}>일일</button>
        <button style={pill(tab==='weekly')} onClick={()=>setTab('weekly')}>주간</button>
        <button style={pill(tab==='reunion')} onClick={()=>setTab('reunion')}>재회</button>
      </div>
      {tab==='daily'?<Daily/>:tab==='weekly'?<Weekly/>:<Reunion/>}
    </div>
  </main>
}
