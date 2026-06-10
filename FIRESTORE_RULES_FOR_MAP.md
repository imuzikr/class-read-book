# 🔒 Firestore 보안 규칙 업데이트 (지도/랭킹/주간대장 기능용)

지도, 랭킹, 주간 독서 대장 기능을 사용하려면 Firestore 보안 규칙을 업데이트해야 합니다.

## 업데이트된 보안 규칙

Firebase Console > Firestore Database > 규칙 탭에서 아래 규칙으로 교체하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // 관리자 컬렉션 (콘솔/서버에서만 관리 권장)
    match /admins/{adminId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // 사용자는 자신의 데이터만 수정, 읽기는 지도 기능을 위해 인증 사용자 허용
    match /users/{userId} {
      allow read: if isSignedIn(); // 지도 기능용
      allow write: if isSignedIn() &&
        (request.auth.uid == userId || isAdmin());
    }
    
    // 책 데이터: 읽기는 인증 사용자 허용 (랭킹/주간대장), 수정/삭제는 본인+관리자만
    match /books/{bookId} {
      allow read: if isSignedIn();
      allow update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // 독서 기록: 읽기는 인증 사용자 허용 (랭킹/주간대장), 수정/삭제는 본인+관리자만
    match /readingLogs/{logId} {
      allow read: if isSignedIn();
      allow update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() &&
        request.resource.data.userId == request.auth.uid;
    }
    
    // 감상문: 읽기는 인증 사용자 허용 (랭킹/주간대장), 수정/삭제는 본인+관리자만
    match /reviews/{reviewId} {
      allow read: if isSignedIn();
      allow update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() &&
        request.resource.data.userId == request.auth.uid;
    }
    
    // 뱃지는 모든 사용자가 읽을 수 있음
    match /badges/{badgeId} {
      allow read: if isSignedIn();
      allow write: if false;
    }
    
    // 사용자 뱃지: 읽기는 인증 사용자 허용 (랭킹), 수정/삭제는 본인+관리자만
    match /userBadges/{badgeId} {
      allow read: if isSignedIn();
      allow update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // 랭킹: 읽기는 인증 사용자, 쓰기는 본인 문서만 (문서 ID = {uid}_{period})
    match /rankings/{rankingId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && rankingId == request.auth.uid + '_' + request.resource.data.period
        && request.resource.data.period in ['daily', 'weekly', 'monthly', 'all-time']
        && request.resource.data.totalExp is number
        && request.resource.data.totalExp >= 0;
      allow delete: if isAdmin();
    }
  }
}
```

## 주요 변경사항

**users 컬렉션:**
- 기존: 사용자 본인만 읽기/쓰기
- 변경: 읽기는 인증 사용자 허용(지도 기능), 쓰기는 본인 또는 관리자만 허용
- 이유: 지도 기능 공개 조회 + 관리자 운영 기능을 동시에 보장

**rankings 컬렉션:**
- 기존: 인증 사용자 누구나 쓰기 가능 → 타인의 랭킹 점수를 덮어쓸 수 있는 취약점
- 변경: 본인 문서(`{uid}_{period}`)만 생성/수정 가능, 문서 ID·userId·period·totalExp 필드 검증 추가, 삭제는 관리자만
- 주의: `totalExp` 값 자체는 여전히 클라이언트가 계산하므로, 본인 점수 부풀리기는 별도 과제(서버 측 계산)로 해결 필요

**주의사항:**
- `admins/{uid}` 문서가 존재해야 관리자 권한이 활성화됩니다.
- `users` 읽기를 전체 인증 사용자에게 열어둔 구조라면, 문서에 이메일 같은 민감정보를 직접 저장하지 않거나 공개용 프로필 컬렉션으로 분리하는 것이 안전합니다.
- 익명화 옵션(`isAnonymous`)이 켜진 사용자는 코드에서 필터링됩니다.

## 적용 방법

1. Firebase Console 접속
2. Firestore Database > 규칙 탭
3. 위의 규칙을 복사하여 붙여넣기
4. "게시" 버튼 클릭

---

# 🔒 2단계: 경험치 서버 계산 전환 후 잠금 규칙

> ⚠️ **반드시 서버 API 버전(독서 기록/감상문 생성이 `/api/reading-logs`, `/api/reviews`를 호출하는 코드)이 프로덕션에 배포된 후에 적용하세요.**
> 이 규칙을 먼저 적용하면 구버전 코드의 기록 저장이 실패합니다.

이 규칙을 적용하면:
- 클라이언트에서 `users` 문서의 경험치/레벨/스트릭 등 스탯 필드를 직접 수정할 수 없습니다 (본인 점수 조작 차단)
- `readingLogs`, `reviews`, `userBadges` 생성은 서버 API(Admin SDK)만 가능합니다
- 별명/캐릭터/공개 설정 등 일반 설정 필드는 기존처럼 본인이 수정할 수 있습니다

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // 클라이언트가 수정할 수 없는 사용자 스탯 필드 (서버 API 전용)
    function touchesStatFields() {
      return request.resource.data.diff(resource.data).affectedKeys().hasAny(
        ['exp', 'level', 'totalPagesRead', 'totalBooksRead',
         'currentStreak', 'longestStreak', 'lastReadingDate']
      );
    }

    match /admins/{adminId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      // 가입 시 생성: 스탯은 초기값만 허용
      allow create: if isSignedIn() && request.auth.uid == userId
        && request.resource.data.get('exp', 0) == 0
        && request.resource.data.get('level', 1) == 1
        && request.resource.data.get('totalPagesRead', 0) == 0
        && request.resource.data.get('totalBooksRead', 0) == 0
        && request.resource.data.get('currentStreak', 0) == 0
        && request.resource.data.get('longestStreak', 0) == 0;
      // 본인은 설정 필드만 수정 가능, 스탯 필드는 서버 API 전용
      allow update: if isAdmin() ||
        (isSignedIn() && request.auth.uid == userId && !touchesStatFields());
      allow delete: if isSignedIn() &&
        (request.auth.uid == userId || isAdmin());
    }

    match /books/{bookId} {
      allow read: if isSignedIn();
      allow update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() &&
        request.resource.data.userId == request.auth.uid;
    }

    // 독서 기록: 생성은 서버 API 전용, 본인은 감상/공개 여부만 수정 가능
    match /readingLogs/{logId} {
      allow read: if isSignedIn();
      allow create: if false;
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['notes', 'isPublic']);
      // 삭제는 회원 탈퇴 흐름(본인 데이터 일괄 삭제)을 위해 본인 허용
      allow delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
    }

    // 감상문: 생성은 서버 API 전용(보너스 경험치 때문), 본인은 내용/별점만 수정 가능
    match /reviews/{reviewId} {
      allow read: if isSignedIn();
      allow create: if false;
      allow update: if isSignedIn() && resource.data.userId == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['content', 'rating', 'updatedAt']);
      allow delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
    }

    match /badges/{badgeId} {
      allow read: if isSignedIn();
      allow write: if false;
    }

    // 사용자 뱃지: 부여는 서버 API 전용
    match /userBadges/{badgeId} {
      allow read: if isSignedIn();
      allow create, update: if false;
      // 삭제는 회원 탈퇴 흐름을 위해 본인 허용
      allow delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
    }

    // 랭킹: 본인 문서만 쓰기 가능 (1단계에서 적용됨)
    match /rankings/{rankingId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn()
        && request.resource.data.userId == request.auth.uid
        && rankingId == request.auth.uid + '_' + request.resource.data.period
        && request.resource.data.period in ['daily', 'weekly', 'monthly', 'all-time']
        && request.resource.data.totalExp is number
        && request.resource.data.totalExp >= 0;
      allow delete: if isAdmin();
    }
  }
}
```

## 2단계 적용 순서

1. 서버 API 버전 코드가 Vercel 프로덕션에 배포되었는지 확인
2. (권장: 학생들이 사용하지 않는 시간대에) Firebase Console > Firestore > 규칙 탭에서 위 규칙으로 **전체 교체** 후 게시
3. 규칙 플레이그라운드에서 검증:
   - 본인 `users` 문서의 `exp` 필드 update → **거부**되어야 정상
   - 본인 `users` 문서의 `nickname` 필드 update → **허용**되어야 정상
   - `readingLogs` create → **거부**되어야 정상
4. 실제 계정으로 독서 기록 저장/삭제, 감상문 작성, 별명 변경이 정상 동작하는지 확인

