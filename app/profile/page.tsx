'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, updateUserData, deleteUserData } from '@/lib/firebase/firestore';
import { type AnimalType, getFixedOutfitForAnimal, ANIMAL_OPTIONS, getCharacterEmoji } from '@/lib/utils/characters';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CharacterSelector from '@/components/character/CharacterSelector';

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType | undefined>();
  const [nickname, setNickname] = useState('');
  const [useNickname, setUseNickname] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        setSelectedAnimal(data.character.animalType as AnimalType);
      }
      
      // 별명 설정 초기화
      if (data) {
        setNickname(data.nickname || '');
        setUseNickname(data.useNickname !== false);
      }
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
      setError('사용자 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSaveNickname = async () => {
    if (!user) return;

    if (useNickname) {
      const validationError = validateNickname(nickname);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError('');
    setSavingNickname(true);

    try {
      await updateUserData(user.uid, {
        nickname: useNickname ? nickname.trim() : '',
        useNickname,
      });

      await fetchUserData();
      alert('별명이 변경되었습니다!');
    } catch (err: any) {
      setError(err.message || '별명 변경에 실패했습니다.');
    } finally {
      setSavingNickname(false);
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

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeleting(true);
    setError('');

    try {
      // 1. Firestore의 모든 사용자 데이터 삭제
      await deleteUserData(user.uid);

      // 2. Firebase Authentication 계정 삭제
      const { deleteUser: firebaseDeleteUser } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase/config');
      
      if (auth && auth.currentUser) {
        await firebaseDeleteUser(auth.currentUser);
      }

      // 3. 로그인 페이지로 리다이렉트
      alert('계정이 성공적으로 삭제되었습니다.');
      router.push('/login');
    } catch (err: any) {
      console.error('계정 삭제 실패:', err);
      setError(err.message || '계정 삭제에 실패했습니다. 다시 시도해주세요.');
      setDeleting(false);
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

      {/* 오늘의 감상 공개 설정 */}
      <Card title="오늘의 감상 공개 설정">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            다른 사용자에게 오늘의 감상을 공개할지 설정할 수 있습니다.
            <br />
            이 설정은 앞으로 작성하는 독서 기록에 적용됩니다.
          </p>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={userData.showTodayThought !== false}
              onChange={async (e) => {
                if (!user) return;
                try {
                  await updateUserData(user.uid, {
                    showTodayThought: e.target.checked,
                  });
                  await fetchUserData();
                } catch (error) {
                  console.error('설정 변경 실패:', error);
                  alert('설정 변경에 실패했습니다.');
                }
              }}
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
      </Card>

      {/* 별명 설정 */}
      <Card title="별명 설정">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            독서 활동에서 사용할 이름을 설정할 수 있습니다.
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
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setError('');
                }}
                placeholder="2글자 이상의 별명을 입력하세요"
                maxLength={20}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white text-base"
              />
              <p className="mt-1 text-xs text-gray-500">
                한글 또는 영문 조합으로 2글자 이상 입력해주세요.
              </p>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveNickname}
              disabled={savingNickname || (useNickname && !nickname.trim())}
              className="px-6"
            >
              {savingNickname ? '저장 중...' : '별명 저장'}
            </Button>
          </div>
        </div>
      </Card>

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

      {/* 계정 삭제 */}
      <Card title="계정 관리">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-red-900 mb-2">⚠️ 계정 탈퇴</h3>
            <p className="text-sm text-red-800 mb-3">
              계정을 탈퇴하면 다음 데이터가 <strong>완전히 삭제</strong>되며 복구할 수 없습니다:
            </p>
            <ul className="text-sm text-red-800 list-disc list-inside space-y-1 mb-4">
              <li>사용자 프로필 정보</li>
              <li>등록한 모든 책 정보</li>
              <li>모든 독서 기록 및 감상</li>
              <li>획득한 모든 뱃지</li>
              <li>레벨 및 경험치 정보</li>
              <li>랭킹 및 통계 데이터</li>
            </ul>
            <p className="text-sm text-red-900 font-semibold">
              정말로 탈퇴하시겠습니까?
            </p>
          </div>

          {!showDeleteConfirm ? (
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              계정 탈퇴하기
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-900 font-semibold mb-2">
                  최종 확인이 필요합니다.
                </p>
                <p className="text-sm text-yellow-800">
                  위에 나열된 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setError('');
                  }}
                  disabled={deleting}
                  className="flex-1"
                >
                  취소
                </Button>
                <Button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? '삭제 중...' : '확인하고 탈퇴하기'}
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
