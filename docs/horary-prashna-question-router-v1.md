# Horary + Prashna Question Router V1

## 목적

별빛의 운명에서 자유문장 질문을 바로 점성술 해석으로 넘기지 않고, 먼저 **질문 도메인 + 복수 의도 + 선택지 + 관련 규칙 정책**으로 구조화하기 위한 V1 분류 사전이다.

이 단계의 AI는 차트를 해석하지 않는다. 질문을 계산 규칙으로 라우팅하는 역할만 한다.

## V1 구성

- 대표 질문 50개
- primary type 13개
  - LOST_ITEM
  - RELATIONSHIP
  - CAREER
  - EXAM_EDUCATION
  - MONEY
  - BUSINESS_CONTRACT
  - PROPERTY_MOVE
  - TRAVEL_FOREIGN
  - HEALTH
  - LEGAL_CONFLICT
  - FAMILY_CHILDREN
  - COMMUNICATION_NEWS
  - GENERAL_EVENT
- multi-intent 분류
  - YES_NO / TIMING / LOCATION / RECOVERY / CONTACT / RECONCILIATION / COMMITMENT
  - OPTION_RANKING / ACTION_ADVICE / OUTCOME / CAUSE
  - THIRD_PARTY_SYMBOLISM / THEFT_SYMBOLISM
  - JOB_OFFER / PROMOTION / PASS_FAIL / PURCHASE_SALE / SIGNING / PAYMENT / MOVE / TRAVEL / CONFLICT_RESOLUTION / NEWS_RESULT
- Western Horary policy와 Prashna D1 bhava policy를 분리 저장
- 건강·법률·금융·제3자 사생활 질문은 별도 risk profile로 라우팅

## 핵심 설계 원칙

1. **분류와 해석을 분리한다.**
   - classifier는 `primary_type`, `intents`, `policy_id`, `subject`, `counterparty`, `options`, `confidence`, `needs_clarification`만 만든다.
   - 실제 점성술 판단은 다음 단계의 Horary / Prashna 규칙 엔진이 담당한다.

2. **Western Horary와 Prashna를 합산하지 않는다.**
   - 두 체계는 독립적으로 판정하고 마지막에 `일치 / 부분일치 / 상충`만 비교한다.

3. **선택지 질문은 first-class intent다.**
   - 선택지가 2개 이상이면 `OPTION_RANKING`을 붙이고 원문 순서를 보존한다.
   - 예: 분실물 위치 3개 후보, A회사/B회사, 이번 달/다음 달.

4. **모호하면 한 번만 확인한다.**
   - 대상 하우스가 달라질 정도로 질문 주체가 불명확하거나 confidence가 낮으면 clarification을 1회 요청한다.
   - 그 외에는 `GENERAL_EVENT`로 억지 분류하지 않고 fallback한다.

5. **전통 Horary house routing을 기본으로 한다.**
   - querent: 1H ruler + Moon
   - personal movable possession: 2H
   - home/property: 4H
   - relationship/counterparty: 7H
   - career/status: 10H
   - long/foreign travel: 9H
   - messages/news: 3H
   - health/illness context: 6H
   - legal opponent: 7H + law/authority context

6. **Prashna V1은 D1 Whole Sign bhava routing만 고정한다.**
   - Lagna / Lagna lord / Moon을 공통 기반으로 둔다.
   - 질문 유형별 관련 bhava와 lord를 추가한다.
   - 학파별 특수 조합과 divisional chart는 V1 라우터 단계에서 강제하지 않는다.

## 대표 자료 확인

V1 정책은 특정 사이트의 문장을 복사한 데이터셋이 아니라, 전통 Horary/Prashna에서 반복적으로 쓰이는 질문 구조와 하우스 배정을 제품용 분류 계약으로 재작성한 것이다.

참고 확인 자료:

- Skyscript Horary introduction: https://www.skyscript.co.uk/horary_intro.html
- Skyscript relationship horaries: https://www.skyscript.co.uk/relationships.html
- Skyscript lost-object horaries: https://www.skyscript.co.uk/wit.html
- Skyscript 2nd house rulerships: https://www.skyscript.co.uk/2.html
- Skyscript 3rd house rulerships: https://www.skyscript.co.uk/3.html
- Skyscript 7th house rulerships: https://www.skyscript.co.uk/7.html

## V1 검증

`tests/test_horary_prashna_question_router_v1.py`

검증 항목:

- seed example 정확히 50개
- 모든 primary type에 최소 1개 예제 존재
- 모든 policy_id 유효
- 모든 intent가 허용 enum에 포함
- 2개 이상 선택지 질문은 `OPTION_RANKING` 포함
- 민감 도메인의 risk profile 명시
- Western / Prashna policy 분리
- production classifier prompt는 chart judgement를 금지

## 다음 구현 단계

1. `/v1/horary-prashna/classify` API
2. 브라우저 `현재 위치 사용` 버튼 → latitude/longitude 수집
3. 질문 시각 자동 기록 + 사용자 수정 옵션
4. Western Horary chart 계산
5. Prashna D1 계산
6. question policy 기반 significator/bhava evidence 생성
7. Yes/No / timing / location / option ranking scorer
8. 두 체계 독립 결론 + 교차 비교
9. AI는 evidence 설명만 담당

V1의 목적은 '50문장을 외워서 답하는 모델'이 아니라, 빅데이터가 없어도 자유질문을 안정적으로 계산 규칙에 연결하는 **라우팅 계약**을 만드는 것이다.
