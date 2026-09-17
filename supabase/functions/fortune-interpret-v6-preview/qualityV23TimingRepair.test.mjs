import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectInterpretationQuality } from './qualityV2.ts'

function payload(v23=true) {
  return {
    ...(v23 ? { __v23_evidence_timing_repair: true } : {}),
    period_kind: 'week',
    period: { start: '2026-09-14', end: '2026-09-20' },
    evidence_ledger: [
      { id:'W:daily:good', system:'western', topic:'학업', scope:'daily_actual', date:'2026-09-16', direction:'supportive' },
      { id:'W:daily:bad', system:'western', topic:'직장', scope:'daily_actual', date:'2026-09-18', direction:'caution' },
      { id:'W:daily:rel', system:'western', topic:'연락', scope:'daily_actual', date:'2026-09-17', direction:'supportive' },
    ],
  }
}

function candidate() {
  return {
    headline:'테스트 해설',
    overall:{summary:'충분한 길이의 테스트 총평으로 기간 흐름과 현실 확인 방식을 설명한다. '.repeat(3)},
    key_windows:[
      {label:'직접 근거 있음',start:'2026-09-16',end:'2026-09-16',signal:'활용',topics:['학업'],summary:'직접 근거가 있는 시기 설명을 충분한 길이로 적어 검증할 수 있게 한다.',action:'계산 근거가 있는 행동만 확인한다.',avoid:'과대해석하지 않는다.',evidence_refs:['W:daily:good']},
      {label:'날짜 과장',start:'2026-09-20',end:'2026-09-20',signal:'주의',topics:['직장'],summary:'직접 근거 날짜를 벗어난 시기 설명이라 V23 로컬 보정에서 제거돼야 한다.',action:'이 날짜를 확정하지 않는다.',avoid:'없는 날짜 근거를 만들지 않는다.',evidence_refs:['W:daily:bad']},
    ],
    cross_checks:[],
    decisions:[
      {action:'유효한 행동',timing:'2026-09-16',reason:'유효한 시기와 같은 근거를 공유한다.',watch:'실제 결과를 확인한다.',avoid:'단정하지 않는다.',evidence_refs:['W:daily:good']},
      {action:'제거될 행동',timing:'2026-09-20',reason:'제거될 시기만 근거로 삼는다.',watch:'실제 결과를 확인한다.',avoid:'단정하지 않는다.',evidence_refs:['W:daily:bad']},
    ],
    clusters:{relationship:'',work_study:'',money_news:'',condition:''},
    relationship_reading:{context:'관계 방향을 구분해 읽는 테스트 맥락을 충분히 설명한다.',flow:'연락 방향과 실제 반응을 구분해서 이어지는 흐름을 충분히 설명한다.',focus_timing:'2026-09-18을 관계 주목일로 본다.',watch:'실제 연락과 반응이 이어지는지 확인한다.',avoid:'날짜 하나만으로 상대 행동을 확정하지 않는다.',evidence_refs:['W:daily:rel']},
    contact_flow:{incoming:'상대가 먼저 오는 흐름을 실제 연락으로 확인한다.',outgoing:'내가 먼저 보내는 흐름은 별도로 확인한다.',reconnection:'과거 인연 접점은 실제 재접촉으로 확인한다.'},
    systems:{western:'',saju:'',thai:''},
    priorities:['학업 확인','관계 반응 확인'],
    topic_analysis:{},
    limits:'확률이나 사건 확정을 뜻하지 않는다.',
  }
}

test('V23 locally removes unsupported timing claims before traceability scoring', () => {
  const data=candidate()
  const report=inspectInterpretationQuality(data,payload(true))
  assert.equal(report.local_timing_repair,true)
  assert.equal(data.key_windows.length,1)
  assert.equal(data.key_windows[0].start,'2026-09-16')
  assert.equal(data.decisions.length,1)
  assert.doesNotMatch(data.relationship_reading.focus_timing,/2026-09-18/)
  const stage2=report.stages.find(stage=>stage.stage===2)
  assert.ok(stage2)
  assert.doesNotMatch(stage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)
})

test('legacy quality validation keeps unsupported timing visible for retry', () => {
  const data=candidate()
  const report=inspectInterpretationQuality(data,payload(false))
  assert.equal(report.local_timing_repair,false)
  assert.equal(data.key_windows.length,2)
  const stage2=report.stages.find(stage=>stage.stage===2)
  assert.match(stage2.issues.join(' '),/key_window 날짜를 뒷받침하지 않는 근거|관계·재회 주목 날짜에 직접 날짜 근거 미연결/)
})
