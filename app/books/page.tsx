'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getBooks, deleteBook, type Book } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { getDefaultBookCover } from '@/lib/utils/bookCover';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Link from 'next/link';

export default function BooksPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'reading' | 'completed' | 'paused'>('all');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }

      fetchBooks();
    }
  }, [user, authLoading, router]);

  const fetchBooks = async () => {
    if (!user) return;

    try {
      const allBooks = await getBooks(user.uid);
      
      // 추가 중복 제거 (제목과 저자 기준)
      const uniqueBooksMap = new Map<string, Book>();
      for (const book of allBooks) {
        const key = `${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
        if (!uniqueBooksMap.has(key)) {
          uniqueBooksMap.set(key, book);
        } else {
          // 이미 존재하는 경우, 더 최근에 생성된 것으로 교체
          const existing = uniqueBooksMap.get(key)!;
          if (book.createdAt && existing.createdAt && 
              book.createdAt.toMillis() > existing.createdAt.toMillis()) {
            uniqueBooksMap.set(key, book);
          }
        }
      }
      
      const uniqueBooks = Array.from(uniqueBooksMap.values());
      setBooks(uniqueBooks);
    } catch (error) {
      console.error('책 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bookId: string) => {
    if (!confirm('정말 이 책을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteBook(bookId);
      // 삭제 후 목록을 다시 불러오기 (중복 제거 로직을 다시 적용하기 위해)
      await fetchBooks();
    } catch (error) {
      console.error('책 삭제 실패:', error);
      alert('책 삭제에 실패했습니다.');
    }
  };

  const filteredBooks = books.filter(book => {
    if (filter === 'all') return true;
    return book.status === filter;
  });

  const getStatusBadge = (status: Book['status']) => {
    const styles = {
      reading: 'bg-blue-100 text-blue-800',
      completed: 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md',
      paused: 'bg-gray-100 text-gray-800',
    };

    const labels = {
      reading: '읽는 중',
      completed: '완독',
      paused: '일시정지',
    };

    if (status === 'completed') {
      return (
        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${styles[status]} flex items-center gap-1.5 animate-pulse`}>
          <span className="text-sm">⭐</span>
          <span>{labels[status]}</span>
        </span>
      );
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('ko-KR');
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">내 서재</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>← 대시보드</Button>
          <Button onClick={() => router.push('/books/new')}>새 책 추가</Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          {(['all', 'reading', 'completed', 'paused'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === status
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status === 'all' && '전체'}
              {status === 'reading' && '읽는 중'}
              {status === 'completed' && '완독'}
              {status === 'paused' && '일시정지'}
            </button>
          ))}
        </div>
      </div>

      {/* 책 목록 */}
      {filteredBooks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {filter === 'all' 
                ? '등록된 책이 없습니다.' 
                : `${filter === 'reading' ? '읽는 중인' : filter === 'completed' ? '완독한' : '일시정지한'} 책이 없습니다.`}
            </p>
            <Link href="/books/new">
              <Button>첫 책 추가하기</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.map((book) => {
            const progress = book.totalPages > 0 
              ? Math.round((book.currentPage / book.totalPages) * 100) 
              : 0;

            return (
              <Card 
                key={book.id} 
                className={`hover:shadow-lg transition-all ${
                  book.status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <div className="space-y-4">
                  {/* 책 커버 이미지와 정보 */}
                  <div className="flex gap-4">
                    {/* 커버 이미지 썸네일 */}
                    <div className="flex-shrink-0">
                      <div className="w-20 h-28 bg-gray-200 rounded overflow-hidden shadow-sm">
                        {book.coverImage ? (
                          <img
                            src={book.coverImage}
                            alt={`${book.title} 커버`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
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
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                            {book.title}
                          </h3>
                          <p className="text-sm text-gray-600 truncate">{book.author}</p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {getStatusBadge(book.status)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{book.currentPage} / {book.totalPages} 페이지</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    시작일: {formatDate(book.startDate)}
                    {book.finishDate && (
                      <span className="ml-2">완독일: {formatDate(book.finishDate)}</span>
                    )}
                  </div>

                  <div className="flex space-x-2 pt-2 border-t">
                    <Link href={`/books/${book.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full bg-primary-50">
                        독서 기록 작성
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(book.id!)}
                      className="text-gray-600 hover:text-red-600 p-2"
                      title="삭제"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

