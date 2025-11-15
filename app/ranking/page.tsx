'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getRankings, getUserRanking, type RankingPeriod, type RankingItem } from '@/lib/utils/ranking';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function RankingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [userRanking, setUserRanking] = useState<RankingItem | null>(null);
  const [period, setPeriod] = useState<RankingPeriod>('all-time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchRankings();
    }
  }, [user, authLoading, router, period]);

  const fetchRankings = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // 먼저 현재 사용자의 랭킹을 업데이트
      const { getUserData } = await import('@/lib/firebase/firestore');
      const { updateRanking, calculatePeriodExp } = await import('@/lib/utils/ranking');
      
      // 랭킹 데이터를 먼저 가져오고, 랭킹 업데이트는 백그라운드로 처리
      const [rankingsData, userRankingData, userData] = await Promise.all([
        getRankings(period, 100),
        getUserRanking(user.uid, period),
        getUserData(user.uid),
      ]);

      // 랭킹 업데이트는 백그라운드로 처리 (페이지 로딩을 막지 않음)
      if (userData) {
        const periods: Array<'daily' | 'weekly' | 'monthly' | 'all-time'> = ['daily', 'weekly', 'monthly', 'all-time'];
        Promise.all(
          periods.map(async (p) => {
            try {
              const periodExp = await calculatePeriodExp(user.uid, p, userData);
              await updateRanking(user.uid, p, periodExp);
            } catch (err) {
              console.error(`${p} 랭킹 업데이트 실패:`, err);
            }
          })
        ).catch(err => console.error('랭킹 업데이트 실패:', err));
      }
      setRankings(rankingsData);
      setUserRanking(userRankingData);
    } catch (error: any) {
      console.error('랭킹 로드 실패:', error);
      const errorMessage = error.message || '랭킹을 불러오는 중 오류가 발생했습니다.';
      setError(errorMessage);
      
      // Firestore 인덱스 오류인지 확인
      if (errorMessage.includes('index') || errorMessage.includes('The query requires an index')) {
        setError('랭킹 조회를 위해 Firestore 인덱스가 필요합니다. Firebase 콘솔에서 인덱스를 생성해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    // 4등부터는 회색 메달 SVG
    if (rank >= 4 && rank <= 10) {
      return null; // SVG로 렌더링
    }
    return `#${rank}`;
  };

  const renderMedal = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    // 4등부터는 회색 메달 SVG
    if (rank >= 4 && rank <= 10) {
      return (
        <div className="relative w-8 h-8 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" className="absolute">
            {/* 메달 리본 */}
            <path d="M 16 3 L 11 8 L 16 11 L 21 8 Z" fill="#9CA3AF" opacity="0.8"/>
            {/* 메달 원형 */}
            <circle cx="16" cy="16" r="13" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="1.5"/>
            <circle cx="16" cy="16" r="10" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
          </svg>
          <span className="relative z-10 text-xs font-bold text-gray-700">
            {rank}
          </span>
        </div>
      );
    }
    return <span className="text-sm font-bold text-gray-600">#{rank}</span>;
  };

  const getPeriodLabel = (p: RankingPeriod) => {
    switch (p) {
      case 'daily':
        return '일간';
      case 'weekly':
        return '주간';
      case 'monthly':
        return '월간';
      case 'all-time':
        return '전체';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-4">랭킹</h1>
        
        {/* 기간 선택 */}
        <div className="flex space-x-2 mb-6">
          {(['daily', 'weekly', 'monthly', 'all-time'] as RankingPeriod[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {getPeriodLabel(p)}
            </Button>
          ))}
        </div>
      </div>

      {/* 내 순위 */}
      {userRanking && (
        <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">내 순위</p>
              <div className="flex items-center gap-2">
                {renderMedal(userRanking.rank)}
                <span className="text-2xl font-bold">{userRanking.rank}위</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">경험치</p>
              <p className="text-2xl font-bold text-primary-600">
                {userRanking.totalExp.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 에러 메시지 */}
      {error && (
        <Card className="bg-red-50 border-red-200">
          <div className="text-red-800">
            <p className="font-semibold mb-1">⚠️ 오류</p>
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      {/* 랭킹 목록 */}
      <Card title={`${getPeriodLabel(period)} 랭킹 TOP ${rankings.length}`}>
        {rankings.length === 0 && !error ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">아직 랭킹 데이터가 없습니다.</p>
            <p className="text-sm">독서 기록을 추가하거나 대시보드를 방문하면 랭킹이 생성됩니다.</p>
          </div>
        ) : rankings.length === 0 && error ? (
          <div className="text-center py-8 text-gray-500">
            랭킹을 불러올 수 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.map((item, index) => {
              const isCurrentUser = item.userId === user?.uid;
              
              return (
                <div
                  key={item.userId}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                    isCurrentUser
                      ? 'bg-primary-50 border-2 border-primary-300'
                      : index < 3
                      ? 'bg-gray-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 flex items-center justify-center">
                      {renderMedal(item.rank)}
                    </div>
                    <div>
                      <p className={`font-semibold ${isCurrentUser ? 'text-primary-700' : 'text-gray-900'}`}>
                        {item.isAnonymous ? '익명 사용자' : item.userName}
                        {isCurrentUser && ' (나)'}
                      </p>
                      {!item.isAnonymous && (
                        <p className="text-xs text-gray-500">{item.userEmail}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-600">
                      {item.totalExp.toLocaleString()} EXP
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

