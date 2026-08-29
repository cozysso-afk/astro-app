from pathlib import Path
p=Path('web/src/AppNext.tsx')
text=p.read_text(encoding='utf-8')
old="""  const headline = challenging > supportive + 3 ? '강한 자극과 마찰이 함께 있는 관계 구조' : supportive > challenging + 3 ? '조화 접점이 상대적으로 많은 관계 구조' : '끌림·조화·긴장이 섞여 있는 복합 관계 구조'
  const communicationText = communication.length ? `소통 관련 접점이 ${communication.length}개 보여. ${communication.slice(0,2).map(relationshipAspectMeaning).join(' ')}` : '수성 관련 주요 접점이 상위권에 많지 않아. 대화 패턴은 다른 접점과 실제 경험을 같이 봐야 해.'
  const chemistryText = chemistry.length ? `끌림·추진력·강도 관련 접점이 ${chemistry.length}개야. ${chemistry.slice(0,2).map(relationshipAspectMeaning).join(' ')}` : '금성·화성·명왕성 관련 강한 접점이 상위권에 적어, 끌림 하나만으로 관계 전체를 설명하기는 어려워.'
  const stabilityText = structure.length ? `지속성·성장·반복 패턴 관련 접점이 ${structure.length}개야. ${structure.slice(0,2).map(relationshipAspectMeaning).join(' ')}` : '토성·목성·노드 관련 상위 접점이 적어 장기 지속성은 현재 계산만으로 강하게 단정하기 어려워.'
  const timing = partnerExact ? '두 사람의 정확한 출생시간·좌표가 있어 진행 시너스트리·데이비슨·마크스 타이밍까지 계산할 수 있어. 아래 접점 수는 사건 확률이 아니야.' : '상대 출생시간/장소가 없어서 진행 시너스트리·진행 컴포지트·데이비슨·마크스 타이밍은 계산에서 제외됐어. 0/0/0은 활성도 0이 아니라 정밀 타이밍 미계산이 맞아.'"""
new="""  const topAspect = tight[0]
  const headline = topAspect ? `${aspectText(topAspect)}이 가장 강하게 걸리는 관계` : '확정 가능한 핵심 접점이 적은 관계 구조'
  const overview = tight.length ? tight.slice(0,3).map((aspect,index)=>`${index+1}순위 ${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°): ${relationshipAspectMeaning(aspect)}`).join(' ') : '현재 입력으로 확정 가능한 주요 접점이 적어서 관계 전체를 강하게 단정하기 어려워.'
  const communicationTight = [...communication].sort((a,b)=>a.orb-b.orb).slice(0,2)
  const chemistryTight = [...chemistry].sort((a,b)=>a.orb-b.orb).slice(0,2)
  const structureTight = [...structure].sort((a,b)=>a.orb-b.orb).slice(0,2)
  const communicationText = communicationTight.length ? communicationTight.map((aspect)=>`${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°) — ${relationshipAspectMeaning(aspect)}`).join(' ') : 'Mercury(수성) 관련 확정 접점이 상위권에 적어서 소통 패턴은 현재 차트만으로 강하게 말하지 않을게.'
  const chemistryText = chemistryTight.length ? chemistryTight.map((aspect)=>`${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°) — ${relationshipAspectMeaning(aspect)}`).join(' ') : 'Venus(금성)·Mars(화성)·Pluto(명왕성) 관련 확정 접점이 상위권에 적어서 끌림 하나로 관계를 설명하진 않을게.'
  const stabilityText = structureTight.length ? structureTight.map((aspect)=>`${aspectText(aspect)}(오브 ${aspect.orb.toFixed(2)}°) — ${relationshipAspectMeaning(aspect)}`).join(' ') : 'Saturn(토성)·Jupiter(목성)·교점 관련 확정 접점이 상위권에 적어서 장기 지속성은 현재 계산만으로 강하게 단정하기 어려워.'
  const timing = partnerExact ? '두 사람의 정확한 출생시간과 위치가 있어 진행 궁합차트·Davison(데이비슨)·Marks(마크스) 시기층까지 계산할 수 있어.' : '상대 출생시간이 없어서 Moon(달)·ASC(상승점)·DSC(하강점)·MC(중천점)·IC(천저점)처럼 시간에 민감한 요소와 정밀 진행 시기층은 제외했어. 대신 출생시간 없이 확정 가능한 행성 간 접점만 해석해.'"""
if old not in text: raise SystemExit('relationship static marker missing')
text=text.replace(old,new,1)
old2="""      <span className=\"eyebrow\">RELATIONSHIP READING</span><h3>{headline}</h3>
      <p className=\"relationship-overview\">시너스트리에서 {interpretableAspects.length}개 해석 가능한 접점이 잡혔고 조화 {supportive} · 긴장 {challenging} · 혼합 {mixed}이야. 이 숫자는 궁합 점수나 재회 확률이 아니라 두 차트가 어디에서 반복적으로 맞물리는지 보여주는 구조값이야. 오브가 좁을수록 그 주제가 체감되기 쉬워.</p>"""
new2="""      <span className=\"eyebrow\">관계 구조 해설</span><h3>{headline}</h3>
      <p className=\"relationship-overview\">{overview}</p>"""
if old2 not in text: raise SystemExit('relationship overview marker missing')
text=text.replace(old2,new2,1)
text=text.replace("<div className=\"relationship-key-aspects\"><strong>가장 강한 접점</strong>{tight.map((aspect,index)=>", "<div className=\"relationship-key-aspects\"><strong>가장 강한 접점</strong>{tight.slice(0,3).map((aspect,index)=>",1)
p.write_text(text,encoding='utf-8')
print('relationship static reading made evidence-first')
