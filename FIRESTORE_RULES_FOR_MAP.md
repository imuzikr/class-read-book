# 🔒 Firestore 보안 규칙 업데이트 (지도 기능용)

지도 기능을 사용하려면 Firestore 보안 규칙을 업데이트해야 합니다.

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
    
    match /books/{bookId} {
      allow read, update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    match /readingLogs/{logId} {
      allow read, update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() &&
        request.resource.data.userId == request.auth.uid;
    }
    
    match /reviews/{reviewId} {
      allow read, update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() &&
        request.resource.data.userId == request.auth.uid;
    }
    
    // 뱃지는 모든 사용자가 읽을 수 있음
    match /badges/{badgeId} {
      allow read: if isSignedIn();
      allow write: if false;
    }
    
    // 사용자 뱃지는 자신의 것만 읽을 수 있음
    match /userBadges/{badgeId} {
      allow read, update, delete: if isSignedIn() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && 
        request.resource.data.userId == request.auth.uid;
    }
    
    // 랭킹은 모든 사용자가 읽을 수 있음
    match /rankings/{document=**} {
      allow read: if isSignedIn();
      allow write: if false;
    }
  }
}
```

## 주요 변경사항

**users 컬렉션:**
- 기존: 사용자 본인만 읽기/쓰기
- 변경: 읽기는 인증 사용자 허용(지도 기능), 쓰기는 본인 또는 관리자만 허용
- 이유: 지도 기능 공개 조회 + 관리자 운영 기능을 동시에 보장

**주의사항:**
- `admins/{uid}` 문서가 존재해야 관리자 권한이 활성화됩니다.
- `users` 읽기를 전체 인증 사용자에게 열어둔 구조라면, 문서에 이메일 같은 민감정보를 직접 저장하지 않거나 공개용 프로필 컬렉션으로 분리하는 것이 안전합니다.
- 익명화 옵션(`isAnonymous`)이 켜진 사용자는 코드에서 필터링됩니다.

## 적용 방법

1. Firebase Console 접속
2. Firestore Database > 규칙 탭
3. 위의 규칙을 복사하여 붙여넣기
4. "게시" 버튼 클릭

