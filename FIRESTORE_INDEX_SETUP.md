# 🔍 Firestore 인덱스 설정 가이드

## 문제 상황
책 추가 시 "The query requires an index" 오류가 발생합니다.

## 해결 방법

### 방법 1: 자동 인덱스 생성 (가장 쉬움)

1. **오류 메시지의 링크 클릭**
   - 화면에 표시된 빨간색 박스 안의 링크를 클릭하세요
   - 또는 아래 링크를 직접 열기:
   ```
   https://console.firebase.google.com/v1/r/project/class-read-book/firestore/indexes?create_composite=...
   ```

2. **인덱스 생성 확인**
   - Firebase Console에서 인덱스 생성 페이지가 열립니다
   - "인덱스 만들기" 또는 "Create Index" 버튼 클릭
   - 인덱스 생성 완료까지 몇 분 소요될 수 있습니다

3. **인덱스 생성 완료 대기**
   - 인덱스가 생성되면 "Enabled" 상태로 변경됩니다
   - 완료되면 다시 책 추가를 시도하세요

### 방법 2: 수동 인덱스 생성

1. **Firebase Console 접속**
   - [Firebase Console](https://console.firebase.google.com/) 접속
   - 프로젝트 선택

2. **Firestore Database로 이동**
   - 왼쪽 메뉴에서 "Firestore Database" 클릭
   - 상단 탭에서 "인덱스" 또는 "Indexes" 클릭

3. **인덱스 생성**
   - "인덱스 만들기" 또는 "Create Index" 버튼 클릭
   - 다음 설정 입력:

   **인덱스 1: books 컬렉션**
   - 컬렉션 ID: `books`
   - 필드 추가:
     - `userId` - 오름차순 (Ascending)
     - `status` - 오름차순 (Ascending)
   - 쿼리 범위: 컬렉션 (Collection)
   - "만들기" 또는 "Create" 클릭

   **인덱스 2: readingLogs 컬렉션**
   - 컬렉션 ID: `readingLogs`
   - 필드 추가:
     - `userId` - 오름차순 (Ascending)
     - `date` - 내림차순 (Descending)
   - 쿼리 범위: 컬렉션 (Collection)
   - "만들기" 또는 "Create" 클릭

   **인덱스 3: readingLogs 컬렉션 (두 번째)**
   - 컬렉션 ID: `readingLogs`
   - 필드 추가:
     - `userId` - 오름차순 (Ascending)
     - `bookId` - 오름차순 (Ascending)
     - `date` - 내림차순 (Descending)
   - 쿼리 범위: 컬렉션 (Collection)
   - "만들기" 또는 "Create" 클릭

   **인덱스 4: rankings 컬렉션**
   - 컬렉션 ID: `rankings`
   - 필드 추가:
     - `period` - 오름차순 (Ascending)
     - `totalExp` - 내림차순 (Descending)
   - 쿼리 범위: 컬렉션 (Collection)
   - "만들기" 또는 "Create" 클릭

## 인덱스 생성 완료 확인

1. Firestore Database > 인덱스 탭에서
2. 생성한 인덱스들이 "Enabled" 상태인지 확인
3. 모든 인덱스가 활성화되면 책 추가 기능이 정상 작동합니다

## 참고사항

- 인덱스 생성에는 몇 분이 소요될 수 있습니다
- 인덱스가 생성되는 동안 "Building" 상태로 표시됩니다
- 인덱스 생성이 완료되면 자동으로 "Enabled"로 변경됩니다
- 인덱스는 한 번만 생성하면 계속 사용됩니다

## 문제 해결

### 인덱스가 생성되지 않는 경우
- Firebase Console에서 프로젝트가 올바르게 선택되어 있는지 확인
- 브라우저를 새로고침하고 다시 시도
- Firebase Console의 권한이 있는지 확인

### 여전히 오류가 발생하는 경우
- 브라우저 콘솔(F12)에서 정확한 오류 메시지 확인
- Firestore Database가 생성되어 있는지 확인
- Firestore 보안 규칙이 올바르게 설정되어 있는지 확인

