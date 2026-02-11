'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signInWithGoogle, getGoogleRedirectResult } from '@/lib/firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, createUserData } from '@/lib/firebase/firestore';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Google 리다이렉트 결과 처리
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getGoogleRedirectResult();
        if (result && result.user) {
          const userId = result.user.uid;

          // 사용자 데이터가 없으면 생성
          try {
            const existingUserData = await getUserData(userId);
            if (!existingUserData) {
              await createUserData(userId, {
                email: result.user.email || '',
                name: result.user.displayName || '사용자',
                displayName: result.user.displayName || '사용자',
                photoURL: result.user.photoURL || '',
                level: 1,
                exp: 0,
                totalPagesRead: 0,
                totalBooksRead: 0,
                currentStreak: 0,
                longestStreak: 0,
                isAnonymous: false,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          } catch (dbError: any) {
            console.error('사용자 데이터 처리 실패:', dbError);
          }

          // 캐릭터가 없으면 선택 페이지로, 있으면 대시보드로
          try {
            const userData = await getUserData(userId);
            if (userData && !userData.character) {
              router.push('/character/select');
            } else {
              router.push('/dashboard');
            }
          } catch (dbError: any) {
            console.error('사용자 데이터 확인 실패:', dbError);
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('리다이렉트 결과 처리 실패:', error);
      }
    };

    if (!authLoading) {
      handleRedirectResult();
    }
  }, [authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);
      const userId = result.user.uid;

      // 별명 설정 -> 캐릭터 선택 -> 대시보드 순서로 확인
      try {
        const userData = await getUserData(userId);
        if (userData) {
          if (userData.nickname === undefined) {
            // 별명이 없으면 별명 설정 페이지로
            router.push('/nickname/setup');
          } else if (!userData.character) {
            // 별명은 있지만 캐릭터가 없으면 캐릭터 선택 페이지로
            router.push('/character/select');
          } else {
            // 모두 있으면 대시보드로
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      } catch (dbError: any) {
        console.error('사용자 데이터 확인 실패:', dbError);
        // 데이터 확인 실패해도 대시보드로 이동
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('로그인 에러:', err);
      // Firebase 에러 메시지를 사용자 친화적으로 변환
      let errorMessage = '로그인에 실패했습니다.';
      if (err.code === 'auth/user-not-found') {
        errorMessage = '등록되지 않은 이메일입니다.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = '비밀번호가 올바르지 않습니다.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = '올바른 이메일 형식이 아닙니다.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await signInWithGoogle();
      const userId = result.user.uid;

      // 사용자 데이터가 없으면 생성
      try {
        const existingUserData = await getUserData(userId);
        if (!existingUserData) {
          await createUserData(userId, {
            email: result.user.email || '',
            name: result.user.displayName || '사용자',
            displayName: result.user.displayName || '사용자',
            photoURL: result.user.photoURL || '',
            level: 1,
            exp: 0,
            totalPagesRead: 0,
            totalBooksRead: 0,
            currentStreak: 0,
            longestStreak: 0,
            isAnonymous: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } catch (dbError: any) {
        console.error('사용자 데이터 처리 실패:', dbError);
        // 사용자 데이터 생성 실패해도 계속 진행
      }

      // 별명 설정 -> 캐릭터 선택 -> 대시보드 순서로 확인
      try {
        const userData = await getUserData(userId);
        if (userData) {
          if (userData.nickname === undefined) {
            // 별명이 없으면 별명 설정 페이지로
            router.push('/nickname/setup');
          } else if (!userData.character) {
            // 별명은 있지만 캐릭터가 없으면 캐릭터 선택 페이지로
            router.push('/character/select');
          } else {
            // 모두 있으면 대시보드로
            router.push('/dashboard');
          }
        } else {
          router.push('/dashboard');
        }
      } catch (dbError: any) {
        console.error('사용자 데이터 확인 실패:', dbError);
        // 데이터 확인 실패해도 대시보드로 이동
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Google 로그인 에러:', err);
      // 리다이렉트가 시작된 경우 에러를 표시하지 않음 (페이지가 이동됨)
      if (err.message === 'REDIRECT_INITIATED') {
        setError('');
        // 리다이렉트가 시작되었으므로 로딩 상태 유지
        return;
      }
      
      // Firebase 에러 메시지를 사용자 친화적으로 변환
      let errorMessage = 'Google 로그인에 실패했습니다.';
      if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = '로그인 팝업이 닫혔습니다. 다시 시도해주세요.';
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage = '팝업이 차단되어 리다이렉트 방식으로 전환합니다...';
        // 리다이렉트가 자동으로 시작되므로 에러를 표시하지 않음
        return;
      } else if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = '로그인 요청이 취소되었습니다. 다시 시도해주세요.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card title="로그인">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            type="password"
            label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        {/* 구분선 */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">또는</span>
          </div>
        </div>

        {/* Google 로그인 버튼 */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>Google로 로그인</span>
          </div>
        </Button>

        <div className="mt-4 text-center text-sm">
          <span className="text-gray-600">계정이 없으신가요? </span>
          <Link href="/signup" className="text-blue-600 hover:underline">
            회원가입
          </Link>
        </div>
      </Card>
    </div>
  );
}
