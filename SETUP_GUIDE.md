# 🚀 프로젝트 설정 가이드

## 1단계: Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: `class-read-book`)
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

## 2단계: Firebase Authentication 설정

1. Firebase Console에서 프로젝트 선택
2. 왼쪽 메뉴에서 **Authentication** 클릭
3. **시작하기** 버튼 클릭
4. **Sign-in method** 탭에서 **이메일/비밀번호** 활성화
5. 저장

## 3단계: Firestore Database 설정

1. Firebase Console에서 **Firestore Database** 클릭
2. **데이터베이스 만들기** 클릭
3. **테스트 모드에서 시작** 선택 (나중에 보안 규칙 설정)
4. 위치 선택 (가장 가까운 지역, 예: `asia-northeast3` - 서울)
5. **사용 설정** 클릭

## 4단계: 웹 앱 추가 및 환경 변수 설정

1. Firebase Console에서 프로젝트 설정 (톱니바퀴 아이콘) 클릭
2. **일반** 탭에서 아래로 스크롤
3. **내 앱** 섹션에서 웹 아이콘 (</>) 클릭
4. 앱 닉네임 입력 (예: `class-read-book-web`)
5. **앱 등록** 클릭
6. **SDK 설정 및 구성**에서 `firebaseConfig` 객체의 값들을 복사

### 환경 변수 파일 생성

프로젝트 루트에 `.env.local` 파일을 생성하고 아래 내용을 입력하세요:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=여기에_apiKey_값_입력
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=여기에_authDomain_값_입력
NEXT_PUBLIC_FIREBASE_PROJECT_ID=여기에_projectId_값_입력
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=여기에_storageBucket_값_입력
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=여기에_messagingSenderId_값_입력
NEXT_PUBLIC_FIREBASE_APP_ID=여기에_appId_값_입력
```

**예시:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAbc123def456ghi789jkl
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=class-read-book.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=class-read-book
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=class-read-book.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

## 5단계: Firestore 보안 규칙 설정

1. Firebase Console에서 **Firestore Database** 클릭
2. **규칙** 탭 클릭
3. 아래 보안 규칙을 복사하여 붙여넣기:

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
      allow write: if false; // 관리자만 수정 가능 (Cloud Function 사용)
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
      allow write: if false; // Cloud Function으로만 업데이트
    }
  }
}
```

4. **게시** 버튼 클릭

## 6단계: Firestore 인덱스 설정

Firestore에서 복합 쿼리를 사용하기 위해 인덱스가 필요합니다. 
앱을 실행하고 쿼리를 실행하면 Firebase Console에서 인덱스 생성 링크가 제공됩니다.

또는 수동으로 **Firestore Database > 인덱스** 탭에서 다음 인덱스들을 생성하세요:

1. **books 컬렉션**
   - 컬렉션 ID: `books`
   - 필드: `userId` (오름차순), `status` (오름차순)
   - 쿼리 범위: 컬렉션

2. **readingLogs 컬렉션**
   - 컬렉션 ID: `readingLogs`
   - 필드: `userId` (오름차순), `date` (내림차순)
   - 쿼리 범위: 컬렉션

3. **readingLogs 컬렉션** (두 번째)
   - 컬렉션 ID: `readingLogs`
   - 필드: `userId` (오름차순), `bookId` (오름차순), `date` (내림차순)
   - 쿼리 범위: 컬렉션

4. **rankings 컬렉션**
   - 컬렉션 ID: `rankings`
   - 필드: `period` (오름차순), `totalExp` (내림차순)
   - 쿼리 범위: 컬렉션

## 7단계: 개발 서버 실행

터미널에서 다음 명령어를 실행하세요:

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## ✅ 확인 사항

- [ ] Firebase 프로젝트 생성 완료
- [ ] Authentication 활성화 완료
- [ ] Firestore Database 생성 완료
- [ ] `.env.local` 파일 생성 및 환경 변수 입력 완료
- [ ] Firestore 보안 규칙 설정 완료
- [ ] 개발 서버 실행 성공
- [ ] 회원가입/로그인 테스트 완료

## 🐛 문제 해결

### 환경 변수가 적용되지 않는 경우
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 개발 서버를 재시작 (`Ctrl+C` 후 `npm run dev`)

### Firebase 연결 오류
- 환경 변수 값이 정확한지 확인
- Firebase Console에서 프로젝트가 활성화되어 있는지 확인

### Firestore 권한 오류
- 보안 규칙이 올바르게 설정되었는지 확인
- 사용자가 로그인되어 있는지 확인

## 📚 다음 단계

환경 설정이 완료되면 다음 기능들을 구현할 수 있습니다:
- 책 등록 및 관리
- 독서 기록 기능
- 감상문 작성
- 게임화 시스템 (레벨, 뱃지)
- 통계 및 랭킹

