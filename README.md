# 독거노인 안전 모니터링 — 프론트엔드

독거노인 생활 패턴(낙상, 이상행동, 활동 없음 등)을 실시간으로 감지·알림하는 시스템의 프론트엔드 MVP입니다.

## 실행

```bash
npm install
cp .env.example .env.local   # 환경변수 파일 생성 후 값 입력
npm run dev                   # http://localhost:5173
```

## 환경변수 (`.env.local`)

| 변수 | 설명 | 예시 |
|------|------|------|
| `VITE_API_BASE` | 백엔드 Flask API 주소 | `http://54.180.112.118:5000` |
| `VITE_MEDIA_BASE` | mediamtx WHEP 스트리밍 주소 | `http://54.180.112.118:8889` |

## 빌드

```bash
npm run build   # dist/ 생성 — 백엔드에서 정적 파일로 서빙 가능
```

## 기술 스택

- Vite 8 + React 18 + TypeScript (strict)
- TanStack Query v5 — 서버 상태 관리
- Zustand — 인증 토큰 전역 상태
- Tailwind CSS v3 + shadcn/ui
- react-hook-form + zod — 로그인 폼 검증
- SSE: fetch streaming (EventSource 미사용 — Authorization 헤더 불가)
- 영상: WebRTC WHEP (RTCPeerConnection)

## 알려진 제약 (Out of Scope)

- 회원가입 UI 없음 (관리자 계정은 백엔드에서 직접 생성)
- 환자 정보 편집·추가·삭제 없음
- 위험점수 트렌드 그래프 없음
- Push notification 없음
- 다크 모드, PWA 미지원
- 단위·E2E 테스트 없음
