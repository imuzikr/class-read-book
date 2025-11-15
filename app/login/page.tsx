'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signInWithGoogle, getGoogleRedirectResult } from '@/lib/firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, createUserData } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
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
  const [processingRedirect, setProcessingRedirect] = useState(false);
  
  // 리다이렉트 결과를 저장할 ref (useEffect보다 먼저 선언)
  const redirectResultRef = useRef<{ userId: string; processed: boolean } | null>(null);

  // 디버깅: user 상태 변경 시 로그 출력
  useEffect(() => {
    console.log('=== 인증 상태 디버깅 ===');
    console.log('authLoading:', authLoading);
    console.log('user:', user);
    console.log('user?.uid:', user?.uid);
    console.log('user?.email:', user?.email);
    console.log('user?.displayName:', user?.displayName);
    console.log('user?.providerData:', user?.providerData);
    console.log('========================');
  }, [user, authLoading]);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트 (리다이렉트 처리 중이 아닐 때만)
  // 단, 리다이렉트 결과가 있는 경우는 제외 (별도 useEffect에서 처리)
  useEffect(() => {
    if (!authLoading && user && !processingRedirect && !redirectResultRef.current) {
      console.log('이미 로그인된 사용자 감지, 대시보드로 이동', { userId: user.uid });
      router.push('/dashboard');
    }
  }, [user, authLoading, router, processingRedirect]);

  // 페이지 로드 시 리다이렉트 결과 확인 (한 번만 실행)
  useEffect(() => {
    const handleRedirectResult = async () => {
      // 이미 처리 중이면 중복 실행 방지
      if (processingRedirect || redirectResultRef.current?.processed) return;
      
      try {
        setProcessingRedirect(true);
        console.log('리다이렉트 결과 확인 시작...');
        const result = await getGoogleRedirectResult();
        console.log('리다이렉트 결과:', result);
        
        if (result && result.user) {
          const userId = result.user.uid;
          console.log('Google 로그인 성공 (리다이렉트 결과), 사용자 ID:', userId);
          redirectResultRef.current = { userId, processed: false };
          
          // 사용자 데이터가 없으면 생성
          try {
            const existingUserData = await getUserData(userId);
            if (!existingUserData) {
              console.log('새 사용자 데이터 생성 중...');
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
              console.log('사용자 데이터 생성 완료');
            }
          } catch (dbError: any) {
            console.error('사용자 데이터 처리 실패:', dbError);
          }
        } else {
          console.log('리다이렉트 결과 없음 - getRedirectResult가 null 반환');
          console.log('현재 인증 상태 확인 중...', { hasUser: !!user, userId: user?.uid, authLoading });
          
          // getRedirectResult가 null이어도 이미 로그인되어 있을 수 있음
          // useAuth의 user 상태를 확인해야 함
          // user 상태가 있으면 리다이렉트가 완료된 것으로 간주
          if (user) {
            console.log('인증 상태 확인됨 (getRedirectResult null이지만 user 존재), 사용자 데이터 확인 중...');
            redirectResultRef.current = { userId: user.uid, processed: false };
            
            // 사용자 데이터가 없으면 생성
            try {
              const existingUserData = await getUserData(user.uid);
              if (!existingUserData) {
                console.log('새 사용자 데이터 생성 중...');
                await createUserData(user.uid, {
                  email: user.email || '',
                  name: user.displayName || '사용자',
                  displayName: user.displayName || '사용자',
                  photoURL: user.photoURL || '',
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
                console.log('사용자 데이터 생성 완료');
              }
            } catch (dbError: any) {
              console.error('사용자 데이터 처리 실패:', dbError);
            }
          } else {
            // user가 아직 없으면 onAuthStateChanged가 트리거될 때까지 대기
            console.log('user 상태가 아직 없음 - onAuthStateChanged 대기 중...');
            console.log('authLoading 상태:', authLoading);
            // processingRedirect를 false로 설정하지 않고 대기
            // user 상태가 업데이트되면 두 번째 useEffect에서 처리됨
          }
        }
      } catch (err: any) {
        console.error('리다이렉트 결과 처리 실패:', err);
        setError('로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        setProcessingRedirect(false);
      }
    };

    // 인증 로딩이 완료된 후에만 실행 (한 번만)
    if (!authLoading && !redirectResultRef.current?.processed) {
      handleRedirectResult();
    }
  }, [authLoading, processingRedirect]);

  // 인증 상태가 업데이트되면 리다이렉트 처리
  useEffect(() => {
    // 리다이렉트 결과가 있고 아직 처리되지 않았으며, user 상태가 업데이트된 경우
    if (redirectResultRef.current && !redirectResultRef.current.processed && user && user.uid === redirectResultRef.current.userId) {
      console.log('인증 상태 확인됨 (리다이렉트 결과), 페이지 이동 시작', { userId: user.uid });
      const userId = redirectResultRef.current.userId;
      redirectResultRef.current.processed = true; // 처리 완료 표시
      setProcessingRedirect(false);
      
      // 캐릭터가 없으면 선택 페이지로, 있으면 대시보드로
      getUserData(userId).then((userData) => {
        if (userData && !userData.character) {
          console.log('캐릭터 없음, 캐릭터 선택 페이지로 이동');
          router.push('/character/select');
        } else {
          console.log('대시보드로 이동');
          router.push('/dashboard');
        }
      }).catch((error) => {
        console.error('사용자 데이터 가져오기 실패:', error);
        router.push('/dashboard');
      });
    }
    // getRedirectResult가 null이었지만 user가 나중에 업데이트된 경우 (리다이렉트 완료)
    else if (!redirectResultRef.current && user && !authLoading && processingRedirect) {
      // getRedirectResult가 null이었지만 user가 있으면 리다이렉트가 완료된 것으로 간주
      console.log('user 상태 업데이트 감지 (getRedirectResult null이었지만 user 존재), 처리 시작', { userId: user.uid });
      redirectResultRef.current = { userId: user.uid, processed: false };
      
      // 사용자 데이터가 없으면 생성
      getUserData(user.uid).then(async (existingUserData) => {
        if (!existingUserData) {
          console.log('새 사용자 데이터 생성 중...');
          await createUserData(user.uid, {
            email: user.email || '',
            name: user.displayName || '사용자',
            displayName: user.displayName || '사용자',
            photoURL: user.photoURL || '',
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
          console.log('사용자 데이터 생성 완료');
        }
        
        // 캐릭터가 없으면 선택 페이지로, 있으면 대시보드로
        const userData = await getUserData(user.uid);
        if (userData && !userData.character) {
          console.log('캐릭터 없음, 캐릭터 선택 페이지로 이동');
          router.push('/character/select');
        } else {
          console.log('대시보드로 이동');
          router.push('/dashboard');
        }
      }).catch((error) => {
        console.error('사용자 데이터 처리 실패:', error);
        router.push('/dashboard');
      });
    }
  }, [user, router, processingRedirect, authLoading]);

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
      // 리다이렉트 방식으로 Google 로그인 시작
      await signInWithGoogle();
      // 리다이렉트가 시작되면 이 함수는 여기서 종료됨
      // 실제 로그인 처리는 리다이렉트 후 getRedirectResult로 처리됨
    } catch (err: any) {
      console.error('Google 로그인 에러:', err);
      setError(err.message || 'Google 로그인에 실패했습니다.');
      setLoading(false);
    }
  };

  // 인증 로딩 중이거나 리다이렉트 처리 중이면 로딩 표시
  if (authLoading || processingRedirect) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">로그인 처리 중...</div>
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

