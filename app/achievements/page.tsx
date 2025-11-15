'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserBadges } from '@/lib/firebase/firestore';
import { BADGE_DEFINITIONS, type BadgeDefinition } from '@/lib/utils/badges';
import Card from '@/components/ui/Card';

export default function AchievementsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchBadges();
    }
  }, [user, authLoading, router]);

  const fetchBadges = async () => {
    if (!user) return;

    try {
      const badges = await getUserBadges(user.uid);
      setEarnedBadges(badges);
    } catch (error) {
      console.error('뱃지 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEarned = (badgeId: string) => {
    return earnedBadges.includes(badgeId);
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  const sortedBadges = [...BADGE_DEFINITIONS].sort((a, b) => a.order - b.order);
  const earnedCount = earnedBadges.length;
  const totalCount = BADGE_DEFINITIONS.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">업적</h1>
        <p className="text-gray-600">
          획득한 뱃지: {earnedCount} / {totalCount}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
          <div
            className="bg-primary-500 h-3 rounded-full transition-all"
            style={{ width: `${(earnedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedBadges.map((badge) => {
          const earned = isEarned(badge.id);

          return (
            <Card
              key={badge.id}
              className={`transition-all ${
                earned
                  ? 'bg-gradient-to-br from-primary-50 to-primary-100 border-primary-300'
                  : 'bg-gray-50 opacity-60'
              }`}
            >
              <div className="text-center space-y-3">
                <div className="text-6xl">{badge.icon}</div>
                <div>
                  <h3
                    className={`text-lg font-semibold ${
                      earned ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {badge.name}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      earned ? 'text-gray-600' : 'text-gray-400'
                    }`}
                  >
                    {badge.description}
                  </p>
                </div>
                <div className="flex justify-center items-center space-x-2 text-xs">
                  <span
                    className={`px-2 py-1 rounded ${
                      earned
                        ? 'bg-primary-200 text-primary-800'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    +{badge.expReward} EXP
                  </span>
                  {earned && (
                    <span className="text-green-600 font-medium">✓ 획득</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

