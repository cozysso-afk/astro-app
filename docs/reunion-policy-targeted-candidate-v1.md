# Reunion policy targeted candidate v1

## 목적

PR #234의 gate sensitivity audit에서 확인된 두 개의 후단 병목을 실제 계산 정책 후보로 구현한다. 이 변경은 결과를 낙관적으로 만들기 위한 global threshold 완화가 아니며, 독립 outcome cohort가 없는 상태에서 predictive accuracy를 주장하지 않는다.

## 변경

### 실제 만남

기존 exact stage trigger:

- Mars only

후보 정책:

- Mars or Venus

기존 meeting targets, direct aspects, exact-trigger families, orb limit, event threshold는 그대로 유지한다. 따라서 Venus가 추가되더라도 기존 meeting target을 벗어나거나 minor aspect/context-only evidence만으로 후보가 열리지는 않는다.

### 관계 재정의

기존 medium gate:

- Lunar Return only

후보 정책:

- Lunar Return
- Solar Return, 단 `relationship_rebuilding` stage에서만

Solar Return은 이미 rebuilding의 medium context에 포함되어 있던 계산 근거다. 이번 후보는 그 기존 context를 medium gate anchor로도 허용한다. 감정/연락/실제 만남 stage에는 Solar Return을 추가하지 않는다.

## 변경하지 않는 것

- weights
- global thresholds: long-term 35 / mid-term 25 / event-trigger 12
- stage-specific long-term policy
- meeting/rebuilding targets
- direct aspects
- exact-trigger families
- orb limits
- ±7일 local peak selection
- cross-system scoring semantics
- event probability: 계속 not calculated

## 버전 표기

기존 engine `VERSION`은 기존 downstream contract와 회귀 테스트를 깨지 않기 위해 이 draft candidate에서는 유지한다.

대신 `selection_policy.policy_revision = reunion-policy-targeted-candidate-v1`을 노출한다. 실제 production merge를 결정할 경우 engine/cache version bump를 별도 검토한다.

## 해석 주의

이 후보는 PR #234에서 확인된 두 개의 후단 병목만 완화한다. 같은 audit에서 실제 만남과 관계 재정의 모두 long-term policy가 더 큰 1차 병목으로 확인됐다.

따라서 이 후보에서 public candidate가 거의 늘지 않는다면 다음 검토 대상은 global threshold가 아니라 stage-specific long-term policy다.

이 변경만으로 실제 사건 예측 정확도가 개선됐다고 결론내리지 않는다. 독립 outcome-labelled holdout 없이는 descriptive candidate behavior만 비교한다.
