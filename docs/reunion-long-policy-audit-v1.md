# Reunion long-policy audit v1

## 목적

PR #235의 targeted policy candidate 이후에도 `in_person_meeting`과 `relationship_rebuilding`의 가장 큰 1차 병목은 long-term gate에 남아 있다.

이 감사는 global threshold를 낮추지 않고, stage-specific long-term source/target 구성이 과도하게 좁은지 최소 단위 counterfactual로 확인한다. production policy는 변경하지 않는다.

## 기준선

기준선은 PR #235 candidate 정책이다.

- meeting fast trigger: Mars or Venus
- rebuilding medium gate: Lunar Return or Solar Return
- global thresholds: 35 / 25 / 12 유지
- weights, aspects, orb, local-peak 규칙 유지

## counterfactuals

### 1. `meeting_directed_add_mars`

현재 meeting long-term directed source는 Moon / Venus / Sun이다.

Mars를 source에만 추가한다. meeting의 stage-defining fast trigger에 Mars가 이미 포함되어 있으므로, long-term source와 exact trigger 의미가 서로 어긋나는지 확인하는 정렬 테스트다.

### 2. `meeting_directed_add_mercury`

Mercury를 meeting directed source에만 추가한다.

연락·일정·이동 같은 logistics 신호가 meeting long gate를 얼마나 바꾸는지 보는 stress test다. production 제안이 아니다.

### 3. `rebuilding_directed_add_mercury`

Mercury를 rebuilding directed source에만 추가한다.

기존 target 집합은 그대로 둔다.

### 4. `rebuilding_target_add_mercury`

Mercury를 rebuilding directed target에만 추가한다.

기존 source 집합은 그대로 둔다.

### 5. `targeted_long_candidate_v1`

아래 세 변경을 함께 적용해 상호작용을 측정한다.

- meeting directed source + Mars
- rebuilding directed source + Mercury
- rebuilding directed target + Mercury

단일 variant의 delta를 단순 합산하지 않고 combined rerun 결과를 별도로 비교한다.

## 출력

private request를 각 variant에서 엔진 전체 재실행한다.

공개 출력에는 stage별 aggregate count만 포함한다.

- future long pass
- future medium pass
- future numeric pass
- future semantic trigger pass
- future hierarchy pass
- future local peak
- candidate count

이름, 출생정보, 좌표, raw evidence, 정확 후보 날짜는 출력하지 않는다.

## 판정 원칙

- long-pass delta가 거의 없으면 해당 source/target 제한은 현재 사례의 핵심 병목이 아니다.
- long-pass는 늘지만 hierarchy/peak가 늘지 않으면 병목이 다음 gate로 이동한 것이다.
- public peak까지 의미 있게 늘더라도 정확도 개선을 뜻하지 않는다.
- 독립 outcome-labelled holdout 없이 production retuning 결론을 내리지 않는다.
- global threshold 완화는 이 감사 범위 밖이다.
