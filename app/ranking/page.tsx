'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { authedFetch } from '@/lib/utils/apiClient';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

interface RankingItem {
  userId: string;
  userName: string;
  level: number;
  totalExp: number;
  rank: number;
}

interface PublicProfile {
  user: {
    userName: string;
    level: number;
    exp: number;
    totalBooksRead: number;
    totalPagesRead: number;
    currentStreak: number;
  };
  books: Array<{
    id: string;
    title: string;
    author: string;
    totalPages: number;
    currentPage: number;
    status: string;
    coverImage?: string;
  }>;
  logs: Array<{
    id: string;
    bookId: string;
    date: string;
    pagesRead: number;
    notes?: string;
  }>;
}

export default function RankingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [userRanking, setUserRanking] = useState<RankingItem | null>(null);
  const [period, setPeriod] = useState<RankingPeriod>('all-time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<{ userId: string; userName: string } | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<PublicProfile['user'] | null>(null);
  const [selectedUserBooks, setSelectedUserBooks] = useState<PublicProfile['books']>([]);
  const [selectedUserLogs, setSelectedUserLogs] = useState<PublicProfile['logs']>([]);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  const fetchRankings = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // 서버 API에서 랭킹 계산 (다른 사용자의 기록을 클라이언트가 직접 읽지 않음)
      const data = await authedFetch<{ rankings: RankingItem[] }>(
        `/api/community/rankings?period=${period}`,
        { method: 'GET' }
      );

      setRankings(data.rankings);

      // 현재 사용자의 순위 찾기
      const myRanking = data.rankings.find(r => r.userId === user.uid);
      setUserRanking(myRanking || null);
    } catch (error: any) {
      console.error('랭킹 로드 실패:', error);
      const errorMessage = error.message || '랭킹을 불러오는 중 오류가 발생했습니다.';
      setError(errorMessage);
      
      if (errorMessage.includes('index') || errorMessage.includes('The query requires an index')) {
        setError('랭킹 조회를 위해 Firestore 인덱스가 필요합니다. Firebase 콘솔에서 인덱스를 생성해주세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchRankings();
    }
  }, [user, authLoading, router, period, fetchRankings]);

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
    // 4등부터는 회색 메달 SVG (모든 순위에 적용)
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

  const handleUserClick = async (userId: string, userName: string) => {
    setSelectedUser({ userId, userName });
    setLoadingUserDetail(true);
    
    try {
      // 서버 API가 공개 감상만 걸러서 내려준다 (비공개 감상은 전송 자체가 안 됨)
      const profile = await authedFetch<PublicProfile>(
        `/api/users/${userId}/public-profile`,
        { method: 'GET' }
      );

      setSelectedUserData(profile.user);
      setSelectedUserBooks(profile.books);
      setSelectedUserLogs(profile.logs);
    } catch (error) {
      console.error('사용자 상세 정보 로드 실패:', error);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setSelectedUserData(null);
    setSelectedUserBooks([]);
    setSelectedUserLogs([]);
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
                  onClick={() => !isCurrentUser && handleUserClick(item.userId, item.userName)}
                  className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                    isCurrentUser
                      ? 'bg-primary-50 border-2 border-primary-300'
                      : index < 3
                      ? 'bg-gray-50 cursor-pointer hover:bg-gray-100'
                      : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 flex items-center justify-center">
                      {renderMedal(item.rank)}
                    </div>
                    <div>
                      <p className={`font-semibold ${isCurrentUser ? 'text-primary-700' : 'text-gray-900'}`}>
                        {item.userName}
                        {isCurrentUser && ' (나)'}
                      </p>
                      <p className="text-xs text-gray-500">Lv.{item.level}</p>
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

      {/* 사용자 상세 정보 모달 */}
      {selectedUser && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">
                  {selectedUser.userName}님의 독서 활동
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {loadingUserDetail ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : selectedUserData ? (
                <div className="space-y-6">
                  {/* 사용자 기본 정보 */}
                  <Card>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">레벨</span>
                        <span className="font-semibold">Lv.{selectedUserData.level}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">경험치</span>
                        <span className="font-semibold">{selectedUserData.exp.toLocaleString()} EXP</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">읽은 책</span>
                        <span className="font-semibold">{selectedUserData.totalBooksRead}권</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">읽은 페이지</span>
                        <span className="font-semibold">{selectedUserData.totalPagesRead.toLocaleString()}페이지</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">연속 독서 일수</span>
                        <span className="font-semibold">{selectedUserData.currentStreak}일</span>
                      </div>
                    </div>
                  </Card>

                  {/* 읽고 있는 책 */}
                  <Card title={`읽고 있는 책 (${selectedUserBooks.filter(b => b.status === 'reading').length}권)`}>
                    {selectedUserBooks.filter(b => b.status === 'reading').length === 0 ? (
                      <p className="text-gray-500 text-center py-4">현재 읽고 있는 책이 없습니다.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedUserBooks
                          .filter(b => b.status === 'reading')
                          .map((book) => {
                            const progress = book.totalPages > 0 
                              ? Math.round((book.currentPage / book.totalPages) * 100) 
                              : 0;
                            
                            return (
                              <div key={book.id} className="border-b border-gray-200 pb-3 last:border-0">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-sm">{book.title}</h4>
                                    <p className="text-xs text-gray-500">{book.author}</p>
                                  </div>
                                  <span className="text-xs text-gray-600">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary-600 h-2 rounded-full"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {book.currentPage} / {book.totalPages} 페이지
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Card>

                  {/* 오늘의 감상 (공개된 것만) */}
                  <Card title={`오늘의 감상 (${selectedUserLogs.length}건)`}>
                    {selectedUserLogs.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">공개된 감상이 없습니다.</p>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {selectedUserLogs.map((log) => {
                          const book = selectedUserBooks.find(b => b.id === log.bookId);
                          
                          return (
                            <div key={log.id} className="border-b border-gray-200 pb-3 last:border-0">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-medium text-sm text-gray-900">
                                    {book?.title || '알 수 없음'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(log.date).toLocaleDateString('ko-KR')}
                                  </p>
                                </div>
                                <span className="text-xs text-gray-600">
                                  {log.pagesRead}페이지
                                </span>
                              </div>
                              {log.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded">
                                  <p className="text-sm text-gray-700">{log.notes}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">사용자 정보를 불러올 수 없습니다.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

