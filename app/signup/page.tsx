'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signUp, signInWithGoogle, getGoogleRedirectResult } from '@/lib/firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, createUserData } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingRedirect, setProcessingRedirect] = useState(false);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // 페이지 로드 시 리다이렉트 결과 확인
  useEffect(() => {
    const handleRedirectResult = async () => {
      // 이미 처리 중이면 중복 실행 방지
      if (processingRedirect) return;
      
      try {
        setProcessingRedirect(true);
        const result = await getGoogleRedirectResult();
        
        if (result && result.user) {
          const userId = result.user.uid;
          
          // 사용자 데이터가 이미 있는지 확인
          const existingUserData = await getUserData(userId);
          
          if (!existingUserData) {
            // 사용자 데이터 생성 (캐릭터는 나중에 선택)
            try {
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
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
              });
            } catch (dbError: any) {
              console.error('사용자 데이터 생성 실패:', dbError);
            }
          }

          // 인증 상태가 설정될 때까지 잠시 대기
          await new Promise(resolve => setTimeout(resolve, 500));

          // 캐릭터가 없으면 선택 페이지로, 있으면 대시보드로
          const userData = await getUserData(userId);
          if (userData && !userData.character) {
            router.push('/character/select');
          } else {
            router.push('/dashboard');
          }
        }
      } catch (err: any) {
        console.error('리다이렉트 결과 처리 실패:', err);
        setError('회원가입 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setProcessingRedirect(false);
      }
    };

    // 인증 로딩이 완료된 후에만 실행
    if (!authLoading) {
      handleRedirectResult();
    }
  }, [authLoading, router, processingRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signUp(email, password, name);
      const userId = userCredential.user.uid;

      // 사용자 데이터 생성 (캐릭터는 나중에 선택)
      await createUserData(userId, {
        email,
        name,
        displayName: name,
        level: 1,
        exp: 0,
        totalPagesRead: 0,
        totalBooksRead: 0,
        currentStreak: 0,
        longestStreak: 0,
        isAnonymous: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // 캐릭터 선택 페이지로 이동
      router.push('/character/select');
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);

    try {
      // 리다이렉트 방식으로 Google 로그인 시작
      await signInWithGoogle();
      // 리다이렉트가 시작되면 이 함수는 여기서 종료됨
      // 실제 로그인 처리는 리다이렉트 후 getRedirectResult로 처리됨
    } catch (err: any) {
      console.error('Google 회원가입 에러:', err);
      setError(err.message || 'Google 회원가입에 실패했습니다.');
      setLoading(false);
    }
  };

  // 인증 로딩 중이거나 리다이렉트 처리 중이면 로딩 표시
  if (authLoading || processingRedirect) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">회원가입 처리 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <Card title="회원가입">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />
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
            minLength={6}
          />
          <Input
            type="password"
            label="비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            minLength={6}
          />
          
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? '가입 중...' : '회원가입'}
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

        {/* Google 회원가입 버튼 */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignUp}
          disabled={loading}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
          Google로 회원가입
        </Button>

        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-primary-600 hover:underline">
            이미 계정이 있으신가요? 로그인
          </Link>
        </div>
      </Card>
    </div>
  );
}

