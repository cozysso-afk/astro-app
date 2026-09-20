# 재회운 v2.8 — Birth-time precision audit

## 목적
v2.8은 재회운 stage/selectivity를 다시 튜닝하는 버전이 아니다. low-confidence 출생시각으로 계산된 Lunar Return(월회귀) 근거가 medium gate(중기 관문)에 얼마나 의존하는지 결과 자체에서 감사할 수 있게 만드는 provenance(근거 이력) 보강이다.

## 배경
저장 리딩을 identity 기준으로 재점검한 결과, 현재 private validation 데이터는 서로 다른 여러 커플이 아니라 동일 커플의 상대 출생시각 변형 기록이었다. 따라서 이 데이터로 cross-couple generalization(타 커플 일반화)을 주장하지 않는다.

동일 2026 기간의 birth-time sensitivity audit에서 시간 입력 변형 3건은 hierarchy eligible이 308/304/307일, public/local peaks가 12/12/13개였고 nearest는 모두 2026-09-22 contact로 유지됐다. birth time unknown 조건은 hierarchy 31일, peak 1개로 근거가 크게 감소했다. 반면 TOP3 날짜/순위는 시간 변형에 따라 유의미하게 변했다.

이 패턴을 추적한 결과 provisional Lunar Return이 exact Lunar Return과 동일한 medium-gate 수치 자격으로 들어가는 구조를 확인했다. v2.8에서는 이 사실을 숨기지 않고 후보별로 의존성을 노출하되 임의 감점이나 suppression(제외)은 하지 않는다.

## 구현
`reunion_hierarchy_v2.py`의 버전은 `reunion-hierarchy-v2.8-birth-time-precision-audit`이다.

Return evidence에는 `return_precision`과 `return_side`를 유지한다. 새 `_medium_precision_audit()`는 Lunar Return medium-gate evidence를 대상으로 전체 score와 exact-only score를 각각 계산하고, 전체 gate pass와 exact-only gate pass를 함께 기록한다.

상태값은 `gate_depends_on_provisional`, `provisional_contributes_but_exact_gate_passes`, `exact_only`, `unknown_precision_present`, `no_lunar_anchor`로 구분한다.

이 audit object는 daily trace와 public/group/peak candidate에 전달된다. selection policy에도 provisional Lunar Return을 계산 가능 상태로 유지하면서 exact-only counterfactual을 함께 보고한다는 정책을 명시한다.

## 불변 조건
v2.8에서는 `WEIGHTS`, `THRESHOLDS`, stage trigger policy, long/medium/event gate 순서, local-peak radius, ranking key, public candidate selection을 변경하지 않는다.

`_medium_precision_audit()`의 결과는 gate score를 다시 쓰거나 candidate를 제외하지 않는다. 즉 v2.8은 계산 결과를 조정하는 기능이 아니라, 그 결과가 추정 출생시각에 의존하는지를 설명하는 audit-only layer다.

## 테스트
회귀 테스트는 provisional evidence가 gate를 열었을 때 `gate_depends_on_provisional`로 표시되는지, exact evidence만으로도 gate가 통과할 때 `provisional_contributes_but_exact_gate_passes`인지, Return evidence의 precision/side가 보존되는지를 확인한다.

기존 hierarchy/relocation 회귀 테스트도 함께 실행해 v2.8 audit field 추가가 stage selection 규칙을 바꾸지 않는지 감시한다.

## 검증 한계
현재 private DB에 독립된 타 커플 validation 표본이 없으므로 cross-couple generalization은 **UNVERIFIED**다.

기존 v2.7 private saved-case 3건의 기준값은 2026 `raw=816, hierarchy=308, peaks=12, nearest=2026-09-22 contact`, 2027 A/B `raw=569, hierarchy=174, peaks=38, nearest=2027-01-02 emotional`이며 2027 A/B는 결정적으로 동일했다.

v2.8 private replay는 반드시 PII를 저장소/로그에 남기지 않는 격리 runner에서 aggregate/digest만 재검증해야 한다. 이 문서는 실행되지 않은 private replay를 PASS로 표기하지 않는다.

## 배포 정책
PR #186은 Draft로 유지한다. production deploy와 merge는 하지 않는다. UI 구조와 사용자 입력 UX는 변경하지 않는다.
