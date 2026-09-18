import type { RelationshipAiResponse } from '../appTypes'

type SajuLensLike = { key?: string; meaning?: string; action?: string }

const SENTENCE_END = /(?<=[.!?。])\s+/u

export function firstSentences(value: unknown, maxSentences = 2): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const rows = text.split(SENTENCE_END).map(row => row.trim()).filter(Boolean)
  return rows.slice(0, Math.max(1, maxSentences)).join(' ')
}

export function relationshipGenerationCost(ai: RelationshipAiResponse | null): string {
  if (!ai?.ok) return ''
  const enriched = ai as RelationshipAiResponse & { estimated_max_job_krw?: number; max_job_krw?: number }
  const exact = Number(ai.usage?.estimated_krw)
  const upper = Number(enriched.estimated_max_job_krw)
  if (Number.isFinite(exact) && exact > 0) return `이번 생성 예상비용 약 ${Math.round(exact)}원 · 저장본 재열람 0원`
  if (Number.isFinite(upper) && upper > 0) return `이번 생성 작업의 서버 예상 상한 약 ${Math.round(upper)}원 · 저장본 재열람 0원`
  return '생성 완료 · 저장본 재열람 0원'
}

export function reunionSajuCopy(value: string, lens: SajuLensLike, directionLabel: string) {
  const base = { title: `${directionLabel} · ${value}`, meaning: '', action: '' }
  switch (lens.key) {
    case '재성':
      return {
        ...base,
        meaning: '이 축은 관계를 감정만으로 보기보다 시간·노력·생활 조건처럼 실제로 주고받는 몫을 확인하려는 쪽으로 읽어.',
        action: '재접촉이 생기면 “다시 만났느냐”보다 연락 빈도, 약속 이행, 서로 쓰는 시간과 노력이 이전과 달라졌는지를 먼저 봐.',
      }
    case '관성':
      return {
        ...base,
        meaning: '이 축은 관계의 기준·약속·책임을 분명하게 만들려는 쪽으로 읽어. 애매한 호감보다 관계를 어떤 방식으로 이어갈지의 합의가 중요해.',
        action: '안부나 사과 한 번보다 연락 방식, 만남 약속, 경계와 책임이 실제로 구체화되는지를 확인해.',
      }
    case '식상':
      return {
        ...base,
        meaning: '이 축은 마음을 밖으로 표현하고 대화를 다시 움직이는 방식과 연결돼. 표현이 늘어나는 것과 관계가 복원되는 것은 같은 뜻이 아니야.',
        action: '먼저 연락하거나 말을 꺼냈다면 한 번의 메시지보다 대화가 이어지는지, 다음 행동으로 연결되는지를 봐.',
      }
    case '인성':
      return {
        ...base,
        meaning: '이 축은 상대의 말과 행동을 받아들이고 의미를 해석하는 방식과 연결돼. 과거 기억이 현재 신호를 대신하지 않도록 구분해서 읽는 게 중요해.',
        action: '예전의 설명을 반복해서 추측하기보다 지금 확인 가능한 답변, 약속, 태도만 따로 놓고 판단해.',
      }
    case '비겁':
      return {
        ...base,
        meaning: '이 축은 관계 안에서 자기 기준과 주도권을 어떻게 지키고 조율하는지와 연결돼. 누가 이기느냐보다 서로 양보 가능한 범위를 보는 편이 맞아.',
        action: '누가 먼저 연락했는지만 세기보다 갈등 뒤에 역할·경계·의견 조정 방식이 실제로 달라지는지를 확인해.',
      }
    default:
      return {
        ...base,
        meaning: lens.meaning || '두 사람의 관계에서 드러나는 역할과 반응 방식을 보는 보조 맥락이야.',
        action: lens.action || '실제 연락과 약속, 행동이 어떻게 달라지는지를 함께 확인해.',
      }
  }
}
