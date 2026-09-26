# 재회운 v2.6 return relocation provenance audit

## 범위

- PR #186은 Draft 상태를 유지한다.
- production deploy / merge / UI 변경은 하지 않는다.
- v2.4의 stage 가중치, threshold, long/medium/trigger policy, ranking/local-peak 규칙은 재튜닝하지 않는다.
- v2.6은 return local-date / ASC / house 계산의 위치 provenance만 교정한다.

## 문제

v2.5까지 planetary return exact crossing 자체는 UTC로 정확히 계산했지만, return ASC/house geometry에는 입력된 출생지 좌표를 fallback으로 사용했다. 출생지는 사용자의 현재 거주지나 해당 return 시점의 실제 위치라는 보장이 없으므로, 이를 current/forecast location처럼 취급하면 근거가 없는 위치 가정이 된다.

## v2.6 정책

`RelationshipProfile`에 backend-only optional `forecast_location`을 additive하게 추가했다.

```json
{
  "place_id": "optional opaque id",
  "latitude": 0.0,
  "longitude": 0.0,
  "timezone_id": "IANA/Zone"
}
```

- UI/사용자 입력 UX는 이번 버전에서 변경하지 않는다.
- `forecast_location`이 있으면 그 IANA timezone을 return local calendar date에 사용하고, 그 latitude/longitude를 ASC/house geometry에 사용한다.
- return ASC/houses는 `forecast_location`이 있고 birth time reliability가 exact일 때만 admit한다.
- `forecast_location`이 없으면 planetary return exact crossing/planetary positions는 계속 계산하지만 `angles={}` / `house_activations=[]`로 둔다.
- 출생지 좌표를 current/return location으로 조용히 재사용하지 않는다.
- 위치가 없을 때 birth timezone은 local-date 표시를 위한 calendar fallback일 뿐, return geometry provenance가 아니다.
- provenance에는 source/timezone/coordinate availability/place-id presence/policy만 남기며 원 좌표를 결과 metadata에 복제하지 않는다.

## 천문 계산 불변성

Return의 exact UTC crossing과 행성 위치는 관측 위치와 무관한 geocentric planetary calculation으로 유지한다. v2.6의 위치 입력은 local-date label과 return ASC/house geometry에만 관여한다.

Synthetic regression에서 같은 exact UTC event에 대해 forecast location을 바꿔도 planetary positions는 동일하고, angle/house geometry만 달라짐을 검사한다.

## 테스트

`tests/test_return_relocation_v26.py`에 다음 회귀를 추가했다.

1. optional additive `forecast_location` API payload 보존
2. invalid forecast IANA timezone fail-closed
3. forecast location 미지정 시 birthplace를 return angle에 재사용하지 않음
4. 명시 location이 return ASC/house geometry를 구동
5. location 변경 시 planetary positions 불변
6. forecast timezone이 return local calendar date를 결정
7. forecast location이 있어도 exact birth time이 아니면 return angles/houses 미사용

Calculation Audit CI가 이 테스트를 직접 실행하도록 workflow도 갱신했다.

## saved-case private replay

기존 저장 사례 3건은 개인정보 원문을 저장소/문서에 남기지 않고 격리 Render runner에서 aggregate만 출력했다. 이 입력에는 `forecast_location`이 없으므로 v2.6은 과거의 unsupported birthplace return-house evidence를 제거한다. 따라서 v2.5와의 완전 동일성은 성공 조건이 아니며, 변화가 해당 제거에 한정되는지를 본다.

| 사례 | 지표 | v2.5 | v2.6 |
|---|---|---:|---:|
| 2026 | raw numeric gate | 865 | 816 |
| 2026 | hierarchy eligible | 324 | 308 |
| 2026 | public/local peaks | 12 | 12 |
| 2026 | nearest | 2026-09-22 contact | 동일 |
| 2027A/B | raw numeric gate | 583 | 569 |
| 2027A/B | hierarchy eligible | 179 | 174 |
| 2027A/B | public/local peaks | 39 | 38 |
| 2027A/B | nearest | 2027-01-02 emotional | 동일 |

### stage hierarchy pass

| Stage | 2026 v2.5 → v2.6 | 2027 v2.5 → v2.6 |
|---|---:|---:|
| emotional_reactivation | 133 → 128 | 55 → 55 |
| contact_recontact | 117 → 117 | 69 → 69 |
| in_person_meeting | 32 → 29 | 43 → 43 |
| relationship_rebuilding | 42 → 34 | 12 → 7 |

2026 TOP3의 날짜/단계/final score는 v2.5와 동일했다: 2026-11-02 emotional 76.22, 2026-10-21 emotional 76.07, 2026-11-28 emotional 68.22.

2027 TOP3의 날짜/단계 순서는 유지됐고 unsupported house evidence 제거로 일부 medium/final score가 낮아졌다: 2027-05-17 emotional 70.74, 2027-12-20 meeting 66.01, 2027-05-26 emotional 64.99. nearest는 2027-01-02 emotional로 유지됐다.

2027 duplicate pair는 totals, stage distribution, selected set, TOP/nearest를 포함한 deterministic digest가 완전히 동일했다 (`ec57f3d…`).

모든 replay는 validation PASS, `nearest_in_public=true`, `selection_implies_hierarchy_and_numeric=true`였다.

격리 free Render의 v2.6 replay runtime은 약 54.2s / 49.7s / 49.7s였다. 이는 v2.5의 이전 4초대 실행과 동일 환경이 아니므로 성능 회귀 비교 수치로 사용하지 않는다.

## 해석

Candidate 수 감소는 threshold/weight/stage 정책 변경 때문이 아니다. `forecast_location`이 없는 legacy 입력에서 근거가 없던 birthplace-based return house activations를 제거한 결과 medium evidence 일부가 사라진 것이다. 핵심 nearest와 2026 TOP3는 유지됐고 2027 duplicate 결정성도 유지됐다.

## 남은 제한

- `forecast_location`은 forecast 기간 전체에 적용하는 하나의 정적 위치 proxy다. 실제 travel itinerary나 return 순간의 물리적 위치를 증명하지 않는다.
- event-specific / date-specific relocation timeline은 아직 모델링하지 않는다.
- UI에는 아직 forecast/current residence 입력이 없다. 따라서 현 UI의 legacy 입력에서는 return ASC/houses를 의도적으로 생략한다.
- planetary return 자체는 location 없이도 계속 유효하다.
