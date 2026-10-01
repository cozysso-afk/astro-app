# Reunion gate sensitivity audit v1

## 목적

재회운이 자유형 GPT/Claude 해석보다 유독 낮게 보이는 이유를 문구가 아니라 계산 계층에서 점검한다. 이 감사는 실제 사건 확률을 새로 주장하지 않으며, 결과를 낙관적으로 맞추기 위해 threshold를 임의 조정하지 않는다.

## 현재 계산 구조

`reunion_hierarchy_v2.py`는 사건 확률 모델이 아니라 순차 gate 기반 timing-selection policy다.

현재 기본값:

- long-term >= 35
- mid-term >= 25
- event-trigger >= 12
- 이후 stage-specific semantic trigger와 ±7일 local peak 선택

중요한 점은 gate가 순차 평가된다는 것이다. long-term이 실패하면 mid-term과 fast trigger를 계산하지 않고, mid-term이 실패하면 fast trigger를 계산하지 않는다. 따라서 저장 결과의 `0`은 항상 '계산했더니 0'이 아니라 '앞 gate에서 중단되어 미평가'일 수 있다.

## 운영 저장본의 비식별 aggregate 확인

2026-09-27 읽기 전용 DB 점검에서 v2.8 hierarchy가 보존된 최근 archive 4건을 확인했다. 기존 generalization audit 결과상 저장 corpus의 독립 커플 다양성은 검증되지 않았으므로, 이 4건을 4개의 독립 사례로 취급하지 않는다. 네 archive의 아래 aggregate는 동일했다.

| stage | future days | long pass | mid pass | semantic trigger / hierarchy pass | public peaks |
|---|---:|---:|---:|---:|---:|
| emotional_reactivation | 97 | 97 | 97 | 37 | 5 |
| contact_recontact | 97 | 97 | 97 | 20 | 6 |
| in_person_meeting | 97 | 2 | 2 | 0 | 0 |
| relationship_rebuilding | 97 | 6 | 0 | 0 | 0 |

## 무엇이 실제 병목인가

### 감정 / 연락

장기와 중기 수치 gate는 97/97일 모두 통과한다. 따라서 이 두 단계가 낮게 보일 때 병목은 threshold 35/25가 아니라 stage-specific exact trigger 정책이다.

- contact는 Mercury primary trigger를 요구한다.
- emotional은 Venus direct trigger 또는 제한된 Moon+Venus 결합 조건을 요구한다.

즉 contact 결과를 올리기 위해 long/mid threshold를 낮추는 것은 현재 저장 패턴에서는 효과가 거의 없을 가능성이 높다.

### 실제 만남

97일 중 long-term gate를 통과한 날이 2일뿐이다. 두 날은 mid gate까지 통과했지만 최종 semantic trigger는 0일이다.

현재 meeting long policy는 directed Moon/Venus/Sun -> ASC/DSC/Venus/Mars 또는 Jupiter/Saturn/Uranus -> ASC/DSC/Venus/Mars를 요구하고, exact trigger는 Mars primary만 허용한다. 하위 dimension weight에서는 Venus와 Mars가 모두 0.95, Mercury가 0.70인데 hierarchy exact trigger는 Mars만 stage-defining으로 인정한다.

따라서 meeting의 보수성은 두 군데에서 생긴다.

1. long-term stage policy에서 95/97일이 먼저 탈락
2. 남은 2일도 Mars-primary exact trigger가 없어 탈락

### 관계 회복

97일 중 long-term gate를 통과한 날은 6일이고, 그 6일 모두 Lunar Return medium anchor 25를 넘지 못했다. fast rebuilding trigger는 평가 단계까지 도달하지 않았다.

따라서 현재 '관계 회복 후보 0'은 '회복 관련 빠른 신호가 전혀 없었다'와 같은 뜻이 아니다. 현재 순차 정책에서는 long/mid gate에서 먼저 막혀 fast trigger를 계산하지 않은 날이 대부분이다.

## 구조적으로 보수성을 만드는 규칙

현재 정책에는 threshold 수치 외에도 강한 선별 규칙이 있다.

- 모든 stage의 medium gate는 Lunar Return 하나만 필수 anchor로 사용한다. Mercury/Venus/Mars/Solar Return은 계산되지만 medium gate를 열 수 없다.
- contact exact stage trigger는 Mercury primary만 인정한다.
- meeting exact stage trigger는 Mars primary만 인정한다. Venus/Mercury는 관련 신호로 계산되어도 stage-defining trigger가 아니다.
- rebuilding은 Venus/Sun primary, Mercury support다.
- trine/sextile/quincunx와 return-angle 접촉은 context-only로 남고 exact candidate를 만들 수 없다.

이 규칙들은 v2.4에서 과통과를 줄이기 위해 들어갔지만, observed outcome으로 calibration된 규칙은 아니다.

## 왜 저장 trace만으로 ±5 / ±10 sensitivity를 계산하면 안 되는가

현재 trace는 sequential gating 때문에 미평가 계층을 0으로 보존한다. 예를 들어 rebuilding에서 long gate를 실패한 91일의 mid/fast score는 반사실 점수가 아니라 미계산 값이다.

따라서 저장 JSON에 단순히 threshold를 ±5/±10 적용하면 false-negative sensitivity를 잘못 계산하게 된다.

## 이번 감사 도구

`scripts/reunion_gate_sensitivity_audit.py`는 같은 private request를 각 threshold variant로 엔진 전체 재실행한다.

- baseline
- long-term -10 / -5 / +5 / +10
- mid-term -10 / -5 / +5 / +10
- event-trigger -10 / -5 / +5 / +10

각 variant는 다른 두 gate를 그대로 유지한다. 출력은 stage별 미래 gate pass 수, hierarchy pass 수, peak/candidate 수와 baseline 대비 delta만 포함한다. 이름, 생년월일, 좌표, exact candidate date는 출력하지 않는다.

이 방식은 앞 gate threshold가 바뀌었을 때 원래 생략되던 mid/fast 계산을 실제로 다시 수행하므로 저장 trace 재해석보다 정확하다.

## 현재 결론

현재 자료만으로 '35/25/12가 통계적으로 너무 높다'고 결론낼 수는 없다. 독립 outcome cohort가 없기 때문이다.

다만 현재 저장 패턴에서 낮은 재회 단계의 주 병목은 분명하다.

- contact: long/mid threshold가 아니라 semantic trigger 선별
- meeting: long-term policy가 1차 병목, Mars-only trigger가 2차 병목
- rebuilding: long-term policy가 1차 병목, Lunar-only mid anchor가 2차 병목

따라서 다음 계산 수정 후보는 전체 threshold를 일괄 완화하는 것이 아니라, sensitivity replay 결과를 보고 stage별 policy를 조정하는 것이다. 특히 meeting의 Mars-only trigger와 rebuilding의 universal Lunar mid anchor는 별도 counterfactual 비교 대상이다.

## 제한

- 최근 archive 4건은 독립 커플 4건으로 간주하지 않는다.
- 이 감사는 점성술적 사건 예측의 객관적 정확도를 검증하지 않는다.
- outcome label 없이 threshold를 production에서 변경하지 않는다.
- sensitivity runner 결과를 보기 전에는 stage policy 완화도 production에 적용하지 않는다.
