# 📚 우리 반 독서 대장

학생들의 독서 활동을 게임화하여 장려하는 웹 애플리케이션입니다.

## 🚀 시작하기

### 필수 요구사항
- Node.js 18 이상
- npm 또는 yarn
- Firebase 프로젝트

### 설치 및 실행

1. 패키지 설치
```bash
npm install
```

2. 환경 변수 설정
`.env.local` 파일을 생성하고 Firebase 설정을 추가하세요:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

3. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📁 프로젝트 구조

```
class-read-book/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 인증 관련 페이지
│   ├── (dashboard)/       # 대시보드 페이지
│   └── layout.tsx         # 루트 레이아웃
├── components/            # 재사용 가능한 컴포넌트
│   ├── ui/               # 기본 UI 컴포넌트
│   └── features/         # 기능별 컴포넌트
├── lib/                  # 유틸리티 및 설정
│   ├── firebase/         # Firebase 설정
│   └── utils/            # 유틸리티 함수
├── hooks/                # Custom React Hooks
├── store/                # Zustand 상태 관리
└── types/                # TypeScript 타입 정의
```

## 🛠 기술 스택

- **Frontend**: Next.js 14, React, TypeScript
- **스타일링**: Tailwind CSS
- **상태 관리**: Zustand
- **데이터베이스**: Firebase Firestore
- **인증**: Firebase Authentication
- **차트**: Recharts

## 📖 주요 기능

- 📖 책 등록 및 관리
- 📝 일일 독서 기록
- 🔥 연속 독서 일수 추적
- ✍️ 감상문 작성
- 🎮 레벨 및 경험치 시스템
- 🏆 뱃지 시스템
- 📊 통계 및 시각화
- 🏅 랭킹 시스템

자세한 내용은 [PROJECT_PLAN.md](./PROJECT_PLAN.md)를 참고하세요.
