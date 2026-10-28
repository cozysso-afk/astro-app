import test from "node:test"
import assert from "node:assert/strict"
import { attachAuthoredDayTimingEvidence } from "./dayTimingEvidenceV23.ts"

const ledger = [
  { id:"W:window:2026-10-26:직장:best", scope:"intraday_window", topic:"직장", direction:"supportive", date:"2026-10-26", window:"07:00~08:30" },
  { id:"W:detail:2026-10-26:직장:1", scope:"intraday_evidence", topic:"직장", direction:"supportive", date:"2026-10-26", text:"수성-목성 조화" },
  { id:"W:window:2026-10-26:연애:caution", scope:"intraday_window", topic:"연애", direction:"caution", date:"2026-10-26", window:"15:00~16:30" },
  { id:"W:detail:2026-10-26:연애:1", scope:"intraday_evidence", topic:"연애", direction:"caution", date:"2026-10-26", text:"달-토성 긴장" },
]
const payload = { period_kind:"day", period:{ start:"2026-10-26", end:"2026-10-26" }, evidence_ledger:ledger }

test("grounds authored day timing with exact calculated window and same-topic detail", () => {
  const original = {
    decisions:[
      { action:"업무 결정을 정리해.", timing:"2026-10-26 07:00 ~ 08:30", reason:"업무 흐름", watch:"답변", avoid:"성급함", evidence_refs:["W:overall:직장"] },
      { action:"관계 결론을 미뤄.", timing:"2026-10-26 15:00 ~ 16:30 피하기", reason:"관계 흐름", watch:"반응", avoid:"단정", evidence_refs:[] },
    ],
  }
  const proseBefore = original.decisions.map(({evidence_refs,...row}) => row)
  const result = attachAuthoredDayTimingEvidence(structuredClone(original), payload)
  assert.deepEqual(result.decisions.map(({evidence_refs,...row}) => row), proseBefore)
  assert.ok(result.decisions[0].evidence_refs.includes("W:window:2026-10-26:직장:best"))
  assert.ok(result.decisions[0].evidence_refs.includes("W:detail:2026-10-26:직장:1"))
  assert.ok(result.decisions[1].evidence_refs.includes("W:window:2026-10-26:연애:caution"))
  assert.ok(result.decisions[1].evidence_refs.includes("W:detail:2026-10-26:연애:1"))
})

test("does not guess when the same clock has multiple unlinked topics", () => {
  const ambiguousPayload = { ...payload, evidence_ledger:[...ledger,
    { id:"W:window:2026-10-26:금전:best", scope:"intraday_window", topic:"금전", direction:"supportive", date:"2026-10-26", window:"07:00~08:30" },
    { id:"W:detail:2026-10-26:금전:1", scope:"intraday_evidence", topic:"금전", direction:"supportive", date:"2026-10-26", text:"금성-목성 조화" },
  ]}
  const decision = { action:"일정을 정리해.", timing:"07:00~08:30", reason:"흐름", watch:"결과", avoid:"단정", evidence_refs:[] }
  const result = attachAuthoredDayTimingEvidence({ decisions:[decision] }, ambiguousPayload)
  assert.deepEqual(result.decisions[0], decision)
})
