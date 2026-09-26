# 재회운 v2.5 IANA timezone / historical DST audit

## 범위

- PR #186의 Draft 상태를 유지한다.
- UI, 사용자 입력 UX, stage 가중치/임계값/선별 정책은 변경하지 않는다.
- 출생 local civil time을 UTC instant로 바꾸는 provenance만 추가한다.
- current residence, forecast location, return relocation은 이 버전의 범위가 아니다.

## 수정 전 데이터 흐름

| 경로 | v2.4 동작 | 위험 |
|---|---|---|
| API profile | `utc_offset_hours`만 전달 | 역사적 DST를 표현할 수 없음 |
| natal / Davison | local datetime에서 고정 offset 차감 | IANA provenance 없음 |
| progression / solar arc | birth UTC를 경로별로 다시 계산 | 향후 중복 적용 위험 |
| returns | birth UTC와 return local date를 고정 offset으로 계산 | 역사적 local date가 달라질 수 있음 |
| hierarchy query day | 별도 `query_utc_offset_hours` 사용 | 출생/조회 개념은 분리됐지만 IANA 미지원 |
| Saju | local civil time + fixed legal offset으로 true-solar 보정 | 역사적 legal offset 미지원 |

검토한 경로에서는 고정 offset이 실제로 두 번 적용되는 현재 버그는 발견되지 않았다. 다만 동일 birth UTC 변환이 여러 함수에 복제돼 있어 IANA 추가 시 이중 변환이 생길 위험이 있었다.

## v2.5 설계

`timezone_provenance_v1.resolve_local_datetime()`를 canonical resolver로 사용한다.

우선순위는 다음과 같다.

1. 명시된 유효한 `timezone_id`의 IANA historical offset
2. `timezone_id`가 없을 때 기존 `utc_offset_hours`
3. 두 값이 모두 없을 때 legacy default UTC+9

명시된 IANA ID가 잘못됐으면 fixed offset으로 조용히 fallback하지 않고 validation failure로 종료한다. IANA가 선택되면 fixed offset은 적용하지 않는다.

결과 provenance에는 zone ID, source, 실제 resolved offset, fold, local-time status, 적용 policy를 기록한다. 이름·출생 payload·주소는 기록하지 않는다.

## DST 경계 정책

| 입력 상태 | 정책 |
|---|---|
| 정상 local time | IANA historical offset 적용 |
| ambiguous local time, fold 입력 있음 | 명시된 fold 0/1 사용 |
| ambiguous local time, fold 없음 | 결정적으로 fold=0 사용하고 provenance 기록 |
| nonexistent local time | 자동 이동 없이 validation failure |
| invalid timezone ID | fixed offset fallback 없이 validation failure |

## downstream 적용

- Natal, synastry, Davison, progression, solar arc는 동일 resolved birth UTC를 재사용한다.
- Return exact crossing은 UTC로 유지하고, 화면용 local date만 해당 출생 zone으로 변환한다.
- Return house location은 기존처럼 entered birthplace fallback이다. relocation 정확성으로 주장하지 않는다.
- Query timezone은 birth timezone과 별도 필드/metadata로 유지한다.
- Saju는 기존 local civil-time 의미와 절기/true-solar 공식을 유지한다. canonical resolver에서 얻은 역사적 legal offset만 전달한다.

## fixture 검증

- Modern `Asia/Seoul`: UTC+9 fixed input과 동일 UTC instant
- Historical `Asia/Seoul` 1988 summer: IANA UTC+10, fixed UTC+9와 1시간 차이
- Historical Korea spring transition: nonexistent local time fail-closed
- Historical Korea autumn transition: fold=0 default와 fold=1 명시가 1시간 차이
- `America/New_York`: winter UTC-5 / summer UTC-4
- New York spring transition: nonexistent local time fail-closed
- IANA + contradictory fixed offset: IANA만 한 번 적용
- 두 사람의 서로 다른 timezone ID: 독립 resolution
- natal / progression / return: 같은 birth UTC epoch 재사용
- Saju: local date/time 불변, historical legal offset만 전달

## legacy saved-case regression

개인정보는 암호화 조회 후 권한 600 임시 파일에서만 사용했으며 replay 직후 안전 삭제했다. 저장소나 로그에는 원문을 남기지 않았다.

| 사례 | v2.4 hierarchy eligible | v2.5 | v2.4 peaks | v2.5 | nearest | digest | runtime v2.4 → v2.5 |
|---|---:|---:|---:|---:|---|---|---:|
| 2026 | 324 | 324 | 12 | 12 | 2026-09-22 contact | 동일 | 4.462s → 4.345s |
| 2027A | 179 | 179 | 39 | 39 | 2027-01-02 emotional | 동일 | 3.992s → 4.204s |
| 2027B | 179 | 179 | 39 | 39 | 2027-01-02 emotional | 동일 | 4.161s → 4.074s |

세 사례 모두 totals, stage distribution, nearest, TOP3, score components, deterministic digest가 동일했다. 2027 duplicate pair도 같은 digest를 유지했다.

## 테스트

- timezone/relationship/reunion 집중 회귀: 95 passed
- Saju/personal/integrated 보조 회귀: 50 passed
- 로컬 전체 Calculation Audit 중 JPL gold fixture는 sandbox에서 외부 ephemeris download가 차단돼 완주하지 못했다. GitHub CI의 ephemeris cache 환경에서 최종 판정한다.

## 남은 제한

- Return ASC/houses는 현재 거주지나 실제 return location이 아니라 entered birthplace를 사용한다.
- Forecast/current residence timezone과 travel relocation은 아직 입력받지 않는다.
- legacy fixed-offset 입력은 결과를 보존하지만 역사적 DST provenance 자체는 `UNVERIFIED`다.
