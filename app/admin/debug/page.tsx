'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/firebase/firestore';
import Card from '@/components/ui/Card';

export default function AdminDebugPage() {
  const { user, isAdmin: isAdminFromHook, adminLoading } = useAuth();
  const [directCheck, setDirectCheck] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      // 직접 isAdmin 함수 호출
      const adminStatus = await isAdmin(user.uid);
      setDirectCheck(adminStatus);

      // 디버깅 정보 수집
      setDebugInfo({
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        hookIsAdmin: isAdminFromHook,
        directIsAdmin: adminStatus,
        adminLoading,
      });
    } catch (error: any) {
      console.error('관리자 확인 오류:', error);
      setDebugInfo({
        error: error.message,
        userId: user.uid,
        email: user.email,
      });
    }
  };

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <p className="text-red-600">로그인이 필요합니다.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">관리자 상태 디버깅</h1>

      <Card title="사용자 정보">
        <div className="space-y-2">
          <p><strong>UID:</strong> {user.uid}</p>
          <p><strong>이메일:</strong> {user.email}</p>
          <p><strong>이름:</strong> {user.displayName || '없음'}</p>
        </div>
      </Card>

      <Card title="관리자 확인 결과" className="mt-6">
        <div className="space-y-4">
          <div>
            <p className="font-semibold">useAuth 훅 결과:</p>
            <p className={isAdminFromHook ? 'text-green-600' : 'text-red-600'}>
              {adminLoading ? '확인 중...' : (isAdminFromHook ? '✅ 관리자로 인식됨' : '❌ 일반 사용자로 인식됨')}
            </p>
          </div>

          <div>
            <p className="font-semibold">직접 isAdmin() 호출 결과:</p>
            <p className={directCheck === null ? 'text-gray-600' : (directCheck ? 'text-green-600' : 'text-red-600')}>
              {directCheck === null ? '확인 중...' : (directCheck ? '✅ 관리자로 인식됨' : '❌ 일반 사용자로 인식됨')}
            </p>
          </div>
        </div>
      </Card>

      <Card title="확인 사항" className="mt-6">
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold mb-2">1. Firestore에 admins 컬렉션이 있는지 확인:</p>
            <p className="text-gray-600">Firebase Console → Firestore Database → 데이터 탭에서 &apos;admins&apos; 컬렉션 확인</p>
          </div>

          <div>
            <p className="font-semibold mb-2">2. 문서 ID가 UID와 일치하는지 확인:</p>
            <p className="text-gray-600">문서 ID가 위의 UID와 정확히 일치해야 합니다</p>
            <p className="text-gray-600 font-mono bg-gray-100 p-2 mt-1">{user.uid}</p>
          </div>

          <div>
            <p className="font-semibold mb-2">3. 문서에 email 필드가 있는지 확인:</p>
            <p className="text-gray-600">email 필드가 있어야 합니다 (선택사항이지만 권장)</p>
          </div>

          <div>
            <p className="font-semibold mb-2">4. 로그인 방식 확인:</p>
            <p className="text-gray-600">
              관리자 등록 시 사용한 로그인 방식과 동일한 방식으로 로그인했는지 확인하세요.
              <br />
              - Google 로그인으로 등록했다면 → Google 로그인 사용
              <br />
              - 이메일/비밀번호로 등록했다면 → 이메일/비밀번호 로그인 사용
            </p>
          </div>
        </div>
      </Card>

      {debugInfo && (
        <Card title="디버깅 정보" className="mt-6">
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </Card>
      )}

      <div className="mt-6">
        <button
          onClick={checkAdminStatus}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          다시 확인
        </button>
      </div>
    </div>
  );
}

