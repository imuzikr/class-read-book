'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getReviews, deleteReview } from '@/lib/firebase/firestore';
import { type Review, type Book } from '@/types';
import { getBook } from '@/lib/firebase/firestore';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Link from 'next/link';

export default function ReviewsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<(Review & { book?: Book })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    if (!user) return;

    try {
      const reviewsData = await getReviews(user.uid);
      
      // 각 감상문에 책 정보 추가
      const reviewsWithBooks = await Promise.all(
        reviewsData.map(async (review) => {
          try {
            const book = await getBook(review.bookId);
            return { ...review, book: book || undefined };
          } catch {
            return { ...review, book: undefined };
          }
        })
      );

      setReviews(reviewsWithBooks as (Review & { book?: Book })[]);
    } catch (error) {
      console.error('감상문 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchReviews();
    }
  }, [user, authLoading, router, fetchReviews]);

  const handleDelete = async (reviewId: string) => {
    if (!confirm('정말 이 감상문을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteReview(reviewId);
      setReviews(reviews.filter(review => review.id !== reviewId));
    } catch (error) {
      console.error('감상문 삭제 실패:', error);
      alert('감상문 삭제에 실패했습니다.');
    }
  };

const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR');
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
          >
            ★
          </span>
        ))}
      </div>
    );
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
        <h1 className="text-3xl font-bold">내 감상문</h1>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">작성한 감상문이 없습니다.</p>
            <Link href="/books">
              <Button>책 목록 보기</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Link
                      href={`/books/${review.bookId}`}
                      className="text-xl font-semibold text-primary-600 hover:underline"
                    >
                      {review.book?.title || '알 수 없는 책'}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      {review.book?.author || ''}
                    </p>
                  </div>
                  <div className="text-right">
                    {renderStars(review.rating)}
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {review.content}
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <Link href={`/reviews/${review.id}/edit`}>
                    <Button variant="outline" size="sm">수정</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(review.id!)}
                    className="text-red-600 hover:text-red-700"
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

