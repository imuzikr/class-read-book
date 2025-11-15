'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { getUserData } from '@/lib/firebase/firestore';
import { getUserDisplayName } from '@/lib/utils/userDisplay';
import Button from '@/components/ui/Button';
import { logout } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDisplayName, setUserDisplayName] = useState<string>('');

  useEffect(() => {
    if (user) {
      getUserData(user.uid).then((userData) => {
        if (userData) {
          setUserDisplayName(getUserDisplayName(userData));
        } else {
          setUserDisplayName(user.displayName || user.email || '');
        }
      }).catch(() => {
        setUserDisplayName(user.displayName || user.email || '');
      });
    } else {
      setUserDisplayName('');
    }
  }, [user]);

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
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">📚</span>
              <span className="text-xl font-bold text-primary-600 hidden sm:inline">우리 반 독서 대장</span>
              <span className="text-lg font-bold text-primary-600 sm:hidden">독서 대장</span>
            </Link>
            {user && userDisplayName && (
              <span className="text-sm text-gray-600 hidden md:inline border-l border-gray-300 pl-3">
                {userDisplayName}
              </span>
            )}
          </div>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden lg:flex items-center space-x-4">
            {loading ? (
              <div className="text-gray-400">로딩 중...</div>
            ) : user ? (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-primary-600 text-sm">
                  대시보드
                </Link>
                <Link href="/books" className="text-gray-700 hover:text-primary-600 text-sm">
                  내 서재
                </Link>
                <Link href="/statistics" className="text-gray-700 hover:text-primary-600 text-sm">
                  통계
                </Link>
                <Link href="/achievements" className="text-gray-700 hover:text-primary-600 text-sm">
                  업적
                </Link>
                <Link href="/ranking" className="text-gray-700 hover:text-primary-600 text-sm">
                  랭킹
                </Link>
                <Link href="/map" className="text-gray-700 hover:text-primary-600 text-sm">
                  📊 여정 현황
                </Link>
                <Link href="/profile" className="text-gray-700 hover:text-primary-600 text-sm">
                  프로필
                </Link>
                {isAdmin && (
                  <Link href="/admin" className="text-red-600 hover:text-red-700 font-semibold text-sm">
                    🔐 관리자
                  </Link>
                )}
                <div className="flex items-center space-x-2">
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

          {/* 모바일 햄버거 버튼 */}
          <div className="lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-primary-600 p-2"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-4">
            <nav className="flex flex-col space-y-3">
              {loading ? (
                <div className="text-gray-400 text-center">로딩 중...</div>
              ) : user ? (
                <>
                  <Link 
                    href="/dashboard" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    대시보드
                  </Link>
                  <Link 
                    href="/books" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    내 서재
                  </Link>
                  <Link 
                    href="/statistics" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    통계
                  </Link>
                  <Link 
                    href="/achievements" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    업적
                  </Link>
                  <Link 
                    href="/ranking" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    랭킹
                  </Link>
                  <Link 
                    href="/map" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    📊 여정 현황
                  </Link>
                  <Link 
                    href="/profile" 
                    className="text-gray-700 hover:text-primary-600 px-2 py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    프로필
                  </Link>
                  {isAdmin && (
                    <Link 
                      href="/admin" 
                      className="text-red-600 hover:text-red-700 font-semibold px-2 py-1"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      🔐 관리자
                    </Link>
                  )}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="px-2 py-1 text-sm text-gray-600 mb-2">
                      {userDisplayName || user.displayName || user.email}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full"
                    >
                      로그아웃
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Link 
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="ghost" size="sm" className="w-full">로그인</Button>
                  </Link>
                  <Link 
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="primary" size="sm" className="w-full">회원가입</Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

