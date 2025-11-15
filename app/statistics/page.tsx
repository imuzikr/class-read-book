'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, getBooks, getReadingLogs, getReviews } from '@/lib/firebase/firestore';
import { formatDateKorean } from '@/lib/utils/date';
import { getLevelProgress, getExpToNextLevel } from '@/lib/utils/game';
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
  const [loading, setLoading] = useState(true);

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
      const [userDataRes, booksRes, logsRes, reviewsRes] = await Promise.all([
        getUserData(user.uid),
        getBooks(user.uid),
        getReadingLogs(user.uid),
        getReviews(user.uid),
      ]);

      setUserData(userDataRes);
      setBooks(booksRes);
      setReadingLogs(logsRes);
      setReviews(reviewsRes);
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
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              {userData.totalPagesRead.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">총 읽은 페이지</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              {userData.totalBooksRead}
            </div>
            <div className="text-sm text-gray-600 mt-1">완독한 책</div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">
              🔥 {userData.currentStreak}
            </div>
            <div className="text-sm text-gray-600 mt-1">연속 독서 일수</div>
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
    </div>
  );
}

