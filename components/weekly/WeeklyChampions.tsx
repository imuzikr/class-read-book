'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getWeeklyChampions, type WeeklyChampion } from '@/lib/utils/weeklyChampions';
import { Trophy, Medal, Award, BookOpen } from 'lucide-react';
import { getDefaultBookCover } from '@/lib/utils/bookCover';
import { getCharacterEmoji } from '@/lib/utils/characters';

export default function WeeklyChampions() {
  const [champions, setChampions] = useState<WeeklyChampion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChampions = async () => {
      try {
        const data = await getWeeklyChampions(3);
        setChampions(data);
      } catch (error) {
        console.error('주간 독서 대장 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChampions();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-400 text-sm">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (champions.length === 0) {
    return null;
  }

  const getRankConfig = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          icon: Trophy,
          bgColor: 'bg-gradient-to-br from-yellow-200 to-amber-300',
          borderColor: '',
          textColor: 'text-yellow-900',
          badgeBg: 'bg-yellow-500',
          badgeText: 'text-white',
          iconColor: 'text-yellow-600',
        };
      case 2:
        return {
          icon: Medal,
          bgColor: 'bg-gradient-to-br from-gray-200 to-slate-300',
          borderColor: '',
          textColor: 'text-gray-900',
          badgeBg: 'bg-gray-400',
          badgeText: 'text-white',
          iconColor: 'text-gray-600',
        };
      case 3:
        return {
          icon: Award,
          bgColor: 'bg-gradient-to-br from-orange-200 to-amber-300',
          borderColor: '',
          textColor: 'text-orange-900',
          badgeBg: 'bg-orange-500',
          badgeText: 'text-white',
          iconColor: 'text-orange-600',
        };
      default:
        return {
          icon: Award,
          bgColor: 'bg-gradient-to-br from-blue-200 to-indigo-300',
          borderColor: '',
          textColor: 'text-blue-900',
          badgeBg: 'bg-blue-500',
          badgeText: 'text-white',
          iconColor: 'text-blue-600',
        };
    }
  };

  return (
    <div className="mb-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg p-2">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">이번 주 독서 대장</h2>
          <p className="text-xs text-gray-500">월~일 독서 활동 종합 평가</p>
        </div>
      </div>

      {/* 대장 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[72px]">
        {champions.map((champion) => {
          const config = getRankConfig(champion.rank);
          const Icon = config.icon;

          return (
            <div
              key={champion.userId}
              className={`relative ${config.bgColor} rounded-lg p-4 shadow-lg transition-all duration-200 hover:shadow-xl flex flex-col`}
            >
              {/* 순위 배지 */}
              <div className="absolute -top-2 -right-2">
                <div className={`${config.badgeBg} rounded-full w-8 h-8 flex items-center justify-center shadow-md`}>
                  <span className={`${config.badgeText} font-bold text-sm`}>{champion.rank}</span>
                </div>
              </div>

              {/* 사용자 정보 */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  {/* 프로필 사진 또는 플레이스홀더 */}
                  {champion.userPhotoURL ? (
                    <Image
                      src={champion.userPhotoURL}
                      alt={champion.userName}
                      width={32}
                      height={32}
                      unoptimized
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white shadow-sm flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                  <h3 className={`font-semibold text-xs ${config.textColor} truncate flex-1`}>
                    {champion.userName}
                  </h3>
                </div>
                
                {/* 책 커버와 캐릭터 */}
                <div className="flex items-center justify-center gap-2">
                  {/* 최근 읽은 책 커버 */}
                  {champion.recentBookCover ? (
                    <div className="w-20 h-28 rounded overflow-hidden shadow-lg border-2 border-gray-300">
                      <Image
                        src={champion.recentBookCover}
                        alt="최근 읽은 책"
                        width={80}
                        height={112}
                        unoptimized
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getDefaultBookCover();
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-28 rounded overflow-hidden shadow-lg border-2 border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  
                  {/* 동물 캐릭터 */}
                  {champion.character && (
                    <div className="w-24 h-36 flex items-center justify-center overflow-hidden">
                      <span className="text-6xl block leading-none" style={{ fontSize: '5rem' }}>
                        {getCharacterEmoji(champion.character.animalType as any)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 통계 */}
              <div className="space-y-2 pt-3 border-t border-gray-200 mt-auto">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">연속 독서</span>
                  <span className={`font-semibold ${config.textColor}`}>{champion.weeklyStreak}일</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">독서 분량</span>
                  <span className={`font-semibold ${config.textColor}`}>{champion.weeklyPages.toLocaleString()}p</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">주간 경험치</span>
                  <span className={`font-semibold ${config.textColor}`}>{champion.weeklyExp.toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
