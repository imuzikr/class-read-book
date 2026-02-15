# 🔑 환경 변수 설정 가이드

## 1단계: Firebase Console에서 환경 변수 복사

### 방법 1: 프로젝트 설정에서 복사 (권장)

1. **Firebase Console 접속**
   - [https://console.firebase.google.com/](https://console.firebase.google.com/) 접속
   - 프로젝트 선택

2. **프로젝트 설정 열기**
   - 화면 왼쪽 상단의 **톱니바퀴 아이콘** (⚙️) 클릭
   - 또는 화면 오른쪽 상단의 **프로젝트 설정** 클릭

3. **일반 탭 확인**
   - "일반" 또는 "General" 탭이 선택되어 있는지 확인

4. **내 앱 섹션 찾기**
   - 페이지를 아래로 스크롤
   - **"내 앱"** 또는 **"Your apps"** 섹션 찾기

5. **웹 앱 확인 또는 추가**
   - 이미 웹 앱이 있다면:
     - 웹 앱 아이콘 (</>) 옆의 **"설정"** 또는 **"Config"** 클릭
   - 웹 앱이 없다면:
     - 웹 아이콘 (</>) 클릭
     - 앱 닉네임 입력 (예: `class-read-book-web`)
     - **"앱 등록"** 클릭

6. **SDK 설정 복사**
   - **"SDK 설정 및 구성"** 또는 **"SDK setup and configuration"** 섹션에서
   - `firebaseConfig` 객체의 값들을 확인:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",              // 이 값 복사
     authDomain: "xxx.firebaseapp.com", // 이 값 복사
     projectId: "xxx",                  // 이 값 복사
     storageBucket: "xxx.appspot.com",  // 이 값 복사
     messagingSenderId: "123456789",    // 이 값 복사
     appId: "1:123456789:web:abc..."    // 이 값 복사
   };
   ```

### 방법 2: 웹 앱이 이미 추가된 경우

1. 프로젝트 설정 > 일반 탭
2. "내 앱" 섹션에서 웹 앱 찾기
3. 웹 앱 옆의 **"설정"** 또는 **"Config"** 클릭
4. `firebaseConfig` 값 확인

## 2단계: 프로젝트에 `.env.local` 파일 생성

### 파일 위치
프로젝트 루트 폴더 (`class-read-book`)에 `.env.local` 파일을 생성하세요.

**경로 예시:**
```
F:\Code\class-read-book\.env.local
```

### 파일 생성 방법

#### 방법 1: VS Code에서 생성
1. VS Code에서 프로젝트 열기
2. 왼쪽 파일 탐색기에서 프로젝트 루트 폴더 우클릭
3. "새 파일" 선택
4. 파일 이름 입력: `.env.local` (앞에 점 포함!)

#### 방법 2: 파일 탐색기에서 생성
1. Windows 파일 탐색기 열기
2. `F:\Code\class-read-book` 폴더로 이동
3. 새 텍스트 문서 생성
4. 파일 이름을 `.env.local`로 변경 (확장자 포함)

#### 방법 3: 터미널에서 생성
```bash
cd F:\Code\class-read-book
echo. > .env.local
```

## 3단계: 환경 변수 입력

`.env.local` 파일을 열고 아래 형식으로 입력하세요:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=여기에_apiKey_값_붙여넣기
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=여기에_authDomain_값_붙여넣기
NEXT_PUBLIC_FIREBASE_PROJECT_ID=여기에_projectId_값_붙여넣기
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=여기에_storageBucket_값_붙여넣기
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=여기에_messagingSenderId_값_붙여넣기
NEXT_PUBLIC_FIREBASE_APP_ID=여기에_appId_값_붙여넣기
```

### 실제 예시:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAbc123def456ghi789jkl
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=class-read-book.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=class-read-book
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=class-read-book.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# 관리자 API를 사용할 때만 필요 (서버 전용)
FIREBASE_ADMIN_PROJECT_ID=class-read-book
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@class-read-book.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## ⚠️ 중요 사항

1. **파일 이름 정확히**: `.env.local` (앞에 점 포함, 확장자 없음)
2. **등호(=) 주변 공백 없음**: `KEY=value` (O), `KEY = value` (X)
3. **따옴표 없음**: `KEY=value` (O), `KEY="value"` (X)
4. **클라이언트 변수만 `NEXT_PUBLIC_` 사용**: `FIREBASE_ADMIN_*`는 서버 전용이므로 `NEXT_PUBLIC_`를 붙이지 않습니다.
5. **개발 서버 재시작**: 환경 변수 변경 후 반드시 서버 재시작 필요

## 4단계: 확인

1. `.env.local` 파일 저장
2. 개발 서버 재시작:
   ```bash
   # Ctrl+C로 서버 중지 후
   npm run dev
   ```
3. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속
4. 로그인/회원가입 테스트

## 문제 해결

### 환경 변수가 적용되지 않는 경우
- 파일 이름이 정확한지 확인 (`.env.local`)
- 파일이 프로젝트 루트에 있는지 확인
- 개발 서버를 재시작했는지 확인

### Firebase 연결 오류
- 환경 변수 값이 정확한지 확인
- 따옴표나 공백이 없는지 확인
- Firebase Console에서 프로젝트가 활성화되어 있는지 확인

