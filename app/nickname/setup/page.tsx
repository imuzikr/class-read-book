'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, updateUserData } from '@/lib/firebase/firestore';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

export default function NicknameSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [nickname, setNickname] = useState('');
  const [useNickname, setUseNickname] = useState(true);
  const [showTodayThought, setShowTodayThought] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const checkUserNickname = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getUserData(user.uid);
      setUserData(data);
      
      // 이미 별명이 설정되어 있으면 대시보드로 이동
      if (data?.nickname !== undefined) {
        router.push('/character/select');
      }
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
    }
  }, [user, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      checkUserNickname();
    }
  }, [user, authLoading, router, checkUserNickname]);

  const validateNickname = (value: string): string | null => {
    if (!value.trim()) {
      return '별명을 입력해주세요.';
    }
    
    if (value.trim().length < 2) {
      return '별명은 2글자 이상이어야 합니다.';
    }
    
    // 한글 또는 영문 조합만 허용
    const nicknameRegex = /^[가-힣a-zA-Z\s]+$/;
    if (!nicknameRegex.test(value.trim())) {
      return '별명은 한글 또는 영문만 사용할 수 있습니다.';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (useNickname) {
      const validationError = validateNickname(nickname);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!user) return;

    setLoading(true);

    try {
      await updateUserData(user.uid, {
        nickname: useNickname ? nickname.trim() : '',
        useNickname,
        showTodayThought,
      });

      // 캐릭터 선택 페이지로 이동
      router.push('/character/select');
    } catch (err: any) {
      setError(err.message || '별명 설정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !userData) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card title="별명 설정">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <p className="text-gray-600">
              독서 활동에서 사용할 이름을 설정해주세요.
            </p>

            {/* 별명 사용 여부 선택 */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                이름 표시 방식
              </label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nameType"
                    checked={useNickname}
                    onChange={() => setUseNickname(true)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">별명 사용</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="nameType"
                    checked={!useNickname}
                    onChange={() => setUseNickname(false)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">실명 사용</span>
                </label>
              </div>
            </div>

            {/* 별명 입력 */}
            {useNickname && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  별명 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setError('');
                  }}
                  placeholder="2글자 이상의 별명을 입력하세요"
                  maxLength={20}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  한글 또는 영문 조합으로 2글자 이상 입력해주세요.
                </p>
              </div>
            )}

            {/* 오늘의 감상 공개 설정 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                오늘의 감상 공개 설정
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTodayThought}
                  onChange={(e) => setShowTodayThought(e.target.checked)}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                />
                <span className="text-gray-700">
                  다른 사용자에게 오늘의 감상을 공개합니다
                </span>
              </label>
              <p className="text-xs text-gray-500 ml-6">
                체크 해제 시 다른 사용자에게 오늘의 감상이 보이지 않습니다.
              </p>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              disabled={loading || (useNickname && !nickname.trim())}
              className="px-8"
            >
              {loading ? '설정 중...' : '다음'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

