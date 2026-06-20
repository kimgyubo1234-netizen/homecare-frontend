# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요
독거노인 안전 모니터링 시스템 — 프론트엔드 (졸업작품 MVP)  
백엔드(Flask + PostgreSQL + S3 + mediamtx)는 EC2 54.116.119.98에서 운영 중. 도메인: homecare.p-e.kr (HTTPS)

## 개발 명령어

```bash
# 프로젝트 초기화 (최초 1회)
npm create vite@latest . -- --template react-ts
npm install

# 의존성 설치
npm install react-router-dom @tanstack/react-query zustand react-hook-form zod date-fns
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui 초기화
npx shadcn-ui@latest init

# 개발 서버
npm run dev

# 빌드
npm run build

# 타입 체크
npx tsc --noEmit
```

## 기술 스택
- **Vite** + **React 18** + **TypeScript** (strict mode)
- **React Router v6** — 라우팅
- **TanStack Query v5** — 서버 상태 (캐시, 폴링, refetch)
- **Zustand** — auth 상태만 (access_token, user_id, email, role)
- **Tailwind CSS v3** + **shadcn/ui**
- **react-hook-form** + **zod** — login form 검증
- HTTP: 기본 `fetch` (axios 없음)
- SSE: `fetch` streaming — `EventSource`는 Authorization 헤더를 보낼 수 없어서 사용 금지

## 환경 변수 (`.env.local`)
```
VITE_API_BASE=https://homecare.p-e.kr
VITE_MEDIA_BASE=https://homecare.p-e.kr
```
코드에 IP 하드코딩 금지. 항상 `import.meta.env.VITE_API_BASE` 사용.

## 권장 디렉토리 구조
```
src/
  api/          # fetch 래퍼, query key 상수
  components/   # 재사용 UI 컴포넌트
    layout/     # AppLayout, SideNav, Header
    video/      # VideoPlayer (WHEP)
    sse/        # SseProvider
  pages/        # Login, Dashboard, Alerts
  store/        # Zustand auth store
  lib/          # zod 스키마, 유틸 (날짜 변환 등)
  router/       # 라우트 정의, AuthGuard
```

## 핵심 아키텍처

### 인증 흐름
1. POST `/api/v1/auth/login` → `access_token` 수신
2. Zustand store + `localStorage`에 저장
3. 모든 API 요청: `Authorization: Bearer <access_token>` 헤더
4. 401 응답 시: 토큰 삭제 → `/login` 리다이렉트 + 토스트

### 라우트 구조
```
/login          — 비인증 전용
/dashboard      — AuthGuard 필요, 기본 경로
/alerts         — AuthGuard 필요
```

### 환자 목록 조회 (임시)
백엔드에 patient-list API 없음. `/api/v1/events?limit=500` 결과에서 `unique patient_id` 추출하여 사용.

### VideoPlayer — WHEP 프로토콜
mediamtx의 WHEP 엔드포인트: `${VITE_MEDIA_BASE}/<patientCode>/whep`  
WebRTC `RTCPeerConnection`으로 연결. 로딩/에러/재시도 상태 처리 필수.

### SSE 연결 (`SseProvider`)
`fetch`로 `/api/v1/alerts/stream` 스트리밍. 이벤트 타입:
- `CONNECTED` / `PING` — 무시 또는 연결 상태 업데이트
- `ALERT` — TanStack Query 캐시 업데이트 + 토스트
- `RISK_SCORE` — TanStack Query 캐시 업데이트

## API 응답 컨벤션
- datetime: ISO-8601 UTC, 필드명에 `_utc` 접미사 → 표시 전 KST 변환 필수
- 환자 식별자: `patient_id` (API), `patient_code` (DB 내부, 사용 안 함)
- 4xx 에러: `{ "error": "<snake_case_code>" }`
- 주요 에러 코드: `email_and_password_required`, `invalid_credentials`, `access_denied`, `patient_not_found`

## UI 컨벤션
- **위험도 색상**: `high` → `text-red-500`, `medium` → `text-yellow-500`, `low` → `text-green-500`
- **시간 표시**: 모두 KST 로컬 시간 (`date-fns` 또는 `Intl.DateTimeFormat`)
- **토스트**: 우측 상단 fixed, 5초 자동 소멸
- **언어**: 한국어 UI
- **반응형**: 데스크탑 우선 (1280px+)

## Scope 주의
다음은 Phase 2 (발표 후) 범위 — MVP에 포함하지 않음:
회원가입 UI, 환자 편집/추가/삭제, 위험점수 트렌드 그래프, 통계/리포트, Push notification, 다크 모드, PWA, 단위/E2E 테스트, CI/CD
