'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getAllUsersAdmin,
  getAllBooks,
  getAllReadingLogs,
  getAllReviews,
  getUserData,
  type UserData,
  type Book,
  type ReadingLog,
  type Review,
} from '@/lib/firebase/firestore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getDefaultBookCover } from '@/lib/utils/bookCover';

export default function AdminPage() {
  const { user, loading: authLoading, isAdmin: isAdminUser, adminLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBooks: 0,
    totalReadingLogs: 0,
    totalReviews: 0,
    totalPagesRead: 0,
  });
  const [users, setUsers] = useState<Array<UserData & { id: string; actualBooksRead?: number }>>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookReaders, setBookReaders] = useState<Map<string, Array<{ userId: string; userName: string; progress: number }>>>(new Map());
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'books'>('stats');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedBookReaders, setSelectedBookReaders] = useState<Array<{ userId: string; userName: string; progress: number; status: string; currentPage: number; totalPages: number }>>([]);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      
      if (!isAdminUser) {
        router.push('/');
        return;
      }

      fetchData();
    }
  }, [user, authLoading, adminLoading, isAdminUser, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [usersData, booksData, logsData, reviewsData] = await Promise.all([
        getAllUsersAdmin(50),
        getAllBooks(50),
        getAllReadingLogs(50),
        getAllReviews(50),
      ]);

      setBooks(booksData);
      
      // 각 사용자별로 실제 완독한 책의 개수 계산
      const completedBooksCount = new Map<string, number>();
      for (const book of booksData) {
        if (book.status === 'completed') {
          const currentCount = completedBooksCount.get(book.userId) || 0;
          completedBooksCount.set(book.userId, currentCount + 1);
        }
      }
      
      // 사용자 데이터에 실제 완독한 책의 개수 추가
      const usersWithActualCount = usersData.map(user => ({
        ...user,
        actualBooksRead: completedBooksCount.get(user.id) || 0,
      }));
      
      setUsers(usersWithActualCount);
      
      // 디버깅: 완독한 책 확인
      const completedBooks = booksData.filter(book => book.status === 'completed');
      console.log(`관리자 페이지: 전체 책 ${booksData.length}개, 완독한 책 ${completedBooks.length}개`);
      if (completedBooks.length > 0) {
        console.log('완독한 책 목록:', completedBooks.map(b => `${b.title} (${b.author}) - ${b.currentPage}/${b.totalPages}페이지`));
      }
      
      // 디버깅: 사용자 통계 확인
      console.log('사용자 목록:', usersWithActualCount.map(u => ({
        name: u.displayName || u.name,
        email: u.email,
        totalBooksRead: u.totalBooksRead,
        actualBooksRead: u.actualBooksRead,
        totalPagesRead: u.totalPagesRead,
      })));

      // 사용자 데이터를 userId로 매핑 (빠른 조회를 위해)
      const usersMap = new Map<string, UserData & { id: string }>();
      for (const user of usersData) {
        usersMap.set(user.id, user);
      }

      // 각 책에 대해 읽는 사용자 정보 수집
      const readersMap = new Map<string, Array<{ userId: string; userName: string; progress: number }>>();
      
      // 제목+저자로 그룹화
      const bookGroups = new Map<string, Book[]>();
      for (const book of booksData) {
        const key = `${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
        if (!bookGroups.has(key)) {
          bookGroups.set(key, []);
        }
        bookGroups.get(key)!.push(book);
      }

      // 각 그룹에 대해 읽는 사용자 정보 수집 (병렬 처리)
      const readerPromises = Array.from(bookGroups.entries()).map(async ([key, groupBooks]) => {
        const readers: Array<{ userId: string; userName: string; progress: number }> = [];
        
        // 각 책의 사용자 정보를 병렬로 처리
        const bookReaderPromises = groupBooks.map(async (book) => {
          // 이미 가져온 사용자 데이터에서 찾기
          const userData = usersMap.get(book.userId);
          if (userData) {
            const progress = book.totalPages > 0 
              ? Math.round((book.currentPage / book.totalPages) * 100) 
              : 0;
            
            return {
              userId: book.userId,
              userName: userData.displayName || userData.name || '이름 없음',
              progress,
            };
          } else {
            // usersData에 없는 경우에만 getUserData 호출 (예외 상황)
            try {
              const fetchedUserData = await getUserData(book.userId);
              if (fetchedUserData) {
                const progress = book.totalPages > 0 
                  ? Math.round((book.currentPage / book.totalPages) * 100) 
                  : 0;
                
                return {
                  userId: book.userId,
                  userName: fetchedUserData.displayName || fetchedUserData.name || '이름 없음',
                  progress,
                };
              }
            } catch (error) {
              console.error(`사용자 ${book.userId} 정보 가져오기 실패:`, error);
            }
          }
          return null;
        });
        
        const bookReaders = await Promise.all(bookReaderPromises);
        const validReaders = bookReaders.filter((reader): reader is { userId: string; userName: string; progress: number } => reader !== null);
        
        return { key, readers: validReaders };
      });
      
      const readerResults = await Promise.all(readerPromises);
      for (const { key, readers } of readerResults) {
        if (readers.length > 0) {
          readersMap.set(key, readers);
        }
      }
      
      setBookReaders(readersMap);

      // 통계 계산
      const totalPagesRead = usersData.reduce((sum, user) => sum + (user.totalPagesRead || 0), 0);

      setStats({
        totalUsers: usersData.length,
        totalBooks: booksData.length,
        totalReadingLogs: logsData.length,
        totalReviews: reviewsData.length,
        totalPagesRead,
      });
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 책 클릭 시 해당 책을 읽고 있는 사용자들의 상세 정보 가져오기
  const handleBookClick = async (book: Book) => {
    setSelectedBook(book);
    
    // 같은 제목+저자의 책을 읽는 모든 사용자 찾기
    const bookKey = `${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
    const allBooksWithSameTitle = books.filter(b => 
      `${b.title.trim().toLowerCase()}_${b.author.trim().toLowerCase()}` === bookKey
    );
    
    // 각 사용자별 상세 정보 수집
    const readersDetails = await Promise.all(
      allBooksWithSameTitle.map(async (b) => {
        const userData = users.find(u => u.id === b.userId);
        if (userData) {
          const progress = b.totalPages > 0 
            ? Math.round((b.currentPage / b.totalPages) * 100) 
            : 0;
          
          return {
            userId: b.userId,
            userName: userData.displayName || userData.name || '이름 없음',
            progress,
            status: b.status,
            currentPage: b.currentPage,
            totalPages: b.totalPages,
          };
        }
        return null;
      })
    );
    
    const validReaders = readersDetails.filter((reader): reader is { userId: string; userName: string; progress: number; status: string; currentPage: number; totalPages: number } => reader !== null);
    setSelectedBookReaders(validReaders);
  };

  if (authLoading || adminLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAdminUser) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">관리자 대시보드</h1>
        <p className="text-gray-600">시스템 통계 및 사용자 관리</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'stats'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            통계
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            사용자 ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('books')}
            className={`py-2 px-4 border-b-2 font-medium text-sm ${
              activeTab === 'books'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            책 ({books.length})
          </button>
        </nav>
      </div>

      {/* 통계 탭 */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stats.totalUsers.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">전체 사용자</div>
            </div>
          </Card>
          
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stats.totalBooks.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">등록된 책</div>
            </div>
          </Card>
          
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stats.totalReadingLogs.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">독서 기록</div>
            </div>
          </Card>
          
          <Card>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 mb-2">
                {stats.totalPagesRead.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">총 읽은 페이지</div>
            </div>
          </Card>
        </div>
      )}

      {/* 사용자 목록 탭 */}
      {activeTab === 'users' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    레벨
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    경험치
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    읽은 책
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    읽은 페이지
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연속 일수
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((userData) => (
                  <tr key={userData.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {userData.photoURL && (
                          <img
                            className="h-10 w-10 rounded-full mr-3"
                            src={userData.photoURL}
                            alt={userData.displayName || userData.name}
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {userData.displayName || userData.name || '이름 없음'}
                          </div>
                          <div className="text-sm text-gray-500">{userData.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.level}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.exp.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.actualBooksRead !== undefined ? userData.actualBooksRead : userData.totalBooksRead}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.totalPagesRead.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {userData.currentStreak}일
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 책 목록 탭 */}
      {activeTab === 'books' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    저자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    진행률
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    읽는 사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {books.map((book) => {
                  const progress = book.totalPages > 0 
                    ? Math.round((book.currentPage / book.totalPages) * 100) 
                    : 0;
                  
                  // 같은 제목+저자의 책을 읽는 모든 사용자 찾기
                  const bookKey = `${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
                  const readers = bookReaders.get(bookKey) || [];
                  
                  return (
                    <tr 
                      key={book.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleBookClick(book)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* 책 커버 이미지 썸네일 */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-16 bg-gray-200 rounded overflow-hidden shadow-sm">
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
                                  <span className="text-lg">📚</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-gray-900">{book.title}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {book.author}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            book.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : book.status === 'reading'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {book.status === 'completed'
                            ? '완독'
                            : book.status === 'reading'
                            ? '읽는 중'
                            : '일시정지'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {readers.length > 0 ? (
                          <div className="space-y-1">
                            {readers.map((reader, idx) => (
                              <div key={reader.userId} className="flex items-center">
                                <span className="font-medium text-gray-900">{reader.userName}</span>
                                <span className="ml-2 text-xs text-gray-500">
                                  ({reader.progress}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {book.createdAt
                          ? new Date(book.createdAt.toMillis()).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6">
        <Button onClick={() => router.push('/')} variant="outline">
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}

