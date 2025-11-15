'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getReview, updateReview, getBook, type Review, type Book } from '@/lib/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function EditReviewPage() {
  const router = useRouter();
  const params = useParams();
  const reviewId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [review, setReview] = useState<Review | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    content: '',
    rating: '5',
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchReview();
    }
  }, [user, authLoading, router, reviewId]);

  const fetchReview = async () => {
    try {
      const reviewData = await getReview(reviewId);
      if (!reviewData) {
        router.push('/reviews');
        return;
      }

      if (reviewData.userId !== user?.uid) {
        router.push('/reviews');
        return;
      }

      setReview(reviewData);
      setFormData({
        content: reviewData.content,
        rating: reviewData.rating.toString(),
      });

      // 책 정보도 가져오기
      try {
        const bookData = await getBook(reviewData.bookId);
        setBook(bookData);
      } catch {
        // 책 정보를 가져올 수 없어도 계속 진행
      }
    } catch (error) {
      console.error('감상문 정보 로드 실패:', error);
      router.push('/reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!review) return;

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

      await updateReview(reviewId, {
        content: formData.content.trim(),
        rating,
        updatedAt: Timestamp.now(),
      });

      router.push(`/books/${review.bookId}`);
    } catch (err: any) {
      setError(err.message || '감상문 수정에 실패했습니다.');
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

  if (!review) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">감상문 수정</h1>

      <Card>
        {book && (
          <div className="mb-6 pb-4 border-b">
            <h2 className="text-xl font-semibold">{book.title}</h2>
            <p className="text-gray-600">{book.author}</p>
          </div>
        )}

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
              {submitting ? '수정 중...' : '수정 완료'}
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

