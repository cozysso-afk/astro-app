# 재회운 v2.4 단계 의미 분리 및 저장 사례 재검증

기준 브랜치: `fix/reunion-hierarchy-v2`  
기준 v2.3 HEAD: `e5fa26b8caeddad8dfc97cccb8947d968b043419`  
엔진: `reunion-hierarchy-v2.4-stage-semantics`

이 문서는 개인 출생정보를 포함하지 않는다. 저장 요청 3건은 암호화해 조회한 뒤 격리 프로세스의 메모리에서만 계산했다. 실제 사건 이력은 입력에서 제외했다.

## 수정 전 원인 분석

v2.3의 감정 단계 과통과는 단기 Moon 하나만의 문제가 아니었다.

| 관찰 | 2026 | 2027A | 판정 |
|---|---:|---:|---|
| 감정 hierarchy 통과 | 301일 | 256일 | 과통과 |
| 대표 근거가 Moon | 239일(79.4%) | 185일(72.3%) | 가설 1·2 지지 |
| 대표 근거가 progressed family | 133일(44.2%) | 117일(45.7%) | 가설 3 부분 지지 |
| 대표 근거가 return-angle | 0일 | 0일 | 가설 4 기각 |
| 대표 근거가 trine/sextile | 111일(36.9%) | 72일(28.1%) | 가설 5 지지 |

direct aspect만 허용하는 반사실 계산에서도 감정 통과는 2026년 298일, 2027년 252일이었다. 하루에 여러 Moon/Venus 접촉이 존재하므로 각 종류만 줄이는 것으로는 해결되지 않았다.

장기 관문의 단계 의미 공유가 더 큰 원인이었다. 동일한 `Secondary Progression(세컨더리 프로그레션/2차 진행) Mercury→Sun`이 감정·연락·만남·관계 재정의 장기 점수를 함께 열었다. 대표 장기 근거로 이 한 접촉이 사용된 날은 2027년 감정 274일, 관계 재정의 349일이었고, 2026년에도 각각 123일과 303일이었다. 따라서 단계별 단기 whitelist만 추가하면 장기 관문 과통과는 남는다.

2026년 기준일 이후 관계 재정의 0건은 단기 gate의 과소통과가 아니었다. v2.3에서 미래 104일 모두 Lunar Return(루나리턴/달회귀) 중기 점수가 기준 25 미만이었다. v2.4에서는 91일이 단계별 장기 관문에서 먼저 탈락했고, 남은 13일도 중기 점수가 기준 미만이었다. 미래 구간에서 단기 semantic gate까지 도달한 날이 없으므로 0건은 현재 근거에 맞는 결과다.

## 변경한 계산 규칙

임계값 `long=35`, `mid=25`, `event=12`와 최종 가중치는 변경하지 않았다.

### 장기 관문

공통 `PERSONAL × TARGETS` 풀을 단계별 장기 정책으로 바꿨다.

| 단계 | 진행/솔라아크 핵심 | 장기 트랜짓 핵심 |
|---|---|---|
| 감정 | Moon/Venus/Sun → Moon/Venus/Sun | slow planet → Moon/Venus/Sun |
| 연락 | Mercury → Mercury/Moon/Venus/Sun/DSC | Jupiter/Saturn/Uranus → Mercury/Venus/DSC |
| 만남 | Moon/Venus/Sun → ASC/DSC/Venus/Mars | Jupiter/Saturn/Uranus → ASC/DSC/Venus/Mars |
| 관계 재정의 | Venus/Sun → Moon/Venus/Sun/DSC/Saturn | Jupiter/Saturn → Moon/Venus/Sun/DSC/Saturn |

진행 Mercury→Sun은 연락의 장기 근거로 보존하지만 다른 세 단계의 장기 관문을 자동으로 열지 않는다. 양방향 진행/솔라아크 계산과 기존 정밀도는 유지한다.

### 사건 촉발

- conjunction/opposition/square만 exact-date direct trigger로 사용한다.
- trine/sextile/quincunx는 context-only로 남긴다.
- `natal_trigger`, `progressed_trigger`만 정확한 날짜 촉발 family다.
- `return_angle_trigger`는 context-only다.
- 연락은 Mercury → Mercury/Moon/Venus/DSC를 요구한다. Mercury→Sun 단독은 거부한다.
- 만남은 Mars → ASC/DSC/Venus/Mars를 요구한다. Moon 단독과 Mars→Moon은 거부한다.
- 관계 재정의는 Venus/Sun → DSC/Venus/Saturn 직접각을 요구한다. Mercury는 보조 문맥이며 단독 촉발이 아니다.
- 감정은 Venus 직접각을 우선한다. Moon은 natal Moon→Moon/Venus 직접각이면서 독립적인 Venus 관계 문맥이 같은 날 존재할 때만 촉발로 인정한다.

`fast_evidence`의 공개 크기는 유지했다. 표시되는 근거에는 `accepted_by_stage_policy`와 `rejection_reason`을 넣고, 일별 trace에는 대표 근거·채택/문맥 수·거부 사유 집계를 추가했다. 전체 rejected evidence 배열은 production payload에 저장하지 않는다.

raw numeric 진단은 모든 stage-related fast context 점수로 계산하고, 최종 `components.event_trigger`는 direct semantic evidence만 계산한다. 따라서 raw gate와 hierarchy gate를 다시 구분할 수 있다.

## v2.3 → v2.4 저장 사례 비교

| 사례 | 지표 | v2.3 | v2.4 |
|---|---|---:|---:|
| 2026 | total stage-days | 1,460 | 1,460 |
|  | raw numeric pass | 1,073 | 865 |
|  | hierarchy eligible | 790 | 324 |
|  | local peaks | 19 | 12 |
|  | nearest | 2026-09-22 | 2026-09-22 |
| 2027A/B | total stage-days | 1,460 | 1,460 |
|  | raw numeric pass | 785 | 583 |
|  | hierarchy eligible | 547 | 179 |
|  | local peaks | 57 | 39 |
|  | nearest | 2027-01-02 | 2027-01-02 |

### 단계별 hierarchy pass / local peak

| 사례 | 단계 | v2.3 | v2.4 |
|---|---|---:|---:|
| 2026 | 감정 | 301 / 6 | 133 / 5 |
|  | 연락 | 202 / 6 | 117 / 7 |
|  | 만남 | 172 / 7 | 32 / 0 |
|  | 관계 재정의 | 115 / 0 | 42 / 0 |
| 2027A/B | 감정 | 256 / 20 | 55 / 11 |
|  | 연락 | 120 / 14 | 69 / 14 |
|  | 만남 | 134 / 19 | 43 / 10 |
|  | 관계 재정의 | 37 / 4 | 12 / 4 |

후보 수 목표나 stage quota는 사용하지 않았다. 연락은 통과일이 줄었지만 2026 local peak가 6→7로 늘었다. 연속 구간이 의미 있는 개별 섬으로 분리되면서 생긴 결과이며, 개수를 맞추는 후처리를 하지 않았다는 증거다.

## 동일 사건의 단계 중복

| 사례 | 범위 | v2.3 2단계 사용 | v2.4 2단계 사용 | 3/4단계 사용 |
|---|---|---:|---:|---:|
| 2026 | 전체 accepted evidence | 100 | 12 | 0 |
|  | 대표 evidence | 30 | 7 | 0 |
| 2027A/B | 전체 accepted evidence | 22 | 2 | 0 |
|  | 대표 evidence | 4 | 1 | 0 |

v2.4의 남은 중복은 emotional↔rebuilding의 Venus 관계 접촉뿐이다. 두 단계가 서로 다른 장기·중기 관문을 통과한 경우에만 같은 Venus 사건이 쓰인다. contact↔rebuilding 중복은 0이 됐다.

## TOP 후보 추적

### 2026

| 날짜 | 단계 | Long | Mid | Event | Final | 대표 근거 |
|---|---|---:|---:|---:|---:|---|
| 2026-11-02 | 감정 | 87.30 | 62.65 | 100.00 | 76.22 | progressed Venus opposition Moon, orb 0.020879°, strength 93.016 |
| 2026-10-21 | 감정 | 87.77 | 61.42 | 100.00 | 76.07 | natal Venus opposition Venus, orb 0.019409°, strength 93.156 |
| 2026-11-28 | 감정 | 50.92 | 81.58 | 100.00 | 68.22 | progressed Venus opposition Moon, orb 0.014478°, strength 93.625 |

TOP3가 모두 감정인 이유는 감정 점수 ceiling만이 아니다. 세 후보 모두 고빈도 Moon이 아니라 Venus 직접각이다. 2026 미래에는 만남/재정의 hierarchy pass가 없고, 연락 local peak 최고점은 60.32로 감정 local peak 최저점 61.89보다 낮다. stage quota 없이 같은 점수식으로 비교한 결과다.

### 2027A/B

| 날짜 | 단계 | Long | Mid | Event | Final | 대표 근거 |
|---|---|---:|---:|---:|---:|---|
| 2027-05-17 | 감정 | 93.63 | 33.17 | 100.00 | 71.06 | progressed Venus conjunction Moon, orb 0.025092°, strength 97.491 |
| 2027-12-20 | 만남 | 78.96 | 33.48 | 100.00 | 66.01 | natal Mars square DSC, orb 0.011581°, strength 86.388 |
| 2027-05-26 | 감정 | 71.72 | 41.53 | 100.00 | 65.48 | natal Venus square Venus, orb 0.053132°, strength 87.112 |

## 성능과 결정성

동일 호스트·동일 프로세스 조건의 2회 반복 중앙값:

| 사례 | v2.3 | v2.4 | 변화 |
|---|---:|---:|---:|
| 2027A | 6.761초 | 5.822초 | -13.9% |
| 2027B | 7.322초 | 5.546초 | -24.3% |
| 2026 | 7.673초 | 6.242초 | -18.6% |

v2.4는 단계별 장기 관문에서 더 일찍 탈락하므로 중기·3시간 fast 샘플 계산을 덜 수행한다. 천문 표본 간격과 계산 정밀도는 변경하지 않았다. 절대 시간은 실행 부하에 따라 흔들리므로 같은 실행 환경의 상대값만 성능 판정에 사용했다.

2027A/B의 TOP3, nearest, 단계별 수, 선택 후보와 determinism digest가 완전히 일치했다. 각 사례를 반복 실행한 digest도 동일했다.

## 테스트

- 재회 계층/회귀/단계 테스트: 63 passed
- Thai 독립 회귀 묶음: 132 passed
- 전체 Calculation Audit 로컬 실행은 `de421.bsp`를 내려받는 과정에서 로컬 SSL 인증서 오류로 중단됐다. 계산 실패가 아니라 테스트 데이터 다운로드 환경 실패이며 GitHub CI에서 최종 확인한다.
- 추가 검증: 감정 단독 비승격, 연락/만남/재정의 독립성, direct/context 각 역할, return-angle 단독 거부, natal trigger 통과, Moon+Venus 결합 조건, Mercury→Sun 단계별 장기 분리, fast Venus의 장기 gate 우회 금지, trace 사유 표시.

## CI

v2.4 계산 커밋 `3f6ae1333bf50640eeeb0d00119017d9fcfe7378` 기준 세 workflow가 모두 통과했다.

| Workflow | 결과 | 실행 |
|---|---|---|
| Calculation Audit CI | PASS | https://github.com/cozysso-afk/astro-app/actions/runs/35513481277 |
| Web CI | PASS | https://github.com/cozysso-afk/astro-app/actions/runs/35513481284 |
| Interpretation Release CI | PASS | https://github.com/cozysso-afk/astro-app/actions/runs/35513481286 |

Calculation Audit CI가 `reunion_hierarchy_v2.py` 구문 검사와 `tests/test_reunion_hierarchy_v2.py`를 포함한 계산 감사 묶음을 직접 실행했다. 해설의 `reunion_hierarchy.validation.status == PASS` fail-closed 조건은 변경하지 않았다. CI 통과는 저장 사례 evidence 검증과 별개의 확인 항목으로 취급했다.

## A~H 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| A 감정 과통과 원인 식별 | PASS | Moon 빈도, supportive aspect, progressed family, 공통 장기 Mercury→Sun의 기여를 분리 측정 |
| B 단계별 evidence 의미 독립 | PASS | 단계별 장기·대상·direct aspect·family 정책과 독립 테스트 |
| C cross-stage 중복 감소 | PASS | 2027 전체 22→2, 대표 4→1; 2026 전체 100→12, 대표 30→7 |
| D 2026 rebuilding 0 원인 확인 | PASS | 미래 91일 long fail, 나머지 13일 medium fail; semantic gate 도달 전 탈락 |
| E TOP3 감정 독식 정당성 | PASS | 2026 TOP은 Venus 직접각이며 타 단계 미래 점수/관문이 낮음; 2027 TOP3에는 만남 포함 |
| F 과소통과 없음 | PASS | 2026 12개, 2027 39개 공개 피크; 2027 네 단계 모두 후보 존재 |
| G duplicate 결정성 | PASS | 2027A/B 및 반복 실행 digest 일치 |
| H runtime 유지 | PASS | 같은 환경에서 13.9~24.3% 단축 |

## 남은 문제와 다음 단계

- 2026 미래 만남·관계 재정의 0건은 현재 장기/중기 근거에 따른 결과다. 더 많은 독립 커플 표본이 없으므로 일반화는 `UNVERIFIED`다.
- 2027 nearest 1월 2일은 기존 guard-band 재검증에서 조회 시작 경계 산물이 아닌 것으로 확인됐지만, 실제 사건 적중성은 이 audit의 범위가 아니다.
- 감정 event score 100점 포화는 2026 hierarchy 통과일 133일 중 27일, 2027 55일 중 14일 남아 있다. v2.3의 117일/107일보다는 줄었으나 향후 별도 점수 ceiling 연구 대상이다.
- v2.4 단계 의미와 성능은 DST/timezone provenance 작업으로 넘어갈 수 있는 상태다. 다만 다른 커플 저장 표본이 생기면 v2.5 전에 같은 evidence audit을 반복해야 한다.

원시 개인 정보 없는 집계 데이터는 `docs/reunion-hierarchy-v2.4-saved-audit.json`에 있다.
