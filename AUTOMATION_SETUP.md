# 별빛의 운명 · 자동 운세/아이폰 푸시 설정

현재 앱은 일일·주간·월간 AI 캐시 선생성, iPhone 홈 화면 웹앱 푸시, 딥링크, IndexedDB 장기 저장을 사용한다. 비밀값은 저장소 코드에 넣지 않고 GitHub Actions Secrets에서만 읽는다.

## 1. 필요한 비밀값

GitHub 저장소의 Settings → Secrets and variables → Actions → Repository secrets에는 아래 **2개만** 필요하다.

1. `ONESIGNAL_APP_API_KEY`: OneSignal App API Key. **절대 저장소 파일에 커밋하지 않는다.**
2. `ASTRO_APP_PIN`: Streamlit 앱 로그인에 쓰는 `APP_PIN`과 같은 값. 선생성 워커가 PIN 인증할 때만 사용한다.

`ONESIGNAL_APP_ID`는 비밀값이 아닌 공개 식별자이며 앱/워크플로 설정에 이미 반영되어 있으므로 Secret으로 만들지 않는다.

## 2. OneSignal Web Push 설정

OneSignal의 Site URL에는 하위 경로 없이 origin만 사용한다.

`https://cozysso-afk.github.io`

실제 홈 화면 설치 페이지:

`https://cozysso-afk.github.io/astro-app/`

Service Worker 파일은 `/astro-app/OneSignalSDKWorker.js`, scope는 `/astro-app/`로 설정되어 있다. 앱의 Service Worker는 OneSignal Web SDK v16 Service Worker를 불러온다.

## 3. iPhone 알림 허용

1. Safari에서 `https://cozysso-afk.github.io/astro-app/`를 연다.
2. 공유 → 홈 화면에 추가.
3. 홈 화면의 `별빛의 운명` 아이콘으로 실행한다.
4. 처음 표시되는 `🔔 알림 켜기`를 누르고 iOS 알림 권한을 허용한다.
5. 이후 예약 알림을 누르면 대상 일일/주간/월간 리포트로 연결된다.

## 4. 예약 시간

- 일일 AI 캐시 선생성: 매일 07:30 KST
- 일일 푸시: 매일 08:00 KST
- 주간 AI 캐시 선생성: 일요일 20:30 KST
- 주간 푸시: 일요일 21:00 KST
- 월간 AI 캐시 선생성: 매월 말일 19:30 KST
- 월간 푸시: 매월 말일 20:00 KST

월간 워크플로는 cron이 매일 실행되더라도 실제 말일인지 코드에서 다시 확인하고, 말일이 아니면 생성/발송하지 않는다.

GitHub Actions의 예약 실행은 GitHub 사정에 따라 몇 분 늦어질 수 있다.

## 5. 선생성 방식

`horoscope-prewarm.yml`은 Playwright 헤드리스 브라우저로 Streamlit을 연다. 자동화 URL에서는 브라우저 localStorage 기반 30일 자동로그인 확인만 건너뛰며, **PIN 검증 자체는 그대로 수행한다.** PIN이 맞아야 앱이 열리고 AI 리포트 생성 완료 표시를 확인한 뒤 성공 처리한다.

예약 주간 선생성은 일요일에 다음 월요일~일요일을 대상으로 한다. 수동 주간 테스트는 실행일과 관계없이 다음 월요일을 시작일로 잡는다. 수동 월간 테스트는 말일이 아니어도 다음 달을 대상으로 실행할 수 있으며, 예약 월간 실행의 말일 보호 로직은 그대로 유지한다.

이 선생성은 Streamlit 서버 캐시를 미리 데우는 방식이다. iPhone의 IndexedDB에 원격으로 데이터를 써넣는 것은 아니다. Streamlit 서버가 재시작되면 서버 캐시는 사라질 수 있지만, iPhone에 이미 저장된 IndexedDB 운세는 별도로 남는다.

## 6. 푸시 발송 방식

`horoscope-push-reminders.yml`은 OneSignal App API Key로 푸시를 보낸다.

OneSignal의 일반 `Subscribed Users` 세그먼트가 Apple Web Push 구독을 메시지 대상으로 잡지 못하는 사례가 실제 검산에서 확인되어, 운영 sender는 OneSignal의 구독 Export API로 **현재 살아 있는 Web Push 구독만 동적으로 발견**하고 `include_subscription_ids`로 직접 발송한다.

- Subscription ID는 저장소 코드에 하드코딩하지 않는다.
- Subscription ID는 Actions 로그에도 출력하지 않는다.
- PWA 재설치로 Subscription ID가 새로 생겨도 다음 발송 시 다시 발견한다.
- HTTP 200이어도 OneSignal 응답에 `errors`가 있거나 실제 message ID가 없으면 성공으로 처리하지 않는다.

## 7. 수동 테스트

필요할 때 GitHub → Actions에서 다음 두 워크플로를 수동 실행할 수 있다.

- `Pre-generate horoscope AI cache`: `daily`, `weekly`, `monthly` 중 하나를 골라 Streamlit AI 선생성을 검산한다.
- `Test horoscope push`: `daily`, `weekly`, `monthly` 중 하나를 골라 OneSignal 발송을 검산한다.

수동 주간은 다음 월요일, 수동 월간은 다음 달을 대상으로 한다. 전체 자동화의 PIN 인증 → Streamlit AI 선생성 → 활성 Web Push 구독 탐색 → OneSignal 직접 발송 경로는 구축 시 실제 E2E 테스트를 통과했다. 임시 E2E 워크플로와 트리거 파일은 검증 후 제거했다.

## 8. 저장 관련 주의

- iPhone 저장함의 주 저장소는 IndexedDB다.
- 지속 저장 허용 여부는 Safari/iOS 정책이 최종 결정한다.
- 저장함 JSON 백업에는 생성한 운세와 AI 해설, 선택적으로 기록한 실제 결과 데이터가 들어갈 수 있으므로 개인 파일처럼 보관한다.
- 백업 파일에는 Gemini API Key, OneSignal API Key, 앱 PIN을 넣지 않는다.
- 비밀값을 Issue, README, 소스코드, 커밋 메시지에 붙여 넣지 않는다.
