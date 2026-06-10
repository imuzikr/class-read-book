'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getBook } from '@/lib/firebase/firestore';
import { type Book } from '@/types';
import { authedFetch } from '@/lib/utils/apiClient';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

function NewReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookIdParam = searchParams.get('bookId');
  const { user, loading: authLoading } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    content: '',
    rating: '5',
  });

  const fetchBook = useCallback(async () => {
    if (!bookIdParam) return;

    try {
      const bookData = await getBook(bookIdParam);
      if (!bookData) {
        router.push('/books');
        return;
      }

      if (bookData.userId !== user?.uid) {
        router.push('/books');
        return;
      }

      setBook(bookData);
    } catch (error) {
      console.error('책 정보 로드 실패:', error);
      router.push('/books');
    } finally {
      setLoading(false);
    }
  }, [bookIdParam, user, router]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }

      if (bookIdParam) {
        fetchBook();
      } else {
        router.push('/books');
      }
    }
  }, [user, authLoading, router, bookIdParam, fetchBook]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bookIdParam) return;

    setError('');
    setSubmitting(true);

    try {
      if (!formData.content.trim()) {
        setError('감상문 내용을 입력해주세요.');
        return;
      }

      const rating = parseInt(formData.rating);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        setError('별점을 선택해주세요.');
        return;
      }

      // 서버 API로 감상문 생성 (보너스 경험치는 서버에서 반영)
      const result = await authedFetch<{
        oldLevel: number;
        newLevel: number;
        newBadges: { name: string }[];
      }>('/api/reviews', {
        body: {
          bookId: bookIdParam,
          content: formData.content.trim(),
          rating,
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

      router.push(`/books/${bookIdParam}`);
    } catch (err: any) {
      setError(err.message || '감상문 작성에 실패했습니다.');
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

  if (!book) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">감상문 작성</h1>

      <Card>
        <div className="mb-6 pb-4 border-b">
          <h2 className="text-xl font-semibold">{book.title}</h2>
          <p className="text-gray-600">{book.author}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              별점 *
            </label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star.toString() })}
                  className={`text-3xl transition-transform hover:scale-110 ${
                    parseInt(formData.rating) >= star
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              선택된 별점: {formData.rating}점
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              감상문 내용 *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={10}
              placeholder="이 책을 읽고 느낀 점, 인상 깊었던 부분, 추천하고 싶은 이유 등을 자유롭게 작성해주세요..."
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? '작성 중...' : '감상문 저장하기'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
            >
              취소
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">로딩 중...</div>}>
      <NewReviewContent />
    </Suspense>
  );
}
