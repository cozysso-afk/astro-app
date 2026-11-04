# 일일 해설 운영 반영 — 2026-11-04

## 배포
- 일일 해설·공통 문서·폰트·이미지 저장: PR #331, main `62ac6bb5efbb733b6b28461da086e4cfe80b979a`.
- 모델 선택 이력이 없는 브라우저의 기본값: PR #332, main `50ced2a6f519c86168e86f0baff1d3d2176ceaec`. 저장된 3.6/3.7 선택은 유지한다. 이 기본 설정은 앱 공통 모델 선택에 해당한다.
- 운영 주소: https://astro-app-web-ten.vercel.app
- Vercel production `dpl_8aWrSDaHZKQ7e4LBmdRsmkwLUw7K`: READY, 운영 도메인 연결 확인.
- Supabase `fortune-interpret-v23-preview`: 배포 44, JWT 검증 유지. 검수한 소스 `81bcb1189b52e0075cbd9166a0e7289863346037`에 고정.
- 해설 버전: `supabase-ai-v23.11-daily-reading-contract-v18`.
- 별도 QA 함수는 HTTP 410 중지 상태 유지.

## 배포 전 확인
- PR #331 검사 6개, PR #332 검사 5개 모두 통과.
- 기본 모델 수정의 TypeScript 및 Vite production build 통과.
- 이전 두 실제 Gemini 결과의 일일 7탭·4개 너비·16장 이미지 검증은 [편집 검수 보고서](editorial-quality-final.md)에 기록했다.

## 운영 확인
- 실제 인증·계산·해설·탭·이미지 저장 실행: https://github.com/cozysso-afk/astro-app/actions/runs/41843271939
- 통과: 실제 로그인·계산·기본 3.7 모델·생성 작업 완료. 작업 `cd1abe43-8046-4083-a82a-c223df3a9a85`, Gemini 호출 2회.
- 7탭 × 4개 너비(320/350/393/430), 이미지 8장 본문 일치. 누락·잘림·브라우저 오류 없음. [실제 운영 결과](production-live/browser-report.json).
- 최초 실행은 테스트가 V22 공개 응답에서 생략되는 비용 추정치를 읽으려다 생성 전에 중단됐다(유료 0회). 인증된 V23 inspect를 조회하도록 수정 후 통과했다.

## 이미지 직접 검수 후 보완
- 분야 탭에 종합용 금전 주의문이 붙지 않게 범위를 분리했다. 원고를 다시 쓰거나 대체 문장을 만들지 않는다.
- 날짜만 반복하는 적용 시기 블록을 생략했다. 의미 있는 시기 문장은 유지한다.
- 일일 이미지 높이를 실제 내용에 맞춰 큰 빈 여백을 줄였다. 다른 운세의 이미지 규격은 유지한다.
- 실제 운영 생성 결과를 그대로 재사용한 로컬 화면·이미지 검사 통과. 모든 탭 준비 상태, 저장 이미지 7장 본문 보존. 관련 테스트 20개 및 production build 통과. 추가 Gemini 호출 없음. [결과](production-layout-final/browser-report.json).

## 복구 지점
- 이전 frontend: `dpl_CNXSkgbWHyvK4JPEbVuWSwqBaEC3`.
- 이전 V23 source pin: `ef83b7e4da0edf3629f4975f2e637fdfc9d7c069`.
- 실제 복구는 수행하지 않았다.
