'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, getBooks, getReadingLogs, getReviews, getUserBadges } from '@/lib/firebase/firestore';
import { formatDateKorean } from '@/lib/utils/date';
import { getLevelProgress, getExpToNextLevel } from '@/lib/utils/game';
import { getDefaultBookCover } from '@/lib/utils/bookCover';
import { BADGE_DEFINITIONS } from '@/lib/utils/badges';
import Card from '@/components/ui/Card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function StatisticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [readingLogs, setReadingLogs] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [userBadges, setUserBadges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<'pages' | 'books' | 'streak' | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const [userDataRes, booksRes, logsRes, reviewsRes, badgesRes] = await Promise.all([
        getUserData(user.uid),
        getBooks(user.uid),
        getReadingLogs(user.uid),
        getReviews(user.uid),
        getUserBadges(user.uid),
      ]);

      setUserData(userDataRes);
      setBooks(booksRes);
      setReadingLogs(logsRes);
      setReviews(reviewsRes);
      setUserBadges(badgesRes);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 월별 독서량 데이터 준비
  const getMonthlyData = () => {
    const monthlyMap = new Map<string, number>();

    readingLogs.forEach(log => {
      const date = log.date.toDate();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, current + log.pagesRead);
    });

    const sortedMonths = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6); // 최근 6개월

    return sortedMonths.map(([month, pages]) => ({
      month: month.split('-')[1] + '월',
      pages,
    }));
  };

  // 주간 독서량 데이터 준비
  const getWeeklyData = () => {
    const weeklyMap = new Map<string, number>();
    const now = new Date();
    
    // 최근 8주
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekKey = `${weekStart.getFullYear()}-W${getWeekNumber(weekStart)}`;
      weeklyMap.set(weekKey, 0);
    }

    readingLogs.forEach(log => {
      const date = log.date.toDate();
      const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
      if (weeklyMap.has(weekKey)) {
        const current = weeklyMap.get(weekKey) || 0;
        weeklyMap.set(weekKey, current + log.pagesRead);
      }
    });

    return Array.from(weeklyMap.entries()).map(([week, pages]) => ({
      week: week.split('-W')[1] + '주',
      pages,
    }));
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // 책 상태별 통계
  const getBookStatusStats = () => {
    const reading = books.filter(b => b.status === 'reading').length;
    const completed = books.filter(b => b.status === 'completed').length;
    const paused = books.filter(b => b.status === 'paused').length;

    return [
      { name: '읽는 중', value: reading, color: '#3b82f6' },
      { name: '완독', value: completed, color: '#10b981' },
      { name: '일시정지', value: paused, color: '#6b7280' },
    ];
  };

  // 평균 1일 독서량 계산
  const getAverageDailyPages = () => {
    if (readingLogs.length === 0) return 0;
    
    // 독서한 날짜의 개수 계산
    const uniqueDates = new Set<string>();
    readingLogs.forEach(log => {
      const date = log.date.toDate();
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      uniqueDates.add(dateKey);
    });
    
    const totalDays = uniqueDates.size;
    if (totalDays === 0) return 0;
    
    return Math.round(userData.totalPagesRead / totalDays);
  };

  // 완독한 책 목록 가져오기
  const getCompletedBooks = () => {
    return books.filter(b => b.status === 'completed');
  };

  // 사용자 개인의 연속 독서 일수 기록 추출 (상위 3개)
  const getUserStreakHistory = () => {
    if (readingLogs.length === 0) return [];
    
    // 독서 기록을 날짜별로 그룹화
    const dateMap = new Map<string, Date>();
    readingLogs.forEach(log => {
      const date = log.date.toDate();
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, date);
      }
    });
    
    // 날짜 배열로 변환하고 정렬 (오래된 순)
    const sortedDates = Array.from(dateMap.values())
      .map(d => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        return date;
      })
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (sortedDates.length === 0) return [];
    
    // 모든 연속 독서 구간 찾기
    const streaks: Array<{ startDate: Date; endDate: Date; days: number }> = [];
    let currentStreakStart: Date | null = null;
    let currentStreakEnd: Date | null = null;
    let prevDate: Date | null = null;
    
    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];
      
      if (prevDate === null) {
        // 첫 번째 날짜
        currentStreakStart = currentDate;
        currentStreakEnd = currentDate;
      } else {
        const daysDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // 연속된 날짜
          currentStreakEnd = currentDate;
        } else {
          // 연속이 끊김 - 현재 구간 저장
          if (currentStreakStart && currentStreakEnd) {
            const streakDays = Math.floor((currentStreakEnd.getTime() - currentStreakStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            streaks.push({
              startDate: currentStreakStart,
              endDate: currentStreakEnd,
              days: streakDays,
            });
          }
          // 새로운 구간 시작
          currentStreakStart = currentDate;
          currentStreakEnd = currentDate;
        }
      }
      
      prevDate = currentDate;
    }
    
    // 마지막 구간 저장
    if (currentStreakStart && currentStreakEnd) {
      const streakDays = Math.floor((currentStreakEnd.getTime() - currentStreakStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      streaks.push({
        startDate: currentStreakStart,
        endDate: currentStreakEnd,
        days: streakDays,
      });
    }
    
    // 일수 기준으로 정렬하고 상위 3개 반환
    return streaks
      .sort((a, b) => b.days - a.days)
      .slice(0, 3);
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
        <p className="text-gray-600">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const progress = getLevelProgress(userData.exp, userData.level);
  const expToNext = getExpToNextLevel(userData.exp, userData.level);
  const monthlyData = getMonthlyData();
  const weeklyData = getWeeklyData();
  const bookStatusData = getBookStatusStats();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">통계</h1>

      {/* 주요 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div 
            className="text-center cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-lg p-2 relative hover:-translate-y-1 hover:shadow-md"
            onClick={() => setModalType('pages')}
          >
            <div className="text-3xl font-bold text-primary-600">
              {userData.totalPagesRead.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">총 읽은 페이지</div>
            <div className="absolute top-2 right-2 text-gray-300 text-xs">👆</div>
          </div>
        </Card>
        <Card>
          <div 
            className="text-center cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-lg p-2 relative hover:-translate-y-1 hover:shadow-md"
            onClick={() => setModalType('books')}
          >
            <div className="text-3xl font-bold text-primary-600">
              {userData.totalBooksRead}
            </div>
            <div className="text-sm text-gray-600 mt-1">완독한 책</div>
            <div className="absolute top-2 right-2 text-gray-300 text-xs">👆</div>
          </div>
        </Card>
        <Card>
          <div 
            className="text-center cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-lg p-2 relative hover:-translate-y-1 hover:shadow-md"
            onClick={() => setModalType('streak')}
          >
            <div className="text-3xl font-bold text-primary-600">
              🔥 {userData.currentStreak}
            </div>
            <div className="text-sm text-gray-600 mt-1">연속 독서 일수</div>
            <div className="absolute top-2 right-2 text-gray-300 text-xs">👆</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              {reviews.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">작성한 감상문</div>
          </div>
        </Card>
      </div>

      {/* 책 상태별 통계 */}
      {bookStatusData.some(d => d.value > 0) && (
        <Card title="책 상태별 통계">
          <div className="grid grid-cols-3 gap-4">
            {bookStatusData.map((item) => (
              <div key={item.name} className="text-center">
                <div
                  className="text-4xl font-bold mb-2"
                  style={{ color: item.color }}
                >
                  {item.value}
                </div>
                <div className="text-sm text-gray-600">{item.name}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 뱃지 섹션 */}
      <Card title="뱃지">
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-3">
          {BADGE_DEFINITIONS.sort((a, b) => a.order - b.order).map((badge) => {
            const hasBadge = userBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`relative flex flex-col items-center p-3 rounded-lg transition-all group ${
                  hasBadge
                    ? 'bg-primary-50 border-2 border-primary-300 opacity-100'
                    : 'bg-gray-50 border border-gray-200 opacity-30'
                }`}
              >
                <div className={`text-3xl mb-1 ${hasBadge ? '' : 'grayscale'}`}>
                  {badge.icon}
                </div>
                <div className={`text-xs text-center font-medium ${
                  hasBadge ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {badge.name}
                </div>
                
                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-48">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                    <div className="font-semibold mb-1">{badge.name}</div>
                    <div className="text-gray-300">{badge.description}</div>
                    {hasBadge && (
                      <div className="mt-1 pt-1 border-t border-gray-700 text-primary-300">
                        ✓ 취득 완료
                      </div>
                    )}
                    {/* 화살표 */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 레벨 및 경험치 */}
      <Card title={`레벨 ${userData.level}`}>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>경험치: {userData.exp.toLocaleString()}</span>
            <span>다음 레벨까지: {expToNext.toLocaleString()} EXP</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-primary-500 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">{progress}%</p>
        </div>
      </Card>

      {/* 월별 독서량 차트 */}
      {monthlyData.length > 0 && (
        <Card title="월별 독서량">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="pages" fill="#f97316" name="페이지 수" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* 주간 독서량 차트 */}
      {weeklyData.length > 0 && (
        <Card title="주간 독서량 (최근 8주)">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pages" stroke="#3b82f6" name="페이지 수" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}


      {/* 상세 정보 모달 */}
      {modalType && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setModalType(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">
                  {modalType === 'pages' && '평균 1일 독서량'}
                  {modalType === 'books' && '완독한 책 목록'}
                  {modalType === 'streak' && '연속 독서 일수 랭킹'}
                </h2>
                <button
                  onClick={() => setModalType(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {modalType === 'pages' && (
                <div className="space-y-4">
                  <Card>
                    <div className="text-center py-8">
                      <div className="text-4xl font-bold text-primary-600 mb-2">
                        {getAverageDailyPages()}페이지
                      </div>
                      <p className="text-gray-600">
                        평균 1일 독서량
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        총 {userData.totalPagesRead.toLocaleString()}페이지를 {readingLogs.length > 0 ? new Set(readingLogs.map(log => {
                          const date = log.date.toDate();
                          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                        })).size : 0}일 동안 읽으셨습니다.
                      </p>
                    </div>
                  </Card>
                </div>
              )}

              {modalType === 'books' && (
                <div className="space-y-4">
                  {getCompletedBooks().length === 0 ? (
                    <Card>
                      <div className="text-center py-8 text-gray-500">
                        완독한 책이 없습니다.
                      </div>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {getCompletedBooks().map((book) => {
                        const progress = book.totalPages > 0 
                          ? Math.round((book.currentPage / book.totalPages) * 100) 
                          : 0;
                        
                        return (
                          <Card key={book.id} className="p-4">
                            <div className="flex gap-3">
                              <div className="flex-shrink-0 w-16 h-20 bg-gray-200 rounded overflow-hidden">
                                {book.coverImage ? (
                                  <img
                                    src={book.coverImage}
                                    alt={book.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = getDefaultBookCover();
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                    <span>📚</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm mb-1 line-clamp-2">{book.title}</h4>
                                <p className="text-xs text-gray-500 mb-2">{book.author}</p>
                                <div className="mb-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-green-500 h-2 rounded-full"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-600">{progress}%</span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {book.totalPages}페이지
                                  </div>
                                </div>
                                {book.finishDate && (
                                  <p className="text-xs text-gray-500">
                                    완독일: {formatDateKorean(book.finishDate.toDate())}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {modalType === 'streak' && (
                <div className="space-y-4">
                  <Card>
                    <div className="space-y-3">
                      {getUserStreakHistory().length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          연속 독서 기록이 없습니다.
                        </div>
                      ) : (
                        getUserStreakHistory().map((streak, index) => {
                          const rank = index + 1;
                          
                          return (
                            <div
                              key={`${streak.startDate.getTime()}-${streak.endDate.getTime()}`}
                              className="flex items-center justify-between p-4 rounded-lg bg-gray-50"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-12 flex items-center justify-center">
                                  {rank === 1 && <span className="text-2xl">🥇</span>}
                                  {rank === 2 && <span className="text-2xl">🥈</span>}
                                  {rank === 3 && <span className="text-2xl">🥉</span>}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {rank}위 연속 독서 기록
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDateKorean(streak.endDate)} ~ {formatDateKorean(streak.startDate)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-primary-600">
                                  🔥 {streak.days}일
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

