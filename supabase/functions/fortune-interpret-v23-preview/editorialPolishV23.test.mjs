import assert from 'node:assert/strict'
import test from 'node:test'
import { polishV23EditorialDepth } from './editorialPolishV23.ts'

function fixture(){
  const payload={
    evidence_ledger:[
      {id:'W:detail:2026-10-05:학업:1',system:'western',topic:'학업',direction:'caution',scope:'intraday_evidence'},
      {id:'S:ctx:2026-10-05',system:'saju',topic:'학업',direction:'caution',scope:'period_context'},
      {id:'T:ctx:2026-10-05',system:'thai',topic:'학업',direction:'neutral',scope:'period_context'},
    ],
  }
  const data={
    score_marker:33,
    overall:{summary:'오늘 결과가 나쁠 가능성이 높아.'},
    topic_analysis:{
      학업:{
        importance:'핵심',verdict:'학업은 이날 활성도가 33점으로 주의야.',
        reason:'수성-토성 마찰이 직접 연결돼 있어.',timing:'2026-10-05',
        action:'집중력을 확인해.',avoid:'낮은 점수만 보고 단정하지 마.',confidence:'보통',confidence_reason:'근거가 연결돼 있어.',
        evidence_refs:['W:detail:2026-10-05:학업:1'],
      },
    },
    clusters:{
      work_study:{
        study:{
          conclusion:'학습 진도가 더디고 이해에서 마찰이 생기기 쉬워 양을 줄이는 편이 좋아.',
          real_scene:'책상 앞에 오래 있어도 머리에 잘 들어오지 않고 피로가 누적될 수 있어.',
          action:'오늘 목표 분량을 절반으로 줄이고 핵심 내용만 확실히 정리해.',
          change_condition:'이해가 안 되는 부분은 표시해 두고 다음 학습 구간으로 넘겨.',
          evidence_refs:['W:detail:2026-10-05:학업:1'],applicability:'direct',
        },
      },
    },
    cross_checks:[{
      label:'교차 확인',mode:'복수체계',start:'2026-10-05',end:'2026-10-05',
      synthesis:'같은 구간의 독립 근거이며 서로 합산하지 않아.',
      evidence_refs:['W:detail:2026-10-05:학업:1','S:ctx:2026-10-05','T:ctx:2026-10-05'],
    }],
    decisions:[],priorities:[],systems:{},
  }
  return {payload,data}
}

test('important topic analysis reuses grounded deep cluster prose instead of generic fallback action',()=>{
  const {payload,data}=fixture()
  const out=polishV23EditorialDepth(data,payload)
  assert.match(out.topic_analysis.학업.verdict,/학습 진도가 더디고/)
  assert.match(out.topic_analysis.학업.reason,/수성-토성/)
  assert.match(out.topic_analysis.학업.reason,/책상 앞에 오래 있어도/)
  assert.match(out.topic_analysis.학업.action,/목표 분량을 절반으로 줄이고/)
  assert.match(out.topic_analysis.학업.avoid,/판단을 바꿀 조건은/)
  assert.deepEqual(out.topic_analysis.학업.evidence_refs,['W:detail:2026-10-05:학업:1'])
})

test('shallow cross-system synthesis becomes role-based and practical without voting systems together',()=>{
  const {payload,data}=fixture()
  const out=polishV23EditorialDepth(data,payload)
  const synthesis=out.cross_checks[0].synthesis
  assert.match(synthesis,/Western은/)
  assert.match(synthesis,/사주는/)
  assert.match(synthesis,/시점/)
  assert.match(synthesis,/기간 배경/)
  assert.match(synthesis,/실제 운영에서는/)
  assert.match(synthesis,/목표 분량을 절반으로 줄이고/)
  assert.doesNotMatch(synthesis,/다수결.*보장/)
})

test('certainty polish softens event-like overstatement while leaving calculation values untouched',()=>{
  const {payload,data}=fixture()
  const out=polishV23EditorialDepth(data,payload)
  assert.equal(out.score_marker,33)
  assert.doesNotMatch(out.overall.summary,/가능성이 높아/)
  assert.match(out.overall.summary,/나타날 수 있어/)
  assert.equal(data.overall.summary,'오늘 결과가 나쁠 가능성이 높아.')
})

test('ungrounded cluster copy is not promoted into topic analysis',()=>{
  const {payload,data}=fixture()
  data.clusters.work_study.study.evidence_refs=['MISSING']
  const out=polishV23EditorialDepth(data,payload)
  assert.equal(out.topic_analysis.학업.verdict,'학업은 이날 활성도가 33점으로 주의야.')
  assert.equal(out.topic_analysis.학업.action,'집중력을 확인해.')
})
