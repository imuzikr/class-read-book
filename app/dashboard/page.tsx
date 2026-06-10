'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, getBooks } from '@/lib/firebase/firestore';
import { type Book } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { getLevelProgress, getExpToNextLevel } from '@/lib/utils/game';
import type { User } from '@/types';
import { getDefaultBookCover } from '@/lib/utils/bookCover';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<User | null>(null);
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
              const aTime = a.updatedAt?.getTime() || 0;
              const bTime = b.updatedAt?.getTime() || 0;
              return bTime - aTime;
            });
            setReadingBooks(sortedBooks);
            console.log('읽고 있는 책:', sortedBooks.length, '권');
          } catch (error) {
            console.error('읽고 있는 책 로드 실패:', error);
            setReadingBooks([]);
          }
          
          // 랭킹은 이제 서버 API(/api/community/rankings)가 실시간 계산하므로
          // rankings 컬렉션 캐시 갱신이 더 이상 필요 없음
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
      {/* 헤더: 타이틀과 빠른 액션 버튼들 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold">대시보드</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.push('/books/new')}>새 책 추가</Button>
          <Button
            variant="secondary"
            onClick={() => {
              // 읽고 있는 책이 있으면 첫 번째 책의 상세 페이지로, 없으면 독서 기록 페이지로
              if (readingBooks.length > 0) {
                router.push(`/books/${readingBooks[0].id}`);
              } else {
                router.push('/reading-log');
              }
            }}
          >
            매일독서
          </Button>
          <Button variant="outline" onClick={() => router.push('/books')}>내 서재 보기</Button>
        </div>
      </div>

      {/* 현재 읽고 있는 책들 */}
      {readingBooks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">현재 읽고 있는 책</h2>
            <Link href="/books" className="text-sm text-primary-600 hover:text-primary-700">
              전체 보기 →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readingBooks.map((book) => {
              const progress = book.totalPages > 0
                ? Math.round((book.currentPage / book.totalPages) * 100)
                : 0;

              return (
                <Card
                  key={book.id}
                  className="hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => router.push(`/books/${book.id}`)}
                >
                  <div className="space-y-3">
                    {/* 책 커버 이미지와 정보 */}
                    <div className="flex gap-3">
                      {/* 커버 이미지 */}
                      <div className="flex-shrink-0">
                        <div className="w-20 h-28 bg-gray-200 rounded overflow-hidden shadow-sm">
                          {book.coverImage ? (
                            <Image
                              src={book.coverImage}
                              alt={`${book.title} 커버`}
                              width={80}
                              height={112}
                              unoptimized
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Image 컴포넌트에서는 onError 처리가 다릅니다.
                                // 일단 unoptimized를 사용하여 img 태그와 유사하게 동작하도록 합니다.
                                const target = e.target as HTMLImageElement;
                                target.src = getDefaultBookCover();
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                              <span className="text-2xl">📚</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 책 정보 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
                          {book.title}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">{book.author}</p>
                        <div className="mt-2">
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            읽는 중
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 진행률 */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{book.currentPage} / {book.totalPages} 페이지</span>
                        <span className="font-semibold text-primary-600">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* 독서 기록 버튼 */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/books/${book.id}`);
                      }}
                    >
                      독서 기록 작성
                    </Button>
                  </div>
                </Card>
              );
            })}
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
    </div>
  );
}

