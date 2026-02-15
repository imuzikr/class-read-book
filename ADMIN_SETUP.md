# Admin Setup Guide

이 문서는 이 프로젝트에서 관리자 권한을 안전하게 추가/운영하는 표준 절차입니다.

## 목표

- 관리자 권한은 클라이언트가 아니라 서버에서 검증
- 관리자 기능은 `/api/admin/*` 라우트에서만 처리
- 권한 기준은 Firestore `admins/{uid}` 문서 존재 여부
- Firestore Rules에 `isAdmin()` 정책 반영

## 이 프로젝트의 현재 기준 구현

- 서버 검증 유틸: `lib/server/requireAdmin.ts`
- Admin SDK 초기화: `lib/firebase/admin.ts`
- 관리자 API:
  - `app/api/admin/dashboard/route.ts`
  - `app/api/admin/users/[userId]/route.ts`
- 관리자 UI: `app/admin/page.tsx` (직접 Firestore 호출 금지, API만 호출)
- 규칙 문서: `FIRESTORE_RULES_FOR_MAP.md`

## 1) 환경변수 설정 (`.env.local`)

아래 3개를 추가합니다.

```env
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

주의:
- `FIREBASE_ADMIN_PRIVATE_KEY`는 큰따옴표 포함 권장
- 줄바꿈은 실제 엔터가 아니라 `\n` 문자열 유지
- `NEXT_PUBLIC_` 접두사 절대 사용 금지 (서버 전용)

## 2) Firebase Console에서 관리자 UID 확인

방법 A (권장):
- 앱에서 관리자 계정으로 로그인
- `http://localhost:3000/admin/debug` 접속
- 화면의 `UID` 확인

방법 B:
- Firebase Console -> Authentication -> Users
- 관리자 계정의 UID 확인

## 3) Firestore에 관리자 문서 등록

- Firebase Console -> Firestore Database -> 데이터
- 컬렉션 `admins` 생성 (없으면)
- 문서 생성:
  - 문서 ID: 반드시 관리자 UID와 동일
  - 필드 예시:
    - `email` (string)
    - `role` (string, 예: `super_admin`)
    - `createdAt` (timestamp)

중요:
- 문서 ID를 자동 생성하면 안 됩니다.
- 권한 판정은 `admins/{uid}` 존재 여부로만 합니다.

## 4) Firestore Rules 게시

- `FIRESTORE_RULES_FOR_MAP.md`의 코드블록(`rules_version = '2';`부터 마지막 `}`까지) 복사
- Firebase Console -> Firestore Database -> 규칙 탭에 붙여넣기
- `게시` 클릭

최소 확인 포인트:
- `function isAdmin()` 존재
- `match /admins/{adminId}` 존재
- `books`, `readingLogs`, `reviews`, `userBadges`에 `|| isAdmin()` 정책 포함

## 5) 개발 서버 재시작

환경변수 반영을 위해 서버를 재시작합니다.

```bash
npm run dev
```

## 6) 검증 시나리오 (필수)

### 관리자 계정
- `/admin` 접속 가능
- Network에서 `/api/admin/dashboard?limit=50` 상태코드 `200`
- 요청 헤더에 `Authorization: Bearer ...` 포함

### 일반 사용자 계정
- `/admin` 접속 시 홈(`/`)으로 리디렉트
- `/api/admin/*`는 호출되지 않거나 `401/403`

## 7) 문제 발생 시 빠른 진단

### `/api/admin/dashboard`가 `500`
- `.env.local`에 `FIREBASE_ADMIN_*` 3개가 정확히 있는지 확인
- 저장 후 서버 재시작했는지 확인
- `FIREBASE_ADMIN_PRIVATE_KEY`의 `\n` 형식 확인

### 관리자여도 `/admin` 접근 불가
- 로그인 계정 UID와 `admins` 문서 ID가 정확히 일치하는지 확인
- Rules 게시 완료 여부 확인
- 관리자 등록 계정과 현재 로그인 계정이 같은지 확인

### 브라우저에서 API 직접 호출 시 `401`
- 정상입니다. 주소창 직접 접근은 `Authorization` 헤더가 없기 때문입니다.

## 8) 보안 운영 권장

- 비밀값(`CLIENT_SECRET`, Admin private key)은 채팅/문서 공유 시 유출로 간주하고 즉시 재발급
- `.env.local`은 커밋 금지 (`.gitignore` 유지)
- 관리자 추가/삭제는 `admins` 컬렉션 문서 추가/삭제로 운영

## 9) 다음에 에이전트에게 요청할 때 템플릿

```text
관리자 권한 기능을 추가/개선해 주세요.

요구사항:
1) 관리자 검증은 서버에서만 수행
2) 관리자 기능은 /api/admin/* 라우트로만 처리
3) Firebase ID 토큰(Bearer) 검증 후 admins/{uid} 존재 확인
4) Firestore Rules에 isAdmin() + admins 컬렉션 정책 반영
5) 일반 사용자 /admin 접근 차단
6) env.example, 운영 문서(ADMIN_SETUP.md) 동기화
7) 관리자 200 / 일반사용자 401·403 검증까지 수행
```

## 10) 운영 점검표 (배포 전/후)

### 배포 전 체크리스트

- [ ] `.env.local`(개발), 배포 환경 변수(운영)에 `FIREBASE_ADMIN_*` 3개가 모두 설정되어 있다.
- [ ] `FIREBASE_ADMIN_PRIVATE_KEY`가 큰따옴표로 감싸져 있고 `\n` 문자열 형식이 유지되어 있다.
- [ ] `admins` 컬렉션에 관리자 문서가 있으며 문서 ID가 실제 관리자 UID와 일치한다.
- [ ] Firestore Rules 최신본이 게시되어 `isAdmin()` 및 `admins` 정책이 반영되어 있다.
- [ ] `app/admin/page.tsx`에서 관리자 데이터 접근은 `/api/admin/*` 호출로만 수행한다.
- [ ] 비밀값(`NAVER_CLIENT_SECRET`, Admin private key)이 커밋/문서/채팅에 노출되지 않았다.

### 배포 직후 체크리스트

- [ ] 관리자 계정 로그인 후 `/admin` 접속 시 대시보드가 정상 렌더링된다.
- [ ] Network에서 `/api/admin/dashboard?limit=50` 응답이 `200`이다.
- [ ] 관리자 화면에서 사용자 상세 조회 API(`/api/admin/users/...`)가 `200`이다.
- [ ] 일반 계정 로그인 후 `/admin` 접속 시 홈(`/`)으로 리디렉트된다.
- [ ] 일반 계정에서 `/api/admin/*` 호출이 `401` 또는 `403`으로 차단된다.
- [ ] 서버 로그에 `Firebase Admin SDK 환경 변수가 누락` 오류가 없다.

### 보안 정기 점검 (월 1회 권장)

- [ ] `admins` 컬렉션의 관리자 목록이 최신 운영 인원과 일치한다.
- [ ] 불필요한 관리자 문서(퇴사/권한 해제 대상)가 제거되어 있다.
- [ ] Firestore Rules가 임시 완화 없이 운영 정책을 유지하고 있다.
- [ ] 키/시크릿 교체 이력(발급일, 교체일)이 기록되어 있다.
- [ ] 비정상 관리자 API 접근 시도(401/403 급증)가 없는지 로그를 확인했다.

### 사고 대응 체크리스트 (키 유출 의심 시)

- [ ] 노출된 시크릿(`NAVER_CLIENT_SECRET` 등)을 즉시 재발급/폐기했다.
- [ ] 배포 환경 변수와 로컬 환경 변수를 모두 새 값으로 교체했다.
- [ ] 개발 서버/배포 서버를 재시작해 새 환경 변수를 반영했다.
- [ ] 관리자/일반 사용자 권한 시나리오를 재검증했다.
- [ ] 필요한 경우 `admins` 컬렉션을 감사해 불필요 권한을 정리했다.

