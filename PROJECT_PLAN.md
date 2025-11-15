# 독서 활동 장려 웹 앱 프로젝트 계획서

## 📋 프로젝트 개요
학생들의 독서 활동을 게임화하여 장려하는 웹 애플리케이션

## 🎯 핵심 기능

### 1. 독서 기록 관리
- **책 등록**: 제목, 저자, 총 페이지 수, 시작일, 완독일
- **독서 분량 기록**: 일일 읽은 페이지 수 기록
- **독서 기간 추적**: 연속 독서 일수, 총 독서 일수
- **감상문 작성**: 책별 감상문 작성 및 관리

### 2. 게임화 요소
- **레벨 시스템**: 독서량에 따른 레벨업
- **경험치(EXP) 시스템**: 페이지 수, 연속 독서일, 감상문 작성 등으로 획득
- **뱃지 시스템**: 다양한 업적 달성 시 뱃지 획득
- **랭킹 시스템**: 클래스/학교 단위 랭킹 (익명화 옵션)

### 3. 통계 및 시각화
- **개인 대시보드**: 독서 통계, 진행 중인 책, 최근 활동
- **차트**: 월별 독서량, 연속 독서 일수 그래프
- **업적 현황**: 획득한 뱃지, 현재 레벨, 다음 레벨까지 남은 경험치

## 🛠 기술 스택 제안

### Frontend
- **프레임워크**: React + TypeScript
- **스타일링**: Tailwind CSS
- **상태 관리**: Zustand 또는 React Context
- **차트**: Chart.js 또는 Recharts
- **UI 컴포넌트**: shadcn/ui 또는 Material-UI

### Backend
- **프레임워크**: Next.js (Full-stack) 또는 React + Vite
- **데이터베이스**: Firebase Firestore
- **인증**: Firebase Authentication
- **스토리지**: Firebase Storage (이미지 파일용, 선택사항)
- **실시간 업데이트**: Firestore 실시간 리스너

### 배포
- **Frontend**: Firebase Hosting 또는 Vercel, Netlify
- **Backend**: Firebase Functions (서버리스 함수, 선택사항)
- **Database**: Firebase Firestore
- **인증**: Firebase Authentication

## 📊 Firestore 데이터베이스 스키마 설계

### Collection: `users` (사용자)
```typescript
// Document ID: userId (Firebase Auth UID)
{
  email: string
  name: string
  displayName?: string
  photoURL?: string
  level: number (기본값: 1)
  exp: number (기본값: 0)
  totalPagesRead: number (기본값: 0)
  totalBooksRead: number (기본값: 0)
  currentStreak: number (기본값: 0)
  longestStreak: number (기본값: 0)
  lastReadingDate?: Timestamp (마지막 독서일)
  createdAt: Timestamp
  updatedAt: Timestamp
  isAnonymous: boolean (랭킹 익명화 여부)
}
```

### Collection: `books` (책)
```typescript
// Document ID: auto-generated
{
  userId: string (Firebase Auth UID)
  title: string
  author: string
  totalPages: number
  currentPage: number (기본값: 0)
  startDate: Timestamp
  finishDate?: Timestamp
  status: 'reading' | 'completed' | 'paused'
  coverImage?: string (URL)
  createdAt: Timestamp
  updatedAt: Timestamp
}
// 인덱스: userId + status (복합 인덱스)
```

### Collection: `readingLogs` (독서 기록)
```typescript
// Document ID: auto-generated
{
  userId: string (Firebase Auth UID)
  bookId: string
  date: Timestamp (날짜만, 시간은 00:00:00)
  pagesRead: number
  notes?: string
  expGained: number (획득한 경험치)
  createdAt: Timestamp
}
// 인덱스: userId + date (복합 인덱스, 내림차순)
// 인덱스: userId + bookId + date (복합 인덱스)
```

### Collection: `reviews` (감상문)
```typescript
// Document ID: auto-generated
{
  userId: string (Firebase Auth UID)
  bookId: string
  content: string
  rating: number (1-5)
  createdAt: Timestamp
  updatedAt: Timestamp
}
// 인덱스: userId (단일 인덱스)
// 인덱스: bookId (단일 인덱스)
```

### Collection: `badges` (뱃지 정의)
```typescript
// Document ID: badgeId
{
  name: string
  description: string
  icon: string (이모지 또는 아이콘 이름)
  expReward: number (획득 시 보상 경험치)
  condition: {
    type: 'first_book' | 'streak_days' | 'books_completed' | 'pages_month' | 'reviews_written' | 'level_reached'
    value: number (조건 값)
  }
  order: number (표시 순서)
  createdAt: Timestamp
}
```

### Collection: `userBadges` (사용자 뱃지)
```typescript
// Document ID: auto-generated
{
  userId: string (Firebase Auth UID)
  badgeId: string
  earnedAt: Timestamp
}
// 인덱스: userId (단일 인덱스)
// 서브컬렉션으로 관리할 수도 있음: users/{userId}/badges/{badgeId}
```

### Collection: `rankings` (랭킹)
```typescript
// Document ID: userId + period (예: "userId_weekly")
// 또는 서브컬렉션: rankings/{period}/users/{userId}
{
  userId: string (Firebase Auth UID)
  period: 'daily' | 'weekly' | 'monthly' | 'all-time'
  totalExp: number
  rank: number (계산된 값, Cloud Function으로 업데이트)
  updatedAt: Timestamp
}
// 인덱스: period + totalExp (복합 인덱스, 내림차순)
```

### Firestore 인덱스 전략
- **복합 인덱스 필요**:
  - `books`: userId + status
  - `readingLogs`: userId + date (desc)
  - `readingLogs`: userId + bookId + date
  - `rankings`: period + totalExp (desc)

### Firestore 보안 규칙 예시
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자는 자신의 데이터만 읽고 쓸 수 있음
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /books/{bookId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    match /readingLogs/{logId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // 뱃지는 모든 사용자가 읽을 수 있음
    match /badges/{badgeId} {
      allow read: if request.auth != null;
      allow write: if false; // 관리자만 수정 가능 (Cloud Function 사용)
    }
    
    // 랭킹은 모든 사용자가 읽을 수 있음
    match /rankings/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Cloud Function으로만 업데이트
    }
  }
}
```

## 🎮 게임화 시스템 설계

### 경험치(EXP) 획득 규칙
- **페이지 읽기**: 1페이지당 1 EXP
- **연속 독서**: 연속 N일째 → N × 10 EXP (보너스)
- **감상문 작성**: 1개당 50 EXP
- **책 완독**: 100 EXP (보너스)
- **뱃지 획득**: 뱃지별 20-100 EXP

### 레벨 시스템
- 레벨 1: 0 EXP
- 레벨 2: 100 EXP
- 레벨 3: 250 EXP
- 레벨 4: 500 EXP
- 레벨 5: 1000 EXP
- 이후: 레벨 N = 레벨(N-1) × 1.5 (반올림)

### 뱃지 종류
1. **첫 걸음**: 첫 책 등록
2. **독서 습관**: 7일 연속 독서
3. **독서 마니아**: 30일 연속 독서
4. **완독가**: 첫 책 완독
5. **다독가**: 10권 완독
6. **감상가**: 첫 감상문 작성
7. **열정가**: 한 달에 500페이지 읽기
8. **마라토너**: 한 달에 1000페이지 읽기
9. **지속가**: 100일 연속 독서
10. **마스터**: 레벨 10 달성

## 📱 주요 페이지 구조

### 1. 로그인/회원가입 페이지
- Firebase Authentication 사용
- 이메일/비밀번호 기반 인증
- 소셜 로그인 옵션 (Google, GitHub 등)
- 비밀번호 재설정 기능

### 2. 대시보드 (메인 페이지)
- 오늘의 독서 목표 진행률
- 현재 읽고 있는 책 목록
- 연속 독서 일수 (Streak)
- 레벨 및 경험치 바
- 최근 활동 피드
- 빠른 액션 버튼 (독서 기록, 새 책 추가)

### 3. 독서 기록 페이지
- 캘린더 뷰로 일별 독서량 표시
- 오늘 읽은 페이지 수 입력
- 간단한 메모 작성

### 4. 내 서재 페이지
- 읽고 있는 책 목록
- 완독한 책 목록
- 읽고 싶은 책 목록 (선택사항)
- 책 추가/수정/삭제

### 5. 감상문 페이지
- 감상문 목록
- 감상문 작성/수정/삭제
- 별점 평가

### 6. 통계 페이지
- 월별 독서량 차트
- 연속 독서 일수 그래프
- 읽은 책 분류 통계
- 총 독서 시간 추정 (선택사항)

### 7. 업적 페이지
- 획득한 뱃지 갤러리
- 미획득 뱃지 (회색 처리)
- 각 뱃지의 획득 조건 표시

### 8. 랭킹 페이지
- 전체 랭킹
- 주간/월간/전체 기간 필터
- 내 순위 하이라이트
- 익명화 옵션

## 🎨 UI/UX 디자인 컨셉

### 컬러 팔레트
- **Primary**: 독서를 연상시키는 따뜻한 색상 (주황/갈색 계열)
- **Secondary**: 신뢰감 있는 파란색
- **Success**: 초록색 (목표 달성)
- **Background**: 밝고 깨끗한 흰색/회색

### 디자인 원칙
- **직관적**: 아이콘과 시각적 피드백 활용
- **게임적**: 레벨업, 뱃지 획득 시 축하 애니메이션
- **모바일 친화적**: 반응형 디자인
- **접근성**: 색상 대비, 키보드 네비게이션 지원

## 📅 개발 단계별 계획

### Phase 1: 기초 설정 (1주)
- [ ] 프로젝트 초기 설정 (Next.js + TypeScript)
- [ ] Firebase 프로젝트 생성 및 설정
- [ ] Firebase SDK 설치 및 초기화
- [ ] Firebase Authentication 설정 (이메일/비밀번호)
- [ ] Firestore 데이터베이스 생성 및 보안 규칙 설정
- [ ] 기본 레이아웃 및 네비게이션

### Phase 2: 핵심 기능 (2주)
- [ ] 책 등록/관리 기능
- [ ] 독서 기록 기능 (일일 페이지 입력)
- [ ] 연속 독서 일수 계산 로직
- [ ] 감상문 작성/관리 기능

### Phase 3: 게임화 시스템 (1.5주)
- [ ] 경험치 시스템 구현
- [ ] 레벨업 시스템 구현
- [ ] 뱃지 시스템 구현 (획득 조건 체크)
- [ ] 랭킹 시스템 구현

### Phase 4: 통계 및 시각화 (1주)
- [ ] 대시보드 통계 표시
- [ ] 차트 라이브러리 연동
- [ ] 개인 통계 페이지

### Phase 5: UI/UX 개선 (1주)
- [ ] 디자인 시스템 적용
- [ ] 애니메이션 추가
- [ ] 반응형 디자인 최적화
- [ ] 접근성 개선

### Phase 6: 테스트 및 배포 (0.5주)
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 성능 최적화
- [ ] 배포 및 모니터링 설정

## 🔒 보안 고려사항

### Firebase 보안
- **Firestore Security Rules**: 사용자별 데이터 접근 제어
- **Firebase Authentication**: 비밀번호는 자동 해싱 처리
- **인증 토큰**: Firebase Auth가 자동으로 관리
- **XSS 방지**: 입력값 검증 및 이스케이프
- **CORS**: Firebase Hosting에서 자동 처리
- **Rate Limiting**: Firebase App Check 사용 고려

### 추가 보안 기능
- **Firebase App Check**: 봇 및 악성 요청 방지
- **데이터 검증**: 클라이언트 및 서버 측 검증 (Cloud Functions)
- **익명화 옵션**: 랭킹에서 개인정보 보호

## 📈 향후 확장 가능성
- 책 추천 시스템 (AI 기반)
- 친구 추가 및 소셜 기능
- 독서 모임 생성
- 독서 챌린지 이벤트
- 모바일 앱 (React Native)
- 선생님용 관리자 페이지
- 학교/클래스 단위 통계

## 📝 참고사항
- 학생 개인정보 보호 (GDPR 준수)
- 익명화 옵션 제공
- Firebase 자동 백업 활용
- 사용자 피드백 수집 메커니즘
- Firestore 쿼리 최적화 (인덱스 설정)
- 실시간 업데이트를 위한 Firestore 리스너 활용
- 오프라인 지원 (Firestore 오프라인 영속성)

## 🔥 Firebase 특화 기능 활용

### Firestore 실시간 업데이트
- 독서 기록 실시간 동기화
- 랭킹 실시간 업데이트
- 뱃지 획득 알림

### Cloud Functions 활용 (선택사항)
- 랭킹 자동 계산 및 업데이트
- 뱃지 획득 조건 자동 체크
- 통계 집계 및 캐싱
- 알림 발송 (이메일/Push)

### Firebase Storage 활용 (선택사항)
- 책 표지 이미지 저장
- 감상문 첨부 이미지
- 프로필 사진

### Firebase Analytics
- 사용자 행동 분석
- 기능별 사용 통계
- 성능 모니터링

