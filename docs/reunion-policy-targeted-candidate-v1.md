# Reunion policy targeted candidate v1

## 목적

PR #234의 gate sensitivity audit과 후속 private replay에서 확인된 후단 병목을 실제 계산 정책 후보로 구현한다. 이 변경은 결과를 낙관적으로 만들기 위한 global threshold 완화가 아니며, 독립 outcome cohort가 없는 상태에서 predictive accuracy를 주장하지 않는다.

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

최종 후보 정책:

- Lunar Return
- Venus Return, 단 `relationship_rebuilding` stage에서만

Venus Return은 이미 rebuilding의 medium context에 포함되어 있던 계산 근거다. 후속 medium-anchor private replay에서 기존 Lunar+Solar 후보는 long-pass 6~7일 모두 medium 0에 머물렀고 max gate score도 23.33으로 threshold 25를 넘지 못했다. 반면 Lunar+Venus는 세 저장 snapshot 모두 medium-pass 2일, hierarchy-pass 1일을 만들며 좁게 병목을 해소했다.

Solar+Venus 또는 Lunar+Solar+Venus 조합은 각 snapshot의 모든 long-pass day를 medium-pass로 열어 더 넓게 작동했으므로 production 후보에서 제외한다. Solar Return은 rebuilding context에는 계속 남지만 medium gate를 여는 key로는 사용하지 않는다.

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

후속 long-policy audit에서 rebuilding에 Mercury directed source를 추가한 broad variant는 사실상 Mercury→Sun contact 때문에 long gate를 거의 전 기간 통과시키는 포화가 확인되어 production 후보에서 제외했다. 현재 후보는 long policy를 건드리지 않는다.

이 후보가 실제 사건 예측 정확도를 개선했다고 결론내리지 않는다. 독립 outcome-labelled holdout 없이는 descriptive candidate behavior/selectivity만 비교한다.
