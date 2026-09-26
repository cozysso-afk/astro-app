# 재회운 v2.7 event-specific return relocation timeline audit

## 범위

- PR #186은 Draft 상태를 유지한다.
- production deploy / merge / UI 구조·입력 UX 변경은 하지 않는다.
- v2.4의 stage 가중치, threshold, long/medium/trigger policy, ranking/local-peak 규칙은 재튜닝하지 않는다.
- v2.7은 v2.6의 정적 `forecast_location` 한계를 보완해 Return event별 위치 provenance를 명시적으로 선택하는 backend-only 입력을 추가한다.

## 문제

v2.6은 출생지를 current/return location으로 조용히 재사용하던 fallback을 제거하고, 명시적 `forecast_location`이 있을 때만 Return ASC/house geometry를 계산하도록 교정했다. 다만 하나의 정적 위치를 forecast 기간 전체에 적용하므로 여행·이동처럼 기간 중 실제 위치가 바뀌는 경우를 표현하지 못했다.

## v2.7 입력 모델

`RelationshipProfile`에 optional `forecast_location_timeline`을 additive하게 추가했다. 각 항목은 기존 `ForecastLocation`의 위치 필드와 UTC 구간을 가진다.

```json
{
  "forecast_location_timeline": [
    {
      "place_id": "optional opaque id",
      "latitude": 0.0,
      "longitude": 0.0,
      "timezone_id": "IANA/Zone",
      "start_utc": "2026-09-20T00:00:00Z",
      "end_utc": "2026-09-21T00:00:00Z"
    }
  ]
}
```

정책:

- `start_utc` / `end_utc`는 timezone-aware datetime만 허용하고 내부에서 UTC로 정규화한다.
- 구간은 `[start_utc, end_utc)` 반열린 구간이다. 따라서 정확히 `end_utc`인 event는 그 구간에 속하지 않는다.
- `end_utc > start_utc`여야 한다.
- 겹치는 구간은 validation failure로 거부한다. 서로 맞닿은 adjacent 구간은 허용한다.
- UI/사용자 입력 UX는 이번 버전에서 변경하지 않는다.

## event별 위치 resolution

Return exact UTC event마다 다음 순서로 위치를 결정한다.

1. exact UTC가 포함되는 `forecast_location_timeline` 구간
2. 매칭 구간이 없으면 기존 static `forecast_location`
3. 둘 다 없으면 위치 `unavailable`

`unavailable`일 때:

- planetary return exact crossing / planetary positions는 계속 계산한다.
- Return ASC/house geometry는 계산하지 않고 `angles={}` / `house_activations=[]`로 둔다.
- birth timezone은 local calendar label을 위한 fallback으로만 사용한다.
- birthplace 좌표를 current/return location으로 재사용하지 않는다.

## 천문 계산 불변성

위치 timeline은 다음에만 영향을 준다.

- Return event의 local calendar date label
- exact birth time reliability가 있는 경우 Return ASC / house geometry

Return exact UTC crossing과 planetary positions는 기존 geocentric 계산을 유지한다. 같은 exact UTC event를 New York과 Tokyo 위치로 각각 계산하는 regression에서 planetary positions는 완전히 동일하고 ASC만 달라지는 것을 검사한다.

## provenance

Event provenance에는 다음 종류의 정보만 남긴다.

- `source`: `forecast_location_timeline` / `forecast_location` / `unavailable`
- timezone id
- coordinate availability
- place-id presence
- timeline source인 경우 `timeline_index`
- calendar/angle policy

원 latitude/longitude 값은 결과 provenance metadata에 복제하지 않는다.

Top-level provenance는 timeline이 존재할 때 event-dependent policy와 interval count를 기록하며, 특정 event 위치라고 오해할 수 있는 단일 좌표를 노출하지 않는다.

## 테스트

`tests/test_return_relocation_v27.py`에서 다음을 검증한다.

1. timeline API payload의 additive 보존 및 UTC 정규화
2. naive datetime / 역전 구간 fail-closed
3. overlap 거부, adjacent 구간 허용
4. timeline match가 static location보다 우선하며 end boundary는 exclusive
5. timeline 밖 + static 없음이면 angles/houses 생략
6. timeline timezone이 event local calendar date를 결정
7. 동일 exact UTC에서 위치 변경 시 planetary positions 불변, ASC는 변경
8. event/top-level provenance에 원 좌표를 복제하지 않음

v2.6 + v2.7 focused relocation tests는 guarded patch 단계에서 15 passed였고, 최종 Calculation Audit CI에도 v2.7 fixture를 직접 포함했다.

## legacy saved-case private replay

기존 저장 사례 3건을 개인정보 원문을 저장소/문서에 남기지 않는 격리 runner에서 aggregate만 재실행했다. 세 입력 모두 `forecast_location` / `forecast_location_timeline`이 없는 legacy 입력이다.

v2.7 결과는 v2.6의 deterministic signature와 완전히 동일했다.

| 사례 | raw numeric gate | hierarchy eligible | local peaks | nearest | v2.6→v2.7 digest |
|---|---:|---:|---:|---|---|
| 2026 | 816 | 308 | 12 | 2026-09-22 contact | 동일 (`d702758b…`) |
| 2027A | 569 | 174 | 38 | 2027-01-02 emotional | 동일 (`ec57f3d5…`) |
| 2027B | 569 | 174 | 38 | 2027-01-02 emotional | 동일 (`ec57f3d5…`) |

2027 duplicate pair digest도 서로 완전히 동일했다. 모든 replay에서:

- validation `PASS`
- `nearest_in_public=true`
- `selection_implies_hierarchy_and_numeric=true`

격리 free Render의 v2.7 replay runtime은 약 54.7s / 48.494s / 46.995s였다. 성능 최적화 목적의 변경이 아니며 이 수치는 해당 격리 환경의 관측치로만 기록한다.

## CI

HEAD `54219c23d0543faceff3c7f4f9d918ebb1d75f3e`에서:

- Calculation Audit CI: PASS — run `35518438298`
- Web CI: PASS — run `35518438290`
- Interpretation Release CI: PASS — run `35518438301`

문서/임시 patch infra 정리 후 최종 HEAD에서도 세 CI를 다시 확인한다.

## 해석

v2.7은 stage 점수 튜닝이 아니라 location provenance의 표현력을 확장한 변경이다. 위치 timeline이 제공되지 않는 기존 입력의 계산 결과는 v2.6과 동일해야 하며 private replay가 이를 확인했다.

위치 timeline이 제공되는 경우에만 Return local-date / ASC / house evidence가 event별 위치에 따라 달라진다. planetary return 자체의 exact UTC와 planetary positions는 위치 입력과 독립적이다.

## 남은 제한

- timeline은 사용자가 제공한 위치 구간을 신뢰하는 schedule/proxy이며, 실제 물리적 위치를 외부 데이터로 증명하지 않는다.
- 현재 UI에는 forecast/current residence/travel timeline 입력 UX가 없다. 따라서 현 UI legacy 입력에서는 Return ASC/houses가 계속 의도적으로 생략된다.
- 여러 사람이 각기 다른 travel timeline을 갖는 더 복잡한 모델, GPS/history 연동, 자동 위치 추론은 포함하지 않는다.
