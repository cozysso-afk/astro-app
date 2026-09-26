import { buildPromptPacket, promptBudget } from '../fortune-interpret-v21-preview/costGuardV21.ts'
import { buildPeriodNarrativeContext, buildPeriodNarrativeInstruction, PERIOD_NARRATIVE_VERSION } from './periodNarrativeV23.ts'

export const V23_PROMPT_VERSION = 'fortune-ai-prompt-v23.2-human-scene-first'
const enc = new TextEncoder()

const HUMAN_LANGUAGE_CONTRACT = `[HUMAN_LANGUAGE_CONTRACT]
- 해설의 첫 문장과 headline은 점수·등급·추상적인 운세평이 아니라, 이 기간에 실제 생활에서 체감할 수 있는 구체적인 장면이나 변화로 시작해.
- "좋은 흐름", "무난한 편", "균형이 중요", "신중하게", "성찰", "성장", "에너지", "조율", "변화의 기회" 같은 말만으로 문장을 완성하지 마. 이런 추상어를 쓰면 반드시 누가/무엇을/어떻게 체감하는지 현실 장면을 같은 문장 또는 바로 다음 문장에 붙여.
- headline은 다른 날짜나 다른 사람에게 그대로 붙여도 말이 되는 범용 조언이면 실패야. 선택된 phenomenon의 대상·작용·생활 분야 중 최소 하나가 드러나야 해.
- supportive와 caution이 동시에 강하면 하나를 지우지 말고 "기회는 열리지만 ○○ 때문에 속도가 달라진다"처럼 모순과 긴장을 사람말 한 문장 안에 살려.
- 천체명·aspect·오브·점수는 본문을 시작하는 말이 아니야. 먼저 현실 장면을 말하고, 전문 근거는 reason/세부 근거에서 뒤에 설명해.
- 점수는 확률이 아니다. 숫자가 결론의 주어가 되지 않게 하고, 이미 말한 해석의 강약을 보조하는 경우에만 사용해.
- 같은 뜻의 조언을 동의어로 바꿔 반복하지 마. "서두르지 마/신중해/천천히 봐"는 같은 의미로 취급해 한 번만 써.
- 실제 근거가 없는 사건, 상대의 속마음, 연락 주체, 결과 확정, 금전 수익, 건강 진단은 만들지 마.
- day면 headline은 오늘만의 촉발·시간대·현실 장면 중 하나를 반드시 포함해. "오늘은 ○○에 힘을 쓰기 좋은 편" 같은 분야 점수 요약만 쓰지 마.
- week면 headline은 7일의 이동이나 전환을 말해. 하루짜리 문장을 기간만 "이번 주"로 바꿔 재사용하지 마. 가능하면 초반→중반→후반 중 실제 근거가 있는 두 구간 이상의 차이를 연결해.
- month/annual은 단일 날짜를 전체 기간의 성격으로 확대하지 말고 반복·누적·방향 전환을 중심으로 설명해.
- 행동 조언은 해석을 다시 말하는 문장이 아니라, 사용자가 현실에서 확인하거나 조정할 수 있는 구체 행동 하나로 써.`

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
  // This private runtime marker is intentionally kept out of the prompt packet.
  // It lets the shared quality validator safely prune unsupported V23 timing
  // claims without changing the legacy V21 validation contract.
  if (payload && typeof payload === 'object') payload.__v23_evidence_timing_repair = true
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
  const text = `${narrativeInstruction}\n\n${HUMAN_LANGUAGE_CONTRACT}\n\n[V23 CORE CONTRACT]\n- 계산과 점수는 서버가 끝냈다. 다시 계산하지 마.\n- 서사는 topic 점수부터 시작하지 말고 period_narrative.phenomena의 현상 묶음부터 시작해.\n- 같은 현상이 여러 topic에 걸쳐 있으면 한 번 설명한 뒤 분야별 발현 차이만 덧붙여.\n- 각 핵심 문단은 반드시 근거가 의미하는 작용 → 체감/환경 → 기간 내 위치 → 현실 확인 신호 순으로 연결해.\n- 점수·평균·변동폭을 설명 자체로 착각하지 마. 숫자는 강약을 보조할 때만 사용해.\n- day/week/month/annual의 시간해상도를 섞지 마.\n- 고정 조언문을 분야명만 바꿔 반복하지 마. 행동은 해당 현상 묶음과 시기의 조건에서 도출해.\n- supportive와 caution이 함께 있는 현상은 긴장 또는 혼합으로 설명하고 하나의 긍정/부정 결론으로 압축하지 마.\n- Western·사주·Thai는 독립 근거로 유지하고, 같은 시기라는 이유로 합산·시너지·확정 표현을 만들지 마.\n- 상대 속마음, 사건 확률, 가격방향, 매매 적기를 만들지 마.\n\nPROMPT_DATA=${JSON.stringify(packet)}`
  return {
    version: V23_PROMPT_VERSION,
    narrative_version: PERIOD_NARRATIVE_VERSION,
    packet,
    text,
  }
}
