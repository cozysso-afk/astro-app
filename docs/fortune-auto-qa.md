# 별빛의 운명 — 자동 운세 검증

## 현재 가능한 것

- GitHub Actions **Fortune Quality Audit**는 매 PR마다 검사기의 정상/오류 사례를 테스트하고,
  20개의 **가상 프로필 식별자** × 일/주/월/년 4종 = 80개의 **QA 전용 센티널**에 대한
  HTML/JSON 보고서를 생성합니다. **Gemini 해설 80개를 생성한 것이 아닙니다.**
- **Reading Visual QA**는 기존 Playwright 모바일 화면/저장 이미지 캡처를 유지하고,
  해당 화면의 넘침·카드 누락·저장 장수 진단을 같은 HTML 보고서에 연결합니다.
  캡처는 GitHub Actions 아티팩트에 저장되므로 사람이 직접 촬영할 필요가 없습니다.
- 평가기는 미등록 근거 ID, 기간 밖 시기, 서로 다른 분야 간 중복 해설,
  서로 다른 프로필에 반복된 동일 해설을 표시합니다. 중복 의심은 **검토(review)**이며
  근거 누락/기간 오류는 **실패(failed)**입니다.
- 실제 V23 결과에 대해서는 기존 6단계 해설 품질 검사기를 다시 실행합니다.
  규칙 기반 검사는 사실성/문장 품질을 100% 보증하지 않습니다.
- `live_gemini_cases`는 응답의 문자열만 믿지 않습니다. 저장된 V23 생성 버전,
  최종 모델과 일치하는 2xx Gemini 호출 trace, 서버의 `provenance_verified=true`,
  품질 검증 6단계 전부 통과가 함께 확인된 건만 실제 Gemini 성공으로 셉니다.
- 검증되지 않은 저장본이나 이전 캐시는 사용자 운세 해설로 표시하지 않습니다.
  프론트엔드는 Gemini가 작성한 필드만 배치하고, 누락된 문장을 고정 문구로 채우지 않습니다.

## 실제 Gemini 검증 — 명시적 유료 호출 승인 시에만

워크플로 **Fortune Quality Audit → Run workflow**에서
confirm_paid_calls=YES, max_jobs=1..4를 지정하면 실제 계산 API →
V22 정밀도 게이트 → V23 Gemini → 상태 조회 → 검증 보고서를 순차 실행합니다.
기본 최대 2건, 상한 4건이며 1건당 서버 정책상 최대 2번의 Gemini 호출이 가능합니다.
검사기는 **무료 inspect 및 비용 한도 검사에 통과하기 전에는 start를 호출하지 않습니다.**
이 경로는 사용자의 실제 계정/개인정보가 아닌 가상 프로필만 사용합니다.

이 작업은 GitHub Actions secrets에 아래 5개가 구성되어야 동작합니다.

- QA_SUPABASE_URL: 별빛의 운명 QA 환경의 Supabase URL
- QA_SUPABASE_ANON_KEY: QA 환경 anon key
- QA_USER_EMAIL: 실제 사용자와 분리된 QA 전용 계정 이메일
- QA_USER_PASSWORD: QA 전용 계정 비밀번호
- QA_CALC_API_URL: 통합 계산 POST 전체 URL (.../v1/fortune/integrated)

설정되지 않았다면 **실제 Gemini 검증은 실행되지 않습니다.**
개인 사용자의 JWT나 실제 운세 입력을 GitHub 코드/이슈/아티팩트에 올리지 마세요.
워크플로는 실행할 때마다 QA 전용 계정으로 로그인해 짧게 유지되는 사용자 JWT를 새로 받습니다.
하위 호환을 위한 `QA_USER_ACCESS_TOKEN`도 지원하지만, 만료되므로 자동 QA에는 권장하지 않습니다.
실제 서비스와 분리된 QA 프로젝트 및 비용 제한을 권장합니다.

## 기존 실제 응답 JSON 검증

외부에서 안전하게 수집한 *가상 프로필*의 실제 Gemini 응답을 검증할 수도 있습니다.

~~~bash
node --experimental-strip-types web/scripts/fortune-quality-audit.mjs \
  --mode live --input /secure/qa-cases.json --out /secure/qa-report
~~~

입력은 배열 또는 { "cases": [...] } 형식입니다. 각 항목은
id, profile_id, period_kind, payload(기간·evidence_ledger 포함),
result(V23 status 응답의 data, origin, provenance_verified, interpreter_version,
model, usage.generation_version, usage.call_trace, usage.quality_validation 포함)를 가집니다.

**보고서에는 계산 원문, 출생정보, Gemini 해설 전문을 저장하지 않습니다.**
케이스 ID와 오류 코드/근거 ID/건수만 남기므로 ID도 가명으로 구성하세요.
원본 입력 JSON은 민감할 수 있으므로 비공개 보관 후 삭제하세요.
실패 보고서에는 원문 오류나 프롬프트 대신 모델, 호출 종류, HTTP 결과 분류,
finish reason, 토큰 수, 6단계 통과 여부만 남겨 비용·실패 원인을 안전하게 감사합니다.

## 결과 해석

- fixture_only: true, live_gemini_cases: 0: 검증기 및 화면 테스트만 성공한 상태
- mode: live, live_gemini_cases > 0: 실제 Gemini V23 응답에 대한 검사 결과
- failed: 근거/시기/구조/품질 규칙 실패
- review: 반복 표현 등 사람이 확인해야 할 문제
- visual: Playwright 진단을 전달했을 때의 화면 결과

문제가 생기면 **근거 계산/프롬프트/재작성 정책**을 고치며, 사용자에게
보일 운세 해설을 하드코딩하거나 자동으로 다른 문장으로 교체하지 않습니다.
