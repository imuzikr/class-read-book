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
  getReadingLogs,
  getBooks,
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
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedUser, setSelectedUser] = useState<(UserData & { id: string; actualBooksRead?: number }) | null>(null);
  const [selectedUserBooks, setSelectedUserBooks] = useState<Book[]>([]);
  const [selectedUserLogs, setSelectedUserLogs] = useState<ReadingLog[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [selectedBookReaders, setSelectedBookReaders] = useState<Array<{ userId: string; userName: string; progress: number; status: string; currentPage: number; totalPages: number; bookId: string }>>([]);
  const [readerLogs, setReaderLogs] = useState<Map<string, ReadingLog[]>>(new Map());
  const [loadingLogs, setLoadingLogs] = useState<Map<string, boolean>>(new Map());

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, adminLoading, isAdminUser, router]);

  // 선택된 책이 변경될 때 사용자 목록 가져오기
  useEffect(() => {
    if (selectedBook) {
      const fetchReaders = async () => {
        // 같은 제목+저자의 책을 읽는 모든 사용자 찾기
        const bookKey = `${selectedBook.title.trim().toLowerCase()}_${selectedBook.author.trim().toLowerCase()}`;
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
                bookId: b.id || '',
              };
            }
            return null;
          })
        );
        
        const validReaders = readersDetails.filter((reader) => reader !== null) as Array<{ userId: string; userName: string; progress: number; status: string; currentPage: number; totalPages: number; bookId: string }>;
        setSelectedBookReaders(validReaders);
        
        // 각 사용자의 독서 로그 자동 로드
        const logsMap = new Map<string, ReadingLog[]>();
        const loadingMap = new Map<string, boolean>();
        
        // 모든 사용자의 독서 로그를 병렬로 로드
        const logPromises = validReaders.map(async (reader) => {
          loadingMap.set(reader.userId, true);
          try {
            const logs = await getReadingLogs(reader.userId, reader.bookId, 100);
            logsMap.set(reader.userId, logs);
          } catch (error) {
            console.error(`사용자 ${reader.userId} 독서 로그 가져오기 실패:`, error);
            logsMap.set(reader.userId, []);
          } finally {
            loadingMap.set(reader.userId, false);
          }
        });
        
        await Promise.all(logPromises);
        setReaderLogs(logsMap);
        setLoadingLogs(loadingMap);
      };
      
      fetchReaders().catch((error) => {
        console.error('독서 로그 로드 실패:', error);
      });
    } else {
      setSelectedBookReaders([]);
    }
  }, [selectedBook, books, users]);

  // 책 클릭 시 해당 책을 읽고 있는 사용자들의 상세 정보 가져오기
  const handleBookClick = (book: Book) => {
    console.log('책 클릭됨:', book.title);
    setSelectedBook(book);
    setSelectedUser(null); // 사용자 선택 해제
  };

  // 사용자 클릭 시 해당 사용자의 상세 정보 가져오기
  const handleUserClick = async (userData: UserData & { id: string; actualBooksRead?: number }) => {
    setSelectedUser(userData);
    setSelectedBook(null); // 책 선택 해제
    setLoadingUserData(true);
    
    try {
      // 사용자의 책 목록과 독서 로그 가져오기
      const [userBooks, userLogs] = await Promise.all([
        getBooks(userData.id),
        getReadingLogs(userData.id, undefined, 50),
      ]);
      
      setSelectedUserBooks(userBooks);
      setSelectedUserLogs(userLogs);
    } catch (error) {
      console.error('사용자 데이터 가져오기 실패:', error);
      setSelectedUserBooks([]);
      setSelectedUserLogs([]);
    } finally {
      setLoadingUserData(false);
    }
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
    <div className="max-w-full mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">관리자 대시보드</h1>
        <p className="text-gray-600 text-sm sm:text-base">시스템 통계 및 사용자 관리</p>
      </div>

      {/* 사이드바 + 메인 콘텐츠 레이아웃 */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* 왼쪽 사이드바 */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="space-y-4">
            {/* 사용자 목록 */}
            <Card>
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">사용자 ({users.length})</h2>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {users.map((userData) => (
                  <div
                    key={userData.id}
                    onClick={() => handleUserClick(userData)}
                    className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedUser?.id === userData.id ? 'bg-primary-50 border-primary-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {userData.photoURL ? (
                        <img
                          className="h-10 w-10 rounded-full"
                          src={userData.photoURL}
                          alt={userData.displayName || userData.name}
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {(userData.displayName || userData.name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {userData.displayName || userData.name || '이름 없음'}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{userData.email}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Lv.{userData.level} • {userData.exp.toLocaleString()} EXP
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 책 목록 */}
            <Card>
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold">책 ({books.length})</h2>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {books.map((book) => {
                  const progress = book.totalPages > 0 
                    ? Math.round((book.currentPage / book.totalPages) * 100) 
                    : 0;
                  
                  return (
                    <div
                      key={book.id}
                      onClick={() => handleBookClick(book)}
                      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedBook?.id === book.id ? 'bg-primary-50 border-primary-200' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-12 h-16 bg-gray-200 rounded overflow-hidden">
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
                              <span className="text-sm">📚</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                            {book.title}
                          </div>
                          <div className="text-xs text-gray-500 mb-2">{book.author}</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-primary-600 h-1.5 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{progress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>

        {/* 오른쪽 메인 콘텐츠 영역 */}
        <div className="flex-1 min-w-0">

          {/* 통계 화면 (기본) */}
          {!selectedUser && !selectedBook && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-primary-600 mb-2">
                    {stats.totalUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">전체 사용자</div>
                </div>
              </Card>
              
              <Card>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-primary-600 mb-2">
                    {stats.totalBooks.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">등록된 책</div>
                </div>
              </Card>
              
              <Card>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-primary-600 mb-2">
                    {stats.totalReadingLogs.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">독서 기록</div>
                </div>
              </Card>
              
              <Card>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-primary-600 mb-2">
                    {stats.totalPagesRead.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">총 읽은 페이지</div>
                </div>
              </Card>
            </div>
          )}

          {/* 선택된 사용자 상세 정보 */}
          {selectedUser && (
            <Card>
              <div className="mb-6">
                <div className="flex items-start gap-4 mb-4">
                  {selectedUser.photoURL ? (
                    <img
                      className="h-16 w-16 rounded-full"
                      src={selectedUser.photoURL}
                      alt={selectedUser.displayName || selectedUser.name}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold text-xl">
                        {(selectedUser.displayName || selectedUser.name || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-1">
                      {selectedUser.displayName || selectedUser.name || '이름 없음'}
                    </h2>
                    <p className="text-gray-600 mb-2">{selectedUser.email}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">레벨:</span>
                        <span className="ml-2 font-semibold text-primary-600">Lv.{selectedUser.level}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">경험치:</span>
                        <span className="ml-2 font-semibold">{selectedUser.exp.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">읽은 책:</span>
                        <span className="ml-2 font-semibold">
                          {selectedUser.actualBooksRead !== undefined ? selectedUser.actualBooksRead : selectedUser.totalBooksRead}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">읽은 페이지:</span>
                        <span className="ml-2 font-semibold">{selectedUser.totalPagesRead.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">연속 일수:</span>
                        <span className="ml-2 font-semibold">{selectedUser.currentStreak}일</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {loadingUserData ? (
                <div className="text-center py-8 text-gray-500">데이터를 불러오는 중...</div>
              ) : (
                <div className="space-y-6">
                  {/* 사용자의 책 목록 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">등록한 책 ({selectedUserBooks.length}권)</h3>
                    {selectedUserBooks.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">등록한 책이 없습니다.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedUserBooks.map((book) => {
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
                                          className={`h-2 rounded-full ${
                                            book.status === 'completed' ? 'bg-green-500' : 'bg-primary-600'
                                          }`}
                                          style={{ width: `${progress}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-600">{progress}%</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {book.currentPage} / {book.totalPages} 페이지
                                    </div>
                                  </div>
                                  <span
                                    className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                                      book.status === 'completed'
                                        ? 'bg-green-100 text-green-800'
                                        : book.status === 'reading'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {book.status === 'completed' ? '완독' : book.status === 'reading' ? '읽는 중' : '일시정지'}
                                  </span>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 사용자의 독서 로그 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">독서 기록 ({selectedUserLogs.length}건)</h3>
                    {selectedUserLogs.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">독서 기록이 없습니다.</p>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto space-y-3">
                        {selectedUserLogs.map((log) => (
                          <Card key={log.id} className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-sm font-medium text-gray-900">
                                {log.date
                                  ? new Date(log.date.toMillis()).toLocaleDateString('ko-KR', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    })
                                  : '-'}
                              </div>
                              <div className="text-sm font-semibold text-primary-600">
                                +{log.expGained} EXP
                              </div>
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              {log.pagesRead}페이지 읽음
                              {log.startPage && log.endPage && (
                                <span className="ml-2">
                                  ({log.startPage}페이지 ~ {log.endPage}페이지)
                                </span>
                              )}
                            </div>
                            {log.notes && (
                              <div className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                {log.notes}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 선택된 책 상세 정보 */}
          {selectedBook && !selectedUser && (
            <Card>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                  <div className="flex-shrink-0">
                    <div className="w-24 h-32 bg-gray-200 rounded overflow-hidden shadow-sm">
                      {selectedBook.coverImage ? (
                        <img
                          src={selectedBook.coverImage}
                          alt={`${selectedBook.title} 커버`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = getDefaultBookCover();
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <span className="text-3xl">📚</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold mb-2 break-words">{selectedBook.title}</h2>
                    <p className="text-base sm:text-lg text-gray-600 mb-2 sm:mb-4">{selectedBook.author}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                      <span>총 페이지: {selectedBook.totalPages}페이지</span>
                      {selectedBook.createdAt && (
                        <span>등록일: {new Date(selectedBook.createdAt.toMillis()).toLocaleDateString('ko-KR')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 읽는 사용자 목록 */}
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-4">
                  읽는 사용자 ({selectedBookReaders.length}명)
                </h3>
                {selectedBookReaders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">이 책을 읽고 있는 사용자가 없습니다.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedBookReaders.map((reader) => {
                      const logs = readerLogs.get(reader.userId) || [];
                      const isLoading = loadingLogs.get(reader.userId) || false;
                      
                      return (
                        <Card key={reader.userId} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-semibold text-base sm:text-lg">{reader.userName}</span>
                                <span
                                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    reader.status === 'completed'
                                      ? 'bg-green-100 text-green-800'
                                      : reader.status === 'reading'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {reader.status === 'completed'
                                    ? '완독'
                                    : reader.status === 'reading'
                                    ? '읽는 중'
                                    : '일시정지'}
                                </span>
                              </div>
                              <div className="mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm text-gray-600">
                                    {reader.currentPage} / {reader.totalPages} 페이지
                                  </span>
                                  <span className="text-sm font-medium text-gray-700">
                                    ({reader.progress}%)
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div
                                    className={`h-3 rounded-full transition-all ${
                                      reader.status === 'completed'
                                        ? 'bg-green-500'
                                        : reader.status === 'reading'
                                        ? 'bg-blue-500'
                                        : 'bg-gray-400'
                                    }`}
                                    style={{ width: `${reader.progress}%` }}
                                  />
                                </div>
                              </div>
                              
                              {/* 독서 로그 목록 - 기본적으로 표시 */}
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                {isLoading ? (
                                  <div className="text-center py-4 text-gray-500">
                                    독서 기록을 불러오는 중...
                                  </div>
                                ) : logs.length === 0 ? (
                                  <div className="text-center py-4 text-gray-500">
                                    독서 기록이 없습니다.
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-sm font-semibold text-gray-700 mb-2">
                                      독서 기록 ({logs.length}건)
                                    </div>
                                    {/* 초기 5개만 보이고 나머지는 스크롤 */}
                                    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                                      {logs.map((log) => (
                                        <div
                                          key={log.id}
                                          className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                                        >
                                          <div className="flex justify-between items-start mb-2">
                                            <div className="text-sm font-medium text-gray-900">
                                              {log.date
                                                ? new Date(log.date.toMillis()).toLocaleDateString('ko-KR', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                  })
                                                : '-'}
                                            </div>
                                            <div className="text-sm font-semibold text-primary-600">
                                              +{log.expGained} EXP
                                            </div>
                                          </div>
                                          <div className="text-sm text-gray-600 mb-1">
                                            {log.pagesRead}페이지 읽음
                                            {log.startPage && log.endPage && (
                                              <span className="ml-2">
                                                ({log.startPage}페이지 ~ {log.endPage}페이지)
                                              </span>
                                            )}
                                          </div>
                                          {log.notes && (
                                            <div className="text-sm text-gray-700 mt-2 p-2 bg-white rounded border border-gray-200">
                                              {log.notes}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Button onClick={() => router.push('/')} variant="outline">
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
}

