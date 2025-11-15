# 🔧 문제 해결 가이드

## Firebase 인증 관련 문제

### Cursor 브라우저에서 인증 오류 발생

**증상:**
- "Unable to process request due to missing initial state" 오류 메시지 표시
- Google 로그인 시 인증 실패

**원인:**
- Cursor의 내장 브라우저는 일반 브라우저와 다르게 동작
- `sessionStorage` 접근 제한 또는 리다이렉트 처리 문제

**해결 방법:**

1. **일반 브라우저 사용 (권장)**
   - Chrome, Firefox, Edge 등 일반 브라우저에서 테스트
   - `http://localhost:3000` 접속
   - 인증 기능은 정상 작동합니다

2. **Cursor 브라우저 설정 확인**
   - 브라우저 설정에서 쿠키/세션 저장 허용
   - 팝업 차단 해제
   - 시크릿 모드 사용 안 함

3. **개발 워크플로우**
   - 코드 편집: Cursor 사용
   - 인증 테스트: 일반 브라우저 사용

**참고:**
- 코드는 `signInWithPopup`을 사용하므로 일반 브라우저에서는 정상 작동합니다
- Cursor 브라우저의 제한으로 인한 현상입니다

## Cursor 브라우저 사용 방법

### 브라우저가 빈 화면으로 보이는 경우

**증상:**
- 브라우저 탭이 열렸지만 빈 화면 (회색 배경에 "Browser" 텍스트만 표시)
- "Enter a URL above, or instruct the Agent to navigate and use the browser" 메시지 표시

**원인:**
- Cursor 브라우저는 일반 브라우저와 다르게 작동합니다
- URL을 직접 입력하거나 Agent가 네비게이션하도록 지시해야 합니다

**해결 방법:**

1. **URL 직접 입력**
   - 상단 URL 입력란에 `http://localhost:3000` 입력
   - Enter 키 누르기

2. **Agent에게 네비게이션 요청**
   - Agent에게 "브라우저에서 localhost:3000으로 이동해줘" 요청
   - Agent가 자동으로 네비게이션합니다

3. **일반 브라우저 사용 (권장)**
   - 개발 서버가 실행 중이라면 (`npm run dev`)
   - Chrome, Firefox 등 일반 브라우저에서 `http://localhost:3000` 접속
   - 더 안정적이고 모든 기능이 정상 작동합니다

**참고:**
- Cursor 브라우저는 주로 Agent가 자동으로 웹사이트를 테스트하거나 스크린샷을 찍을 때 사용됩니다
- 일반적인 개발/테스트는 일반 브라우저 사용을 권장합니다

