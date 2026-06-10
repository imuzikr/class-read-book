import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import {
  applyLogToStreak,
  calculateLogExp,
  kstDayNumber,
  parseKstDate,
} from '@/lib/server/gamification';
import { checkAndAwardBadges } from '@/lib/server/badges';
import { getLevelFromExp } from '@/lib/utils/game';

/**
 * 독서 기록 생성 API
 * 경험치/레벨/스트릭 계산을 서버에서 수행하여 클라이언트 조작을 방지한다.
 * 로그 생성 + 책 진행률 + 사용자 통계를 하나의 트랜잭션으로 처리한다.
 */
export const dynamic = 'force-dynamic';

const MAX_NOTES_LENGTH = 2000;

export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireUser(request);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      throw new HttpError('요청 본문이 올바르지 않습니다.', 400);
    }

    const bookId = typeof body.bookId === 'string' ? body.bookId : '';
    const startPage = Number(body.startPage);
    const endPage = Number(body.endPage);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const logDate = parseKstDate(body.date);

    if (!bookId) {
      throw new HttpError('bookId가 필요합니다.', 400);
    }
    if (!logDate) {
      throw new HttpError('날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)', 400);
    }
    if (kstDayNumber(logDate) > kstDayNumber(new Date())) {
      throw new HttpError('미래 날짜에는 기록할 수 없습니다.', 400);
    }
    if (!Number.isInteger(startPage) || startPage < 1) {
      throw new HttpError('시작 페이지를 올바르게 입력해주세요.', 400);
    }
    if (!Number.isInteger(endPage) || endPage < startPage) {
      throw new HttpError('마지막 페이지는 시작 페이지보다 크거나 같아야 합니다.', 400);
    }
    if (!notes) {
      throw new HttpError('오늘의 감상을 입력해주세요.', 400);
    }
    if (notes.length > MAX_NOTES_LENGTH) {
      throw new HttpError(`감상은 ${MAX_NOTES_LENGTH}자 이내로 입력해주세요.`, 400);
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

      const book = bookSnap.data()!;
      const user = userSnap.data()!;

      if (book.userId !== uid) {
        throw new HttpError('본인의 책에만 기록할 수 있습니다.', 403);
      }

      const totalPages = Number(book.totalPages ?? 0);
      if (endPage > totalPages) {
        throw new HttpError(
          `마지막 페이지는 총 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`,
          400
        );
      }

      const pagesRead = endPage - startPage + 1;
      const lastReadingDate =
        user.lastReadingDate instanceof Timestamp ? user.lastReadingDate.toDate() : undefined;

      const streak = applyLogToStreak(logDate, {
        currentStreak: Number(user.currentStreak ?? 0),
        longestStreak: Number(user.longestStreak ?? 0),
        lastReadingDate,
      });

      // 보너스 포함 경험치를 로그에 저장하여 삭제 시 정확히 회수할 수 있게 한다
      const expGained = calculateLogExp(pagesRead, streak.currentStreak);
      const oldLevel = Number(user.level ?? 1);
      const newExp = Number(user.exp ?? 0) + expGained;
      const newLevel = getLevelFromExp(newExp);

      const newCurrentPage = Math.min(endPage, totalPages);
      const completed = newCurrentPage >= totalPages;
      const wasCompleted = book.status === 'completed';
      const isPublic = user.showTodayThought !== false;
      const now = Timestamp.now();

      const logRef = db.collection('readingLogs').doc();
      tx.set(logRef, {
        userId: uid,
        bookId,
        date: Timestamp.fromDate(logDate),
        startPage,
        endPage,
        pagesRead,
        notes,
        isPublic,
        expGained,
        createdAt: now,
      });

      const bookUpdates: Record<string, unknown> = {
        currentPage: newCurrentPage,
        status: completed ? 'completed' : 'reading',
        updatedAt: now,
      };
      if (completed && !wasCompleted) {
        bookUpdates.finishDate = now;
      }
      tx.update(bookRef, bookUpdates);

      const userUpdates: Record<string, unknown> = {
        exp: newExp,
        level: newLevel,
        totalPagesRead: Number(user.totalPagesRead ?? 0) + pagesRead,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastReadingDate: Timestamp.fromDate(streak.lastReadingDate),
        updatedAt: now,
      };
      if (completed && !wasCompleted) {
        userUpdates.totalBooksRead = Number(user.totalBooksRead ?? 0) + 1;
      }
      tx.update(userRef, userUpdates);

      return { logId: logRef.id, expGained, oldLevel, newLevel, completed };
    });

    const newBadges = await checkAndAwardBadges(uid);

    return NextResponse.json({ ...result, newBadges });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('독서 기록 생성 API 오류:', error);
    return NextResponse.json({ error: '독서 기록 저장에 실패했습니다.' }, { status: 500 });
  }
}
