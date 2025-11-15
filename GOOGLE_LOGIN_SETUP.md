# 🔐 Google 로그인 설정 가이드

Google 로그인 기능을 활성화하는 방법입니다. 매우 간단합니다!

## Firebase Console에서 Google 로그인 활성화

### 1단계: Authentication 메뉴로 이동
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **Authentication** 클릭

### 2단계: Google 로그인 활성화
1. **Sign-in method** 탭 클릭
2. 제공업체 목록에서 **Google** 클릭
3. **사용 설정** 또는 **Enable** 토글을 켜기
4. **프로젝트 지원 이메일** 선택 (기본값 사용 가능)
5. **저장** 또는 **Save** 클릭

**완료!** 이제 Google 로그인을 사용할 수 있습니다.

## 코드 변경 사항

코드는 이미 구현되어 있습니다:
- ✅ `lib/firebase/auth.ts` - Google 로그인 함수 추가됨
- ✅ `app/login/page.tsx` - Google 로그인 버튼 추가됨
- ✅ `app/signup/page.tsx` - Google 회원가입 버튼 추가됨

## 테스트 방법

1. 개발 서버 실행 (`npm run dev`)
2. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속
3. 로그인 또는 회원가입 페이지로 이동
4. "Google로 로그인" 또는 "Google로 회원가입" 버튼 클릭
5. Google 계정 선택 및 권한 승인
6. 대시보드로 자동 이동 확인

## 주의사항

- Google 로그인은 Firebase Console에서 활성화해야만 작동합니다
- 첫 Google 로그인 시 자동으로 사용자 데이터가 생성됩니다
- 이미 이메일로 가입한 계정이 있다면, 같은 이메일로 Google 로그인 시 기존 계정과 연결됩니다

## 문제 해결

### "Google 로그인에 실패했습니다" 오류
- Firebase Console에서 Google 로그인이 활성화되어 있는지 확인
- 브라우저 콘솔(F12)에서 오류 메시지 확인

### 팝업이 차단되는 경우
- 브라우저에서 팝업 차단을 해제하세요
- 또는 새 창에서 열리도록 설정

