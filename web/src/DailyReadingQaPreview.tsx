import { useState } from 'react'
import type { AiInterpretationResponse, IntegratedApiResponse } from './appTypes'
import { SystemReadingViews } from './SystemReadingViews'
import { PeriodFortuneNarrativeV2 } from './PeriodFortuneNarrativeV2'

// Synthetic copy for layout and routing tests only; never a generated prediction.
const section=(conclusion:string,real_scene:string,action:string,change_condition:string)=>({conclusion,real_scene,action,change_condition,evidence_refs:['W:qa-only'],applicability:'conditional' as const})
export const dailyQaData = {
  headline:'사람과 나눌 이야기는 열어두고, 집중할 시간은 따로 확보해.',
  overall:{summary:'대화에 쓸 시간과 혼자 정리할 시간을 나눠 보면 하루의 우선순위가 분명해져. 부탁을 받으면 바로 약속하기 전에 이미 잡힌 일정부터 확인해.',dominant_pattern:'함께 논의할 일과 혼자 마무리할 일이 겹치는 상황을 구분해서 읽은 해설이야.',evidence_refs:['W:qa-only'],best_phase:'',caution_phase:''},
  clusters:{
    relationship:{love_general:section('만남의 속도는 혼자 정하지 말고, 서로 편한 약속부터 맞춰봐.','관심이 있어도 만나는 횟수나 연락 속도는 다를 수 있어.','다음 만남에서 하고 싶은 일을 하나 제안해봐.','상대가 시간을 내기 어렵다고 하면 일정을 다시 합의해.'),summary:section('부탁을 받으면 어디까지 맡을 수 있는지 먼저 말해.','도움을 주는 일과 책임을 대신 지는 일은 구분할 필요가 있어.','내가 맡을 범위와 마감부터 정해.','요청 범위가 늘어나면 처음 약속한 역할부터 다시 맞춰.')},
    work_study:{work:section('새 일을 늘리기 전에, 오늘 끝내야 할 작업을 먼저 정리해.','여러 요청을 동시에 받으면 완료 기준이 흐려질 수 있어.','끝낼 작업 하나와 필요한 확인 사항을 적어봐.','요청 내용이 바뀌면 마감도 함께 조정해.'),study:section('새 진도를 더하기 전에 배운 내용을 한 번 설명해봐.','읽을 때 이해한 내용과 혼자 꺼내 쓸 수 있는 내용은 다를 수 있어.','책을 덮고 핵심 개념을 내 말로 정리해.','설명하다 막히는 부분이 있으면 그 부분부터 다시 읽어.')},
    money_news:{money:section('쓸 돈을 정할 때 이번 주에 남은 결제도 함께 확인해.','지금 잔액만 보면 예정된 지출을 놓치기 쉬워.','정기 결제와 꼭 필요한 지출을 먼저 적어봐.','예정에 없던 비용이 생기면 남은 예산을 다시 정해.')},
    condition:{condition:section('쉬는 시간을 남는 시간에 맡기지 말고 일정에 넣어둬.','긴 일정 사이에 쉴 틈이 없으면 뒤의 계획까지 무리하게 이어갈 수 있어.','일정 하나를 마칠 때 잠깐 멈출 시간을 확보해.','불편함이 계속되면 일정 강도를 낮추고 실제 상태를 먼저 확인해.')},
  },
  decisions:[{action:'중요한 대화와 혼자 처리할 일의 시간을 나눠 잡아.',timing:'예정된 약속과 이동 시간을 먼저 확인한 뒤 적용해.',watch:'새 요청이 들어오면 남은 시간을 다시 계산해.',avoid:'다른 사람의 일정까지 확인하지 않고 약속하지 마.',reason:'같은 시간에 여러 일을 겹쳐 잡지 않기 위한 확인이야.',evidence_refs:['W:qa-only']}],
  systems:{western:'',saju:'',thai:''},priorities:[],topic_analysis:{},limits:'이 문장은 화면 검수용 예시야. 실제 계산 결과나 개인의 운세가 아니야.',
} as unknown as NonNullable<AiInterpretationResponse['data']>
const calculation={period:{start:'2026-11-04',end:'2026-11-04',day_count:1},western:{overall:{},relationship_signals:{}},saju:{ok:false},thai:{ok:false}} as unknown as IntegratedApiResponse

export function DailyReadingQaPreview() {
  const [missing,setMissing]=useState(false)
  const data=missing?{...dailyQaData,clusters:{...dailyQaData.clusters,money_news:{...dailyQaData.clusters.money_news,money:undefined}}} as unknown as typeof dailyQaData:dailyQaData
  const result:AiInterpretationResponse={ok:true,origin:'gemini',provenance_verified:true,data,usage:{quality_validation:{score:100}}}
  return <section data-qa-block="daily-reading" className="fortune-experience period-today">
    <p>일일 해설 화면 검수 · 실제 운세가 아닌 예시</p>
    <button type="button" onClick={()=>setMissing(v=>!v)}>금전 원고 누락 테스트</button>
    <SystemReadingViews calculation={calculation}><PeriodFortuneNarrativeV2 period="today" calculation={calculation} result={result}/></SystemReadingViews>
  </section>
}
