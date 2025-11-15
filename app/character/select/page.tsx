'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, updateUserData } from '@/lib/firebase/firestore';
import { type AnimalType, ANIMAL_OPTIONS, getFixedOutfitForAnimal } from '@/lib/utils/characters';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function CharacterSelectPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      checkUserCharacter();
    }
  }, [user, authLoading, router]);

  const checkUserCharacter = async () => {
    if (!user) return;

    try {
      const data = await getUserData(user.uid);
      setUserData(data);
      
      // 별명이 없으면 별명 설정 페이지로 이동
      if (data?.nickname === undefined) {
        router.push('/nickname/setup');
        return;
      }
      
      // 이미 캐릭터가 있으면 대시보드로 이동
      if (data?.character) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
    }
  };

  const handleSelect = async () => {
    if (!user || !selectedAnimal) {
      setError('캐릭터를 선택해주세요.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // 고정된 옷 스타일 가져오기
      const characterConfig = getFixedOutfitForAnimal(selectedAnimal);

      // 사용자 데이터 업데이트
      await updateUserData(user.uid, {
        character: {
          animalType: characterConfig.animalType,
          outfitColor: characterConfig.outfitColor,
          outfitDesign: characterConfig.outfitDesign,
        },
      });

      // 대시보드로 이동
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || '캐릭터 선택에 실패했습니다.');
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
    <div className="max-w-4xl mx-auto">
      <Card title="캐릭터 선택">
        <div className="space-y-6">
          <p className="text-gray-600 text-center">
            독서 여정을 함께할 귀여운 동물 캐릭터를 선택해주세요!
            <br />
            같은 동물을 선택해도 괜찮아요. 모두 같은 스타일의 옷을 입고 있어요.
          </p>

          {/* 캐릭터 선택 그리드 */}
          <div className="grid grid-cols-5 gap-4">
            {ANIMAL_OPTIONS.map((option) => {
              const isSelected = selectedAnimal === option.animalType;

              return (
                <button
                  key={option.animalType}
                  type="button"
                  onClick={() => setSelectedAnimal(option.animalType)}
                  className={`
                    relative p-4 rounded-lg border-2 transition-all
                    ${isSelected 
                      ? 'border-primary-500 bg-primary-50 shadow-md scale-105' 
                      : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-5xl">{option.emoji}</div>
                    <div className="text-sm font-medium text-gray-700">
                      {option.name}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleSelect}
              disabled={!selectedAnimal || loading}
              className="px-8"
            >
              {loading ? '선택 중...' : '캐릭터 선택하기'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

