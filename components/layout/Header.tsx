'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { logout } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { logout: firebaseLogout } = await import('@/lib/firebase/auth');
      await firebaseLogout();
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">📚</span>
            <span className="text-xl font-bold text-primary-600">우리 반 독서 대장</span>
          </Link>

          <nav className="flex items-center space-x-4">
            {loading ? (
              <div className="text-gray-400">로딩 중...</div>
            ) : user ? (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-primary-600">
                  대시보드
                </Link>
                <Link href="/books" className="text-gray-700 hover:text-primary-600">
                  내 서재
                </Link>
                <Link href="/statistics" className="text-gray-700 hover:text-primary-600">
                  통계
                </Link>
                <Link href="/achievements" className="text-gray-700 hover:text-primary-600">
                  업적
                </Link>
                <Link href="/ranking" className="text-gray-700 hover:text-primary-600">
                  랭킹
                </Link>
                <Link href="/map" className="text-gray-700 hover:text-primary-600">
                  📊 여정 현황
                </Link>
                <Link href="/profile" className="text-gray-700 hover:text-primary-600">
                  프로필
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-red-600 hover:text-red-700 font-semibold">
                    🔐 관리자
                  </Link>
                )}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{user.displayName || user.email}</span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    로그아웃
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">로그인</Button>
                </Link>
                <Link href="/signup">
                  <Button variant="primary" size="sm">회원가입</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

