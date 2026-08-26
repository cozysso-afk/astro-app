# 별빛의 운명 · 자동 운세/아이폰 푸시 1회 설정

앱 코드는 일일·주간·월간 AI 캐시 선생성, iPhone 홈 화면 웹앱 푸시, 딥링크, IndexedDB 장기 저장을 준비해 둔다. 아래 값들은 계정 비밀값이라 코드에 직접 넣지 않고 GitHub Actions Secrets에만 둔다.

## 1. 필요한 값

- `ONESIGNAL_APP_ID`: OneSignal Web Push 앱의 App ID. 공개 식별자라 `push-config.js`에 반영되어도 된다.
- `ONESIGNAL_APP_API_KEY`: OneSignal REST API Key. **절대 저장소 파일에 커밋하지 않는다.**
- `ASTRO_APP_PIN`: Streamlit 앱 로그인에 쓰는 `APP_PIN`과 같은 값. 선생성 워커가 앱에 로그인할 때만 쓴다.

## 2. OneSignal Web Push 앱 설정

웹사이트 주소:

`https://cozysso-afk.github.io/astro-app/`

Service Worker 파일:

`OneSignalSDKWorker.js`

Service Worker scope:

`/astro-app/`

앱의 `OneSignalSDKWorker.js`는 OneSignal Web SDK v16 Service Worker를 불러오도록 이미 준비되어 있다.

## 3. GitHub Actions Secrets

GitHub 저장소의 Settings → Secrets and variables → Actions → New repository secret에서 아래 3개를 추가한다.

1. `ONESIGNAL_APP_ID`
2. `ONESIGNAL_APP_API_KEY`
3. `ASTRO_APP_PIN`

비밀값은 Issue, README, 소스코드, 커밋 메시지에 붙여 넣지 않는다.

## 4. 1회 마무리 실행

GitHub → Actions → `Finish astrology automation setup` → Run workflow를 한 번 실행한다.

이 워크플로는 다음을 한꺼번에 확인/적용한다.

- 공개 OneSignal App ID를 `push-config.js`에 반영
- IndexedDB 지속 저장 요청 기능
- 저장함 JSON 백업/복원 기능
- 푸시 딥링크 라우팅
- Python 문법 검사와 기능 마커 검사

성공 후 변경된 `app.py`/`push-config.js`만 자동 커밋한다.

## 5. iPhone에서 알림 허용

1. Safari에서 `https://cozysso-afk.github.io/astro-app/`를 연다.
2. 공유 → 홈 화면에 추가.
3. 홈 화면의 `별빛의 운명` 아이콘으로 실행한다.
4. 처음 표시되는 `🔔 알림 켜기`를 누르고 iOS 알림 권한을 허용한다.
5. 이후 알림을 누르면 대상 일일/주간/월간 리포트로 연결된다.

## 6. 예약 시간

- 일일 AI 캐시 선생성: 매일 07:30 KST
- 일일 푸시: 매일 08:00 KST
- 주간 AI 캐시 선생성: 일요일 20:30 KST
- 주간 푸시: 일요일 21:00 KST
- 월간 AI 캐시 선생성: 매월 말일 19:30 KST
- 월간 푸시: 매월 말일 20:00 KST

월간 워크플로는 매일 스케줄이 깨더라도 실제 말일인지 코드에서 다시 확인하고, 말일이 아니면 생성/발송하지 않는다.

## 7. 수동 검산

GitHub → Actions → `Test astrology automation`에서 `daily`, `weekly`, `monthly` 중 하나를 골라 수동 테스트할 수 있다.

선생성 워커는 Streamlit을 실제 브라우저로 열고 PIN을 입력한 뒤 AI 리포트/저장 표시가 나타나는지 확인한다. 실패 시 디버그 스크린샷을 Actions artifact로 남긴다.

## 저장 관련 주의

- iPhone 저장함의 주 저장소는 IndexedDB다.
- `지속 저장 모드` 허용 여부는 Safari/iOS 정책이 최종 결정한다.
- 저장함의 JSON 백업에는 사용자가 생성한 운세와 AI 해설 문장이 들어가므로 개인 파일처럼 보관한다.
- 백업 파일에는 Gemini API Key, OneSignal API Key, 앱 PIN을 넣지 않는다.
- Streamlit 선생성 캐시와 iPhone IndexedDB는 서로 다른 저장소다. Streamlit 서버가 재시작되면 서버 캐시는 사라질 수 있지만, iPhone에 이미 저장한 IndexedDB 운세는 별도로 남는다.
