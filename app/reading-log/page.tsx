'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getBooks, getReadingLogs } from '@/lib/firebase/firestore';
import { type Book, type ReadingLog } from '@/types';

import { authedFetch } from '@/lib/utils/apiClient';
import { formatDateKorean } from '@/lib/utils/date';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Link from 'next/link';

function ReadingLogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookIdParam = searchParams.get('bookId');
  const { user, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    startPage?: string;
    endPage?: string;
    notes?: string;
  }>({});

  const [formData, setFormData] = useState({
    bookId: bookIdParam || '',
    date: new Date().toISOString().split('T')[0],
    startPage: '',
    endPage: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      // 모든 책 가져오기 (읽고 있는 책만이 아니라 모든 책)
      const allBooks = await getBooks(user.uid);
      // 읽고 있는 책과 완독한 책만 필터링 (일시정지된 책 제외)
      const availableBooks = allBooks.filter(book => 
        book.status === 'reading' || book.status === 'completed'
      );
      setBooks(availableBooks);
      
      const logsData = await getReadingLogs(user.uid, undefined, 30);
      setLogs(logsData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 실시간 검증 함수 (useEffect보다 먼저 선언)
  const validateField = useCallback((fieldName: 'startPage' | 'endPage' | 'notes', value: string, currentFormData = formData) => {
    const selectedBook = books.find(b => b.id === currentFormData.bookId);
    
    // 디버깅: 책 정보 확인
    if (fieldName === 'endPage' && value && selectedBook) {
      const endPage = parseInt(value);
      console.log('검증 중:', {
        endPage,
        totalPages: selectedBook.totalPages,
        bookTitle: selectedBook.title,
        exceeds: endPage > selectedBook.totalPages
      });
    }
    
    setFieldErrors(prevErrors => {
      const errors = { ...prevErrors };

      if (fieldName === 'startPage') {
        const startPage = parseInt(value);
        if (!value) {
          delete errors.startPage;
        } else if (isNaN(startPage) || startPage < 1) {
          errors.startPage = '시작 페이지를 올바르게 입력해주세요.';
        } else if (selectedBook && startPage > selectedBook.totalPages) {
          errors.startPage = `총 페이지 수(${selectedBook.totalPages}페이지)를 초과할 수 없습니다.`;
        } else {
          delete errors.startPage;
        }
        
        // 마지막 페이지와의 관계도 확인
        if (currentFormData.endPage) {
          const endPage = parseInt(currentFormData.endPage);
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
        } else if (!selectedBook) {
          delete errors.endPage;
        } else if (endPage > selectedBook.totalPages) {
          errors.endPage = `값은 ${selectedBook.totalPages} 이하여야 합니다.`;
        } else if (currentFormData.startPage) {
          const startPage = parseInt(currentFormData.startPage);
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
  }, [books, formData]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

  // URL의 bookId 파라미터가 변경되면 폼 데이터 업데이트
  useEffect(() => {
    if (bookIdParam) {
      setFormData(prev => ({
        ...prev,
        bookId: bookIdParam,
      }));
    }
  }, [bookIdParam]);

  // 책이 변경되거나 페이지 값이 변경되면 검증 다시 실행
  useEffect(() => {
    if (formData.bookId && formData.startPage) {
      validateField('startPage', formData.startPage, formData);
    }
    if (formData.bookId && formData.endPage) {
      validateField('endPage', formData.endPage, formData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.bookId, formData.startPage, formData.endPage, books, validateField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSubmitting(true);

    // 필드 오류가 있으면 제출하지 않음
    if (Object.keys(fieldErrors).length > 0) {
      setSubmitting(false);
      setError('입력한 내용을 확인해주세요.');
      return;
    }

    try {
      const selectedBook = books.find(b => b.id === formData.bookId);
      if (!selectedBook) {
        setError('책을 선택해주세요.');
        setSubmitting(false);
        return;
      }

      const startPage = parseInt(formData.startPage);
      const endPage = parseInt(formData.endPage);
      
      if (isNaN(startPage) || startPage < 1) {
        setError('시작 페이지를 올바르게 입력해주세요.');
        setSubmitting(false);
        return;
      }
      
      if (isNaN(endPage) || endPage < 1) {
        setError('마지막 페이지를 올바르게 입력해주세요.');
        setSubmitting(false);
        return;
      }
      
      if (endPage < startPage) {
        setError('마지막 페이지는 시작 페이지보다 크거나 같아야 합니다.');
        setSubmitting(false);
        return;
      }
      
      if (startPage > selectedBook.totalPages || endPage > selectedBook.totalPages) {
        setError(`총 페이지 수(${selectedBook.totalPages}페이지)를 초과할 수 없습니다.`);
        setSubmitting(false);
        return;
      }

      // 오늘의 감상 필수 체크
      const notes = formData.notes.trim();
      if (!notes) {
        setError('오늘의 감상을 작성해주세요.');
        setSubmitting(false);
        return;
      }

      // 서버 API로 독서 기록 생성 (경험치/레벨/스트릭은 서버에서 계산)
      const result = await authedFetch<{
        expGained: number;
        oldLevel: number;
        newLevel: number;
        completed: boolean;
        newBadges: { name: string }[];
      }>('/api/reading-logs', {
        body: {
          bookId: formData.bookId,
          date: formData.date,
          startPage,
          endPage,
          notes,
        },
      });

      // 레벨업 알림
      if (result.newLevel > result.oldLevel) {
        alert(`🎉 레벨업! 레벨 ${result.oldLevel} → 레벨 ${result.newLevel}`);
      }

      // 뱃지 획득 알림
      if (result.newBadges.length === 1) {
        alert(`🎉 뱃지 획득: ${result.newBadges[0].name}!`);
      } else if (result.newBadges.length > 1) {
        alert(`🎉 ${result.newBadges.length}개의 뱃지를 획득했습니다!`);
      }

      // 폼 초기화
      setFormData({
        bookId: bookIdParam || '',
        date: new Date().toISOString().split('T')[0],
        startPage: '',
        endPage: '',
        notes: '',
      });

      // 데이터 새로고침
      await fetchData();

      // 완독 여부 확인 (서버 응답 사용)
      if (result.completed) {
        alert('🎉 완독을 축하합니다! 🎉\n\n독서 기록이 저장되었습니다.');
      } else {
        alert('독서 기록이 저장되었습니다!');
      }
    } catch (err: any) {
      setError(err.message || '독서 기록 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">독서 기록</h1>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>← 대시보드</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기록 입력 폼 */}
        <Card title="오늘의 독서 기록">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                책 선택 *
              </label>
              <select
                value={formData.bookId}
                onChange={(e) => setFormData({ ...formData, bookId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
                disabled={submitting}
              >
                <option value="">책을 선택하세요</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title} ({book.currentPage}/{book.totalPages} 페이지)
                  </option>
                ))}
              </select>
            </div>

            <Input
              type="date"
              label="날짜 *"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              disabled={submitting}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                label="시작 페이지 *"
                value={formData.startPage}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = { ...formData, startPage: newValue };
                  setFormData(updatedFormData);
                  validateField('startPage', newValue, updatedFormData);
                }}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = { ...formData, startPage: newValue };
                  validateField('startPage', newValue, updatedFormData);
                }}
                placeholder="예: 10"
                min="1"
                required
                disabled={submitting}
                error={fieldErrors.startPage}
              />
              <Input
                type="number"
                label="마지막 페이지 *"
                value={formData.endPage}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = { ...formData, endPage: newValue };
                  setFormData(updatedFormData);
                  validateField('endPage', newValue, updatedFormData);
                }}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = { ...formData, endPage: newValue };
                  validateField('endPage', newValue, updatedFormData);
                }}
                placeholder="예: 30"
                min="1"
                required
                disabled={submitting}
                error={fieldErrors.endPage}
              />
            </div>
            
            {formData.bookId && formData.startPage && formData.endPage && (() => {
              const selectedBook = books.find(b => b.id === formData.bookId);
              if (!selectedBook) return null;
              
              const start = parseInt(formData.startPage);
              const end = parseInt(formData.endPage);
              if (isNaN(start) || isNaN(end) || end < start) return null;
              
              const pagesRead = end - start + 1;
              return (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <span className="font-medium">읽은 페이지 수: {pagesRead}페이지</span>
                  {selectedBook.currentPage > 0 && (
                    <span className="ml-2 text-gray-500">
                      (현재까지: {selectedBook.currentPage}페이지)
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
                value={formData.notes}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = { ...formData, notes: newValue };
                  setFormData(updatedFormData);
                  validateField('notes', newValue, updatedFormData);
                }}
                onBlur={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = { ...formData, notes: newValue };
                  validateField('notes', newValue, updatedFormData);
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  fieldErrors.notes ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                }`}
                rows={4}
                placeholder="오늘 읽은 내용에 대한 감상을 작성해주세요..."
                required
                disabled={submitting}
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.notes}</p>
              )}
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || books.length === 0}
            >
              {submitting ? '저장 중...' : '기록 저장하기'}
            </Button>

            {books.length === 0 && (
              <p className="text-sm text-gray-500 text-center">
                읽고 있는 책이 없습니다.{' '}
                <a href="/books/new" className="text-primary-600 hover:underline">
                  책을 추가하세요
                </a>
              </p>
            )}
          </form>
        </Card>

        {/* 최근 기록 */}
        <Card title="최근 독서 기록">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              아직 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {logs.map((log) => {
                const book = books.find(b => b.id === log.bookId);
                const logDate = log.date;
                
                return (
                  <div
                    key={log.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="font-medium text-gray-900">
                          {book?.title || '알 수 없음'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDateKorean(logDate)}
                        </p>
                        {log.startPage && log.endPage ? (
                          <p className="text-xs text-gray-500 mt-1">
                            {log.startPage}페이지 ~ {log.endPage}페이지
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary-600">
                          +{log.pagesRead}페이지
                        </p>
                        <p className="text-xs text-gray-500">
                          +{log.expGained} EXP
                        </p>
                      </div>
                    </div>
                    {log.notes && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">오늘의 감상:</p>
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
    </div>
  );
}

export default function ReadingLogPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">로딩 중...</div>}>
      <ReadingLogContent />
    </Suspense>
  );
}

