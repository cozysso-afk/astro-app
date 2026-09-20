# 재회운 v2.10 — Outcome-blind validation protocol

## 목적

v2.10은 재회운 계산 엔진을 수정하는 버전이 아니다.

목적은 독립 validation case가 확보되기 시작했을 때 다음 순서를 기술적으로 강제하는 것이다.

1. 케이스 입력과 엔진 버전을 먼저 등록한다.
2. 실제 사건/결과를 보지 않은 상태에서 public candidate predictions를 동결한다.
3. 동결 digest가 만들어진 뒤에만 observed outcome을 연결한다.
4. 사전에 고정한 descriptive metrics만 계산한다.
5. 같은 cohort 결과를 보고 weights/threshold/stage policy를 다시 조정하지 않는다.

이 프로토콜은 predictive generalization을 자동으로 증명하지 않는다.

## 현재 전제

v2.9 privacy-safe cohort audit 결과 현재 private saved corpus는 실질적으로 single calculation-profile pair이다.

따라서 현재 상태는 계속 다음과 같다.

- cross-couple diversity: `INSUFFICIENT_DIVERSITY`
- predictive generalization: `UNVERIFIED`

v2.10은 향후 독립 케이스가 들어왔을 때 검증 순서를 미리 고정하기 위한 인프라다.

## 구현

`scripts/reunion_outcome_blind_validation.py`

### 1. register

입력:

- validation request batch
- full 40-char engine commit SHA
- engine version
- 실행 환경의 `VALIDATION_HMAC_KEY`

허용되는 top-level request field는 다음뿐이다.

- `user`
- `counterpart`
- `start_date`
- `end_date`
- `as_of_date`
- `query_utc_offset_hours`
- `analysis_mode`
- `relationship_status`

다음 종류는 prediction freeze 전에 거부한다.

- `reunion_context`
- `event_history`
- `outcome` / `ground_truth` / `label`
- `actual_*`
- `observed_*`

이름은 commitment 대상에서 제외한다. 따라서 display-name alias는 같은 계산 케이스로 취급한다.

반대로 birth time, time confidence, coordinates, timezone 등 실제 계산 입력이 달라지면 다른 case commitment가 된다.

manifest는 raw profile을 출력하지 않는다.

출력되는 case 정보는 pseudonymous `case_id`, HMAC request commitment, validation date range뿐이다.

`manifest_digest`는 다음을 동결한다.

- protocol version
- engine commit/version
- metric specification
- registered case set

### 2. freeze

manifest digest를 다시 검증한 뒤 각 case의 public candidate windows를 동결한다.

prediction record는 다음만 허용한다.

- `case_id`
- `windows`

각 window는 다음만 허용한다.

- `date`
- `start`
- `end`
- `stage`
- `final`

window tolerance를 사후에 추가하지 않는다.

엔진이 공개한 `start/end`를 그대로 평가 경계로 사용한다.

freeze 결과에는 `prediction_digest`가 생기며 outcome은 포함될 수 없다.

### 3. evaluate

prediction digest를 먼저 검증한 후 observed outcome을 연결한다.

outcome schema:

- `case_id`
- `observation_complete`
- `events`

각 event는 정확히 다음 두 필드만 가진다.

- `date`
- `stage`

free-text 사후 설명은 validation metric 입력에 넣지 않는다.

## 사전고정 metric

v2.10의 metric set은 코드에 상수로 고정한다.

### Event metrics

- observed event가 어떤 public window 내부에 있었는지
- observed event가 동일 stage의 public window 내부에 있었는지

### Negative-case burden

- 관찰 기간 동안 event가 없었던 case에 public candidate가 하나라도 있었는지

### Selectivity context

- case당 public windows 수
- public candidate가 하나라도 있는 case 수

단순 hit rate만 보고 좋은 모델이라고 판단하지 않는다.

후보 창을 넓게 많이 내면 hit rate가 올라갈 수 있으므로 candidate burden을 항상 같이 기록한다.

## Incomplete observation

`observation_complete=false` case가 하나라도 있으면 validation rate를 계산하지 않는다.

결과 상태:

`INCOMPLETE_OUTCOME_SET`

metrics는 `null`이다.

부분적으로 알려진 결과만 골라 accuracy처럼 제시하는 것을 막기 위한 정책이다.

## 결과 상태

완전한 outcome set으로 평가해도 상태는:

`DESCRIPTIVE_EVALUATION_ONLY`

이다.

항상:

`generalization_claim_allowed=false`

를 유지한다.

독립 replication 없이 predictive validity/generalization을 선언하지 않는다.

## 금지 사항

v2.10에서는 하지 않는다.

- weights 변경
- thresholds 변경
- stage trigger/semantic policy 변경
- local peak/ranking 변경
- 결과가 잘 나오도록 tolerance 조절
- validation cohort 결과를 본 뒤 같은 cohort에 재튜닝
- event history를 scoring input으로 전달
- private birth payload를 repo에 저장
- UI 변경
- merge
- production deploy

## 향후 실제 validation 실행 순서

1. 독립·동의된 케이스를 확보한다.
2. v2.9 cohort audit으로 profile diversity를 확인한다.
3. outcome을 받기 전에 v2.10 `register`를 실행한다.
4. 지정 commit의 엔진으로 predictions를 계산한다.
5. v2.10 `freeze`로 prediction digest를 남긴다.
6. observation period 종료 후 outcome을 별도 수집한다.
7. v2.10 `evaluate`를 실행한다.
8. 결과는 descriptive metric으로 보고한다.
9. 개선 아이디어가 생기면 기존 cohort는 development set으로 명시하고, 변경된 엔진은 새 independent holdout cohort에서 다시 검증한다.

## 개인정보

HMAC secret은 repo/manifest에 저장하지 않는다.

manifest에 raw name, exact birth profile, coordinates를 출력하지 않는다.

case ID는 secret-keyed commitment의 일부이며 원문 profile을 직접 노출하지 않는다.

검증 CLI 실패 시 raw exception을 출력하지 않고 generic failure만 반환한다.
