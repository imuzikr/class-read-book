import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { REVIEW_EXP_REWARD } from '@/lib/server/gamification';
import { checkAndAwardBadges } from '@/lib/server/badges';
import { getLevelFromExp } from '@/lib/utils/game';

/**
 * 감상문 작성 API
 * 감상문 생성과 보너스 경험치(+70) 반영을 서버에서 처리한다.
 */
export const dynamic = 'force-dynamic';

const MAX_CONTENT_LENGTH = 5000;

export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireUser(request);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new HttpError('요청 본문이 올바르지 않습니다.', 400);
    }

    const bookId = typeof body.bookId === 'string' ? body.bookId : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const rating = Number(body.rating);

    if (!bookId) {
      throw new HttpError('bookId가 필요합니다.', 400);
    }
    if (!content) {
      throw new HttpError('감상문 내용을 입력해주세요.', 400);
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new HttpError(`감상문은 ${MAX_CONTENT_LENGTH}자 이내로 입력해주세요.`, 400);
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new HttpError('별점은 1~5 사이로 선택해주세요.', 400);
    }

    const db = getAdminDb();
    const result = await db.runTransaction(async (tx) => {
      const bookRef = db.collection('books').doc(bookId);
      const userRef = db.collection('users').doc(uid);
      const [bookSnap, userSnap] = await Promise.all([tx.get(bookRef), tx.get(userRef)]);

      if (!bookSnap.exists) {
        throw new HttpError('책을 찾을 수 없습니다.', 404);
      }
      if (!userSnap.exists) {
        throw new HttpError('사용자 정보를 찾을 수 없습니다.', 404);
      }
      if (bookSnap.data()!.userId !== uid) {
        throw new HttpError('본인의 책에만 감상문을 쓸 수 있습니다.', 403);
      }

      const user = userSnap.data()!;
      const oldLevel = Number(user.level ?? 1);
      const newExp = Number(user.exp ?? 0) + REVIEW_EXP_REWARD;
      const newLevel = getLevelFromExp(newExp);
      const now = Timestamp.now();

      const reviewRef = db.collection('reviews').doc();
      tx.set(reviewRef, {
        userId: uid,
        bookId,
        content,
        rating,
        createdAt: now,
        updatedAt: now,
      });

      tx.update(userRef, {
        exp: newExp,
        level: newLevel,
        updatedAt: now,
      });

      return { reviewId: reviewRef.id, oldLevel, newLevel };
    });

    const newBadges = await checkAndAwardBadges(uid);

    return NextResponse.json({ ...result, newBadges });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('감상문 작성 API 오류:', error);
    return NextResponse.json({ error: '감상문 작성에 실패했습니다.' }, { status: 500 });
  }
}
