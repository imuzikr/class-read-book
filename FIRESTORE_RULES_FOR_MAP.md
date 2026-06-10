# 🔒 Firestore 보안 규칙

이 문서의 규칙이 현재 Firebase Console에 적용된 **유일한 기준 규칙**입니다.
규칙을 변경할 때는 이 문서를 함께 수정해서 문서와 콘솔이 항상 일치하도록 유지하세요.

## 설계 원칙

- **읽기**: 지도/랭킹/주간대장 기능을 위해 인증된 사용자에게 허용
- **사용자 스탯**(경험치/레벨/스트릭 등): 클라이언트 수정 불가, 서버 API(Admin SDK) 전용
  - 독서 기록 생성/삭제 → `/api/reading-logs`
  - 감상문 생성 → `/api/reviews`
  - 뱃지 부여 → `/api/badges/check`
- **일반 설정**(별명/캐릭터/공개 여부 등): 본인이 직접 수정 가능
- **랭킹**: 본인 문서(`{uid}_{period}`)만 쓰기 가능, 필드 검증 포함
- Admin SDK(서버)는 보안 규칙을 거치지 않으므로 `allow create: if false`여도 서버 API는 정상 동작합니다

## 적용된 규칙

Firebase Console > Firestore Database > 규칙 탭:

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

    // 랭킹: 본인 문서만 쓰기 가능
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

## 변경 시 주의사항

- `users` 읽기가 인증 사용자 전체에게 열려 있으므로, 문서에 이메일 등 민감정보를 두는 구조는 개선 과제로 남아 있습니다 (공개 프로필 분리 권장).
- `readingLogs` 읽기도 인증 사용자 전체에게 허용된 상태라 `isPublic: false` 기록의 보호는 클라이언트 필터에 의존합니다 (개선 과제).
- 규칙 게시 전 반드시 규칙 플레이그라운드로 검증하세요.

## 검증 방법 (규칙 플레이그라운드)

| 시뮬레이션 | 기대 결과 |
|---|---|
| 본인 uid로 본인 `users` 문서의 `exp` 필드 update | ❌ 거부 |
| 본인 uid로 본인 `users` 문서의 `nickname` 필드 update | ✅ 허용 |
| `readingLogs` 문서 create | ❌ 거부 |
| 다른 uid의 `rankings/{타인uid}_weekly` 문서 create | ❌ 거부 |
| 본인 `rankings/{본인uid}_weekly` create (`userId`=본인, `period`='weekly', `totalExp`=숫자) | ✅ 허용 |

## 변경 이력

- **2026-06**: 경험치/레벨/스트릭 서버 계산 전환에 맞춰 스탯 필드 클라이언트 쓰기 차단, `readingLogs`/`reviews`/`userBadges` 생성을 서버 전용으로 변경
- **2026-06**: `rankings` 쓰기를 본인 문서로 제한 (타인 랭킹 조작 차단)
- 이전: 지도/랭킹/주간대장 기능을 위한 읽기 권한 확대
