# 🔥 Firebase 연결 체크리스트

## ✅ 단계별 체크리스트

### 1단계: Firebase 프로젝트 생성
- [ ] [Firebase Console](https://console.firebase.google.com/) 접속
- [ ] "프로젝트 추가" 클릭
- [ ] 프로젝트 이름 입력 (예: `class-read-book`)
- [ ] Google Analytics 설정 (선택사항)
- [ ] 프로젝트 생성 완료

### 2단계: Authentication 활성화
- [ ] Firebase Console에서 프로젝트 선택
- [ ] 왼쪽 메뉴에서 **Authentication** 클릭
- [ ] **시작하기** 버튼 클릭
- [ ] **Sign-in method** 탭 클릭
- [ ] **이메일/비밀번호** 활성화
- [ ] **저장** 클릭

### 3단계: Firestore Database 생성
- [ ] Firebase Console에서 **Firestore Database** 클릭
- [ ] **데이터베이스 만들기** 클릭
- [ ] **테스트 모드에서 시작** 선택
- [ ] 위치 선택 (권장: `asia-northeast3` - 서울)
- [ ] **사용 설정** 클릭

### 4단계: 웹 앱 추가 및 환경 변수 설정
- [ ] Firebase Console에서 프로젝트 설정 (톱니바퀴 아이콘) 클릭
- [ ] **일반** 탭에서 아래로 스크롤
- [ ] **내 앱** 섹션에서 웹 아이콘 (</>) 클릭
- [ ] 앱 닉네임 입력 (예: `class-read-book-web`)
- [ ] **앱 등록** 클릭
- [ ] **SDK 설정 및 구성**에서 `firebaseConfig` 객체의 값들을 복사
- [ ] 프로젝트 루트에 `.env.local` 파일 생성
- [ ] 아래 형식으로 환경 변수 입력:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=여기에_apiKey_값
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=여기에_authDomain_값
NEXT_PUBLIC_FIREBASE_PROJECT_ID=여기에_projectId_값
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=여기에_storageBucket_값
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=여기에_messagingSenderId_값
NEXT_PUBLIC_FIREBASE_APP_ID=여기에_appId_값
```

### 5단계: Firestore 보안 규칙 설정
- [ ] Firebase Console에서 **Firestore Database** 클릭
- [ ] **규칙** 탭 클릭
- [ ] 아래 보안 규칙 복사하여 붙여넣기
- [ ] **게시** 버튼 클릭

**보안 규칙:**
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
    
    match /reviews/{reviewId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // 뱃지는 모든 사용자가 읽을 수 있음
    match /badges/{badgeId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    // 사용자 뱃지는 자신의 것만 읽을 수 있음
    match /userBadges/{badgeId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // 랭킹은 모든 사용자가 읽을 수 있음
    match /rankings/{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

### 6단계: 개발 서버 재시작
- [ ] 개발 서버 중지 (Ctrl+C)
- [ ] `npm run dev` 실행
- [ ] 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 7단계: 테스트
- [ ] 회원가입 테스트
- [ ] 로그인 테스트
- [ ] 책 추가 테스트
- [ ] 독서 기록 테스트

## 🎯 빠른 시작 가이드

1. **Firebase Console 접속**: https://console.firebase.google.com/
2. **프로젝트 생성** → **Authentication 활성화** → **Firestore 생성**
3. **웹 앱 추가** → 환경 변수 복사
4. **`.env.local` 파일 생성** → 환경 변수 붙여넣기
5. **보안 규칙 설정**
6. **개발 서버 재시작**

## ⚠️ 중요 사항

- `.env.local` 파일은 `.gitignore`에 포함되어 있어 Git에 커밋되지 않습니다
- 환경 변수는 반드시 `NEXT_PUBLIC_` 접두사가 필요합니다
- 개발 서버를 재시작해야 환경 변수가 적용됩니다
- Firebase 무료 플랜으로도 충분히 사용 가능합니다

## 🐛 문제 해결

### 환경 변수가 적용되지 않는 경우
1. `.env.local` 파일이 프로젝트 루트에 있는지 확인
2. 파일 이름이 정확한지 확인 (`.env.local` - 앞에 점 포함)
3. 개발 서버 재시작

### Firebase 연결 오류
1. 브라우저 콘솔(F12)에서 오류 메시지 확인
2. 환경 변수 값이 정확한지 확인
3. Firebase Console에서 프로젝트가 활성화되어 있는지 확인

### Firestore 권한 오류
1. 보안 규칙이 올바르게 설정되었는지 확인
2. 사용자가 로그인되어 있는지 확인
3. Firebase Console > Firestore > 규칙 탭에서 확인

