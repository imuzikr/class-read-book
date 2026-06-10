import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { getLevelFromExp } from '@/lib/utils/game';

/**
 * 독서 기록 삭제 API
 * 경험치/통계 롤백을 서버 트랜잭션으로 처리한다.
 */
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { logId: string } }
) {
  try {
    const { uid } = await requireUser(request);
    const { logId } = params;

    if (!logId) {
      throw new HttpError('logId가 필요합니다.', 400);
    }

    const db = getAdminDb();
    await db.runTransaction(async (tx) => {
      const logRef = db.collection('readingLogs').doc(logId);
      const logSnap = await tx.get(logRef);

      if (!logSnap.exists) {
        throw new HttpError('독서 기록을 찾을 수 없습니다.', 404);
      }

      const log = logSnap.data()!;
      if (log.userId !== uid) {
        throw new HttpError('본인의 기록만 삭제할 수 있습니다.', 403);
      }

      const userRef = db.collection('users').doc(uid);
      const userSnap = await tx.get(userRef);

      const bookId = typeof log.bookId === 'string' && log.bookId ? log.bookId : null;
      const bookSnap = bookId ? await tx.get(db.collection('books').doc(bookId)) : null;

      const now = Timestamp.now();

      if (userSnap.exists) {
        const user = userSnap.data()!;
        const newExp = Math.max(0, Number(user.exp ?? 0) - Number(log.expGained ?? 0));
        const userUpdates: Record<string, unknown> = {
          exp: newExp,
          level: getLevelFromExp(newExp),
          totalPagesRead: Math.max(
            0,
            Number(user.totalPagesRead ?? 0) - Number(log.pagesRead ?? 0)
          ),
          updatedAt: now,
        };

        // 이 기록이 책의 최신 진행 상태였다면 진행률을 되돌린다
        if (bookSnap && bookSnap.exists) {
          const book = bookSnap.data()!;
          if (log.endPage && log.endPage === book.currentPage) {
            const bookUpdates: Record<string, unknown> = {
              currentPage: Math.max(0, Number(log.startPage ?? 1) - 1),
              updatedAt: now,
            };
            if (book.status === 'completed') {
              bookUpdates.status = 'reading';
              bookUpdates.finishDate = null;
              userUpdates.totalBooksRead = Math.max(0, Number(user.totalBooksRead ?? 0) - 1);
            }
            tx.update(bookSnap.ref, bookUpdates);
          }
        }

        tx.update(userRef, userUpdates);
      }

      tx.delete(logRef);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('독서 기록 삭제 API 오류:', error);
    return NextResponse.json({ error: '독서 기록 삭제에 실패했습니다.' }, { status: 500 });
  }
}
