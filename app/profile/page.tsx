'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, updateUserData } from '@/lib/firebase/firestore';
import { type AnimalType, getFixedOutfitForAnimal, ANIMAL_OPTIONS, getCharacterEmoji } from '@/lib/utils/characters';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CharacterSelector from '@/components/character/CharacterSelector';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchUserData();
    }
  }, [user, authLoading, router]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      const data = await getUserData(user.uid);
      setUserData(data);
      
      if (data?.character?.animalType) {
        setSelectedAnimal(data.character.animalType);
      }
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
      setError('사용자 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !selectedAnimal) {
      setError('캐릭터를 선택해주세요.');
      return;
    }

    setError('');
    setSaving(true);

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

      // 데이터 새로고침
      await fetchUserData();
      
      alert('캐릭터가 변경되었습니다!');
    } catch (err: any) {
      setError(err.message || '캐릭터 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="text-center">
        <p className="text-gray-600">사용자 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const currentCharacter = userData.character 
    ? getFixedOutfitForAnimal(userData.character.animalType)
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">프로필</h1>

      {/* 현재 캐릭터 표시 */}
      <Card title="현재 캐릭터">
        <div className="flex flex-col items-center space-y-4">
          {currentCharacter ? (
            <>
              <div className="text-8xl">
                {getCharacterEmoji(currentCharacter.animalType)}
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold">
                  {ANIMAL_OPTIONS.find(opt => opt.animalType === currentCharacter.animalType)?.name}
                </div>
                <div className="text-sm text-gray-500">
                  {currentCharacter.outfitColor} {currentCharacter.outfitDesign}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500">
              <p>캐릭터가 선택되지 않았습니다.</p>
              <p className="text-sm mt-2">아래에서 캐릭터를 선택해주세요.</p>
            </div>
          )}
        </div>
      </Card>

      {/* 캐릭터 변경 */}
      <Card title="캐릭터 변경">
        <div className="space-y-6">
          <p className="text-gray-600 text-center">
            새로운 캐릭터를 선택하세요. 같은 동물을 선택해도 괜찮아요. 모두 같은 스타일의 옷을 입고 있어요.
          </p>

          {/* 캐릭터 선택 그리드 */}
          <CharacterSelector
            selectedAnimal={selectedAnimal}
            onSelect={setSelectedAnimal}
          />

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-center pt-4">
            <Button
              onClick={handleSave}
              disabled={!selectedAnimal || saving || selectedAnimal === userData.character?.animalType}
              className="px-8"
            >
              {saving ? '저장 중...' : '캐릭터 변경하기'}
            </Button>
          </div>
        </div>
      </Card>

      {/* 사용자 정보 */}
      <Card title="사용자 정보">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">이름</span>
            <span className="font-semibold">{userData.name || userData.displayName || '없음'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">이메일</span>
            <span className="font-semibold">{userData.email || '없음'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">레벨</span>
            <span className="font-semibold">{userData.level || 1}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">경험치</span>
            <span className="font-semibold">{userData.exp?.toLocaleString() || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">총 읽은 페이지</span>
            <span className="font-semibold">{userData.totalPagesRead?.toLocaleString() || 0}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
