import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { AdminAuthError, requireAdmin } from '@/lib/server/requireAdmin';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const adminDb = getAdminDb();

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? DEFAULT_LIMIT);
    const limitCount = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const [adminsSnap, usersSnap, booksSnap, readingLogsSnap, reviewsSnap] = await Promise.all([
      adminDb.collection('admins').get(),
      adminDb.collection('users').orderBy('createdAt', 'desc').limit(limitCount * 2).get(),
      adminDb.collection('books').orderBy('createdAt', 'desc').limit(limitCount * 3).get(),
      adminDb.collection('readingLogs').orderBy('createdAt', 'desc').limit(limitCount).get(),
      adminDb.collection('reviews').orderBy('createdAt', 'desc').limit(limitCount).get(),
    ]);

    const adminIds = new Set(adminsSnap.docs.map((doc) => doc.id));

    const users = usersSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email ?? '',
          name: data.name ?? '',
          displayName: data.displayName ?? data.name ?? '',
          photoURL: data.photoURL ?? '',
          level: data.level ?? 1,
          exp: data.exp ?? 0,
          totalPagesRead: data.totalPagesRead ?? 0,
          totalBooksRead: data.totalBooksRead ?? 0,
          currentStreak: data.currentStreak ?? 0,
          longestStreak: data.longestStreak ?? 0,
          lastReadingDate: toIsoString(data.lastReadingDate),
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
          isAnonymous: data.isAnonymous ?? false,
          nickname: data.nickname,
          useNickname: data.useNickname,
          showTodayThought: data.showTodayThought,
          character: data.character,
        };
      })
      .filter((user) => !adminIds.has(user.id))
      .slice(0, limitCount);

    const uniqueBooks = new Map<string, Record<string, unknown>>();

    for (const bookDoc of booksSnap.docs) {
      const data = bookDoc.data();
      const userId = String(data.userId ?? '');
      const title = String(data.title ?? '').trim();
      const author = String(data.author ?? '').trim();
      const key = `${userId}_${title.toLowerCase()}_${author.toLowerCase()}`;

      const current = {
        id: bookDoc.id,
        userId,
        title,
        author,
        totalPages: Number(data.totalPages ?? 0),
        currentPage: Number(data.currentPage ?? 0),
        startDate: toIsoString(data.startDate),
        finishDate: toIsoString(data.finishDate),
        status: data.status ?? 'reading',
        coverImage: data.coverImage ?? '',
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };

      const existing = uniqueBooks.get(key);
      if (!existing) {
        uniqueBooks.set(key, current);
        continue;
      }

      const currentTime = current.updatedAt ? new Date(String(current.updatedAt)).getTime() : 0;
      const existingTime = existing.updatedAt ? new Date(String(existing.updatedAt)).getTime() : 0;

      if (currentTime > existingTime) {
        uniqueBooks.set(key, current);
      }
    }

    const books = Array.from(uniqueBooks.values())
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(String(a.updatedAt)).getTime() : 0;
        const bTime = b.updatedAt ? new Date(String(b.updatedAt)).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limitCount);

    const totalPagesRead = users.reduce((sum, user) => sum + Number(user.totalPagesRead ?? 0), 0);

    return NextResponse.json({
      users,
      books,
      stats: {
        totalUsers: users.length,
        totalBooks: books.length,
        totalReadingLogs: readingLogsSnap.size,
        totalReviews: reviewsSnap.size,
        totalPagesRead,
      },
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('관리자 대시보드 API 오류:', error);
    return NextResponse.json(
      { error: '관리자 대시보드 데이터를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
