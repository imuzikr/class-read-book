import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { AdminAuthError, requireAdmin } from '@/lib/server/requireAdmin';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function getLimit(request: NextRequest): number {
  const raw = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 1), MAX_LIMIT);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireAdmin(request);
    const adminDb = getAdminDb();
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    const limitCount = getLimit(request);
    const bookId = request.nextUrl.searchParams.get('bookId');

    const booksQuery = adminDb
      .collection('books')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount);
    const booksSnap = await booksQuery.get();

    const logsQueryBase = adminDb.collection('readingLogs').where('userId', '==', userId);
    const logsQuery = bookId
      ? logsQueryBase
          .where('bookId', '==', bookId)
          .orderBy('date', 'desc')
          .limit(limitCount)
      : logsQueryBase.orderBy('date', 'desc').limit(limitCount);
    const logsSnap = await logsQuery.get();

    const books = booksSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId ?? '',
        title: data.title ?? '',
        author: data.author ?? '',
        totalPages: data.totalPages ?? 0,
        currentPage: data.currentPage ?? 0,
        startDate: toIsoString(data.startDate),
        finishDate: toIsoString(data.finishDate),
        status: data.status ?? 'reading',
        coverImage: data.coverImage ?? '',
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    });

    const logs = logsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId ?? '',
        bookId: data.bookId ?? '',
        date: toIsoString(data.date),
        pagesRead: data.pagesRead ?? 0,
        startPage: data.startPage,
        endPage: data.endPage,
        notes: data.notes ?? '',
        isPublic: data.isPublic,
        expGained: data.expGained ?? 0,
        createdAt: toIsoString(data.createdAt),
      };
    });

    return NextResponse.json({ books, logs });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('관리자 사용자 상세 API 오류:', error);
    return NextResponse.json(
      { error: '사용자 상세 데이터를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin(request);
    const adminDb = getAdminDb();
    const { userId } = params;

    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    if (admin.uid === userId) {
      return NextResponse.json({ error: '본인 계정은 관리자 API로 삭제할 수 없습니다.' }, { status: 400 });
    }

    const booksQuery = adminDb.collection('books').where('userId', '==', userId);
    const logsQuery = adminDb.collection('readingLogs').where('userId', '==', userId);
    const reviewsQuery = adminDb.collection('reviews').where('userId', '==', userId);
    const badgesQuery = adminDb.collection('userBadges').where('userId', '==', userId);

    const [booksSnap, logsSnap, reviewsSnap, badgesSnap] = await Promise.all([
      booksQuery.get(),
      logsQuery.get(),
      reviewsQuery.get(),
      badgesQuery.get(),
    ]);

    const batch = adminDb.batch();
    booksSnap.docs.forEach((doc) => batch.delete(doc.ref));
    logsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    reviewsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    badgesSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(adminDb.collection('users').doc(userId));

    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('관리자 사용자 삭제 API 오류:', error);
    return NextResponse.json({ error: '사용자 삭제에 실패했습니다.' }, { status: 500 });
  }
}
