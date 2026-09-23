import type { RelationshipApiResponse } from '../appTypes'

export const REUNION_REQUIRED_CALCULATION_SCHEMA = 'relationship-schema-v1.14-directional-evidence'
export const REUNION_REQUIRED_INTERPRETATION_VERSION = 'relationship-v12.5-directional-evidence-narrative'

function knownSha(value: unknown) {
  const sha = String(value ?? '').trim().toLowerCase()
  return sha && sha !== 'unknown' && sha !== 'local' ? sha : ''
}

export const WEB_GIT_SHA = knownSha(typeof __APP_GIT_SHA__ === 'string' ? __APP_GIT_SHA__ : '') || 'unknown'

export type ReunionReleaseCompatibility = {
  ok: boolean
  reason?: 'calculation_schema' | 'interpretation_version' | 'git_sha'
  message?: string
}

export function reunionReleaseCompatibility(
  response: Pick<RelationshipApiResponse, 'calculation_schema_version' | 'interpretation_version' | 'git_sha'>,
  frontendGitSha = WEB_GIT_SHA,
): ReunionReleaseCompatibility {
  if (response.calculation_schema_version !== REUNION_REQUIRED_CALCULATION_SCHEMA) {
    return {
      ok: false,
      reason: 'calculation_schema',
      message: '계산 서버 버전이 화면 버전과 맞지 않아 지금 결과를 표시하지 않았어. 잠시 후 다시 시도해.',
    }
  }
  if (response.interpretation_version !== REUNION_REQUIRED_INTERPRETATION_VERSION) {
    return {
      ok: false,
      reason: 'interpretation_version',
      message: '재회 해설 계약 버전이 맞지 않아 이전 형식의 결과를 현재 결과처럼 표시하지 않았어. 잠시 후 다시 시도해.',
    }
  }
  const backendSha = knownSha(response.git_sha)
  const frontendSha = knownSha(frontendGitSha)
  if (backendSha && frontendSha && backendSha !== frontendSha) {
    return {
      ok: false,
      reason: 'git_sha',
      message: '화면과 계산 서버의 배포 버전이 달라 지금 결과를 표시하지 않았어. 배포가 맞춰진 뒤 다시 계산해.',
    }
  }
  return { ok: true }
}
