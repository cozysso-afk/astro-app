import { buildPromptPacket, promptBudget } from '../fortune-interpret-v21-preview/costGuardV21.ts'
import { buildPeriodNarrativeContext, buildPeriodNarrativeInstruction, PERIOD_NARRATIVE_VERSION } from './periodNarrativeV23.ts'

export const V23_PROMPT_VERSION = 'fortune-ai-prompt-v23-phenomenon-first'
const enc = new TextEncoder()

export function buildV23PromptPacket(payload:any) {
  const base = buildPromptPacket(payload)
  const narrative = buildPeriodNarrativeContext(base)
  return {
    ...base,
    packet_version: V23_PROMPT_VERSION,
    period_narrative: narrative,
  }
}

export function buildV23PromptBudget(payload:any) {
  const base = promptBudget(payload)
  const packet = buildV23PromptPacket(payload)
  const bytes = enc.encode(JSON.stringify(packet)).byteLength
  const estimated_input_tokens = Math.ceil(bytes / 2.6)
  const ratio = estimated_input_tokens / Math.max(1, Number(base.estimated_input_tokens ?? 1))
  // Scaling the full V21 job estimate is deliberately conservative because it
  // also scales the output reserve when V23 adds prompt context.
  const estimated_max_job_krw = Math.max(
    Number(base.estimated_max_job_krw ?? 0),
    Number(base.estimated_max_job_krw ?? 0) * ratio,
  )
  return {
    ...base,
    packet,
    bytes,
    estimated_input_tokens,
    estimated_max_job_krw,
    ok: bytes <= Number(base.max_bytes ?? 0) && estimated_max_job_krw <= Number(base.max_job_krw ?? 0),
    narrative_version: PERIOD_NARRATIVE_VERSION,
    prompt_version: V23_PROMPT_VERSION,
  }
}

export function buildV23CorePrompt(payload:any) {
  const packet = buildV23PromptPacket(payload)
  const narrativeInstruction = buildPeriodNarrativeInstruction(packet)
  const text = `${narrativeInstruction}\n\n[V23 CORE CONTRACT]\n- 계산과 점수는 서버가 끝냈다. 다시 계산하지 마.\n- 서사는 topic 점수부터 시작하지 말고 period_narrative.phenomena의 현상 묶음부터 시작해.\n- 같은 현상이 여러 topic에 걸쳐 있으면 한 번 설명한 뒤 분야별 발현 차이만 덧붙여.\n- 각 핵심 문단은 반드시 근거가 의미하는 작용 → 체감/환경 → 기간 내 위치 → 현실 확인 신호 순으로 연결해.\n- 점수·평균·변동폭을 설명 자체로 착각하지 마. 숫자는 강약을 보조할 때만 사용해.\n- day/week/month/annual의 시간해상도를 섞지 마.\n- 고정 조언문을 분야명만 바꿔 반복하지 마. 행동은 해당 현상 묶음과 시기의 조건에서 도출해.\n- supportive와 caution이 함께 있는 현상은 긴장 또는 혼합으로 설명하고 하나의 긍정/부정 결론으로 압축하지 마.\n- Western·사주·Thai는 독립 근거로 유지하고, 같은 시기라는 이유로 합산·시너지·확정 표현을 만들지 마.\n- 상대 속마음, 사건 확률, 가격방향, 매매 적기를 만들지 마.\n\nPROMPT_DATA=${JSON.stringify(packet)}`
  return {
    version: V23_PROMPT_VERSION,
    narrative_version: PERIOD_NARRATIVE_VERSION,
    packet,
    text,
  }
}
