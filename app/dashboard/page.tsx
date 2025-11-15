'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, getBooks, type Book } from '@/lib/firebase/firestore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { getLevelProgress, getExpToNextLevel } from '@/lib/utils/game';
import type { UserData } from '@/lib/firebase/firestore';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [readingBooks, setReadingBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }

      const fetchUserData = async () => {
        try {
          const data = await getUserData(user.uid);
          
          // 캐릭터가 없으면 캐릭터 선택 페이지로 이동
          if (data && !data.character) {
            router.push('/character/select');
            return;
          }
          
          setUserData(data);
          
          // 읽고 있는 책 가져오기 (모든 책을 가져온 후 필터링)
          try {
            const allBooks = await getBooks(user.uid);
            // 'reading' 상태인 책만 필터링
            const readingOnly = allBooks.filter(book => book.status === 'reading');
            // 최근 업데이트 순으로 정렬
            const sortedBooks = readingOnly.sort((a, b) => {
              const aTime = a.updatedAt?.toMillis() || 0;
              const bTime = b.updatedAt?.toMillis() || 0;
              return bTime - aTime;
            });
            setReadingBooks(sortedBooks);
            console.log('읽고 있는 책:', sortedBooks.length, '권');
          } catch (error) {
            console.error('읽고 있는 책 로드 실패:', error);
            setReadingBooks([]);
          }
          
          // 랭킹 업데이트 (백그라운드, 병렬 처리)
          if (data) {
            const { updateRanking, calculatePeriodExp } = await import('@/lib/utils/ranking');
            const periods: Array<'daily' | 'weekly' | 'monthly' | 'all-time'> = ['daily', 'weekly', 'monthly', 'all-time'];
            
            // 병렬로 처리하고 await 하지 않음 (백그라운드)
            Promise.all(
              periods.map(async (period) => {
                try {
                  const periodExp = await calculatePeriodExp(user.uid, period, data);
                  await updateRanking(user.uid, period, periodExp);
                } catch (error) {
                  console.error(`${period} 랭킹 업데이트 실패:`, error);
                }
              })
            ).catch(err => console.error('랭킹 업데이트 실패:', err));
          }
        } catch (error) {
          console.error('사용자 데이터 로드 실패:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    }
  }, [user, authLoading, router]);

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

  const progress = getLevelProgress(userData.exp, userData.level);
  const expToNext = getExpToNextLevel(userData.exp, userData.level);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">대시보드</h1>

      {/* 독서중 (간략 정보) */}
      {readingBooks.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-gray-600 font-medium">독서중:</span>
              {readingBooks.slice(0, 2).map((book, index) => {
                const bookProgress = book.totalPages > 0 
                  ? Math.round((book.currentPage / book.totalPages) * 100) 
                  : 0;
                return (
                  <Link 
                    key={book.id}
                    href={`/books/${book.id}`}
                    className="text-primary-700 hover:text-primary-900 hover:underline truncate"
                  >
                    {book.title} ({book.currentPage}/{book.totalPages}페이지, {bookProgress}%)
                  </Link>
                );
              })}
              {readingBooks.length > 2 && (
                <span className="text-gray-500">외 {readingBooks.length - 2}권</span>
              )}
            </div>
            <Link href="/books" className="text-xs text-primary-600 hover:text-primary-700 whitespace-nowrap">
              전체 보기 →
            </Link>
          </div>
        </div>
      )}

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

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      {/* 빠른 액션 */}
      <Card title="빠른 액션">
        <div className="flex flex-wrap gap-4">
          <Link href="/books/new">
            <Button>새 책 추가</Button>
          </Link>
          <Link href="/reading-log">
            <Button variant="secondary">매일독서</Button>
          </Link>
          <Link href="/books">
            <Button variant="outline">내 서재 보기</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

