'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signInWithGoogle } from '@/lib/firebase/auth';
import { getUserData, createUserData } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithGoogle();
      const userId = userCredential.user.uid;
      
      // 사용자 데이터가 없으면 생성
      try {
        const existingUserData = await getUserData(userId);
        if (!existingUserData) {
          await createUserData(userId, {
            email: userCredential.user.email || '',
            name: userCredential.user.displayName || '사용자',
            displayName: userCredential.user.displayName || '사용자',
            photoURL: userCredential.user.photoURL || '',
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
        }
      } catch (dbError: any) {
        console.error('사용자 데이터 처리 실패:', dbError);
        // Firestore 에러가 있어도 로그인은 성공했으므로 계속 진행
      }

      // 캐릭터가 없으면 선택 페이지로, 있으면 대시보드로
      try {
        const userData = await getUserData(userId);
        if (userData && !userData.character) {
          window.location.href = '/character/select';
        } else {
          window.location.href = '/dashboard';
        }
      } catch (error) {
        // 오류 발생 시 대시보드로 이동
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      console.error('Google 로그인 에러:', err);
      setError(err.message || 'Google 로그인에 실패했습니다.');
      setLoading(false);
    }
  };

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
          Google로 로그인
        </Button>

        <div className="mt-4 text-center text-sm">
          <Link href="/signup" className="text-primary-600 hover:underline">
            계정이 없으신가요? 회원가입
          </Link>
        </div>
      </Card>
    </div>
  );
}

