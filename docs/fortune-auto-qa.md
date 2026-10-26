# 별빛의 운명 — 자동 운세 검증

## 현재 가능한 것

- GitHub Actions **Fortune Quality Audit**는 매 PR마다 검사기의 정상/오류 사례를 테스트하고,
  20개의 **가상 프로필 식별자** × 일/주/월/년 4종 = 80개의 **QA 전용 센티널**에 대한
  HTML/JSON 보고서를 생성합니다. **Gemini 해설 80개를 생성한 것이 아닙니다.**
- **Reading Visual QA**는 기존 Playwright 모바일 화면/저장 이미지 캡처를 유지하고,
  해당 화면의 넘침·카드 누락·저장 장수 진단을 같은 HTML 보고서에 연결합니다.
  캡처는 GitHub Actions 아티팩트에 저장되므로 사람이 직접 촬영할 필요가 없습니다.
- 평가기는 미등록 근거 ID, 해설의 기간 밖 날짜·사건 확률, 서양·사주·태국 근거 반영,
  분야·프로필·기간 사이의 유사 반복 해설을 표시합니다. 중복 의심은 **검토(review)**이며
  근거 누락/날짜·확률 오류는 **실패(failed)**입니다.
- 실제 V23 결과에 대해서는 기존 6단계 해설 품질 검사기를 다시 실행합니다.
  규칙 기반 검사는 사실성/문장 품질을 100% 보증하지 않습니다.

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
- QA_USER_EMAIL: 운영 사용자와 분리된 QA 전용 이메일 계정
- QA_USER_PASSWORD: QA 전용 계정 비밀번호
- QA_CALC_API_URL: 통합 계산 POST 전체 URL (.../v1/fortune/integrated)

설정되지 않았다면 **실제 Gemini 검증은 실행되지 않습니다.**
개인 사용자의 JWT나 실제 운세 입력을 GitHub 코드/이슈/아티팩트에 올리지 마세요.
실행기가 매번 QA 계정으로 로그인해 새 JWT를 발급받으므로 만료형 access token을 secret으로 저장하지 않습니다.
QA 계정은 최소 권한의 app_access만 부여하고 실제 사용자 데이터와 분리하세요.
실제 서비스와 분리된 QA 프로젝트 및 비용 제한을 권장합니다.

## 기존 실제 응답 JSON 검증

외부에서 안전하게 수집한 *가상 프로필*의 실제 Gemini 응답을 검증할 수도 있습니다.

~~~bash
node --experimental-strip-types web/scripts/fortune-quality-audit.mjs \
  --mode live --input /secure/qa-cases.json --out /secure/qa-report
~~~

입력은 배열 또는 { "cases": [...] } 형식입니다. 각 항목은
id, profile_id, period_kind, payload(기간·evidence_ledger 포함),
result(V23 status 응답의 data, origin, interpreter_version 포함)를 가집니다.

**보고서에는 계산 원문, 출생정보, Gemini 해설 전문을 저장하지 않습니다.**
케이스 ID와 오류 코드/근거 ID/건수만 남기므로 ID도 가명으로 구성하세요.
원본 입력 JSON은 민감할 수 있으므로 비공개 보관 후 삭제하세요.

## 결과 해석

- fixture_only: true, live_gemini_cases: 0: 검증기 및 화면 테스트만 성공한 상태
- mode: live, live_gemini_cases > 0: 실제 Gemini V23 응답에 대한 검사 결과
- failed: 근거/시기/구조/품질 규칙 실패
- review: 반복 표현 등 사람이 확인해야 할 문제
- visual: Playwright 진단을 전달했을 때의 화면 결과

고정 fixture 모바일 검증은 320·350·393·430px에서 운세 결과의 빈 화면·가로 넘침·텍스트 잘림,
분야 카드 3개, 운세일, 계산 이유 펼치기와 이미지 2장 저장을 확인합니다. 이 결과는 실제 Gemini 응답 기반 화면 검증과 구분합니다.

문제가 생기면 **근거 계산/프롬프트/재작성 정책**을 고치며, 사용자에게
보일 운세 해설을 하드코딩하거나 자동으로 다른 문장으로 교체하지 않습니다.
