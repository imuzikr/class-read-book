'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { getBook, updateBook, deleteBook, createReadingLog, getReadingLogs, getUserData, updateUserData, getUserBadges, deleteReadingLog, updateReadingLog, type Book, type ReadingLog } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { calculateExpGain, getLevelFromExp } from '@/lib/utils/game';
import { getStartOfDay } from '@/lib/utils/date';
import { updateStreakOnNewLog } from '@/lib/utils/streak';
import { findNewBadges, awardBadge } from '@/lib/utils/badges';
import { getDefaultBookCover } from '@/lib/utils/bookCover';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Toast, { ToastType } from '@/components/ui/Toast';
import Link from 'next/link';
import { Trash2, Edit2, X, Check, Calendar, BookOpen } from 'lucide-react';

export default function BookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  
  // Toast 상태
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [readingLogError, setReadingLogError] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{
    startPage?: string;
    endPage?: string;
    notes?: string;
  }>({});
  
  // 로그 수정 상태
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogNotes, setEditingLogNotes] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    totalPages: '',
    currentPage: '',
    status: 'reading' as Book['status'],
  });

  const [readingLogForm, setReadingLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    startPage: '',
    endPage: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchBook();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router, bookId]);

  // 독서 기록이 로드되면 시작 페이지 초기값 설정
  useEffect(() => {
    if (logs.length > 0 && logs[0].endPage) {
      // 이전 기록이 있는 경우: 이전 기록의 마지막 페이지 + 1
      const nextStartPage = logs[0].endPage + 1;
      setReadingLogForm(prev => ({
        ...prev,
        startPage: nextStartPage.toString(),
      }));
    } else if (logs.length === 0 && book) {
      // 첫 기록인 경우: 1페이지
      setReadingLogForm(prev => ({
        ...prev,
        startPage: '1',
      }));
    }
  }, [logs, book]);

  const fetchBook = async () => {
    if (!user || !bookId) {
      return;
    }
    
    try {
      setLoading(true);
      const bookData = await getBook(bookId);
      
      if (!bookData) {
        alert('책 정보를 찾을 수 없습니다.');
        router.push('/books');
        return;
      }

      if (bookData.userId !== user.uid) {
        alert('이 책에 대한 권한이 없습니다.');
        router.push('/books');
        return;
      }

      setBook(bookData);
      setFormData({
        title: bookData.title,
        author: bookData.author,
        totalPages: bookData.totalPages.toString(),
        currentPage: bookData.currentPage.toString(),
        status: bookData.status,
      });
      
      // 완독된 책의 경우 폼을 비활성화
      setFormEnabled(bookData.status !== 'completed');
      
      // 독서 기록 가져오기
      if (user) {
        const logsData = await getReadingLogs(user.uid, bookId, 10);
        setLogs(logsData);
      }
    } catch (error) {
      console.error('책 정보 로드 실패:', error);
      router.push('/books');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;

    setError('');

    const totalPagesNum = parseInt(formData.totalPages);
    const currentPageNum = parseInt(formData.currentPage);

    if (isNaN(totalPagesNum) || totalPagesNum <= 0) {
      setError('총 페이지 수를 올바르게 입력해주세요.');
      return;
    }

    if (isNaN(currentPageNum) || currentPageNum < 0 || currentPageNum > totalPagesNum) {
      setError('현재 페이지를 올바르게 입력해주세요.');
      return;
    }

    try {
      const updates: Partial<Book> = {
        title: formData.title.trim(),
        author: formData.author.trim(),
        totalPages: totalPagesNum,
        currentPage: currentPageNum,
        status: formData.status,
        updatedAt: Timestamp.now(),
      };

      // 완독 처리
      const isCompleting = currentPageNum >= totalPagesNum && formData.status !== 'completed';
      if (isCompleting) {
        updates.status = 'completed';
        updates.finishDate = Timestamp.now();
      } else if (currentPageNum < totalPagesNum && formData.status === 'completed') {
        updates.finishDate = undefined;
      }

      await updateBook(bookId, updates);
      
      // 완독 시 뱃지 체크
      if (isCompleting && user) {
        const { getUserData, getUserBadges } = await import('@/lib/firebase/firestore');
        const { findNewBadges, awardBadge } = await import('@/lib/utils/badges');
        const userData = await getUserData(user.uid);
        if (userData) {
          const existingBadges = await getUserBadges(user.uid);
          const newBadges = await findNewBadges(
            userData,
            user.uid,
            existingBadges
          );

          if (newBadges.length > 0) {
            for (const badge of newBadges) {
              await awardBadge(user.uid, badge.id, badge.expReward);
            }
              if (newBadges.length === 1) {
                showToast(`🎉 뱃지 획득: ${newBadges[0].name}!`);
              }
            }
          }
        }
      }

      await fetchBook();
      setEditing(false);
      showToast('책 정보가 수정되었습니다.');
    } catch (err: any) {
      setError(err.message || '책 정보 수정에 실패했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 이 책을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteBook(bookId);
      router.push('/books');
    } catch (error) {
      console.error('책 삭제 실패:', error);
      showToast('책 삭제에 실패했습니다.', 'error');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('정말 이 독서 기록을 삭제하시겠습니까?\n삭제된 경험치와 독서량은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setLoading(true);
      await deleteReadingLog(logId);
      await fetchBook(); // 데이터 새로고침
      showToast('독서 기록이 삭제되었습니다.');
    } catch (err: any) {
      console.error('로그 삭제 실패:', err);
      showToast(err.message || '로그 삭제에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEditingLog = (log: ReadingLog) => {
    setEditingLogId(log.id);
    setEditingLogNotes(log.notes || '');
  };

  const cancelEditingLog = () => {
    setEditingLogId(null);
    setEditingLogNotes('');
  };

  const saveEditingLog = async (logId: string) => {
    if (!editingLogNotes.trim()) {
      showToast('감상 내용을 입력해주세요.', 'error');
      return;
    }

    try {
      setLoading(true);
      await updateReadingLog(logId, { notes: editingLogNotes });
      await fetchBook();
      cancelEditingLog();
      showToast('독서 기록이 수정되었습니다.');
    } catch (err: any) {
      console.error('로그 수정 실패:', err);
      showToast(err.message || '로그 수정에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 이 책을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteBook(bookId);
      router.push('/books');
    } catch (error) {
      console.error('책 삭제 실패:', error);
      alert('책 삭제에 실패했습니다.');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('정말 이 독서 기록을 삭제하시겠습니까?\n삭제된 경험치와 독서량은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setLoading(true);
      await deleteReadingLog(logId);
      await fetchBook(); // 데이터 새로고침
      alert('독서 기록이 삭제되었습니다.');
    } catch (err: any) {
      console.error('로그 삭제 실패:', err);
      alert(err.message || '로그 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startEditingLog = (log: ReadingLog) => {
    setEditingLogId(log.id);
    setEditingLogNotes(log.notes || '');
  };

  const cancelEditingLog = () => {
    setEditingLogId(null);
    setEditingLogNotes('');
  };

  const saveEditingLog = async (logId: string) => {
    if (!editingLogNotes.trim()) {
      alert('감상 내용을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      await updateReadingLog(logId, { notes: editingLogNotes });
      await fetchBook();
      cancelEditingLog();
      alert('독서 기록이 수정되었습니다.');
    } catch (err: any) {
      console.error('로그 수정 실패:', err);
      alert(err.message || '로그 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 실시간 검증 함수
  const validateField = (fieldName: 'startPage' | 'endPage' | 'notes', value: string) => {
    if (!book) return;
    
    setFieldErrors(prevErrors => {
      const errors = { ...prevErrors };

      if (fieldName === 'startPage') {
        const startPage = parseInt(value);
        if (!value) {
          delete errors.startPage;
        } else if (isNaN(startPage) || startPage < 1) {
          errors.startPage = '시작 페이지를 올바르게 입력해주세요.';
        } else if (startPage > book.totalPages) {
          errors.startPage = `총 페이지 수(${book.totalPages}페이지)를 초과할 수 없습니다.`;
        } else {
          delete errors.startPage;
        }
        
        // 마지막 페이지와의 관계도 확인
        if (readingLogForm.endPage) {
          const endPage = parseInt(readingLogForm.endPage);
          if (!isNaN(startPage) && !isNaN(endPage) && endPage < startPage) {
            errors.endPage = '마지막 페이지는 시작 페이지보다 크거나 같아야 합니다.';
          } else if (prevErrors.endPage === '마지막 페이지는 시작 페이지보다 크거나 같아야 합니다.') {
            delete errors.endPage;
          }
        }
      } else if (fieldName === 'endPage') {
        const endPage = parseInt(value);
        if (!value) {
          delete errors.endPage;
        } else if (isNaN(endPage) || endPage < 1) {
          errors.endPage = '마지막 페이지를 올바르게 입력해주세요.';
        } else if (endPage > book.totalPages) {
          errors.endPage = `값은 ${book.totalPages} 이하여야 합니다.`;
        } else if (readingLogForm.startPage) {
          const startPage = parseInt(readingLogForm.startPage);
          if (!isNaN(startPage) && endPage < startPage) {
            errors.endPage = '마지막 페이지는 시작 페이지보다 크거나 같아야 합니다.';
          } else {
            delete errors.endPage;
          }
        } else {
          delete errors.endPage;
        }
      } else if (fieldName === 'notes') {
        if (value && !value.trim()) {
          errors.notes = '오늘의 감상을 작성해주세요.';
        } else {
          delete errors.notes;
        }
      }

      return errors;
    });
  };

  const handleReadingLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !book) return;

    setReadingLogError('');
    
    // 필드 오류가 있으면 제출하지 않음
    if (Object.keys(fieldErrors).length > 0) {
      setReadingLogError('입력한 내용을 확인해주세요.');
      setSubmitting(false);
      return;
    }
    
    setSubmitting(true);

    try {
      const startPage = parseInt(readingLogForm.startPage);
      const endPage = parseInt(readingLogForm.endPage);
      
      // 이전 기록 확인: 가장 최근 기록의 마지막 페이지 찾기
      const previousLastPage = logs.length > 0 && logs[0].endPage 
        ? logs[0].endPage 
        : book.currentPage || 0;
      
      if (isNaN(startPage) || startPage <= 0) {
        setReadingLogError('시작 페이지는 0보다 커야 합니다.');
        setSubmitting(false);
        return;
      }
      
      // 첫 기록이 아닌 경우, 시작 페이지는 이전 기록의 마지막 페이지보다 크거나 같아야 함
      if (logs.length > 0 && startPage < previousLastPage) {
        setReadingLogError(`시작 페이지는 이전 기록의 마지막 페이지(${previousLastPage}페이지)보다 크거나 같아야 합니다.`);
        setSubmitting(false);
        return;
      }
      
      if (isNaN(endPage) || endPage <= 0) {
        setReadingLogError('마지막 페이지는 0보다 커야 합니다.');
        setSubmitting(false);
        return;
      }
      
      if (startPage > book.totalPages) {
        setReadingLogError(`시작 페이지는 총 페이지 수(${book.totalPages}페이지)를 초과할 수 없습니다.`);
        setSubmitting(false);
        return;
      }
      
      if (endPage > book.totalPages) {
        setReadingLogError(`마지막 페이지는 총 페이지 수(${book.totalPages}페이지)를 초과할 수 없습니다.`);
        setSubmitting(false);
        return;
      }
      
      if (endPage < startPage) {
        setReadingLogError('마지막 페이지는 시작 페이지보다 크거나 같아야 합니다.');
        setSubmitting(false);
        return;
      }

      if (!readingLogForm.notes.trim()) {
        setReadingLogError('오늘의 감상을 입력해주세요.');
        setSubmitting(false);
        return;
      }

      const pagesRead = endPage - startPage + 1;
      const logDate = getStartOfDay(new Date(readingLogForm.date));
      // 사용자가 입력한 마지막 페이지를 책의 현재 페이지로 설정 (단, 총 페이지 수를 초과하지 않음)
      const newCurrentPage = Math.min(endPage, book.totalPages);

      // 경험치 계산
      const expGained = calculateExpGain(pagesRead);

      // 사용자 데이터에서 공개 설정 가져오기
      const userData = await getUserData(user.uid);
      const isPublic = userData?.showTodayThought !== false; // 기본값은 true

      // 독서 기록 생성
      await createReadingLog({
        userId: user.uid,
        bookId: book.id!,
        date: Timestamp.fromDate(logDate),
        startPage,
        endPage,
        pagesRead,
        notes: readingLogForm.notes.trim(),
        isPublic,
        expGained,
      });

      // 책의 현재 페이지 업데이트
      const isCompleted = newCurrentPage >= book.totalPages;
      const wasCompleted = book.status === 'completed';
      const bookUpdates: any = {
        currentPage: newCurrentPage,
        status: isCompleted ? 'completed' : 'reading',
      };
      
      if (isCompleted && !wasCompleted) {
        bookUpdates.finishDate = Timestamp.now();
      }
      
      await updateBook(book.id!, bookUpdates);

      // 사용자 통계 업데이트 (이미 위에서 가져온 userData 사용)
      if (userData) {
        const streakData = updateStreakOnNewLog(
          logDate,
          userData.currentStreak,
          userData.lastReadingDate
        );

        const streakBonus = streakData.currentStreak > 0 ? streakData.currentStreak * 10 : 0;
        const expGained = calculateExpGain(pagesRead);
        const totalExpGained = expGained + streakBonus;
        const newExp = userData.exp + totalExpGained;
        const newLevel = getLevelFromExp(newExp);

        // 완독한 경우 totalBooksRead 증가 (이전에 완독되지 않았던 경우만)
        const updateData: any = {
          totalPagesRead: userData.totalPagesRead + pagesRead,
          exp: newExp,
          level: newLevel,
          currentStreak: streakData.currentStreak,
          longestStreak: streakData.longestStreak,
          lastReadingDate: Timestamp.fromDate(streakData.lastReadingDate || logDate),
        };
        
        if (isCompleted && !wasCompleted) {
          updateData.totalBooksRead = (userData.totalBooksRead || 0) + 1;
        }

        await updateUserData(user.uid, updateData);
        
        if (newLevel > userData.level) {
          showToast(`🎉 레벨업! 레벨 ${userData.level} → 레벨 ${newLevel}`);
        }

        const existingBadges = await getUserBadges(user.uid);
        const updatedUserData = await getUserData(user.uid);
        if (updatedUserData) {
          const newBadges = await findNewBadges(
            updatedUserData,
            user.uid,
            existingBadges
          );

          if (newBadges.length > 0) {
            for (const badge of newBadges) {
              await awardBadge(user.uid, badge.id, badge.expReward);
            }
            if (newBadges.length === 1) {
              showToast(`🎉 뱃지 획득: ${newBadges[0].name}!`);
            } else {
              showToast(`🎉 ${newBadges.length}개의 뱃지를 획득했습니다!`);
            }
          }
        }
      }

      // 데이터 새로고침
      await fetchBook();
      
      // 폼 초기화 (시작 페이지는 useEffect에서 자동 설정됨)
      setReadingLogForm({
        date: new Date().toISOString().split('T')[0],
        startPage: '',
        endPage: '',
        notes: '',
      });

      // 완독 여부 확인 (위에서 이미 정의된 isCompleted 변수 사용)
      if (isCompleted) {
        showToast('🎉 완독을 축하합니다! 독서 기록이 저장되었습니다.');
      } else {
        showToast('독서 기록이 저장되었습니다!');
      }
    } catch (err: any) {
      setReadingLogError(err.message || '독서 기록 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR');
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!book) {
    return null;
  }

  const progress = book.totalPages > 0 
    ? Math.round((book.currentPage / book.totalPages) * 100) 
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Toast 
        message={toast.message} 
        isVisible={toast.visible} 
        type={toast.type} 
        onClose={hideToast} 
      />
      <div className="flex justify-between items-center">
        <Link href="/books">
          <Button variant="ghost" size="sm">← 목록으로</Button>
        </Link>
        {!editing && (
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              수정
            </Button>
            <Button variant="outline" onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:border-red-300">
              삭제
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <Card title="책 정보 수정">
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="책 제목"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
            <Input
              label="저자"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              required
            />
            <Input
              label="총 페이지 수"
              type="number"
              value={formData.totalPages}
              onChange={(e) => setFormData({ ...formData, totalPages: e.target.value })}
              min="1"
              required
            />
            <Input
              label="현재 읽은 페이지"
              type="number"
              value={formData.currentPage}
              onChange={(e) => setFormData({ ...formData, currentPage: e.target.value })}
              min="0"
              max={formData.totalPages}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Book['status'] })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="reading">읽는 중</option>
                <option value="completed">완독</option>
                <option value="paused">일시정지</option>
              </select>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-4">
              <Button type="submit" className="flex-1">저장</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setError('');
                  fetchBook();
                }}
              >
                취소
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <>
          <Card>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {/* 책 커버 이미지 */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-32 bg-gray-200 rounded overflow-hidden shadow-sm">
                    {book.coverImage ? (
                      <Image
                        src={book.coverImage}
                        alt={`${book.title} 커버`}
                        className="w-full h-full object-cover"
                        width={96}
                        height={128}
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
                {/* 책 제목과 저자 */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
                  <p className="text-lg text-gray-600">{book.author}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{book.currentPage} / {book.totalPages} 페이지</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-primary-500 h-4 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500">상태</p>
                  <p className="font-medium">
                    {book.status === 'reading' && '읽는 중'}
                    {book.status === 'completed' && '완독'}
                    {book.status === 'paused' && '일시정지'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">시작일</p>
                  <p className="font-medium">{formatDate(book.startDate)}</p>
                </div>
                {book.finishDate && (
                  <div>
                    <p className="text-sm text-gray-500">완독일</p>
                    <p className="font-medium">{formatDate(book.finishDate)}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* 독서 기록 폼과 최근 독서 기록을 2열로 배치 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 독서 기록 폼 */}
            <Card title="오늘의 독서 기록">
              {!formEnabled && book?.status === 'completed' ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                    <div className="text-4xl mb-3">⭐</div>
                    <p className="text-lg font-semibold text-gray-800 mb-2">
                      완독을 축하합니다!
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      이 책은 완독되었습니다. 추가 독서 기록을 작성하시겠습니까?
                    </p>
                    <Button
                      onClick={() => setFormEnabled(true)}
                      className="w-full"
                    >
                      기록 활성화
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReadingLogSubmit} className="space-y-4">
                  <Input
                    type="date"
                    label="날짜 *"
                    value={readingLogForm.date}
                    onChange={(e) => setReadingLogForm({ ...readingLogForm, date: e.target.value })}
                    required
                    disabled={submitting || !formEnabled}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="시작 페이지 *"
                      value={readingLogForm.startPage}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        const updatedForm = { ...readingLogForm, startPage: newValue };
                        setReadingLogForm(updatedForm);
                        validateField('startPage', newValue);
                      }}
                      onBlur={(e) => {
                        validateField('startPage', e.target.value);
                      }}
                      placeholder={logs.length > 0 && logs[0].endPage 
                        ? `예: ${logs[0].endPage + 1}` 
                        : '예: 10'}
                      min={logs.length > 0 && logs[0].endPage 
                        ? (logs[0].endPage + 1).toString() 
                        : '1'}
                      max={book.totalPages}
                      required
                      disabled={submitting || !formEnabled}
                      error={fieldErrors.startPage}
                    />
                    <Input
                      type="number"
                      label="마지막 페이지 *"
                      value={readingLogForm.endPage}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        const updatedForm = { ...readingLogForm, endPage: newValue };
                        setReadingLogForm(updatedForm);
                        validateField('endPage', newValue);
                      }}
                      onBlur={(e) => {
                        validateField('endPage', e.target.value);
                      }}
                      placeholder="예: 30"
                      min="1"
                      max={book.totalPages}
                      required
                      disabled={submitting || !formEnabled}
                      error={fieldErrors.endPage}
                    />
                  </div>
                  
                  {readingLogForm.startPage && readingLogForm.endPage && (() => {
                    const start = parseInt(readingLogForm.startPage);
                    const end = parseInt(readingLogForm.endPage);
                    if (isNaN(start) || isNaN(end) || end < start) return null;
                    
                    const pagesRead = end - start + 1;
                    return (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-medium">읽은 페이지 수: {pagesRead}페이지</span>
                        {book.currentPage > 0 && (
                          <span className="ml-2 text-gray-500">
                            (현재까지: {book.currentPage}페이지)
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      오늘의 감상 *
                    </label>
                    <textarea
                      value={readingLogForm.notes}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setReadingLogForm({ ...readingLogForm, notes: newValue });
                        validateField('notes', newValue);
                      }}
                      onBlur={(e) => {
                        validateField('notes', e.target.value);
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        fieldErrors.notes ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                      }`}
                      rows={4}
                      placeholder="오늘 읽은 내용에 대한 감상을 작성해주세요..."
                      required
                      disabled={submitting || !formEnabled}
                    />
                    {fieldErrors.notes && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors.notes}</p>
                    )}
                  </div>

                  {readingLogError && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                      {readingLogError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      disabled={submitting || !formEnabled}
                    >
                      {submitting ? '저장 중...' : '독서 기록 저장'}
                    </Button>
                    {book?.status === 'completed' && formEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormEnabled(false)}
                        className="px-4"
                      >
                        비활성화
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </Card>

            {/* 최근 독서 기록 */}
            {logs.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">최근 독서 기록</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const logDate = log.date;
                    const pagesRead = log.endPage && log.startPage 
                      ? log.endPage - log.startPage + 1 
                      : log.pagesRead || 0;
                    
                    return (
                      <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm">
                              <Calendar className="w-4 h-4 mr-2" />
                              <span className="font-medium">{logDate.toLocaleDateString('ko-KR')}</span>
                            </div>
                            <div className="flex items-center text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm">
                              <BookOpen className="w-4 h-4 mr-2" />
                              {log.startPage && log.endPage ? (
                                <span>{log.startPage}p ~ {log.endPage}p ({pagesRead}p)</span>
                              ) : (
                                <span>{pagesRead}p 읽음</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 수정 모드일 때 입력창 표시 */}
                        {editingLogId === log.id ? (
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div className="mb-4 grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">날짜 (수정 불가)</label>
                                <input 
                                  type="text" 
                                  value={logDate.toLocaleDateString('ko-KR')} 
                                  disabled 
                                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-gray-500 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">페이지 (수정 불가)</label>
                                <input 
                                  type="text" 
                                  value={`${log.startPage}p ~ ${log.endPage}p`} 
                                  disabled 
                                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-gray-500 text-sm"
                                />
                              </div>
                            </div>
                            
                            <label className="block text-sm font-medium text-gray-700 mb-2">오늘의 감상 수정</label>
                            <textarea
                              value={editingLogNotes}
                              onChange={(e) => setEditingLogNotes(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                              rows={4}
                              placeholder="감상 내용을 입력해주세요..."
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEditingLog}
                                className="flex items-center gap-1 bg-white"
                              >
                                <X className="w-3 h-3" /> 취소
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveEditingLog(log.id)}
                                className="flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> 저장
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* 일반 모드 */
                          <div>
                            {log.notes && (
                              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{log.notes}</p>
                              </div>
                            )}
                            
                            {/* 수정/삭제 버튼 - Button 컴포넌트 사용 */}
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditingLog(log)}
                                className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                수정
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-gray-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                삭제
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Card title="최근 독서 기록">
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">아직 독서 기록이 없습니다.</p>
                </div>
              </Card>
            )}
                          </div>
                        </div>

                        {/* 수정 모드일 때 입력창 표시 */}
                        {editingLogId === log.id ? (
                          <div className="mt-4 border-t pt-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">감상 내용 수정</p>
                            <div className="bg-white p-3 border rounded-lg shadow-sm">
                              <textarea
                                value={editingLogNotes}
                                onChange={(e) => setEditingLogNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                rows={4}
                                placeholder="감상 내용을 입력해주세요..."
                                autoFocus
                              />
                              <div className="flex justify-end gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditingLog}
                                  className="flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> 취소
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => saveEditingLog(log.id)}
                                  className="flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> 저장
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* 일반 모드 */
                          <div className="mt-2">
                            {log.notes && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">오늘의 감상:</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{log.notes}</p>
                              </div>
                            )}
                            
                            {/* 수정/삭제 버튼 - 항상 보이도록 별도 row로 분리 */}
                            <div className="flex justify-end items-center gap-3 mt-2 border-t pt-2 border-gray-100">
                              <button
                                onClick={() => startEditingLog(log)}
                                className="text-xs font-medium text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                                내용 수정
                              </button>
                              <div className="w-px h-3 bg-gray-300"></div>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-xs font-medium text-gray-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                기록 삭제
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card title="최근 독서 기록">
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">아직 독서 기록이 없습니다.</p>
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

