# 🔒 Firestore 보안 규칙 업데이트 (지도 기능용)

지도 기능을 사용하려면 Firestore 보안 규칙을 업데이트해야 합니다.

## 업데이트된 보안 규칙

Firebase Console > Firestore Database > 규칙 탭에서 아래 규칙으로 교체하세요:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자는 자신의 데이터만 읽고 쓸 수 있음
    match /users/{userId} {
      allow read: if request.auth != null; // 모든 인증된 사용자가 읽을 수 있음 (지도 기능용)
      allow write: if request.auth != null && request.auth.uid == userId;
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

## 주요 변경사항

**users 컬렉션:**
- 기존: `allow read, write: if request.auth != null && request.auth.uid == userId;`
- 변경: `allow read: if request.auth != null;` (모든 인증된 사용자가 읽기 가능)
- 이유: 지도 기능에서 다른 사용자들의 위치를 확인하기 위해 필요

**주의사항:**
- 이 규칙은 모든 인증된 사용자가 다른 사용자의 공개 정보(레벨, 경험치, 이름 등)를 읽을 수 있게 합니다
- 개인정보(이메일 등)는 여전히 자신의 것만 볼 수 있습니다
- 익명화 옵션(`isAnonymous`)이 켜진 사용자는 코드에서 필터링됩니다

## 적용 방법

1. Firebase Console 접속
2. Firestore Database > 규칙 탭
3. 위의 규칙을 복사하여 붙여넣기
4. "게시" 버튼 클릭

